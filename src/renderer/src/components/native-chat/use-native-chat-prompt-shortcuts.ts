import { useCallback, useMemo } from 'react'
import { useAppStore } from '../../store'
import { listEnabledAgentPromptShortcuts } from '../../../../shared/agent-prompt-shortcuts'
import { isTuiAgent } from '../../../../shared/tui-agent-config'
import type { NativeChatComposerImageAttachment } from './NativeChatComposerField'
import type {
  NativeChatPromptShortcut,
  NativeChatStructuredComposerTransport
} from './native-chat-composer-types'

export function useNativeChatPromptShortcuts(agent: string): NativeChatPromptShortcut[] {
  const shortcuts = useAppStore((store) => store.settings?.agentPromptShortcuts)
  return useMemo(
    () =>
      isTuiAgent(agent)
        ? listEnabledAgentPromptShortcuts(shortcuts, agent).map(({ id, name, content }) => ({
            id,
            name,
            content
          }))
        : [],
    [agent, shortcuts]
  )
}

export function useNativeChatComposerSendActions(args: {
  disabled: boolean
  draft: string
  hasPendingAttachment: boolean
  imageAttachments: readonly NativeChatComposerImageAttachment[]
  structuredTransport?: NativeChatStructuredComposerTransport
  sendStructured: (text: string, attachments?: readonly NativeChatComposerImageAttachment[]) => void
  sendPty: (text?: string, attachments?: readonly { path: string }[]) => void
}): {
  send: () => void
  sendPromptShortcut: (shortcut: NativeChatPromptShortcut) => void
} {
  const send = useCallback(() => {
    if (args.hasPendingAttachment) {
      return
    }
    if (!args.structuredTransport) {
      args.sendPty()
    } else if (args.draft.trim() !== '' || args.imageAttachments.length > 0) {
      if (!args.disabled) {
        args.sendStructured(args.draft, args.imageAttachments)
      }
    }
  }, [args])

  const sendPromptShortcut = useCallback(
    (shortcut: NativeChatPromptShortcut): void => {
      if (args.disabled) {
        return
      }
      if (args.structuredTransport) {
        args.sendStructured(shortcut.content, [])
      } else {
        args.sendPty(shortcut.content, [])
      }
    },
    [args]
  )

  return { send, sendPromptShortcut }
}
