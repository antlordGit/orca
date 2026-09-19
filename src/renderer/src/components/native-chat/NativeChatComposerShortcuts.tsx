import { useState } from 'react'
import { MessageSquarePlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import type { NativeChatPromptShortcut } from './native-chat-composer-types'

export type NativeChatComposerShortcutsProps = {
  /** Enabled, usable shortcuts for the agent this composer is talking to. */
  shortcuts: readonly NativeChatPromptShortcut[]
  disabled: boolean
  onSelect: (shortcut: NativeChatPromptShortcut) => void
}

/**
 * One-click saved prompts for the running agent. Selecting an item sends its
 * text immediately — the prompt shortcut is a send action, not an insert.
 */
export function NativeChatComposerShortcuts({
  shortcuts,
  disabled,
  onSelect
}: NativeChatComposerShortcutsProps): React.JSX.Element | null {
  const [open, setOpen] = useState(false)
  if (shortcuts.length === 0) {
    return null
  }
  const label = translate('components.native-chat.composer.promptShortcuts', 'Prompt shortcuts')
  return (
    <DropdownMenu modal={false} open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={label}
              disabled={disabled}
              className="pointer-coarse:size-11"
            >
              <MessageSquarePlus className="size-4" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={4}>
          {label}
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent side="top" align="start" className="w-60">
        {shortcuts.map((shortcut) => (
          <DropdownMenuItem
            key={shortcut.id}
            onSelect={() => {
              setOpen(false)
              onSelect(shortcut)
            }}
          >
            <span className="min-w-0 flex-1 truncate">{shortcut.name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
