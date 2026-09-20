import { useEffect, useState } from 'react'
import { useAppStore } from '@/store'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'

type ConfigDirKey = 'claudeConfigDir' | 'codexConfigDir'

const TARGETS: {
  key: ConfigDirKey
  id: string
  label: string
  description: string
  placeholder: string
  envVar: string
}[] = [
  {
    key: 'claudeConfigDir',
    id: 'claude-config-dir',
    label: 'Claude Code 配置目录',
    description: '存放 settings.json 的目录（CLAUDE_CONFIG_DIR）。留空使用默认 ~/.claude。',
    placeholder: '~/.claude',
    envVar: 'CLAUDE_CONFIG_DIR'
  },
  {
    key: 'codexConfigDir',
    id: 'codex-config-dir',
    label: 'Codex 配置目录',
    description: '存放 config.toml 的目录（CODEX_HOME）。留空使用默认 ~/.codex。',
    placeholder: '~/.codex',
    envVar: 'CODEX_HOME'
  }
]

function ConfigDirRow({
  target,
  value,
  saving,
  onSave
}: {
  target: (typeof TARGETS)[number]
  value: string
  saving: boolean
  onSave: (next: string) => Promise<void>
}): React.JSX.Element {
  const [draft, setDraft] = useState(value)
  useEffect(() => {
    setDraft(value)
  }, [value])

  const handlePick = async (): Promise<void> => {
    const picked = await window.api.shell.pickDirectory({
      defaultPath: draft.trim() || undefined
    })
    if (picked) {
      setDraft(picked)
      await onSave(picked)
    }
  }

  const pending = draft !== value
  return (
    <div className="space-y-1.5">
      <Label htmlFor={target.id}>{target.label}</Label>
      <div className="flex gap-2">
        <Input
          id={target.id}
          value={draft}
          placeholder={target.placeholder}
          spellCheck={false}
          onChange={(event) => setDraft(event.target.value)}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={() => void handlePick()}
        >
          选择目录
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0"
          disabled={saving || !pending}
          onClick={() => void onSave(draft)}
        >
          保存
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="shrink-0"
          disabled={saving || (!value && !draft)}
          onClick={() => void onSave('')}
        >
          恢复默认
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{target.description}</p>
    </div>
  )
}

export function LocalProvidersConfigDirSection(): React.JSX.Element {
  const settings = useAppStore((state) => state.settings)
  const updateSettingsOrThrow = useAppStore((state) => state.updateSettingsOrThrow)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async (key: ConfigDirKey, next: string): Promise<void> => {
    setSaving(true)
    setError(null)
    try {
      // Why: the main process normalizes `~` and rejects a non-absolute path by
      // storing '' — the pane echoes back whatever was actually persisted.
      await updateSettingsOrThrow({ [key]: next })
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : '无法保存配置目录。')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="space-y-4 border-t border-border/60 pt-6">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">配置目录</h3>
        <p className="text-xs text-muted-foreground">
          指定 Claude Code 与 Codex 使用的配置目录，启用后对新会话生效。
        </p>
      </div>
      {TARGETS.map((target) => (
        <ConfigDirRow
          key={target.key}
          target={target}
          value={settings?.[target.key] ?? ''}
          saving={saving}
          onSave={(next) => save(target.key, next)}
        />
      ))}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  )
}
