import type { AppState } from '@/store/types'
import type { TerminalTab } from '../../../shared/terminal-tab-types'
import type { TerminalAgent } from '../../../shared/terminal-agent'
import { useAppStore } from '@/store'
import { getTerminalTabOwnerWorktreeId } from '@/store/slices/terminal-tab-owner-index'
import { sendRuntimePtyInputVerified } from '@/runtime/runtime-terminal-verified-input'
import { parsePaneKey } from '../../../shared/stable-pane-id'
import { typeAgentTuiCommand } from '../../../shared/agent-tui-command-typing'
import { buildAgentTabRenameCommand } from '../../../shared/agent-tab-rename-command'

/**
 * Tells the agent running in a renamed tab about the new name, so the session keeps it instead
 * of drifting from the tab. Typed key-by-key because a slash command pasted in one write is read
 * as prose by the TUI's composer.
 */
export function requestAgentTabRenameCommand(tabId: string, title: string | null): void {
  const state = useAppStore.getState()
  if (state.settings?.agentTabRenameSendsSlashCommand !== true || !title) {
    return
  }
  const ownerWorktreeId = getTerminalTabOwnerWorktreeId(state.tabsByWorktree, tabId)
  const tab = ownerWorktreeId
    ? state.tabsByWorktree[ownerWorktreeId]?.find((entry) => entry.id === tabId)
    : undefined
  if (!tab?.ptyId) {
    return
  }
  const command = buildAgentTabRenameCommand(title, runningAgentOfTab(state, tab))
  if (!command) {
    return
  }
  void sendCommandToPty(tab.ptyId, command)
}

/**
 * The agent actually running in the tab. `launchAgent` only covers tabs Orca launched, so a
 * manually started agent (a typed `codearts`, for one) is known only by its live foreground read.
 */
function runningAgentOfTab(state: AppState, tab: TerminalTab): TerminalAgent | undefined {
  for (const [paneKey, entry] of Object.entries(state.paneForegroundAgentByPaneKey ?? {})) {
    if (parsePaneKey(paneKey)?.tabId === tab.id && entry.agent && !entry.shellForeground) {
      return entry.agent
    }
  }
  return tab.launchAgent
}

// Why: a rename must not depend on the agent: a refusal or an unreachable PTY leaves the tab
// name as the user typed it instead of surfacing an error for a rename already drawn.
async function sendCommandToPty(ptyId: string, command: string): Promise<void> {
  try {
    await typeAgentTuiCommand({
      command,
      write: async (key) =>
        (await sendRuntimePtyInputVerified(ptyId, key, 'driving')) ? 'accepted' : 'rejected'
    })
  } catch (error) {
    console.warn(
      '[agent-tab-rename] failed to send rename command:',
      error instanceof Error ? error.message : String(error)
    )
  }
}
