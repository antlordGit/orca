import type {
  LocalProviderClaudeModels,
  LocalProviderEnvironment,
  LocalProviderFields,
  LocalProviderRecord,
  LocalProviderSettings,
  LocalProviderUpstreamFormat
} from './local-provider-types'

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizedString(value: unknown, fallback: string | null = null): string | null {
  return typeof value === 'string' ? value : fallback
}

function normalizedEnvironment(value: unknown): LocalProviderEnvironment {
  if (!isRecord(value)) {
    return {}
  }
  const environment: LocalProviderEnvironment = {}
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === 'string' && key.length > 0 && !key.includes('\0')) {
      environment[key] = entry
    }
  }
  return environment
}

function cloneJsonValue(value: unknown): unknown {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value
  }
  if (Array.isArray(value)) {
    return value.map(cloneJsonValue)
  }
  if (!isRecord(value)) {
    return undefined
  }
  const result: Record<string, unknown> = {}
  for (const [key, entry] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(key)) {
      continue
    }
    const cloned = cloneJsonValue(entry)
    if (cloned !== undefined) {
      result[key] = cloned
    }
  }
  return result
}

function normalizedStringMap(value: unknown): Record<string, string> | undefined {
  if (!isRecord(value)) {
    return undefined
  }
  const result: Record<string, string> = {}
  for (const [key, entry] of Object.entries(value)) {
    if (key.length > 0 && !FORBIDDEN_KEYS.has(key) && typeof entry === 'string') {
      result[key] = entry
    }
  }
  return Object.keys(result).length > 0 ? result : undefined
}

function normalizedClaudeModels(value: unknown): LocalProviderClaudeModels | undefined {
  if (!isRecord(value)) {
    return undefined
  }
  const models: LocalProviderClaudeModels = {}
  for (const key of ['haikuModel', 'sonnetModel', 'opusModel', 'subagentModel'] as const) {
    const model = normalizedString(value[key])
    if (model) {
      models[key] = model
    }
  }
  return Object.keys(models).length > 0 ? models : undefined
}

function normalizedCodexSettings(value: unknown): LocalProviderFields['codex'] {
  if (!isRecord(value)) {
    return undefined
  }
  const settings: NonNullable<LocalProviderFields['codex']> = {}
  const reasoningEffort = normalizedString(value.reasoningEffort)
  const modelProvider = normalizedString(value.modelProvider)
  const customModels = normalizedStringMap(value.customModels)
  if (reasoningEffort) {
    settings.reasoningEffort = reasoningEffort
  }
  if (modelProvider) {
    settings.modelProvider = modelProvider
  }
  if (typeof value.fastMode === 'boolean') {
    settings.fastMode = value.fastMode
  }
  if (customModels) {
    settings.customModels = customModels
  }
  return Object.keys(settings).length > 0 ? settings : undefined
}

export function normalizeLocalProviderFields(value: unknown): LocalProviderFields | undefined {
  if (!isRecord(value)) {
    return undefined
  }
  const fields: LocalProviderFields = {}
  for (const key of [
    'baseUrl',
    'apiKey',
    'authField',
    'model',
    'fallbackModel',
    'haikuModel',
    'sonnetModel',
    'opusModel',
    'subagentModel',
    'reasoningEffort',
    'modelProvider'
  ] as const) {
    const field = normalizedString(value[key])
    if (field !== null && !field.includes('\0')) {
      fields[key] = field
    }
  }
  if (isLocalProviderUpstreamFormatValue(value.upstreamFormat)) {
    fields.upstreamFormat = value.upstreamFormat
  }
  if (typeof value.fastMode === 'boolean') {
    fields.fastMode = value.fastMode
  }
  const modelMappings = normalizedStringMap(value.modelMappings)
  const customModels = normalizedStringMap(value.customModels)
  const claudeModels = normalizedClaudeModels(value.claudeModels)
  const codex = normalizedCodexSettings(value.codex)
  if (modelMappings) {
    fields.modelMappings = modelMappings
  }
  if (customModels) {
    fields.customModels = customModels
  }
  if (claudeModels) {
    fields.claudeModels = claudeModels
  }
  if (codex) {
    fields.codex = codex
  }
  return Object.keys(fields).length > 0 ? fields : undefined
}

function isLocalProviderUpstreamFormatValue(value: unknown): value is LocalProviderUpstreamFormat {
  return typeof value === 'string' && ['anthropic', 'openai', 'responses', 'auto'].includes(value)
}

export function normalizeLocalProviderRecords(value: unknown): LocalProviderRecord[] {
  if (!Array.isArray(value)) {
    return []
  }
  const records: LocalProviderRecord[] = []
  for (const entry of value) {
    if (!isRecord(entry) || !isLocalProviderTypeValue(entry.type)) {
      continue
    }
    const id = normalizedString(entry.id)
    const name = normalizedString(entry.name)
    const command = normalizedString(entry.command)
    const createdAt = normalizedString(entry.createdAt)
    const updatedAt = normalizedString(entry.updatedAt)
    if (!id || !name || !command || !createdAt || !updatedAt) {
      continue
    }
    const args = Array.isArray(entry.args)
      ? entry.args.filter((arg): arg is string => typeof arg === 'string')
      : []
    const fields = normalizeLocalProviderFields(entry.fields)
    const fieldApiKey = fields?.apiKey
    if (fields?.apiKey !== undefined) {
      delete fields.apiKey
    }
    const settingsValue = cloneJsonValue(entry.settings)
    const record: LocalProviderRecord = {
      id,
      type: entry.type,
      name,
      command,
      args,
      env: normalizedEnvironment(entry.env),
      secret:
        typeof entry.secret === 'string' && entry.secret.length > 0
          ? entry.secret
          : (fieldApiKey ?? null),
      enabled: entry.enabled !== false,
      createdAt,
      updatedAt
    }
    if (fields) {
      record.fields = fields
    }
    if (isRecord(settingsValue)) {
      record.settings = settingsValue as LocalProviderSettings
    }
    records.push(record)
  }
  return records
}

function isLocalProviderTypeValue(value: unknown): value is LocalProviderRecord['type'] {
  return value === 'claude-code' || value === 'codex'
}
