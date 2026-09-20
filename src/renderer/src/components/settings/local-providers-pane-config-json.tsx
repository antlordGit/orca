import { useMemo, useState } from 'react'
import type { LocalProviderType } from '../../../../shared/local-provider-types'
import { Button } from '../ui/button'
import { Label } from '../ui/label'
import { Textarea } from '../ui/textarea'
import type { ProviderFormState } from './local-providers-pane-form'

const MASK = '••••••'

function trim(value: string): string {
  return value.trim()
}

function nonEmpty(value: string | undefined): string | undefined {
  const normalized = value?.trim()
  return normalized ? normalized : undefined
}

function parseKeyValueLines(value: string): Record<string, string> {
  const result: Record<string, string> = {}
  for (const line of value.split('\n')) {
    const separator = line.indexOf('=')
    if (separator <= 0) {
      continue
    }
    const key = line.slice(0, separator).trim()
    const target = line.slice(separator + 1).trim()
    if (key && target) {
      result[key] = target
    }
  }
  return result
}

type Projection = {
  name: string
  type: LocalProviderType
  command: string
  env: Record<string, string>
  includeCoAuthoredBy?: boolean
}

function projectClaudeEnv(form: ProviderFormState, hasApiKey: boolean): Record<string, string> {
  const env: Record<string, string> = {}
  const baseUrl = nonEmpty(form.baseUrl)
  if (baseUrl) {
    env.ANTHROPIC_BASE_URL = baseUrl
  }

  const authField = nonEmpty(form.authField) ?? 'ANTHROPIC_AUTH_TOKEN'
  if (form.apiKey && form.apiKey.trim()) {
    env[authField] = form.apiKey
  } else if (hasApiKey) {
    // Why the mask (not the secret): the projection is a preview, and the real
    // credential is only fetched through the explicit reveal channel.
    env[authField] = MASK
  }

  const model = nonEmpty(form.model)
  const fallbackModel = nonEmpty(form.fallbackModel)
  if (model) {
    env.ANTHROPIC_MODEL = model
  }
  if (fallbackModel && fallbackModel !== model) {
    env.ANTHROPIC_DEFAULT_FALLBACK_MODEL = fallbackModel
  }
  const haiku = nonEmpty(form.haikuModel)
  const sonnet = nonEmpty(form.sonnetModel)
  const opus = nonEmpty(form.opusModel)
  const subagent = nonEmpty(form.subagentModel)
  if (haiku) {
    env.ANTHROPIC_DEFAULT_HAIKU_MODEL = haiku
  }
  if (sonnet) {
    env.ANTHROPIC_DEFAULT_SONNET_MODEL = sonnet
  }
  if (opus) {
    env.ANTHROPIC_DEFAULT_OPUS_MODEL = opus
  }
  if (subagent) {
    env.CLAUDE_CODE_SUBAGENT_MODEL = subagent
  }

  const legacyEnv = parseKeyValueLines(form.env)
  for (const [key, value] of Object.entries(legacyEnv)) {
    env[key] = value
  }

  return env
}

function projectCodexEnv(form: ProviderFormState): Record<string, string> {
  const env: Record<string, string> = {}
  const baseUrl = nonEmpty(form.baseUrl)
  if (baseUrl) {
    env.OPENAI_BASE_URL = baseUrl
  }
  if (form.apiKey && form.apiKey.trim()) {
    env.OPENAI_API_KEY = form.apiKey
  }
  const legacyEnv = parseKeyValueLines(form.env)
  for (const [key, value] of Object.entries(legacyEnv)) {
    env[key] = value
  }
  return env
}

function buildProjection(form: ProviderFormState, hasApiKey: boolean): Projection {
  const env =
    form.type === 'claude-code'
      ? projectClaudeEnv(form, hasApiKey)
      : projectCodexEnv(form)
  return {
    name: trim(form.name),
    type: form.type,
    command: trim(form.command),
    env,
    includeCoAuthoredBy: form.type === 'claude-code' ? false : undefined
  }
}

const AUTH_FIELD_KEYS = new Set(['ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_API_KEY'])

function applyClaudeEnvKey(form: ProviderFormState, key: string, value: string): boolean {
  switch (key) {
    case 'ANTHROPIC_MODEL':
      form.model = value
      return true
    case 'ANTHROPIC_DEFAULT_FALLBACK_MODEL':
      form.fallbackModel = value
      return true
    case 'ANTHROPIC_DEFAULT_HAIKU_MODEL':
      form.haikuModel = value
      return true
    case 'ANTHROPIC_DEFAULT_SONNET_MODEL':
      form.sonnetModel = value
      return true
    case 'ANTHROPIC_DEFAULT_OPUS_MODEL':
      form.opusModel = value
      return true
    case 'CLAUDE_CODE_SUBAGENT_MODEL':
      form.subagentModel = value
      return true
    default:
      return false
  }
}

/**
 * Reverse of `projectClaudeEnv`/`projectCodexEnv`: fold an edited env block back
 * onto the form. Only keys the projection itself owns are claimed; everything
 * else lands in the free-form env textarea so no user key is silently dropped.
 * The secret is never written back — an edited plaintext token would otherwise
 * leak into form state and the masked preview would stop round-tripping.
 */
