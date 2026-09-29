import type { IncomingMessage, ServerResponse } from 'node:http'
import type {
  LocalProviderRecord,
  LocalProviderUpstreamFormat
} from '../../shared/local-provider-types'
import type { ProviderResolver, ProxyProvider } from './llm-proxy-provider-resolver'
import { modelRouteForPath, writeModelResponse } from './llm-proxy-model-discovery'

const LLM_PROXY_HOST = '127.0.0.1'

const ROUTES = new Map([
  ['/chat/completions', '/chat/completions'],
  ['/v1/chat/completions', '/chat/completions'],
  ['/response', '/response'],
  ['/v1/response', '/response'],
  ['/responses', '/responses'],
  ['/v1/responses', '/responses'],
  ['/messages', '/messages'],
  ['/v1/messages', '/messages']
])

const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'content-length',
  'host',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade'
])

function requestHeaders(request: IncomingMessage, provider: ProxyProvider): Headers {
  const headers = new Headers()
  for (const [name, value] of Object.entries(request.headers)) {
    if (HOP_BY_HOP_HEADERS.has(name)) {
      continue
    }
    if (Array.isArray(value)) {
      headers.set(name, value.join(', '))
      continue
    }
    if (typeof value === 'string') {
      headers.set(name, value)
    }
  }
  headers.delete('authorization')
  headers.delete('x-api-key')
  if (provider.type === 'claude-code') {
    headers.set('x-api-key', provider.apiKey)
    headers.set('authorization', `Bearer ${provider.apiKey}`)
    headers.set('anthropic-version', '2023-06-01')
  } else {
    headers.set('authorization', `Bearer ${provider.apiKey}`)
  }
  return headers
}

function providerTypeForPath(pathname: string): LocalProviderRecord['type'] {
  return pathname.endsWith('/messages') ? 'claude-code' : 'codex'
}

function providerFormatForPath(pathname: string): LocalProviderUpstreamFormat {
  if (pathname.endsWith('/messages')) {
    return 'anthropic'
  }
  if (pathname.endsWith('/responses') || pathname.endsWith('/response')) {
    return 'responses'
  }
  return 'openai'
}

function gatewayPrefixForPath(pathname: string): string | undefined {
  const match = pathname.match(
    /^\/(?:v1\/)?([A-Za-z0-9-]+)\/(?:chat\/completions|responses?|messages)$/
  )
  return match?.[1]
}

function upstreamUrl(baseUrl: string, provider: ProxyProvider, path: string): string {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, '')
  if (provider.type === 'claude-code' && path === '/messages') {
    try {
      const parsed = new URL(normalizedBaseUrl)
      if (!parsed.pathname.endsWith('/v1')) {
        parsed.pathname = `${parsed.pathname.replace(/\/$/, '')}/v1`
        return `${parsed.toString().replace(/\/$/, '')}${path}`
      }
    } catch {
      // Let fetch report an invalid configured URL.
    }
  }
  return `${normalizedBaseUrl}${path}`
}

async function requestBodyWithProvider(
  request: IncomingMessage,
  provider: ProxyProvider
): Promise<string> {
  const body = await readRequestBody(request)
  let payload: unknown
  try {
    payload = JSON.parse(body.toString('utf8'))
  } catch {
    throw new Error('Request body must be valid JSON')
  }
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    throw new Error('Request body must be a JSON object')
  }
  const requestPayload = Object.fromEntries(Object.entries(payload))
  const requestedModel = typeof requestPayload.model === 'string' ? requestPayload.model : undefined
  const model =
    provider.type !== 'claude-code'
      ? provider.model
      : requestedModel?.toLowerCase().includes('haiku')
        ? (provider.haikuModel ?? provider.model)
        : requestedModel?.toLowerCase().includes('sonnet')
          ? (provider.sonnetModel ?? provider.model)
          : requestedModel?.toLowerCase().includes('opus') ||
              requestedModel?.toLowerCase().includes('fable')
            ? (provider.opusModel ?? provider.model)
            : provider.model
  return model ? JSON.stringify({ ...requestPayload, model }) : body.toString('utf8')
}

async function readRequestBody(request: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}

