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

type ShortcutDraft = {
  id: string
  name: string
  content: string
  enabled: boolean
}

function createShortcutDraft(): ShortcutDraft {
  return { id: `agent-prompt-${createBrowserUuid()}`, name: '', content: '', enabled: true }
}

function normalizedName(name: string): string {
  return name.trim().toLocaleLowerCase()
}

export function AgentPromptShortcutManager({
  shortcuts,
  onChange
}: {
  shortcuts: readonly AgentPromptShortcut[]
  onChange: (shortcuts: AgentPromptShortcut[]) => void
}): React.JSX.Element {
  const [editing, setEditing] = useState<ShortcutDraft | null>(null)
  const [error, setError] = useState<string | null>(null)

  const beginAdd = (): void => {
    setEditing(createShortcutDraft())
    setError(null)
  }

  const beginEdit = (shortcut: AgentPromptShortcut): void => {
    setEditing({ ...shortcut })
    setError(null)
  }

  const cancelEdit = (): void => {
    setEditing(null)
    setError(null)
  }

  const saveEdit = (): void => {
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
    const duplicate = shortcuts.some(
      (shortcut) =>
        shortcut.id !== editing.id && normalizedName(shortcut.name) === normalizedName(name)
    )
    if (duplicate) {
      setError(
        translate(
          'auto.components.settings.AgentsPane.shortcutNameDuplicate',
          'Shortcut names must be unique for this agent.'
        )
      )
      return
    }
    const saved: AgentPromptShortcut = {
      id: editing.id,
      name,
      content,
      enabled: editing.enabled
    }
    const existingIndex = shortcuts.findIndex((shortcut) => shortcut.id === editing.id)
    const next = [...shortcuts]
    if (existingIndex === -1) {
      next.push(saved)
    } else {
      next[existingIndex] = saved
    }
    onChange(next)
    setEditing(null)
    setError(null)
  }

  const toggleShortcut = (shortcut: AgentPromptShortcut, enabled: boolean): void => {
    onChange(shortcuts.map((item) => (item.id === shortcut.id ? { ...item, enabled } : item)))
  }

  const removeShortcut = (shortcut: AgentPromptShortcut): void => {
    onChange(shortcuts.filter((item) => item.id !== shortcut.id))
    if (editing?.id === shortcut.id) {
      cancelEdit()
    }
  }

  return (
    <div className="mt-4 space-y-2 border-t border-border/40 pt-3">
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
          onClick={beginAdd}
          disabled={editing !== null}
          className="h-7 gap-1 text-xs"
        >
          <Plus className="size-3" />
          {translate('auto.components.settings.AgentsPane.addPromptShortcut', 'Add shortcut')}
        </Button>
      </div>

      {shortcuts.length === 0 && editing === null ? (
        <p className="text-[11px] text-muted-foreground">
          {translate(
            'auto.components.settings.AgentsPane.noPromptShortcuts',
            'No prompt shortcuts saved.'
          )}
        </p>
      ) : (
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
                  onCancel={cancelEdit}
                  onSave={saveEdit}
                />
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-xs font-medium">{shortcut.name}</span>
                      <SettingsBadge tone={shortcut.enabled ? 'accent' : 'muted'}>
                        {shortcut.enabled
                          ? translate('auto.components.settings.AgentsPane.enabled', 'Enabled')
                          : translate('auto.components.settings.AgentsPane.disabled', 'Disabled')}
                      </SettingsBadge>
                    </div>
                    <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-[11px] text-muted-foreground">
                      {shortcut.content}
                    </p>
                  </div>
                  <SettingsSegmentedControl<'enabled' | 'disabled'>
                    value={shortcut.enabled ? 'enabled' : 'disabled'}
                    onChange={(value) => toggleShortcut(shortcut, value === 'enabled')}
                    ariaLabel={translate(
                      'auto.components.settings.AgentsPane.shortcutAvailability',
                      '{{value0}} shortcut availability',
                      { value0: shortcut.name }
                    )}
                    size="sm"
                    options={[
                      {
                        value: 'enabled',
                        label: translate('auto.components.settings.AgentsPane.enabled', 'Enabled')
                      },
                      {
                        value: 'disabled',
                        label: translate('auto.components.settings.AgentsPane.disabled', 'Disabled')
                      }
                    ]}
                  />
                  <div className="flex shrink-0 items-center gap-0.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={translate(
                        'auto.components.settings.AgentsPane.editPromptShortcut',
                        'Edit {{value0}}',
                        { value0: shortcut.name }
                      )}
                      onClick={() => beginEdit(shortcut)}
                      disabled={editing !== null}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={translate(
                        'auto.components.settings.AgentsPane.removePromptShortcut',
                        'Remove {{value0}}',
                        { value0: shortcut.name }
                      )}
                      onClick={() => removeShortcut(shortcut)}
                      disabled={editing !== null}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {editing?.id !== undefined &&
          !shortcuts.some((shortcut) => shortcut.id === editing.id) ? (
            <div className="rounded-md border border-border/50 px-2.5 py-2">
              <ShortcutDraftFields
                draft={editing}
                error={error}
                onChange={setEditing}
                onCancel={cancelEdit}
                onSave={saveEdit}
              />
            </div>
          ) : null}
        </div>
      )}
      {editing === null && error ? <p className="text-[11px] text-destructive">{error}</p> : null}
    </div>
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
  onChange: (draft: ShortcutDraft) => void
  onCancel: () => void
  onSave: () => void
}): React.JSX.Element {
  return (
    <div className="space-y-2">
      <Input
        value={draft.name}
        onChange={(event) => onChange({ ...draft, name: event.target.value })}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            onSave()
          } else if (event.key === 'Escape') {
            event.preventDefault()
            onCancel()
          }
        }}
        placeholder={translate('auto.components.settings.AgentsPane.shortcutName', 'Shortcut name')}
        aria-label={translate('auto.components.settings.AgentsPane.shortcutName', 'Shortcut name')}
        aria-invalid={Boolean(error) || undefined}
        className="h-7 text-xs"
        autoFocus
      />
      <Textarea
        value={draft.content}
        onChange={(event) => onChange({ ...draft, content: event.target.value })}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            onCancel()
          }
        }}
        placeholder={translate(
          'auto.components.settings.AgentsPane.shortcutContent',
          'Prompt content'
        )}
        aria-label={translate(
          'auto.components.settings.AgentsPane.shortcutContent',
          'Prompt content'
        )}
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
          {translate('auto.components.settings.AgentsPane.cancel', 'Cancel')}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="xs"
          onClick={onSave}
          className="h-7 gap-1 text-xs"
        >
          <Check className="size-3" />
          {translate('auto.components.settings.AgentsPane.save', 'Save')}
        </Button>
      </div>
    </div>
  )
}