function appliedEnvToForm(
  form: ProviderFormState,
  applied: Record<string, string>
): ProviderFormState {
  const next = { ...form }
  const legacy: Record<string, string> = { ...parseKeyValueLines(form.env) }
  const authField = nonEmpty(form.authField) ?? 'ANTHROPIC_AUTH_TOKEN'
  const ownerField = form.type === 'claude-code' ? 'ANTHROPIC_BASE_URL' : 'OPENAI_BASE_URL'
  const secretKey = form.type === 'claude-code' ? authField : 'OPENAI_API_KEY'

  for (const [key, value] of Object.entries(applied)) {
    if (key === secretKey) {
      delete legacy[key]
      continue
    }
    if (key === ownerField) {
      next.baseUrl = value
      delete legacy[key]
      continue
    }
    if (next.type === 'claude-code' && applyClaudeEnvKey(next, key, value)) {
      delete legacy[key]
      continue
    }
    legacy[key] = value
  }
  next.env = Object.entries(legacy)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')
  return next
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every((entry) => typeof entry === 'string')
  )
}

function parseAppliedEnv(text: string, form: ProviderFormState): Record<string, string> | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    // Keep raw text when invalid; no schema validation per spec.
    return null
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return null
  }
  const env = Object.entries(parsed).find(([key]) => key === 'env')?.[1]
  if (env === undefined) {
    return {}
  }
  if (!isStringRecord(env)) {
    return null
  }
  const applied: Record<string, string> = { ...env }
  // A Claude auth field rename is only representable through the select, so an
  // unnamed token key keeps the current field rather than being treated as free-form.
  if (form.type === 'claude-code') {
    for (const key of Object.keys(applied)) {
      if (AUTH_FIELD_KEYS.has(key)) {
        applied[form.authField.trim() || 'ANTHROPIC_AUTH_TOKEN'] = applied[key]!
        delete applied[key]
      }
    }
  }
  return applied
}

export function LocalProvidersPaneConfigJson({
  form,
  hasApiKey,
  onFormChange
}: {
  form: ProviderFormState
  hasApiKey: boolean
  onFormChange: (form: ProviderFormState) => void
}): React.JSX.Element {
  const formatted = useMemo(
    () => JSON.stringify(buildProjection(form, hasApiKey), null, 2),
    [form, hasApiKey]
  )
  const [text, setText] = useState(formatted)
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle')
  const [applyState, setApplyState] = useState<'idle' | 'invalid'>('idle')
  // Why: the projection echo also fires while the user types in the form. An
  // in-progress JSON edit must survive that echo, so track the projection this
  // text was based on and only resync when the edit had already converged.
  const [echoedFormatted, setEchoedFormatted] = useState(formatted)
  const [editedSinceEcho, setEditedSinceEcho] = useState(false)
  if (formatted !== echoedFormatted) {
    setEchoedFormatted(formatted)
    if (!editedSinceEcho) {
      setText(formatted)
      setApplyState('idle')
    }
  }

  const applyText = (value: string): void => {
    setText(value)
    const applied = parseAppliedEnv(value, form)
    // Why: a still-diverged edit keeps owning the textarea until it parses clean.
    setEditedSinceEcho(applied !== null && value !== formatted)
    setApplyState(applied === null ? 'invalid' : 'idle')
    if (applied === null) {
      return
    }
    onFormChange(appliedEnvToForm(form, applied))
  }

  const handleFormat = (): void => {
    try {
      const parsed: unknown = JSON.parse(text)
      if (parsed !== null && typeof parsed === 'object') {
        const next = JSON.stringify(parsed, null, 2)
        setText(next)
        applyText(next)
      }
    } catch {
      setApplyState('invalid')
    }
  }

  const handleCopy = async (): Promise<void> => {
    try {
      // Why the IPC path, not navigator.clipboard: the renderer is not a secure
      // context in every Electron configuration, where writeText is unavailable.
      await window.api.ui.writeClipboardText(text)
      setCopyState('copied')
      setTimeout(() => setCopyState('idle'), 1500)
    } catch {
      setCopyState('idle')
    }
  }

  return (
    <div className="space-y-1.5 rounded-lg border border-border/60 p-3">
      <div className="flex items-center justify-between">
        <Label htmlFor="edit-provider-config-json">配置 JSON</Label>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={handleFormat}>
            格式化
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => void handleCopy()}>
            {copyState === 'copied' ? '已复制' : '复制'}
          </Button>
        </div>
      </div>
      <Textarea
        id="edit-provider-config-json"
        value={text}
        onChange={(event) => applyText(event.target.value)}
        className="min-h-56"
        spellCheck={false}
        aria-invalid={applyState === 'invalid'}
      />
      {applyState === 'invalid' ? (
        <p className="text-xs text-destructive">
          JSON 无效，已保留输入；修正后会同步上方表单。
        </p>
      ) : editedSinceEcho ? (
        <p className="text-xs text-muted-foreground">已同步上方表单字段。</p>
      ) : null}
    </div>
  )
}