import type {
  LocalProviderRecord,
  LocalProviderUpstreamFormat
} from '../../shared/local-provider-types'

export type ClaudeCodeEnvironment = Record<string, string>

const AUTH_FIELDS = new Set(['ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_API_KEY'])

function nonEmpty(value: string | undefined): string | undefined {
  const normalized = value?.trim()
  return normalized ? normalized : undefined
}

function modelFields(provider: LocalProviderRecord): Record<string, string> {
  const fields = provider.fields ?? {}
  const claudeModels = fields.claudeModels
  const mapped = fields.modelMappings ?? {}
  const mappedFor = (role: string): string | undefined => {
    const entry = Object.entries(mapped).find(([alias]) => alias.toLowerCase().includes(role))
    return entry?.[1]
  }
  const model = nonEmpty(
    fields.model ??
      mappedFor('default') ??
      (fields.fallbackModel && !mappedFor('default') ? fields.fallbackModel : undefined)
  )
  const fallbackModel = nonEmpty(fields.fallbackModel ?? mappedFor('fallback'))
  const haikuModel = nonEmpty(fields.haikuModel ?? claudeModels?.haikuModel ?? mappedFor('haiku'))
  const sonnetModel = nonEmpty(
    fields.sonnetModel ?? claudeModels?.sonnetModel ?? mappedFor('sonnet')
  )
  const opusModel = nonEmpty(fields.opusModel ?? claudeModels?.opusModel ?? mappedFor('opus'))
  const subagentModel = nonEmpty(
    fields.subagentModel ?? claudeModels?.subagentModel ?? mappedFor('subagent')
  )
  return {
    ...(model ? { ANTHROPIC_MODEL: model } : {}),
    ...(fallbackModel && fallbackModel !== model
      ? { ANTHROPIC_DEFAULT_FALLBACK_MODEL: fallbackModel }
      : {}),
    ...(haikuModel ? { ANTHROPIC_DEFAULT_HAIKU_MODEL: haikuModel } : {}),
    ...(sonnetModel ? { ANTHROPIC_DEFAULT_SONNET_MODEL: sonnetModel } : {}),
    ...(opusModel ? { ANTHROPIC_DEFAULT_OPUS_MODEL: opusModel } : {}),
    ...(subagentModel ? { CLAUDE_CODE_SUBAGENT_MODEL: subagentModel } : {})
  }
}

function upstreamFormatValue(format: LocalProviderUpstreamFormat | undefined): string | undefined {
  if (!format || format === 'auto') {
    return undefined
  }
  return format
}

export function buildClaudeCodeEnvironment(provider: LocalProviderRecord): ClaudeCodeEnvironment {
  const fields = provider.fields ?? {}
  const baseUrl = nonEmpty(fields.baseUrl)
  const authField = AUTH_FIELDS.has(fields.authField ?? '')
    ? (fields.authField ?? 'ANTHROPIC_AUTH_TOKEN')
    : 'ANTHROPIC_AUTH_TOKEN'
  const mappedModels = fields.modelMappings ? JSON.stringify(fields.modelMappings) : undefined
  const legacyModel = nonEmpty(provider.env.ANTHROPIC_MODEL)
  return {
    ...provider.env,
    ...(baseUrl ? { ANTHROPIC_BASE_URL: baseUrl } : {}),
    ...(provider.secret === null ? {} : { [authField]: provider.secret }),
    ...modelFields(provider),
    ...(legacyModel && !fields.model && !fields.fallbackModel
      ? { ANTHROPIC_MODEL: legacyModel }
      : {}),
    ...(mappedModels ? { ORCA_LOCAL_PROVIDER_MODEL_MAPPINGS: mappedModels } : {}),
    ...(upstreamFormatValue(fields.upstreamFormat)
      ? { ORCA_LOCAL_PROVIDER_UPSTREAM_FORMAT: upstreamFormatValue(fields.upstreamFormat)! }
      : {})
  }
}

export function mergeClaudeSettingsJson(
  content: string | null,
  environment: ClaudeCodeEnvironment
): string {
  const parsed: unknown = content === null ? {} : JSON.parse(content.replace(/^﻿/, ''))
  if (!isRecord(parsed)) {
    throw new Error('Claude settings.json must contain a JSON object')
  }
  const existingEnvironment = parsed.env
  if (existingEnvironment !== undefined && !isRecord(existingEnvironment)) {
    throw new Error('Claude settings.json env must be a JSON object')
  }
  const nonEmptyEnvironment = Object.fromEntries(
    Object.entries(environment).filter(([, value]) => value.length > 0)
  )
  if (Object.keys(nonEmptyEnvironment).length === 0) {
    return content ?? '{}\n'
  }
  return `${JSON.stringify(
    {
      ...parsed,
      env: { ...(isRecord(existingEnvironment) ? existingEnvironment : {}), ...nonEmptyEnvironment }
    },
    null,
    2
  )}\n`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
