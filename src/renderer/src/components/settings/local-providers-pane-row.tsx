import { useEffect, useState } from 'react'
import type { LocalProviderSummary } from '../../../../shared/local-provider-types'
import { Button } from '../ui/button'
import { translate } from '@/i18n/i18n'
import {
  ProviderFieldsEditor,
  formFromProvider,
  type ProviderFormState
} from './local-providers-pane-form'
import { LocalProvidersPaneConfigJson } from './local-providers-pane-config-json'

export function ProviderRow({
  provider,
  pendingId,
  editing,
  onToggle,
  onEdit,
  onDelete,
  onSave,
  onCancel
}: {
  provider: LocalProviderSummary
  pendingId: string | null
  editing: boolean
  onToggle: (provider: LocalProviderSummary) => void
  onEdit: (provider: LocalProviderSummary) => void
  onDelete: (provider: LocalProviderSummary) => void
  onSave: (provider: LocalProviderSummary, form: ProviderFormState) => void
  onCancel: () => void
}): React.JSX.Element {
  const [form, setForm] = useState(() => formFromProvider(provider))
  const [apiKeyRevealed, setApiKeyRevealed] = useState(false)
  const [revealError, setRevealError] = useState<string | null>(null)
  useEffect(() => {
    if (editing) {
      setForm(formFromProvider(provider))
      setApiKeyRevealed(false)
      setRevealError(null)
    }
  }, [editing, provider])

  const toggleApiKeyReveal = async (): Promise<void> => {
    if (apiKeyRevealed) {
      setApiKeyRevealed(false)
      return
    }
    setRevealError(null)
    try {
      const secret = await window.api.localProviders.reveal({ id: provider.id })
      if (secret === null) {
        setRevealError('该供应商未配置密钥。')
        return
      }
      setForm((current) => ({ ...current, apiKey: secret }))
      setApiKeyRevealed(true)
    } catch (reason: unknown) {
      setRevealError(reason instanceof Error ? reason.message : '无法读取密钥。')
    }
  }

  const typeLabel = provider.type === 'claude-code' ? 'Claude' : 'Codex'
  return (
    <div className="space-y-3 rounded-lg border border-border/60 px-3 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{provider.name}</span>
            <span className="rounded-full border border-border/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">
              {typeLabel}
            </span>
            <span className="text-xs text-muted-foreground">
              {provider.enabled
                ? translate('auto.components.settings.LocalProvidersPane.enabled', '已启用')
                : translate('auto.components.settings.LocalProvidersPane.disabled', '已停用')}
            </span>
            {provider.apiKeyConfigured ? (
              <span className="text-xs text-muted-foreground">API Key 已配置</span>
            ) : null}
          </div>
          <p className="truncate font-mono text-xs text-muted-foreground">{provider.command}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={provider.enabled ? 'outline' : 'default'}
            size="sm"
            disabled={pendingId === provider.id}
            onClick={() => onToggle(provider)}
          >
            {provider.enabled ? '停用' : '启用'}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => onEdit(provider)}>
            编辑
          </Button>
          <Button type="button" variant="destructive" size="sm" onClick={() => onDelete(provider)}>
            删除
          </Button>
        </div>
      </div>
      {editing ? (
        <>
          <ProviderFieldsEditor
            form={form}
            setForm={setForm}
            editing
            apiKeyRevealed={apiKeyRevealed}
            apiKeyConfigured={provider.apiKeyConfigured === true}
            onToggleReveal={() => void toggleApiKeyReveal()}
          />
          {revealError ? (
            <p className="text-sm text-destructive" role="alert">
              {revealError}
            </p>
          ) : null}
          <LocalProvidersPaneConfigJson
            form={form}
            hasApiKey={provider.apiKeyConfigured === true}
            onFormChange={setForm}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              取消
            </Button>
            <Button type="button" onClick={() => onSave(provider, form)}>
              保存
            </Button>
          </div>
        </>
      ) : null}
    </div>
  )
}