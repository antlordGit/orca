import { describe, expect, it } from 'vitest'
import { buildAgentTabRenameCommand } from './agent-tab-rename-command'

describe('buildAgentTabRenameCommand', () => {
  it('builds an unquoted slash command from the new title, on a running agent', () => {
    expect(buildAgentTabRenameCommand('  Build logs ', 'claude')).toBe('/rename Build logs')
  })

  it('flattens line breaks so Enter still submits the whole title', () => {
    expect(buildAgentTabRenameCommand('first\nsecond', 'codex')).toBe('/rename first second')
  })

  it('names a CodeArts session through its CLI, with the title quoted', () => {
    expect(buildAgentTabRenameCommand('Build logs', 'codearts')).toBe(
      "~/.codeartsdoer/bin/cs-rename 'Build logs'"
    )
  })

  it('keeps shell metacharacters in a CodeArts title literal', () => {
    expect(buildAgentTabRenameCommand("it's $HOME `x`", 'codearts')).toBe(
      "~/.codeartsdoer/bin/cs-rename 'it'\\''s $HOME `x`'"
    )
  })

  it('sends nothing for a plain terminal or a cleared title', () => {
    expect(buildAgentTabRenameCommand('Build logs', undefined)).toBeNull()
    expect(buildAgentTabRenameCommand('   ', 'claude')).toBeNull()
  })
})
