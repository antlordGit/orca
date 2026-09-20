import type {
  LocalProviderCreateInput,
  LocalProviderFields,
  LocalProviderRecord,
  LocalProviderSettings,
  LocalProviderSummary,
  LocalProviderUpdateInput
} from '../../shared/local-provider-types'
import { normalizeLocalProviderFields } from '../../shared/local-provider-normalization'

export const MASKED_SECRET = '••••••'
export const MAX_NAME_LENGTH = 120
export const MAX_COMMAND_LENGTH = 512
const MAX_ARGUMENTS = 64
const MAX_ARGUMENT_LENGTH = 2048
const MAX_ENV_ENTRIES = 64
const MAX_ENV_KEY_LENGTH = 128
const MAX_ENV_VALUE_LENGTH = 8192
const MAX_MODEL_MAPPINGS = 128
const MAX_MODEL_LENGTH = 512
const SECRET_ENV_KEY = /key|token|secret|password|credential|auth/i
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype'])
const FIELD_KEYS = [
  'baseUrl',
  'authField',
  'model',
  'fallbackModel',
  'modelMappings',
  'upstreamFormat',
  'haikuModel',
  'sonnetModel',
  'opusModel',
  'subagentModel',
  'reasoningEffort',
  'fastMode',
  'modelProvider',
  'customModels',
  'claudeModels',
  'codex'
] as const

type InputWithFields = {
  fields?: LocalProviderFields & { apiKey?: string | null }
  apiKey?: string | null
  secret?: string | null
} & Record<string, unknown>

export function copyRecord(record: LocalProviderRecord): LocalProviderRecord {
  return {
    ...record,
    args: [...record.args],
    env: { ...record.env },
    ...(record.fields ? { fields: { ...record.fields } } : {}),
    ...(record.settings ? { settings: copySettings(record.settings) } : {})
  }
}

function copySettings(value: LocalProviderSettings): LocalProviderSettings {
  const copy: LocalProviderSettings = {}
  for (const [key, entry] of Object.entries(value)) {
    if (!FORBIDDEN_KEYS.has(key)) {
      copy[key] = entry
    }
  }
  return copy
}

export function requireText(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== 'string') {
    throw new Error(`invalid_local_provider_${field}`)
  }
  const normalized = value.trim()
  if (!normalized || normalized.length > maxLength || normalized.includes('\0')) {
    throw new Error(`invalid_local_provider_${field}`)
  }
  return normalized
}

export function normalizeArgs(value: unknown): string[] {
  if (value === undefined) {
    return []
  }
  if (!Array.isArray(value) || value.length > MAX_ARGUMENTS) {
    throw new Error('invalid_local_provider_args')
  }
  return value.map((argument) => {
    if (
      typeof argument !== 'string' ||
      argument.length > MAX_ARGUMENT_LENGTH ||
      argument.includes('\0')
    ) {
      throw new Error('invalid_local_provider_args')
    }
    return argument
  })
}

export function normalizeEnvironment(value: unknown): Record<string, string> {
  if (value === undefined) {
    return {}
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('invalid_local_provider_env')
  }
  const entries = Object.entries(value)
  if (entries.length > MAX_ENV_ENTRIES) {
    throw new Error('invalid_local_provider_env')
  }
  const environment: Record<string, string> = {}
  for (const [key, entry] of entries) {
    if (
      !key ||
      key.length > MAX_ENV_KEY_LENGTH ||
      key.includes('\0') ||
      FORBIDDEN_KEYS.has(key) ||
      typeof entry !== 'string' ||
      entry.length > MAX_ENV_VALUE_LENGTH ||
      entry.includes('\0')
    ) {
      throw new Error('invalid_local_provider_env')
    }
    environment[key] = entry
  }
  return environment
}

export function normalizeSecret(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null
  }
  if (typeof value !== 'string' || value.length > MAX_ENV_VALUE_LENGTH || value.includes('\0')) {
    throw new Error('invalid_local_provider_secret')
  }
  return value || null
}

export function normalizeSettings(value: unknown): LocalProviderSettings | undefined {
  if (value === undefined) {
    return undefined
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('invalid_local_provider_settings')
  }
  return copySettings(value as LocalProviderSettings)
}

export function normalizeFields(value: unknown): LocalProviderFields | undefined {
  const fields = normalizeLocalProviderFields(value)
  if (!fields) {
    return undefined
  }
  if (fields.modelMappings && Object.keys(fields.modelMappings).length > MAX_MODEL_MAPPINGS) {
    throw new Error('invalid_local_provider_model_mappings')
  }
  for (const model of [
    fields.baseUrl,
    fields.model,
    fields.fallbackModel,
    fields.haikuModel,
    fields.sonnetModel,
    fields.opusModel,
    fields.subagentModel,
    fields.reasoningEffort,
    fields.modelProvider
  ]) {
    if (model !== undefined && model.length > MAX_MODEL_LENGTH) {
      throw new Error('invalid_local_provider_model')
    }
  }
  return fields
}

export function collectFields(input: InputWithFields): LocalProviderFields | undefined {
  const raw: Record<string, unknown> = {}
  if (input.fields) {
    Object.assign(raw, input.fields)
  }
  for (const key of FIELD_KEYS) {
    if (Object.hasOwn(input, key)) {
      raw[key] = input[key]
    }
  }
  return normalizeFields(raw)
}

export function readInputSecret(input: InputWithFields): string | null | undefined {
  if (Object.hasOwn(input, 'apiKey')) {
    return normalizeSecret(input.apiKey)
  }
  if (Object.hasOwn(input, 'secret')) {
    return normalizeSecret(input.secret)
  }
  if (input.fields && Object.hasOwn(input.fields, 'apiKey')) {
    return normalizeSecret(input.fields.apiKey)
  }
  return undefined
}

export function toSummary(record: LocalProviderRecord): LocalProviderSummary {
  const copy = copyRecord(record)
  const secret = copy.secret
  const { secret: _secret, ...publicCopy } = copy
  // Strip apiKey from fields — it lives on `secret`.
  const publicFields = publicCopy.fields ? { ...publicCopy.fields } : undefined
  if (publicFields && 'apiKey' in publicFields) {
    delete publicFields.apiKey
  }
  return {
    id: publicCopy.id,
    type: publicCopy.type,
    name: publicCopy.name,
    command: publicCopy.command,
    args: publicCopy.args,
    env: publicEnvironment(publicCopy.env),
    ...(publicFields ? { fields: publicFields } : {}),
    ...(publicCopy.settings ? { settings: redactSettings(publicCopy.settings) } : {}),
    enabled: publicCopy.enabled,
    createdAt: publicCopy.createdAt,
    updatedAt: publicCopy.updatedAt,
    secretConfigured: secret !== null,
    secretMasked: secret ? MASKED_SECRET : null,
    apiKeyConfigured: secret !== null,
    apiKeyMasked: secret ? MASKED_SECRET : null
  }
}

function redactSettings(settings: LocalProviderSettings): LocalProviderSettings {
  const result: LocalProviderSettings = {}
  for (const [key, value] of Object.entries(settings)) {
    result[key] =
      SECRET_ENV_KEY.test(key) && typeof value === 'string' && value ? MASKED_SECRET : value
  }
  return result
}
function publicEnvironment(environment: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(environment).map(([key, value]) => [
      key,
      SECRET_ENV_KEY.test(key) && value ? MASKED_SECRET : value
    ])
  )
}

export type { InputWithFields }
export type ProviderInput = LocalProviderCreateInput | LocalProviderUpdateInput
