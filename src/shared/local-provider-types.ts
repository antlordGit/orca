export const LOCAL_PROVIDER_TYPES = ['claude-code', 'codex'] as const

export type LocalProviderType = (typeof LOCAL_PROVIDER_TYPES)[number]
export type LocalProviderEnvironment = Record<string, string>
export type LocalProviderUpstreamFormat = 'anthropic' | 'openai' | 'responses' | 'auto'

export type LocalProviderClaudeModels = {
  haikuModel?: string
  sonnetModel?: string
  opusModel?: string
  subagentModel?: string
}

export type LocalProviderCodexSettings = {
  reasoningEffort?: string
  fastMode?: boolean
  modelProvider?: string
  customModels?: Record<string, string>
}

export type LocalProviderFields = {
  baseUrl?: string
  apiKey?: string | null
  authField?: string
  model?: string
  fallbackModel?: string
  modelMappings?: Record<string, string>
  upstreamFormat?: LocalProviderUpstreamFormat
  haikuModel?: string
  sonnetModel?: string
  opusModel?: string
  subagentModel?: string
  claudeModels?: LocalProviderClaudeModels
  reasoningEffort?: string
  fastMode?: boolean
  modelProvider?: string
  customModels?: Record<string, string>
  codex?: LocalProviderCodexSettings
}

export type LocalProviderFieldPatch = {
  [Key in keyof LocalProviderFields]?: LocalProviderFields[Key]
}

export type LocalProviderSettings = Record<string, unknown>

/** The in-memory provider record. The secret never crosses the preload boundary. */
export type LocalProviderRecord = {
  id: string
  type: LocalProviderType
  name: string
  command: string
  args: string[]
  env: LocalProviderEnvironment
  secret: string | null
  fields?: LocalProviderFields
  settings?: LocalProviderSettings
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export type LocalProviderPublicFields = Omit<LocalProviderFields, 'apiKey'>

/**
 * Non-secret view of a provider record.
 * The secret never crosses the preload boundary; env masks secret-like keys
 * in place. Fields intentionally omit `apiKey` because it is stored as `secret`.
 */
export type LocalProviderSummary = {
  id: string
  type: LocalProviderType
  name: string
  command: string
  args: string[]
  env: LocalProviderEnvironment
  fields?: LocalProviderPublicFields
  settings?: LocalProviderSettings
  enabled: boolean
  createdAt: string
  updatedAt: string
  secretConfigured: boolean
  secretMasked: string | null
  apiKeyConfigured?: boolean
  apiKeyMasked?: string | null
}

export type LocalProviderDiagnostic = {
  code: string
  message: string
}

export type LocalProviderSnapshot = {
  version: 1
  providers: LocalProviderSummary[]
  affectedFiles?: string[]
  restartRequired?: boolean
  diagnostics?: LocalProviderDiagnostic[]
}

export type LocalProviderCreateInput = {
  type: LocalProviderType
  name: string
  command?: string
  args?: string[]
  env?: LocalProviderEnvironment
  secret?: string | null
  apiKey?: string | null
  fields?: LocalProviderFields
  settings?: LocalProviderSettings
  baseUrl?: string
  authField?: string
  model?: string
  fallbackModel?: string
  modelMappings?: Record<string, string>
  upstreamFormat?: LocalProviderUpstreamFormat
  haikuModel?: string
  sonnetModel?: string
  opusModel?: string
  subagentModel?: string
  reasoningEffort?: string
  fastMode?: boolean
  modelProvider?: string
  customModels?: Record<string, string>
  enabled?: boolean
}

export type LocalProviderUpdateInput = {
  name?: string
  command?: string
  args?: string[]
  env?: LocalProviderEnvironment
  secret?: string | null
  apiKey?: string | null
  fields?: LocalProviderFieldPatch
  settings?: LocalProviderSettings
  baseUrl?: string
  authField?: string
  model?: string
  fallbackModel?: string
  modelMappings?: Record<string, string>
  upstreamFormat?: LocalProviderUpstreamFormat
  haikuModel?: string
  sonnetModel?: string
  opusModel?: string
  subagentModel?: string
  reasoningEffort?: string
  fastMode?: boolean
  modelProvider?: string
  customModels?: Record<string, string>
  enabled?: boolean
}

const LOCAL_PROVIDER_TYPE_SET = new Set<string>(LOCAL_PROVIDER_TYPES)
const UPSTREAM_FORMATS = new Set<LocalProviderUpstreamFormat>([
  'anthropic',
  'openai',
  'responses',
  'auto'
])
const DEFAULT_COMMANDS: Record<LocalProviderType, string> = {
  'claude-code': 'claude',
  codex: 'codex'
}

export function isLocalProviderType(value: unknown): value is LocalProviderType {
  return typeof value === 'string' && LOCAL_PROVIDER_TYPE_SET.has(value)
}

export function isLocalProviderUpstreamFormat(
  value: unknown
): value is LocalProviderUpstreamFormat {
  return typeof value === 'string' && UPSTREAM_FORMATS.has(value as LocalProviderUpstreamFormat)
}

export function defaultLocalProviderCommand(type: LocalProviderType): string {
  return DEFAULT_COMMANDS[type]
}