function writeUpstreamError(response: ServerResponse, error: unknown): void {
  if (response.headersSent) {
    response.destroy()
    return
  }
  response.writeHead(502, { 'content-type': 'application/json' })
  response.end(
    JSON.stringify({
      error: {
        message: error instanceof Error ? error.message : String(error),
        type: 'llm_proxy_error'
      }
    })
  )
}

function maskApiKey(apiKey: string): string {
  if (apiKey.length <= 8) {
    return '********'
  }
  return `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`
}

export async function handleLlmProxyRequest(
  request: IncomingMessage,
  response: ServerResponse,
  baseUrl: string | undefined,
  resolveProvider: ProviderResolver = () => null
): Promise<void> {
  const requestUrl = new URL(request.url ?? '/', `http://${LLM_PROXY_HOST}`)
  const pathname = requestUrl.pathname
  const modelRoute = modelRouteForPath(pathname)
  if (request.method === 'GET' && modelRoute) {
    const provider = resolveProvider('claude-code', 'anthropic', modelRoute.gatewayPrefix)
    if (!provider) {
      response.writeHead(400, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ error: { message: 'No enabled local provider configured' } }))
      return
    }
    writeModelResponse(response, provider, modelRoute.model)
    return
  }
  if (request.method !== 'POST') {
    response.writeHead(405, { allow: 'POST' })
    response.end()
    return
  }

  const gatewayPrefix = gatewayPrefixForPath(pathname)
  const routePath = gatewayPrefix ? pathname.replace(`/${gatewayPrefix}`, '') : pathname
  const upstreamPath = ROUTES.get(routePath)
  if (!upstreamPath) {
    response.writeHead(404)
    response.end()
    return
  }

  const provider = resolveProvider(
    providerTypeForPath(routePath),
    providerFormatForPath(routePath),
    gatewayPrefix
  )
  if (!provider) {
    response.writeHead(400, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ error: { message: 'No enabled local provider configured' } }))
    return
  }
  if (!provider.baseUrl && !baseUrl) {
    response.writeHead(400, { 'content-type': 'application/json' })
    response.end(
      JSON.stringify({
        error: { message: 'Enabled local provider has no base URL configured' }
      })
    )
    return
  }

  const abortController = new AbortController()
  const abortUpstream = (): void => abortController.abort()
  request.once('aborted', abortUpstream)
  response.once('close', abortUpstream)

  try {
    const targetUrl = upstreamUrl(provider.baseUrl ?? baseUrl!, provider, upstreamPath)
    console.log('[llm-proxy] request', {
      method: request.method,
      clientPath: pathname,
      gatewayPrefix: gatewayPrefix ?? null,
      upstreamUrl: targetUrl,
      model: provider.model ?? null,
      apiKey: maskApiKey(provider.apiKey)
    })
    const upstream = await fetch(targetUrl, {
      method: 'POST',
      headers: requestHeaders(request, provider),
      body: await requestBodyWithProvider(request, provider),
      signal: abortController.signal
    })
    console.log('[llm-proxy] upstream response', {
      upstreamUrl: targetUrl,
      status: upstream.status,
      contentType: upstream.headers.get('content-type')
    })

    const responseHeaders: Record<string, string> = {}
    for (const [name, value] of upstream.headers) {
      if (HOP_BY_HOP_HEADERS.has(name)) {
        continue
      }
      responseHeaders[name] = value
    }
    response.writeHead(upstream.status, responseHeaders)

    if (!upstream.body) {
      response.end()
      return
    }
    const reader = upstream.body.getReader()
    try {
      while (true) {
        const chunk = await reader.read()
        if (chunk.done) {
          break
        }
        response.write(Buffer.from(chunk.value))
      }
      response.end()
    } finally {
      reader.releaseLock()
    }
  } catch (error) {
    console.error('[llm-proxy] upstream request failed', {
      clientPath: pathname,
      gatewayPrefix: gatewayPrefix ?? null,
      error: error instanceof Error ? error.message : String(error)
    })
    if (!abortController.signal.aborted) {
      if (error instanceof Error && error.message.startsWith('Request body must be')) {
        response.writeHead(400, { 'content-type': 'application/json' })
        response.end(JSON.stringify({ error: { message: error.message } }))
      } else {
        writeUpstreamError(response, error)
      }
    }
  } finally {
    request.off('aborted', abortUpstream)
    response.off('close', abortUpstream)
  }
}
