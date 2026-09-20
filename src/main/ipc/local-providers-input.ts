import type {
  LocalProviderCreateInput,
  LocalProviderEnvironment,
  LocalProviderFieldPatch,
  LocalProviderSettings,
  LocalProviderUpdateInput
} from '../../shared/local-provider-types'
import {
  isLocalProviderType,
  isLocalProviderUpstreamFormat
} from '../../shared/local-provider-types'

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

function objectArgs(value: unknown, errorCode: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(errorCode)
  }
  return Object.fromEntries(Object.entries(value))
}

export function providerId(value: unknown): string {
  const args = objectArgs(value, 'invalid_local_provider_request')
  if (typeof args.id !== 'string' || !args.id.trim()) {
    throw new Error('invalid_local_provider_id')
  }
  return args.id
}

function optionalString(
  args: Record<string, unknown>,
  key: string,
  errorCode: string
): string | undefined {
  const value = args[key]
  if (value !== undefined && typeof value !== 'string') {
    throw new Error(errorCode)
  }
  return value
}

function optionalStringArray(
  args: Record<string, unknown>,
  key: string,
  errorCode: string
): string[] | undefined {
  const value = args[key]
  if (value === undefined) {
    return undefined
  }
  if (!Array.isArray(value) || !value.every((entry) => typeof entry === 'string')) {
    throw new Error(errorCode)
  }
  return value
}

function optionalEnvironment(
  args: Record<string, unknown>,
  key: string,
  errorCode: string
): LocalProviderEnvironment | undefined {
  const value = args[key]
  if (value === undefined) {
    return undefined
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(errorCode)
  }
  if (!Object.values(value).every((entry) => typeof entry === 'string')) {
    throw new Error(errorCode)
  }
  return Object.fromEntries(Object.entries(value)) as LocalProviderEnvironment
}

function optionalObject<T extends Record<string, unknown>>(
  args: Record<string, unknown>,
  key: string,
  errorCode: string
): T | undefined {
  const value = args[key]
  if (value === undefined) {
    return undefined
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(errorCode)
  }
  return value as T
}

function optionalSecret(args: Record<string, unknown>): string | null | undefined {
  const value = args.secret
  if (value !== undefined && value !== null && typeof value !== 'string') {
    throw new Error('invalid_local_provider_secret')
  }
  return value
}

function optionalApiKey(args: Record<string, unknown>): string | null | undefined {
  const value = args.apiKey
  if (value !== undefined && value !== null && typeof value !== 'string') {
    throw new Error('invalid_local_provider_secret')
  }
  return value
}

function optionalBoolean(
  args: Record<string, unknown>,
  key: string,
  errorCode: string
): boolean | undefined {
  const value = args[key]
  if (value !== undefined && typeof value !== 'boolean') {
    throw new Error(errorCode)
  }
  return value
}

function collectFields(args: Record<string, unknown>): LocalProviderFieldPatch | undefined {
  const fields: Record<string, unknown> = {}
  const nested = optionalObject<Record<string, unknown>>(
    args,
    'fields',
    'invalid_local_provider_fields'
  )
  if (nested) {
    Object.assign(fields, nested)
  }
  for (const key of FIELD_KEYS) {
    if (Object.hasOwn(args, key)) {
      fields[key] = args[key]
    }
  }
  if (
    fields.upstreamFormat !== undefined &&
    !isLocalProviderUpstreamFormat(fields.upstreamFormat)
  ) {
    throw new Error('invalid_local_provider_upstream_format')
  }
  if (fields.fastMode !== undefined && typeof fields.fastMode !== 'boolean') {
    throw new Error('invalid_local_provider_fast_mode')
  }
  for (const key of [
    'baseUrl',
    'authField',
    'model',
    'fallbackModel',
    'haikuModel',
    'sonnetModel',
    'opusModel',
    'subagentModel',
    'reasoningEffort',
    'modelProvider'
  ]) {
    if (fields[key] !== undefined && typeof fields[key] !== 'string') {
      throw new Error(`invalid_local_provider_${key}`)
    }
  }
  return Object.keys(fields).length > 0 ? (fields as LocalProviderFieldPatch) : undefined
}

