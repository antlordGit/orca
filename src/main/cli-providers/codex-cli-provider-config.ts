import type { LocalProviderRecord } from '../../shared/local-provider-types'

export type CodexTomlUpdates = Record<string, string | boolean>

export type CodexProviderEnvironment = Record<string, string>

export function buildCodexProviderEnvironment(
  provider: LocalProviderRecord
): CodexProviderEnvironment {
  const fields = provider.fields
  return {
    ...provider.env,
    ...(fields?.baseUrl ? { OPENAI_BASE_URL: fields.baseUrl } : {}),
    ...(provider.secret === null ? {} : { CODEX_API_KEY: provider.secret }),
    ...(fields?.model ? { OPENAI_MODEL: fields.model } : {}),
    ...(fields?.modelProvider ? { OPENAI_MODEL_PROVIDER: fields.modelProvider } : {}),
    ...(fields?.reasoningEffort ? { CODEX_REASONING_EFFORT: fields.reasoningEffort } : {}),
    ...(fields?.fastMode === undefined ? {} : { CODEX_FAST_MODE: String(fields.fastMode) }),
    ...(fields?.upstreamFormat && fields.upstreamFormat !== 'auto'
      ? { ORCA_LOCAL_PROVIDER_UPSTREAM_FORMAT: fields.upstreamFormat }
      : {})
  }
}

function quoted(value: string): string {
  return quoteTomlString(value)
}

export function buildCodexTomlUpdates(provider: LocalProviderRecord): CodexTomlUpdates {
  const fields = provider.fields
  const model = fields?.model ?? provider.env.OPENAI_MODEL
  const modelProvider = fields?.modelProvider ?? provider.env.OPENAI_MODEL_PROVIDER
  const reasoningEffort = fields?.reasoningEffort ?? provider.env.CODEX_REASONING_EFFORT
  const fastMode =
    fields?.fastMode === undefined
      ? provider.env.CODEX_FAST_MODE === undefined
        ? undefined
        : provider.env.CODEX_FAST_MODE === 'true'
      : fields.fastMode
  const updates: CodexTomlUpdates = {
    ...(model ? { model: quoted(model) } : {}),
    ...(modelProvider ? { model_provider: quoted(modelProvider) } : {}),
    ...(reasoningEffort ? { model_reasoning_effort: quoted(reasoningEffort) } : {}),
    ...(fastMode === undefined ? {} : { fast_mode: fastMode }),
    ...(fields?.baseUrl ? { ORCA_LOCAL_PROVIDER_BASE_URL: quoted(fields.baseUrl) } : {})
  }
  return updates
}

export function quoteTomlString(value: string): string {
  return `"${value
    .replaceAll('\\', '\\\\')
    .replaceAll('"', '\\"')
    .replaceAll('\b', '\\b')
    .replaceAll('\f', '\\f')
    .replaceAll('\n', '\\n')
    .replaceAll('\r', '\\r')
    .replaceAll('\t', '\\t')}"`
}
