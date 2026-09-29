import { createServer, type Server } from 'node:http'
import { createConnection } from 'node:net'
import type {
  LocalProviderRecord,
  LocalProviderUpstreamFormat
} from '../../shared/local-provider-types'
import type { ProviderResolver, ProxyProvider } from './llm-proxy-provider-resolver'
import { handleLlmProxyRequest } from './llm-proxy-request-handler'

export { handleLlmProxyRequest } from './llm-proxy-request-handler'
export { createStoreProviderResolver } from './llm-proxy-provider-resolver'
export type { ProviderResolver, ProxyProvider } from './llm-proxy-provider-resolver'

const LLM_PROXY_HOST = '127.0.0.1'
export const LLM_PROXY_PORT = 8787

let runningServer: Server | null = null
let startingServer: Promise<Server> | null = null
let activeProviderResolver: ProviderResolver = () => null

export function setLlmProxyProviderResolver(resolver: ProviderResolver): void {
  activeProviderResolver = resolver
}

export function resolveLlmProxyProvider(
  type: LocalProviderRecord['type'],
  format?: LocalProviderUpstreamFormat,
  gatewayPrefix?: string
): ProxyProvider | null {
  return activeProviderResolver(type, format, gatewayPrefix)
}

export function createLlmProxyServer(
  baseUrl: string | undefined,
  resolveProvider: ProviderResolver = () => null
): Server {
  return createServer((request, response) => {
    void handleLlmProxyRequest(request, response, baseUrl, resolveProvider)
  })
}

export async function waitForLlmProxyReady(
  baseUrl: string,
  timeoutMs = 15_000,
  pollMs = 100
): Promise<void> {
  const target = new URL(baseUrl)
  const deadline = Date.now() + timeoutMs
  let lastError: unknown
  while (Date.now() < deadline) {
    try {
      await new Promise<void>((resolve, reject) => {
        const socket = createConnection({ host: target.hostname, port: Number(target.port) || 80 })
        const finish = (error?: Error): void => {
          socket.destroy()
          if (error) {
            reject(error)
          } else {
            resolve()
          }
        }
        socket.once('connect', () => finish())
        socket.once('error', finish)
      })
      return
    } catch (error) {
      lastError = error
      await new Promise((resolve) => setTimeout(resolve, pollMs))
    }
  }
  throw new Error(
    `Local LLM proxy did not become ready at ${target.origin}${lastError instanceof Error ? `: ${lastError.message}` : ''}`
  )
}

export function isLlmProxyUrl(value: string | undefined): boolean {
  if (!value) {
    return false
  }
  try {
    const url = new URL(value)
    return url.hostname === LLM_PROXY_HOST && (Number(url.port) || 80) === LLM_PROXY_PORT
  } catch {
    return false
  }
}

export async function startLlmProxyServer(
  port = LLM_PROXY_PORT,
  baseUrl: string | undefined = undefined,
  resolveProvider: ProviderResolver = resolveLlmProxyProvider
): Promise<Server> {
  if (runningServer) {
    return runningServer
  }
  if (startingServer) {
    return startingServer
  }
  const server = createLlmProxyServer(baseUrl, resolveProvider)
  startingServer = new Promise<void>((resolve, reject) => {
    const onError = (error: Error): void => {
      server.off('listening', onListening)
      reject(error)
    }
    const onListening = (): void => {
      server.off('error', onError)
      resolve()
    }
    server.once('error', onError)
    server.once('listening', onListening)
    server.listen(port, LLM_PROXY_HOST)
  }).then(
    () => {
      runningServer = server
      startingServer = null
      return server
    },
    (error: unknown) => {
      startingServer = null
      throw error
    }
  )
  return startingServer
}

export async function stopLlmProxyServer(): Promise<void> {
  let server = runningServer
  runningServer = null
  const starting = startingServer
  startingServer = null
  if (starting) {
    server = await starting.catch(() => null)
  }
  if (!server || !server.listening) {
    return
  }
  await new Promise<void>((resolve) => server.close(() => resolve()))
}
