import { beforeEach, describe, expect, it, vi } from 'vitest'
import { requestAgentTabRenameCommand } from './agent-tab-rename-command'

const storeState = vi.hoisted(() => ({
  settings: { agentTabRenameSendsSlashCommand: true },
  tabsByWorktree: {} as Record<string, unknown[]>,
  paneForegroundAgentByPaneKey: {} as Record<string, unknown>
}))
const LEAF = '3f2504e0-4f89-41d3-9a0c-0305e82c3301'

const writeAccepted = vi.hoisted(() =>
  vi.fn<(ptyId: string, data: string, kind: string) => Promise<boolean>>(async () => true)
)

vi.mock('@/store', () => ({
  useAppStore: Object.assign(
    (selector: (state: typeof storeState) => unknown) => selector(storeState),
    {
      getState: () => storeState
    }
  )
}))

vi.mock('@/runtime/runtime-terminal-verified-input', () => ({
  sendRuntimePtyInputVerified: writeAccepted
}))

function tab(overrides: Record<string, unknown> = {}) {
  return { id: 'tab-1', ptyId: 'pty-1', launchAgent: 'claude', ...overrides }
}

describe('requestAgentTabRenameCommand', () => {
  beforeEach(() => {
    writeAccepted.mockClear()
    storeState.settings = { agentTabRenameSendsSlashCommand: true }
    storeState.tabsByWorktree = { 'wt-1': [tab()] }
    storeState.paneForegroundAgentByPaneKey = {}
  })

  it('types the slash command key by key and ends with Enter', async () => {
    requestAgentTabRenameCommand('tab-1', 'Build logs')

    await vi.waitFor(() => {
      expect(writeAccepted.mock.calls.at(-1)?.[1]).toBe('\r')
    })
    const typed = writeAccepted.mock.calls.map((call) => call[1]).join('')
    expect(typed).toContain('/rename Build logs')
    expect(typed.endsWith('\r')).toBe(true)
  })

  it('stays silent while the setting is off', () => {
    storeState.settings = { agentTabRenameSendsSlashCommand: false }

    requestAgentTabRenameCommand('tab-1', 'Build logs')

    expect(writeAccepted).not.toHaveBeenCalled()
  })

  it('uses the live foreground agent for a tab Orca did not launch', async () => {
    storeState.tabsByWorktree = { 'wt-1': [tab({ launchAgent: undefined })] }
    storeState.paneForegroundAgentByPaneKey = {
      [`tab-1:${LEAF}`]: {
        agent: 'codearts',
        agentEvidence: 'process-read',
        shellForeground: false
      }
    }

    requestAgentTabRenameCommand('tab-1', 'Build logs')

    await vi.waitFor(() => {
      expect(writeAccepted.mock.calls.at(-1)?.[1]).toBe('\r')
    })
    const typed = writeAccepted.mock.calls.map((call) => call[1]).join('')
    expect(typed).toContain("~/.codeartsdoer/bin/cs-rename 'Build logs'")
  })

  it('stays silent once the foreground is back at the shell', () => {
    storeState.tabsByWorktree = { 'wt-1': [tab({ launchAgent: undefined })] }
    storeState.paneForegroundAgentByPaneKey = {
      [`tab-1:${LEAF}`]: { agent: 'claude', agentEvidence: 'process-read', shellForeground: true }
    }

    requestAgentTabRenameCommand('tab-1', 'Build logs')

    expect(writeAccepted).not.toHaveBeenCalled()
  })

  it('stays silent for a tab with no launched agent or no PTY', () => {
    storeState.tabsByWorktree = { 'wt-1': [tab({ launchAgent: undefined })] }
    requestAgentTabRenameCommand('tab-1', 'Build logs')
    storeState.tabsByWorktree = { 'wt-1': [tab({ ptyId: null })] }
    requestAgentTabRenameCommand('tab-1', 'Build logs')

    expect(writeAccepted).not.toHaveBeenCalled()
  })
})