function addLegacyFieldValues(
  target: Record<string, unknown>,
  args: Record<string, unknown>
): void {
  for (const key of FIELD_KEYS) {
    if (Object.hasOwn(args, key)) {
      target[key] = args[key]
    }
  }
}

export function createInput(value: unknown): LocalProviderCreateInput {
  const args = objectArgs(value, 'invalid_local_provider_request')
  if (!isLocalProviderType(args.type) || typeof args.name !== 'string') {
    throw new Error('invalid_local_provider_request')
  }
  const input: Record<string, unknown> = { type: args.type, name: args.name }
  const command = optionalString(args, 'command', 'invalid_local_provider_command')
  const argsList = optionalStringArray(args, 'args', 'invalid_local_provider_args')
  const env = optionalEnvironment(args, 'env', 'invalid_local_provider_env')
  const secret = optionalSecret(args)
  const apiKey = optionalApiKey(args)
  const fields = collectFields(args)
  const settings = optionalObject<LocalProviderSettings>(
    args,
    'settings',
    'invalid_local_provider_settings'
  )
  const enabled = optionalBoolean(args, 'enabled', 'invalid_local_provider_enabled')
  if (command !== undefined) {
    input.command = command
  }
  if (argsList !== undefined) {
    input.args = argsList
  }
  if (env !== undefined) {
    input.env = env
  }
  if (secret !== undefined) {
    input.secret = secret
  }
  if (apiKey !== undefined) {
    input.apiKey = apiKey
  }
  if (fields !== undefined) {
    input.fields = fields
  }
  if (settings !== undefined) {
    input.settings = settings
  }
  if (enabled !== undefined) {
    input.enabled = enabled
  }
  addLegacyFieldValues(input, args)
  return input as LocalProviderCreateInput
}

export function updateInput(value: unknown): { id: string; updates: LocalProviderUpdateInput } {
  const args = objectArgs(value, 'invalid_local_provider_request')
  if (typeof args.id !== 'string' || !args.id.trim()) {
    throw new Error('invalid_local_provider_id')
  }
  if (typeof args.updates !== 'object' || args.updates === null || Array.isArray(args.updates)) {
    throw new Error('invalid_local_provider_updates')
  }
  const updatesArgs = objectArgs(args.updates, 'invalid_local_provider_updates')
  const updates: Record<string, unknown> = {}
  const name = optionalString(updatesArgs, 'name', 'invalid_local_provider_name')
  const command = optionalString(updatesArgs, 'command', 'invalid_local_provider_command')
  const argsList = optionalStringArray(updatesArgs, 'args', 'invalid_local_provider_args')
  const env = optionalEnvironment(updatesArgs, 'env', 'invalid_local_provider_env')
  const secret = optionalSecret(updatesArgs)
  const apiKey = optionalApiKey(updatesArgs)
  const fields = collectFields(updatesArgs)
  const settings = optionalObject<LocalProviderSettings>(
    updatesArgs,
    'settings',
    'invalid_local_provider_settings'
  )
  const enabled = optionalBoolean(updatesArgs, 'enabled', 'invalid_local_provider_enabled')
  if (name !== undefined) {
    updates.name = name
  }
  if (command !== undefined) {
    updates.command = command
  }
  if (argsList !== undefined) {
    updates.args = argsList
  }
  if (env !== undefined) {
    updates.env = env
  }
  if (secret !== undefined) {
    updates.secret = secret
  }
  if (apiKey !== undefined) {
    updates.apiKey = apiKey
  }
  if (fields !== undefined) {
    updates.fields = fields
  }
  if (settings !== undefined) {
    updates.settings = settings
  }
  if (enabled !== undefined) {
    updates.enabled = enabled
  }
  addLegacyFieldValues(updates, updatesArgs)
  return { id: args.id, updates: updates as LocalProviderUpdateInput }
}

export { objectArgs }
