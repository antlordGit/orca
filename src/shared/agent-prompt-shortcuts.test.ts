import { describe, expect, it } from 'vitest'
import {
  MAX_AGENT_PROMPT_SHORTCUTS_PER_AGENT,
  MAX_AGENT_PROMPT_SHORTCUT_CONTENT_LENGTH,
  MAX_AGENT_PROMPT_SHORTCUT_ID_LENGTH,
  MAX_AGENT_PROMPT_SHORTCUT_NAME_LENGTH,
  applyAgentPromptShortcutsToAgent,
  isAgentPromptShortcutComplete,
  normalizeAgentPromptShortcuts,
  readAgentPromptShortcuts,
  updateAgentPromptShortcutsForAgent,
  type AgentPromptShortcut
} from './agent-prompt-shortcuts'

function shortcut(overrides: Partial<AgentPromptShortcut> = {}): AgentPromptShortcut {
  return {
    id: 'shortcut-1',
    name: 'Review',
    content: 'Review the change',
    enabled: true,
    ...overrides
  }
}

describe('normalizeAgentPromptShortcuts', () => {
  it('returns an empty map for missing or malformed input', () => {
    expect(normalizeAgentPromptShortcuts(undefined)).toEqual({})
    expect(normalizeAgentPromptShortcuts(null)).toEqual({})
    expect(normalizeAgentPromptShortcuts([])).toEqual({})
    expect(normalizeAgentPromptShortcuts('claude')).toEqual({})
  })

  it('keeps known agents with valid rows and drops unknown agents or non-list values', () => {
    const normalized = normalizeAgentPromptShortcuts({
      claude: [shortcut()],
      codex: 'not-a-list',
      'not-an-agent': [shortcut()],
      gemini: [shortcut({ name: ' ' }), shortcut({ id: 'gemini-1' })]
    })

    expect(Object.keys(normalized)).toEqual(['claude', 'gemini'])
    expect(normalized.gemini?.map((entry) => entry.id)).toEqual(['gemini-1'])
  })

  it('trims names, trims trailing content whitespace, and preserves enabled false', () => {
    const normalized = normalizeAgentPromptShortcuts({
      claude: [
        shortcut({ name: '  Review  ', content: 'Body\n\n', enabled: false }),
        shortcut({ id: 'shortcut-2', name: 'Improve' })
      ]
    })

    expect(normalized.claude).toEqual([
      { id: 'shortcut-1', name: 'Review', content: 'Body', enabled: false },
      { id: 'shortcut-2', name: 'Improve', content: 'Review the change', enabled: true }
    ])
  })

  it('drops entries with blank names or blank content', () => {
    const normalized = normalizeAgentPromptShortcuts({
      claude: [
        shortcut({ id: 'blank-name', name: '   ' }),
        shortcut({ id: 'blank-content', content: '  \n ' }),
        shortcut({ id: 'kept' })
      ]
    })

    expect(normalized.claude?.map((entry) => entry.id)).toEqual(['kept'])
  })

  it('bounds ids, names, content, and the per-agent count', () => {
    const longId = 'i'.repeat(MAX_AGENT_PROMPT_SHORTCUT_ID_LENGTH + 20)
    const longName = 'n'.repeat(MAX_AGENT_PROMPT_SHORTCUT_NAME_LENGTH + 20)
    const longContent = 'c'.repeat(MAX_AGENT_PROMPT_SHORTCUT_CONTENT_LENGTH + 20)
    const overflow = Array.from({ length: MAX_AGENT_PROMPT_SHORTCUTS_PER_AGENT + 5 }, (_, index) =>
      shortcut({ id: `shortcut-${index}`, name: `Shortcut ${index}` })
    )

    const normalized = normalizeAgentPromptShortcuts({
      claude: [shortcut({ id: longId, name: longName, content: longContent }), ...overflow]
    })

    expect(normalized.claude?.[0]?.id).toHaveLength(MAX_AGENT_PROMPT_SHORTCUT_ID_LENGTH)
    expect(normalized.claude?.[0]?.name).toHaveLength(MAX_AGENT_PROMPT_SHORTCUT_NAME_LENGTH)
    expect(normalized.claude?.[0]?.content).toHaveLength(MAX_AGENT_PROMPT_SHORTCUT_CONTENT_LENGTH)
    expect(normalized.claude).toHaveLength(MAX_AGENT_PROMPT_SHORTCUTS_PER_AGENT)
  })

  it('generates missing ids and de-duplicates colliding ids deterministically', () => {
    const normalized = normalizeAgentPromptShortcuts({
      claude: [
        shortcut({ id: '', name: 'One' }),
        shortcut({ id: 'dup', name: 'Two' }),
        shortcut({ id: 'dup', name: 'Three' })
      ]
    })

    const ids = normalized.claude?.map((entry) => entry.id) ?? []
    expect(new Set(ids).size).toBe(3)
    expect(ids[1]).toBe('dup')
    expect(ids[2]).toMatch(/^dup-/)
  })
})

describe('isAgentPromptShortcutComplete', () => {
  it('requires a trimmed name and non-blank content', () => {
    expect(isAgentPromptShortcutComplete(shortcut())).toBe(true)
    expect(isAgentPromptShortcutComplete(shortcut({ name: ' ' }))).toBe(false)
    expect(isAgentPromptShortcutComplete(shortcut({ content: '\n\t' }))).toBe(false)
  })
})

describe('per-agent reads and writes', () => {
  it('reads one agent list, returning empty when absent', () => {
    const map = { claude: [shortcut()] }

    expect(readAgentPromptShortcuts(map, 'claude')).toHaveLength(1)
    expect(readAgentPromptShortcuts(map, 'codex')).toEqual([])
    expect(readAgentPromptShortcuts(null, 'claude')).toEqual([])
  })

  it('replaces only the target agent list and leaves other agents untouched', () => {
    const current = { claude: [shortcut()], codex: [shortcut({ id: 'codex-1' })] }

    const next = applyAgentPromptShortcutsToAgent(current, 'claude', [shortcut({ id: 'claude-2' })])

    expect(next.claude?.map((entry) => entry.id)).toEqual(['claude-2'])
    expect(next.codex?.map((entry) => entry.id)).toEqual(['codex-1'])
    expect(current.claude?.map((entry) => entry.id)).toEqual(['shortcut-1'])
  })

  it('drops the agent key entirely when the replacement list normalizes empty', () => {
    const next = applyAgentPromptShortcutsToAgent({ claude: [shortcut()] }, 'claude', [
      shortcut({ name: ' ' })
    ])

    expect(next).toEqual({})
  })

  it('serializes current settings through the target-agent writer', () => {
    const next = updateAgentPromptShortcutsForAgent(
      { codex: [shortcut({ id: 'codex-1' })] },
      'claude',
      [{ id: 'claude-1', name: '  Review ', content: 'Body\n', enabled: false }]
    )

    expect(next).toEqual({
      codex: [{ id: 'codex-1', name: 'Review', content: 'Review the change', enabled: true }],
      claude: [{ id: 'claude-1', name: 'Review', content: 'Body', enabled: false }]
    })
  })
})
