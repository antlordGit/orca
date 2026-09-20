import type { AgentStatusEntry, AgentType } from '../../../../shared/agent-status-types'
import type { PaneForegroundAgentEntry } from '../../store/slices/pane-foreground-agent'

export type TerminalTabAgentTypeState = Record<string, AgentStatusEntry>
export type TerminalTabAgentTypesByLeaf = Readonly<Record<string, AgentType>>

type SelectorDependencies = {
  onEntryVisited?: (paneKey: string) => void
}

type AgentTypeIndexes = {
  all: Map<string, Record<string, AgentType>>
  live: Map<string, Record<string, AgentType>>
}

const EMPTY_AGENT_TYPES_BY_LEAF: TerminalTabAgentTypesByLeaf = Object.freeze({})
const EMPTY_FOREGROUND_AGENT_BY_PANE_KEY: Record<string, PaneForegroundAgentEntry> = Object.freeze(
  {}
)

function reuseRecordIfEqual(
  previous: TerminalTabAgentTypesByLeaf | undefined,
  next: Record<string, AgentType>
): TerminalTabAgentTypesByLeaf {
  if (!previous) {
    return next
  }
  const nextKeys = Object.keys(next)
  if (Object.keys(previous).length !== nextKeys.length) {
    return next
  }
  return nextKeys.every((key) => previous[key] === next[key]) ? previous : next
}

function addAgentType(
  index: Map<string, Record<string, AgentType>>,
  paneKey: string,
  agentType: AgentType
): void {
  const separator = paneKey.indexOf(':')
  if (separator <= 0) {
    return
  }
  const tabId = paneKey.slice(0, separator)
  const leafId = paneKey.slice(separator + 1)
  const byLeaf = index.get(tabId)
  if (byLeaf) {
    byLeaf[leafId] = agentType
  } else {
    index.set(tabId, { [leafId]: agentType })
  }
}

function addForegroundAgentType(
  index: Map<string, Record<string, AgentType>>,
  paneKey: string,
  agentType: AgentType
): void {
  const separator = paneKey.indexOf(':')
  if (separator <= 0) {
    return
  }
  const tabId = paneKey.slice(0, separator)
  const leafId = paneKey.slice(separator + 1)
  const byLeaf = index.get(tabId)
  if (byLeaf) {
    byLeaf[leafId] ??= agentType
  } else {
    index.set(tabId, { [leafId]: agentType })
  }
}

function stabilizeIndex(
  previous: Map<string, TerminalTabAgentTypesByLeaf>,
  next: Map<string, Record<string, AgentType>>
): Map<string, TerminalTabAgentTypesByLeaf> {
  const stabilized = new Map<string, TerminalTabAgentTypesByLeaf>()
  for (const [tabId, byLeaf] of next) {
    stabilized.set(tabId, reuseRecordIfEqual(previous.get(tabId), byLeaf))
  }
  return stabilized
}

function collectAgentTypeIndexes(
  state: TerminalTabAgentTypeState,
  foreground: Record<string, PaneForegroundAgentEntry>,
  onEntryVisited?: (paneKey: string) => void
): AgentTypeIndexes {
  const all = new Map<string, Record<string, AgentType>>()
  const live = new Map<string, Record<string, AgentType>>()
  for (const [paneKey, entry] of Object.entries(state)) {
    onEntryVisited?.(paneKey)
    if (!entry.agentType) {
      continue
    }
    addAgentType(all, paneKey, entry.agentType)
    if (entry.state !== 'done') {
      addAgentType(live, paneKey, entry.agentType)
    }
  }
  for (const [paneKey, entry] of Object.entries(foreground)) {
    if (!entry.agent || entry.shellForeground || entry.routingRevoked) {
      continue
    }
    addForegroundAgentType(all, paneKey, entry.agent)
    addForegroundAgentType(live, paneKey, entry.agent)
  }
  return { all, live }
}

function createSelector(
  includeDone: boolean,
  dependencies: SelectorDependencies = {}
): (
  state: TerminalTabAgentTypeState,
  tabId: string,
  foreground?: Record<string, PaneForegroundAgentEntry>
) => TerminalTabAgentTypesByLeaf {
  let cachedState: TerminalTabAgentTypeState | null = null
  let cachedForeground: Record<string, PaneForegroundAgentEntry> | null = null
  let cachedByTabId = new Map<string, TerminalTabAgentTypesByLeaf>()

  return (state, tabId, foreground = EMPTY_FOREGROUND_AGENT_BY_PANE_KEY) => {
    if (state !== cachedState || foreground !== cachedForeground) {
      const previousByTabId = cachedByTabId
      const indexes = collectAgentTypeIndexes(state, foreground, dependencies.onEntryVisited)
      cachedByTabId = stabilizeIndex(previousByTabId, includeDone ? indexes.all : indexes.live)
      cachedState = state
      cachedForeground = foreground
    }
    return cachedByTabId.get(tabId) ?? EMPTY_AGENT_TYPES_BY_LEAF
  }
}

export function createTerminalTabAgentTypeSelector(
  dependencies: SelectorDependencies = {}
): (
  state: TerminalTabAgentTypeState,
  tabId: string,
  foreground?: Record<string, PaneForegroundAgentEntry>
) => TerminalTabAgentTypesByLeaf {
  return createSelector(true, dependencies)
}

let sharedState: TerminalTabAgentTypeState | null = null
let sharedForeground: Record<string, PaneForegroundAgentEntry> | null = null
let sharedAll = new Map<string, TerminalTabAgentTypesByLeaf>()
let sharedLive = new Map<string, TerminalTabAgentTypesByLeaf>()

function getSharedIndexes(
  state: TerminalTabAgentTypeState,
  foreground: Record<string, PaneForegroundAgentEntry>
): void {
  if (state === sharedState && foreground === sharedForeground) {
    return
  }
  const indexes = collectAgentTypeIndexes(state, foreground)
  sharedAll = stabilizeIndex(sharedAll, indexes.all)
  sharedLive = stabilizeIndex(sharedLive, indexes.live)
  sharedState = state
  sharedForeground = foreground
}

// TerminalPane is mounted once per retained tab. Both selectors share one scan of the global map.
export const selectTerminalTabAgentTypesByLeaf = (
  state: TerminalTabAgentTypeState,
  tabId: string,
  foreground: Record<string, PaneForegroundAgentEntry> = EMPTY_FOREGROUND_AGENT_BY_PANE_KEY
): TerminalTabAgentTypesByLeaf => {
  getSharedIndexes(state, foreground)
  return sharedAll.get(tabId) ?? EMPTY_AGENT_TYPES_BY_LEAF
}

// Terminal input routing must not target panes whose Agent has already exited.
export const selectLiveTerminalTabAgentTypesByLeaf = (
  state: TerminalTabAgentTypeState,
  tabId: string,
  foreground: Record<string, PaneForegroundAgentEntry> = EMPTY_FOREGROUND_AGENT_BY_PANE_KEY
): TerminalTabAgentTypesByLeaf => {
  getSharedIndexes(state, foreground)
  return sharedLive.get(tabId) ?? EMPTY_AGENT_TYPES_BY_LEAF
}
