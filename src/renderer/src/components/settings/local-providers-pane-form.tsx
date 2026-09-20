import type {
  LocalProviderCreateInput,
  LocalProviderFields,
  LocalProviderSummary,
  LocalProviderType
} from '../../../../shared/local-provider-types'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Textarea } from '../ui/textarea'

export type ProviderFormState = {
  type: LocalProviderType
  name: string
  command: string
  apiKey: string
  baseUrl: string
  authField: string
  model: string
  fallbackModel: string
  modelMappings: string
  upstreamFormat: NonNullable<LocalProviderFields['upstreamFormat']>
  haikuModel: string
  sonnetModel: string
  opusModel: string
  subagentModel: string
  reasoningEffort: string
  fastMode: boolean
  modelProvider: string
  customModels: string
  env: string
}

export const INITIAL_FORM: ProviderFormState = {
  type: 'claude-code',
  name: '',
  command: '',
  apiKey: '',
  baseUrl: '',
  authField: 'ANTHROPIC_AUTH_TOKEN',
  model: '',
  fallbackModel: '',
  modelMappings: '',
  upstreamFormat: 'auto',
  haikuModel: '',
  sonnetModel: '',
  opusModel: '',
  subagentModel: '',
  reasoningEffort: '',
  fastMode: false,
  modelProvider: '',
  customModels: '',
  env: ''
}

