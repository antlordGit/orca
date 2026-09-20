import { homedir } from 'node:os'
import { join } from 'node:path'
import type { LocalProviderType } from '../../shared/local-provider-types'

/**
 * Resolves the config root a local provider type projects into.
 *
 * The pin is the CLI's own config root, not a parent: Claude's `CLAUDE_CONFIG_DIR`
 * holds `settings.json` directly, Codex's `CODEX_HOME` holds `config.toml` directly.
 * Callers must join their filename onto the returned path without adding a
 * `.claude`/`.codex` segment.
 */
export function resolveLocalProviderConfigDir(args: {
  type: LocalProviderType
  claudeConfigDir?: string | null
  codexConfigDir?: string | null
  homePath?: string
}): string {
  const home = args.homePath ?? homedir()
  const configured = (args.type === 'claude-code' ? args.claudeConfigDir : args.codexConfigDir)?.trim()
  return configured || join(home, args.type === 'claude-code' ? '.claude' : '.codex')
}

/** The env var that moves the CLI onto `configDir`, or `null` when no pin is needed. */
export function localProviderConfigDirEnv(args: {
  type: LocalProviderType
  configDir: string
  homePath?: string
}): Record<string, string> {
  const defaultDir = resolveLocalProviderConfigDir({ type: args.type, homePath: args.homePath })
  if (args.configDir === defaultDir) {
    return {}
  }
  return args.type === 'claude-code'
    ? { CLAUDE_CONFIG_DIR: args.configDir }
    : { CODEX_HOME: args.configDir }
}
