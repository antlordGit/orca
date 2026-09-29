import type { ServerResponse } from 'node:http'
import type { ProxyProvider } from './llm-proxy-provider-resolver'

const CLAUDE_DEFAULT_MODEL = 'claude-haiku-4-5'

function claudeModel(model: string) {
  return {
    type: 'model',
    id: model,
    display_name: model,
    created_at: '2025-01-01T00:00:00Z'
  }
}

export function modelRouteForPath(
  pathname: string
): { gatewayPrefix?: string; model?: string } | null {
  const match = pathname.match(/^\/(?:v1\/)?(?:(?:([A-Za-z0-9-]+)\/)?models)(?:\/([^/]+))?$/)
  if (!match) {
    return null
  }
  return { gatewayPrefix: match[1], model: match[2] ? decodeURIComponent(match[2]) : undefined }
}

export function writeModelResponse(
  response: ServerResponse,
  provider: ProxyProvider,
  requestedModel?: string
): void {
  const model =
    requestedModel ??
    (provider.type === 'claude-code' ? CLAUDE_DEFAULT_MODEL : (provider.model ?? 'default'))
  response.writeHead(200, { 'content-type': 'application/json' })
  response.end(
    provider.type === 'claude-code'
      ? JSON.stringify({ object: 'list', data: [claudeModel(model)], has_more: false })
      : JSON.stringify({
          object: 'list',
          data: [{ id: model, object: 'model', owned_by: 'orca-llm-proxy' }]
        })
  )
}
