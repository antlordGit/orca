import { useEffect, useRef } from 'react'
import type { AgentType } from '../../../../shared/agent-status-types'
import { isTuiAgent, TUI_AGENT_CONFIG } from '../../../../shared/tui-agent-config'
import type { PaneManager } from '@/lib/pane-manager/pane-manager'
import type { PtyTransport } from './pty-transport-types'

export const AGENT_TERMINAL_RENAME_EVENT = 'orca-agent-terminal-rename'
export const AGENT_RENAME_SUBMIT_DELAY_MS = 50

export type AgentTerminalRenameDetail = {
  tabId: string
  title: string
}

export type AgentRenamePane = {
  agentType?: AgentType
  sendInput: (data: string) => boolean
}

export function buildAgentRenameInput(title: string): string | null {
  const normalizedTitle = title.replace(/[\r\n]+/g, ' ').trim()
  return normalizedTitle.length > 0 ? `/rename ${normalizedTitle}` : null
}

export async function sendAgentRenameInput(
  title: string,
  panes: readonly AgentRenamePane[],
  options: {
    wait?: (delayMs: number) => Promise<void>
  } = {}
): Promise<number> {
  const input = buildAgentRenameInput(title)
  if (!input) {
    return 0
  }
  const wait =
    options.wait ?? ((delayMs) => new Promise<void>((resolve) => setTimeout(resolve, delayMs)))
  let sent = 0
  for (const pane of panes) {
    if (!pane.sendInput(input)) {
      continue
    }
    await wait(AGENT_RENAME_SUBMIT_DELAY_MS)
    if (!pane.sendInput('\r')) {
      continue
    }
    const submitRetryDelayMs =
      pane.agentType && isTuiAgent(pane.agentType)
        ? TUI_AGENT_CONFIG[pane.agentType]?.submitRetryDelayMs
        : undefined
    if (submitRetryDelayMs !== undefined) {
      await wait(submitRetryDelayMs)
      pane.sendInput('\r')
    }
    sent += 1
  }
  return sent
}

export function requestAgentTerminalRename(tabId: string, title: string): void {
  window.dispatchEvent(
    new CustomEvent<AgentTerminalRenameDetail>(AGENT_TERMINAL_RENAME_EVENT, {
      detail: { tabId, title }
    })
  )
}

type AgentRenameListenerProps = {
  tabId: string
  managerRef: React.RefObject<PaneManager | null>
  paneTransportsRef: React.RefObject<Map<number, PtyTransport>>
  tabAgentTypeByLeaf: Readonly<Record<string, AgentType>>
}

/** Sends a manually renamed tab title to every mounted pane. */
export function useAgentTerminalRenameListener({
  tabId,
  managerRef,
  paneTransportsRef,
  tabAgentTypeByLeaf
}: AgentRenameListenerProps): void {
  const agentTypesRef = useRef(tabAgentTypeByLeaf)
  useEffect(() => {
    agentTypesRef.current = tabAgentTypeByLeaf
  }, [tabAgentTypeByLeaf])

  useEffect(() => {
    const onRenameRequest = (event: Event): void => {
      const detail = (event as CustomEvent<AgentTerminalRenameDetail | undefined>).detail
      if (!detail || detail.tabId !== tabId) {
        return
      }
      const manager = managerRef.current
      if (!manager) {
        return
      }
      void sendAgentRenameInput(
        detail.title,
        manager.getPanes().map((pane) => ({
          agentType: agentTypesRef.current[pane.leafId],
          sendInput: (input: string) =>
            paneTransportsRef.current.get(pane.id)?.sendInput(input) ?? false
        }))
      )
    }
    window.addEventListener(AGENT_TERMINAL_RENAME_EVENT, onRenameRequest)
    return () => window.removeEventListener(AGENT_TERMINAL_RENAME_EVENT, onRenameRequest)
  }, [managerRef, paneTransportsRef, tabId])
}
