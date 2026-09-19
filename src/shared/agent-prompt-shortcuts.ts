import type { TuiAgent } from './tui-agent'
import { isTuiAgent } from './tui-agent-config'

/** A saved prompt the Native Chat composer can send to one agent in a single click. */
export type AgentPromptShortcut = {
  id: string
  name: string
  content: string
  /** Disabled shortcuts stay saved and editable but never reach the composer menu. */
  enabled: boolean
}

/** Per-agent shortcut lists; unknown agents and malformed entries are dropped on normalize. */
export type AgentPromptShortcuts = Partial<Record<TuiAgent, AgentPromptShortcut[]>>

export const MAX_AGENT_PROMPT_SHORTCUTS_PER_AGENT = 50
export const MAX_AGENT_PROMPT_SHORTCUT_ID_LENGTH = 80
export const MAX_AGENT_PROMPT_SHORTCUT_NAME_LENGTH = 80
// Why: matches the existing agent-prompt quick-command cap so a shortcut prompt
// can never exceed what the launch/paste paths already accept.
export const MAX_AGENT_PROMPT_SHORTCUT_CONTENT_LENGTH = 6000

/** A shortcut is only usable once it has a name to show and content to send. */
export function isAgentPromptShortcutComplete(shortcut: AgentPromptShortcut): boolean {
  return shortcut.name.trim().length > 0 && shortcut.content.trim().length > 0
}

function normalizeAgentPromptShortcutList(input: unknown): AgentPromptShortcut[] {
  if (!Array.isArray(input)) {
    return []
  }

  const normalized: AgentPromptShortcut[] = []
  const seenIds = new Set<string>()
  const seenNames = new Set<string>()

  for (const item of input) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      continue
    }
    const record = item as Record<string, unknown>
    const name = typeof record.name === 'string' ? record.name.trim() : ''
    const content = typeof record.content === 'string' ? record.content.trimEnd() : ''
    // Why: persisted rows must be usable; incomplete drafts never reach the composer.
    if (!name || !content.trim()) {
      continue
    }
    const nameKey = name.toLocaleLowerCase()
    if (!nameKey || seenNames.has(nameKey)) {
      continue
    }
    seenNames.add(nameKey)

    const idBase = (typeof record.id === 'string' ? record.id.trim() : '') || 'shortcut'
    const baseId = idBase.slice(0, MAX_AGENT_PROMPT_SHORTCUT_ID_LENGTH)
    let id = baseId
    let suffix = 2
    while (seenIds.has(id)) {
      const tail = `-${suffix}`
      id = `${baseId.slice(0, MAX_AGENT_PROMPT_SHORTCUT_ID_LENGTH - tail.length)}${tail}`
      suffix += 1
    }
    seenIds.add(id)

    normalized.push({
      id,
      name: name.slice(0, MAX_AGENT_PROMPT_SHORTCUT_NAME_LENGTH),
      content: content.slice(0, MAX_AGENT_PROMPT_SHORTCUT_CONTENT_LENGTH),
      enabled: record.enabled !== false
    })

    if (normalized.length >= MAX_AGENT_PROMPT_SHORTCUTS_PER_AGENT) {
      break
    }
  }

  return normalized
}

/** Canonical per-agent shortcut map: unknown agents, malformed rows and blank values are dropped. */
export function normalizeAgentPromptShortcuts(input: unknown): AgentPromptShortcuts {
  const normalized: AgentPromptShortcuts = {}
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return normalized
  }

  for (const [agent, list] of Object.entries(input)) {
    if (!isTuiAgent(agent)) {
      continue
    }
    const shortcuts = normalizeAgentPromptShortcutList(list)
    if (shortcuts.length > 0) {
      normalized[agent] = shortcuts
    }
  }

  return normalized
}

export function readAgentPromptShortcuts(
  shortcuts: AgentPromptShortcuts | null | undefined,
  agent: TuiAgent
): AgentPromptShortcut[] {
  return shortcuts?.[agent] ?? []
}

/** The composer menu only offers shortcuts the user has left enabled. */
export function listEnabledAgentPromptShortcuts(
  shortcuts: AgentPromptShortcuts | null | undefined,
  agent: TuiAgent
): AgentPromptShortcut[] {
  return readAgentPromptShortcuts(shortcuts, agent).filter(
    (shortcut) => shortcut.enabled && isAgentPromptShortcutComplete(shortcut)
  )
}

/** Replaces one agent's list, preserving every other agent's shortcuts. */
export function applyAgentPromptShortcutsToAgent(
  current: AgentPromptShortcuts | null | undefined,
  agent: TuiAgent,
  shortcuts: readonly AgentPromptShortcut[]
): AgentPromptShortcuts {
  const next: AgentPromptShortcuts = { ...current }
  const normalized = normalizeAgentPromptShortcutList(shortcuts)
  if (normalized.length > 0) {
    next[agent] = normalized
  } else {
    delete next[agent]
  }
  return next
}

/** Convenience wrapper for callers that hold raw shortcut drafts rather than a typed list. */
export function updateAgentPromptShortcutsForAgent(
  current: AgentPromptShortcuts | null | undefined,
  agent: TuiAgent,
  shortcuts: unknown
): AgentPromptShortcuts {
  return applyAgentPromptShortcutsToAgent(
    current,
    agent,
    normalizeAgentPromptShortcutList(shortcuts)
  )
}