export function parseLocalProviderEnvironment(value: string): Record<string, string> {
  const environment: Record<string, string> = {}
  for (const line of value.split('\n')) {
    const separator = line.indexOf('=')
    if (separator <= 0) {
      continue
    }
    const key = line.slice(0, separator).trim()
    if (key) {
      environment[key] = line.slice(separator + 1)
    }
  }
  return environment
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

function formatKeyValueLines(value: Record<string, string> | undefined): string {
  return Object.entries(value ?? {})
    .map(([key, target]) => `${key}=${target}`)
    .join('\n')
}

export function formFromProvider(provider: LocalProviderSummary): ProviderFormState {
  const fields = provider.fields ?? {}
  return {
    ...INITIAL_FORM,
    type: provider.type,
    name: provider.name,
    command: provider.command,
    baseUrl: fields.baseUrl ?? '',
    authField: fields.authField ?? 'ANTHROPIC_AUTH_TOKEN',
    model: fields.model ?? '',
    fallbackModel: fields.fallbackModel ?? '',
    modelMappings: formatKeyValueLines(fields.modelMappings),
    upstreamFormat: fields.upstreamFormat ?? 'auto',
    haikuModel: fields.haikuModel ?? fields.claudeModels?.haikuModel ?? '',
    sonnetModel: fields.sonnetModel ?? fields.claudeModels?.sonnetModel ?? '',
    opusModel: fields.opusModel ?? fields.claudeModels?.opusModel ?? '',
    subagentModel: fields.subagentModel ?? fields.claudeModels?.subagentModel ?? '',
    reasoningEffort: fields.reasoningEffort ?? fields.codex?.reasoningEffort ?? '',
    fastMode: fields.fastMode ?? fields.codex?.fastMode ?? false,
    modelProvider: fields.modelProvider ?? fields.codex?.modelProvider ?? '',
    customModels: formatKeyValueLines(fields.customModels ?? fields.codex?.customModels),
    env: Object.entries(provider.env)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n')
  }
}

export function buildInput(form: ProviderFormState): LocalProviderCreateInput {
  const fields: LocalProviderFields = {
    ...(form.baseUrl.trim() ? { baseUrl: form.baseUrl.trim() } : {}),
    ...(form.authField.trim() ? { authField: form.authField.trim() } : {}),
    ...(form.model.trim() ? { model: form.model.trim() } : {}),
    ...(form.fallbackModel.trim() ? { fallbackModel: form.fallbackModel.trim() } : {}),
    ...(Object.keys(parseKeyValueLines(form.modelMappings)).length > 0
      ? { modelMappings: parseKeyValueLines(form.modelMappings) }
      : {}),
    ...(form.upstreamFormat !== 'auto' ? { upstreamFormat: form.upstreamFormat } : {}),
    ...(form.type === 'claude-code'
      ? {
          ...(form.haikuModel.trim() ? { haikuModel: form.haikuModel.trim() } : {}),
          ...(form.sonnetModel.trim() ? { sonnetModel: form.sonnetModel.trim() } : {}),
          ...(form.opusModel.trim() ? { opusModel: form.opusModel.trim() } : {}),
          ...(form.subagentModel.trim() ? { subagentModel: form.subagentModel.trim() } : {})
        }
      : {
          ...(form.reasoningEffort.trim() ? { reasoningEffort: form.reasoningEffort.trim() } : {}),
          ...(form.modelProvider.trim() ? { modelProvider: form.modelProvider.trim() } : {}),
          ...(form.fastMode ? { fastMode: true } : {}),
          ...(Object.keys(parseKeyValueLines(form.customModels)).length > 0
            ? { customModels: parseKeyValueLines(form.customModels) }
            : {})
        })
  }
  return {
    type: form.type,
    name: form.name.trim(),
    ...(form.command.trim() ? { command: form.command.trim() } : {}),
    ...(form.apiKey ? { apiKey: form.apiKey } : {}),
    fields,
    ...(form.env.trim() ? { env: parseLocalProviderEnvironment(form.env) } : {})
  }
}

function Field({
  id,
  label,
  value,
  onChange,
  type = 'text',
  placeholder
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  placeholder?: string
}): React.JSX.Element {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        autoComplete={type === 'password' ? 'new-password' : 'off'}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}

export function ProviderFieldsEditor({
  form,
  setForm,
  editing,
  apiKeyRevealed,
  apiKeyConfigured,
  onToggleReveal
}: {
  form: ProviderFormState
  setForm: (form: ProviderFormState) => void
  editing: boolean
  apiKeyRevealed?: boolean
  apiKeyConfigured?: boolean
  onToggleReveal?: () => void
}): React.JSX.Element {
  const update = <K extends keyof ProviderFormState>(key: K, value: ProviderFormState[K]): void => {
    setForm({ ...form, [key]: value })
  }
  const prefix = editing ? 'edit' : 'new'
  return (
    <div className="space-y-4 rounded-lg border border-border/60 p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${prefix}-provider-type`}>类型</Label>
          <select
            id={`${prefix}-provider-type`}
            value={form.type}
            disabled={editing}
            onChange={(event) =>
              update('type', event.target.value === 'codex' ? 'codex' : 'claude-code')
            }
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
          >
            <option value="claude-code">Claude</option>
            <option value="codex">Codex</option>
          </select>
        </div>
        <Field
          id={`${prefix}-provider-name`}
          label="供应商名称"
          value={form.name}
          onChange={(value) => update('name', value)}
          placeholder="例如：我的中转站"
        />
        <Field
          id={`${prefix}-provider-command`}
          label="命令"
          value={form.command}
          onChange={(value) => update('command', value)}
          placeholder={form.type === 'codex' ? 'codex' : 'claude'}
        />
        <div className="space-y-1.5">
          <Label htmlFor={`${prefix}-provider-api-key`}>API Key / Auth Token</Label>
          <div className="flex gap-2">
            <Input
              id={`${prefix}-provider-api-key`}
              type={apiKeyRevealed ? 'text' : 'password'}
              value={form.apiKey}
              placeholder={editing ? '留空以保留已配置密钥' : undefined}
              autoComplete="new-password"
              onChange={(event) => update('apiKey', event.target.value)}
            />
            {onToggleReveal ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0"
                disabled={editing && apiKeyConfigured !== true && !form.apiKey}
                onClick={onToggleReveal}
              >
                {apiKeyRevealed ? '隐藏' : '显示'}
              </Button>
            ) : null}
          </div>
          {apiKeyRevealed && apiKeyConfigured ? (
            <p className="text-xs text-muted-foreground">明文仅在此处显示，未保存前不会写入磁盘。</p>
          ) : null}
        </div>
        <Field
          id={`${prefix}-provider-base-url`}
          label="请求地址 Base URL"
          value={form.baseUrl}
          onChange={(value) => update('baseUrl', value)}
          placeholder="https://api.example.com"
        />
        {form.type === 'claude-code' ? (
          <div className="space-y-1.5">
            <Label htmlFor={`${prefix}-provider-auth-field`}>认证字段</Label>
            <select
              id={`${prefix}-provider-auth-field`}
              value={form.authField}
              onChange={(event) => update('authField', event.target.value)}
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
            >
              <option value="ANTHROPIC_AUTH_TOKEN">ANTHROPIC_AUTH_TOKEN</option>
              <option value="ANTHROPIC_API_KEY">ANTHROPIC_API_KEY</option>
            </select>
          </div>
        ) : null}
        <Field
          id={`${prefix}-provider-model`}
          label={form.type === 'codex' ? '默认模型' : '模型'}
          value={form.model}
          onChange={(value) => update('model', value)}
        />
        <Field
          id={`${prefix}-provider-fallback-model`}
          label="默认兜底模型"
          value={form.fallbackModel}
          onChange={(value) => update('fallbackModel', value)}
        />
        <div className="space-y-1.5">
          <Label htmlFor={`${prefix}-provider-upstream`}>上游格式</Label>
          <select
            id={`${prefix}-provider-upstream`}
            value={form.upstreamFormat}
            onChange={(event) =>
              update('upstreamFormat', event.target.value as ProviderFormState['upstreamFormat'])
            }
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
          >
            <option value="auto">自动</option>
            <option value="anthropic">Anthropic</option>
            <option value="openai">OpenAI Chat</option>
            <option value="responses">OpenAI Responses</option>
          </select>
        </div>
      </div>
      {form.type === 'claude-code' ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            id={`${prefix}-haiku`}
            label="Haiku 模型"
            value={form.haikuModel}
            onChange={(value) => update('haikuModel', value)}
          />
          <Field
            id={`${prefix}-sonnet`}
            label="Sonnet 模型"
            value={form.sonnetModel}
            onChange={(value) => update('sonnetModel', value)}
          />
          <Field
            id={`${prefix}-opus`}
            label="Opus 模型"
            value={form.opusModel}
            onChange={(value) => update('opusModel', value)}
          />
          <Field
            id={`${prefix}-subagent`}
            label="Subagent 模型"
            value={form.subagentModel}
            onChange={(value) => update('subagentModel', value)}
          />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            id={`${prefix}-reasoning`}
            label="Reasoning effort"
            value={form.reasoningEffort}
            onChange={(value) => update('reasoningEffort', value)}
            placeholder="low / medium / high"
          />
          <Field
            id={`${prefix}-model-provider`}
            label="Model provider"
            value={form.modelProvider}
            onChange={(value) => update('modelProvider', value)}
            placeholder="openai 或 custom"
          />
          <label className="flex h-9 items-center gap-2 text-sm text-muted-foreground sm:col-span-2">
            <input
              type="checkbox"
              checked={form.fastMode}
              onChange={(event) => update('fastMode', event.target.checked)}
            />
            Fast mode
          </label>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${prefix}-model-mappings`}>模型映射</Label>
          <Textarea
            id={`${prefix}-model-mappings`}
            value={form.modelMappings}
            onChange={(event) => update('modelMappings', event.target.value)}
            placeholder="claude-sonnet=provider-sonnet\nclaude-opus=provider-opus"
          />
          <p className="text-xs text-muted-foreground">每行一个 alias=target。</p>
        </div>
        {form.type === 'codex' ? (
          <div className="space-y-1.5">
            <Label htmlFor={`${prefix}-custom-models`}>Codex Custom models</Label>
            <Textarea
              id={`${prefix}-custom-models`}
              value={form.customModels}
              onChange={(event) => update('customModels', event.target.value)}
              placeholder="菜单别名=实际模型"
            />
          </div>
        ) : null}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${prefix}-provider-env`}>环境变量</Label>
        <Textarea
          id={`${prefix}-provider-env`}
          value={form.env}
          onChange={(event) => update('env', event.target.value)}
          placeholder="KEY=value\nANOTHER=value"
        />
        <p className="text-xs text-muted-foreground">
          每行一个 KEY=value；敏感变量在列表中只显示掩码。
        </p>
      </div>
    </div>
  )
}
