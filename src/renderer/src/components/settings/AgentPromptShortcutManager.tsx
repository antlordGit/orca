import { useState } from 'react'
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import type { AgentPromptShortcut } from '../../../../shared/agent-prompt-shortcuts'
import { createBrowserUuid } from '@/lib/browser-uuid'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Textarea } from '../ui/textarea'
import { SettingsBadge, SettingsSegmentedControl } from './SettingsFormControls'

type ShortcutDraft = AgentPromptShortcut

export function AgentPromptShortcutManager({
  shortcuts,
  onChange
}: {
  shortcuts: readonly AgentPromptShortcut[]
  onChange: (shortcuts: AgentPromptShortcut[]) => void
}): React.JSX.Element {
  const [editing, setEditing] = useState<ShortcutDraft | null>(null)
  const [error, setError] = useState<string | null>(null)
  const normalizedName = (value: string): string => value.trim().toLocaleLowerCase()
  const startAdd = (): void => {
    setEditing({ id: `agent-prompt-${createBrowserUuid()}`, name: '', content: '', enabled: true })
    setError(null)
  }
  const save = (): void => {
    if (!editing) {
      return
    }
    const name = editing.name.trim()
    const content = editing.content.trimEnd()
    if (!name) {
      setError(
        translate(
          'auto.components.settings.AgentsPane.shortcutNameRequired',
          'Enter a shortcut name.'
        )
      )
      return
    }
    if (!content.trim()) {
      setError(
        translate(
          'auto.components.settings.AgentsPane.shortcutContentRequired',
          'Enter prompt content.'
        )
      )
      return
    }
    if (
      shortcuts.some(
        (item) => item.id !== editing.id && normalizedName(item.name) === normalizedName(name)
      )
    ) {
      setError(
        translate(
          'auto.components.settings.AgentsPane.shortcutNameDuplicate',
          'Shortcut names must be unique for this agent.'
        )
      )
      return
    }
    const nextItem = { ...editing, name, content }
    const index = shortcuts.findIndex((item) => item.id === editing.id)
    onChange(
      index === -1
        ? [...shortcuts, nextItem]
        : shortcuts.map((item, i) => (i === index ? nextItem : item))
    )
    setEditing(null)
    setError(null)
  }
  const cancel = (): void => {
    setEditing(null)
    setError(null)
  }
  return (
    <section className="mt-4 space-y-2 border-t border-border/40 pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-xs font-medium">
            {translate('auto.components.settings.AgentsPane.promptShortcuts', 'Prompt shortcuts')}
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {translate(
              'auto.components.settings.AgentsPane.promptShortcutsDescription',
              'Save prompts you can send from this agent’s Native Chat composer.'
            )}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={startAdd}
          disabled={editing !== null}
          className="h-7 gap-1 text-xs"
        >
          <Plus className="size-3" />
          {translate('auto.components.settings.AgentsPane.addPromptShortcut', 'Add shortcut')}
        </Button>
      </div>
      {shortcuts.length === 0 && !editing ? (
        <p className="text-[11px] text-muted-foreground">
          {translate(
            'auto.components.settings.AgentsPane.noPromptShortcuts',
            'No prompt shortcuts saved.'
          )}
        </p>
      ) : null}
      <div className="space-y-1.5">
        {shortcuts.map((shortcut) => (
          <div
            key={shortcut.id}
            className={cn(
              'rounded-md border border-border/50 px-2.5 py-2',
              !shortcut.enabled && 'bg-muted/30 opacity-75'
            )}
          >
            {editing?.id === shortcut.id ? (
              <ShortcutDraftFields
                draft={editing}
                error={error}
                onChange={setEditing}
                onCancel={cancel}
                onSave={save}
              />
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-xs font-medium">{shortcut.name}</span>
                    <SettingsBadge tone={shortcut.enabled ? 'accent' : 'muted'}>
                      {shortcut.enabled ? 'Enabled' : 'Disabled'}
                    </SettingsBadge>
                  </div>
                  <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-[11px] text-muted-foreground">
                    {shortcut.content}
                  </p>
                </div>
                <SettingsSegmentedControl<'enabled' | 'disabled'>
                  value={shortcut.enabled ? 'enabled' : 'disabled'}
                  onChange={(value) =>
                    onChange(
                      shortcuts.map((item) =>
                        item.id === shortcut.id ? { ...item, enabled: value === 'enabled' } : item
                      )
                    )
                  }
                  ariaLabel={`${shortcut.name} shortcut availability`}
                  size="sm"
                  options={[
                    { value: 'enabled', label: 'Enabled' },
                    { value: 'disabled', label: 'Disabled' }
                  ]}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Edit ${shortcut.name}`}
                  onClick={() => {
                    setEditing({ ...shortcut })
                    setError(null)
                  }}
                  disabled={editing !== null}
                >
                  <Pencil />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove ${shortcut.name}`}
                  onClick={() => onChange(shortcuts.filter((item) => item.id !== shortcut.id))}
                  disabled={editing !== null}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 />
                </Button>
              </div>
            )}
          </div>
        ))}
        {editing && !shortcuts.some((item) => item.id === editing.id) ? (
          <div className="rounded-md border border-border/50 px-2.5 py-2">
            <ShortcutDraftFields
              draft={editing}
              error={error}
              onChange={setEditing}
              onCancel={cancel}
              onSave={save}
            />
          </div>
        ) : null}
      </div>
    </section>
  )
}

function ShortcutDraftFields({
  draft,
  error,
  onChange,
  onCancel,
  onSave
}: {
  draft: ShortcutDraft
  error: string | null
  onChange: (value: ShortcutDraft) => void
  onCancel: () => void
  onSave: () => void
}): React.JSX.Element {
  return (
    <div className="space-y-2">
      <Input
        autoFocus
        value={draft.name}
        onChange={(event) => onChange({ ...draft, name: event.target.value })}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            onSave()
          }
          if (event.key === 'Escape') {
            onCancel()
          }
        }}
        placeholder="Shortcut name"
        aria-label="Shortcut name"
        aria-invalid={Boolean(error) || undefined}
        className="h-7 text-xs"
      />
      <Textarea
        value={draft.content}
        onChange={(event) => onChange({ ...draft, content: event.target.value })}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            onCancel()
          }
        }}
        placeholder="Prompt content"
        aria-label="Prompt content"
        aria-invalid={Boolean(error) || undefined}
        className="min-h-20 text-xs"
      />
      {error ? <p className="text-[11px] text-destructive">{error}</p> : null}
      <div className="flex justify-end gap-1.5">
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={onCancel}
          className="h-7 gap-1 text-xs"
        >
          <X className="size-3" />
          Cancel
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="xs"
          onClick={onSave}
          className="h-7 gap-1 text-xs"
        >
          <Check className="size-3" />
          Save
        </Button>
      </div>
    </div>
  )
}
