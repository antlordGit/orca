import { useAppStore } from '@/store'
import { listEnabledAgentPromptShortcuts } from '../../../../shared/agent-prompt-shortcuts'
import type { TuiAgent } from '../../../../shared/tui-agent'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { getSettingsForAgentTabRuntimeOwner } from '@/lib/agent-paste-draft'
import { sendNativeChatMessage } from '../native-chat/native-chat-runtime-send'
import type { PtyTransport } from './pty-transport'

export function TerminalAgentPromptShortcuts({
  tabId,
  agent,
  transport
}: {
  tabId: string
  agent: TuiAgent
  transport: PtyTransport
}): React.JSX.Element | null {
  const settings = useAppStore((state) => state.settings)
  const shortcuts = listEnabledAgentPromptShortcuts(settings?.agentPromptShortcuts, agent)
  const ptyId = transport.getPtyId()
  if (!ptyId || shortcuts.length === 0) {
    return null
  }
  return (
    <div
      className="terminal-agent-prompt-shortcuts"
      role="group"
      aria-label={translate('components.native-chat.composer.promptShortcuts', 'Prompt shortcuts')}
    >
      {shortcuts.map((shortcut) => (
        <Button
          key={shortcut.id}
          type="button"
          variant="secondary"
          size="xs"
          title={shortcut.content}
          onClick={() => {
            const runtimeSettings = getSettingsForAgentTabRuntimeOwner(tabId)
            sendNativeChatMessage(runtimeSettings, ptyId, shortcut.content)
          }}
        >
          <span className="max-w-48 truncate">{shortcut.name}</span>
        </Button>
      ))}
    </div>
  )
}
