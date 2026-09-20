import { describe, expect, it, vi } from 'vitest'
import { buildAgentRenameInput, sendAgentRenameInput } from './agent-terminal-rename'

describe('agent terminal rename input', () => {
  it('builds a single-line rename command without the submit key', () => {
    expect(buildAgentRenameInput('Release notes')).toBe('/rename Release notes')
  })

  it('does not build a command for an empty title', () => {
    expect(buildAgentRenameInput('  \n\t')).toBeNull()
  })

  it('sends the command and Enter as separate writes to every pane', async () => {
    const firstSendInput = vi.fn(() => true)
    const secondSendInput = vi.fn(() => true)
    const wait = vi.fn(async () => undefined)

    const sent = await sendAgentRenameInput(
      'Multiple panes',
      [{ sendInput: firstSendInput }, { sendInput: secondSendInput }],
      { wait }
    )

    expect(sent).toBe(2)
    expect(firstSendInput.mock.calls).toEqual([['/rename Multiple panes'], ['\r']])
    expect(secondSendInput.mock.calls).toEqual([['/rename Multiple panes'], ['\r']])
    expect(wait).toHaveBeenCalledTimes(2)
  })

  it('retries Enter for Codex after its composer has had time to render', async () => {
    const sendInput = vi.fn(() => true)
    const wait = vi.fn(async () => undefined)

    await sendAgentRenameInput('Codex title', [{ agentType: 'codex', sendInput }], { wait })

    expect(sendInput.mock.calls).toEqual([['/rename Codex title'], ['\r'], ['\r']])
    expect(wait).toHaveBeenCalledTimes(2)
  })

  it('normalizes line breaks before sending the title', async () => {
    const sendInput = vi.fn(() => true)

    await sendAgentRenameInput('first\nsecond\rthird', [{ sendInput }], {
      wait: async () => undefined
    })

    expect(sendInput).toHaveBeenCalledWith('/rename first second third')
  })
})
