import type { TuiAgent } from './tui-agent'
import type { AgentPromptShortcuts } from './agent-prompt-shortcuts'

/** Agent launch identity and agent-tab naming, split out of GlobalSettings so each file stays
 *  under the max-lines budget. */
export type GlobalAgentSettings = {
  /** Per-agent default CLI arguments appended after the binary/path and before prompts. */
  agentDefaultArgs?: Partial<Record<TuiAgent, string>>
  /** Per-agent launch environment defaults used when yolo mode is exposed as env. */
  agentDefaultEnv?: Partial<Record<TuiAgent, Record<string, string>>>
  /** Saved one-click prompts for the Native Chat composer, keyed by agent. */
  agentPromptShortcuts?: AgentPromptShortcuts
  /** One-shot guard for adding yolo-mode default args to untouched agent launch profiles. */
  agentYoloDefaultsMigrated?: boolean
  /** Why: disabling must persist so startup doesn't reinstall global agent hook entries the user just removed. */
  agentStatusHooksEnabled: boolean
  /** A local agent-state-rules.json that replaces downloaded and bundled rules, for testing a rule
   *  change. */
  agentStateRulesPath?: string | null
  /** Off: rules are never downloaded and a cached download is ignored, so the bundled rules (or a
   *  local override) apply. Absent reads as on. */
  agentStateRulesLiveUpdates?: boolean
  /** Pre-trust the worktree or folder Orca starts an agent in, so its "trust this folder?" prompt is skipped. Defaults on. */
  agentWorkspaceTrustEnabled: boolean
  /** Why: generated tab titles are subjective, so they stay opt-in and manual renames win. */
  tabAutoGenerateTitle: boolean
  /** Rename sends a slash command into the running agent, so it defaults off. */
  agentTabRenameSendsSlashCommand: boolean
}
