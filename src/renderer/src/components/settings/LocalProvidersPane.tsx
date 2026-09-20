import { useEffect, useMemo, useState } from 'react'
import type {
  LocalProviderSnapshot,
  LocalProviderSummary
} from '../../../../shared/local-provider-types'
import { Button } from '../ui/button'
import {
  INITIAL_FORM,
  ProviderFieldsEditor,
  buildInput,
  parseLocalProviderEnvironment,
  type ProviderFormState
} from './local-providers-pane-form'
import { ProviderRow } from './local-providers-pane-row'
import { LocalProvidersConfigDirSection } from './local-providers-config-dir-section'

const EMPTY_SNAPSHOT: LocalProviderSnapshot = { version: 1, providers: [] }

export function LocalProvidersPane(): React.JSX.Element {
  const [snapshot, setSnapshot] = useState<LocalProviderSnapshot>(EMPTY_SNAPSHOT)
  const [form, setForm] = useState<ProviderFormState>(INITIAL_FORM)
  const [loading, setLoading] = useState(true)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const groupedProviders = useMemo(
    () => ({
      claude: snapshot.providers.filter((provider) => provider.type === 'claude-code'),
      codex: snapshot.providers.filter((provider) => provider.type === 'codex')
    }),
    [snapshot.providers]
  )

  useEffect(() => {
    let mounted = true
    void window.api.localProviders
      .list()
      .then((nextSnapshot) => {
        if (mounted) {
          setSnapshot(nextSnapshot)
          setError(null)
        }
      })
      .catch((reason: unknown) => {
        if (mounted) {
          setError(reason instanceof Error ? reason.message : '无法加载本机提供商。')
        }
      })
      .finally(() => {
        if (mounted) {
          setLoading(false)
        }
      })
    return () => {
      mounted = false
    }
  }, [])

  const updateSnapshot = (nextSnapshot: LocalProviderSnapshot): void => {
    setSnapshot(nextSnapshot)
    setError(nextSnapshot.diagnostics?.map((diagnostic) => diagnostic.message).join('；') ?? null)
  }

  const toggleProvider = async (provider: LocalProviderSummary): Promise<void> => {
    setPendingId(provider.id)
    setError(null)
    try {
      updateSnapshot(
        await window.api.localProviders.enable({ id: provider.id, enabled: !provider.enabled })
      )
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : '无法更新本机提供商。')
    } finally {
      setPendingId(null)
    }
  }

  const saveNewProvider = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    if (!form.name.trim()) {
      setError('请输入供应商名称。')
      return
    }
    setSaving(true)
    setError(null)
    try {
      updateSnapshot(await window.api.localProviders.create(buildInput(form)))
      setForm(INITIAL_FORM)
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : '无法创建本机提供商。')
    } finally {
      setSaving(false)
    }
  }

  const saveProvider = async (
    provider: LocalProviderSummary,
    nextForm: ProviderFormState
  ): Promise<void> => {
    setSaving(true)
    setError(null)
    try {
      const input = buildInput(nextForm)
      const parsedEnv = nextForm.env.trim()
        ? parseLocalProviderEnvironment(nextForm.env)
        : undefined
      updateSnapshot(
        await window.api.localProviders.update({
          id: provider.id,
          updates: {
            name: input.name,
            ...(input.command ? { command: input.command } : {}),
            ...(input.apiKey ? { apiKey: input.apiKey } : {}),
            ...(input.fields ? { fields: input.fields } : {}),
            ...(parsedEnv !== undefined ? { env: parsedEnv } : {})
          }
        })
      )
      setEditingId(null)
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : '无法保存本机提供商。')
    } finally {
      setSaving(false)
    }
  }

  const deleteProvider = async (provider: LocalProviderSummary): Promise<void> => {
    if (!window.confirm(`确定删除“${provider.name}”吗？`)) {
      return
    }
    setError(null)
    try {
      updateSnapshot(await window.api.localProviders.delete({ id: provider.id }))
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : '无法删除本机提供商。')
    }
  }

  const renderGroup = (title: string, providers: LocalProviderSummary[]): React.JSX.Element => (
    <section className="space-y-2" aria-label={title}>
      <h3 className="text-sm font-semibold">{title}</h3>
      {providers.length > 0 ? (
        <div className="space-y-2">
          {providers.map((provider) => (
            <ProviderRow
              key={provider.id}
              provider={provider}
              pendingId={pendingId}
              editing={editingId === provider.id}
              onToggle={(next) => void toggleProvider(next)}
              onEdit={(next) => setEditingId(next.id)}
              onDelete={(next) => void deleteProvider(next)}
              onSave={(next, nextForm) => void saveProvider(next, nextForm)}
              onCancel={() => setEditingId(null)}
            />
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">未配置</p>
      )}
    </section>
  )

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">本机提供商</h3>
          <p className="text-xs text-muted-foreground">
            配置 Claude Code 和 Codex 的地址、认证、模型与环境变量。启用后只对新会话生效。
          </p>
        </div>
        {loading ? (
          <p className="text-sm text-muted-foreground">加载提供商中…</p>
        ) : (
          <div className="space-y-5">
            {renderGroup('Claude', groupedProviders.claude)}
            {renderGroup('Codex', groupedProviders.codex)}
          </div>
        )}
      </section>
      <form
        className="space-y-4 border-t border-border/60 pt-6"
        onSubmit={(event) => void saveNewProvider(event)}
      >
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">添加提供商</h3>
          <p className="text-xs text-muted-foreground">
            字段按 Claude 或 Codex 类型显示；API Key 不会在列表快照中返回明文。
          </p>
        </div>
        <ProviderFieldsEditor form={form} setForm={setForm} editing={false} />
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <Button type="submit" disabled={saving}>
          {saving ? '保存中…' : '添加提供商'}
        </Button>
      </form>
      <LocalProvidersConfigDirSection />
    </div>
  )
}
