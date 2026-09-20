import type { TuiAgent } from '../../shared/tui-agent'
import type {
  LocalProviderEnvironment,
  LocalProviderRecord
} from '../../shared/local-provider-types'
import { getEnabledLocalProvider, type LocalProviderStore } from './service'
import { buildClaudeCodeEnvironment } from '../cli-providers/claude-cli-provider-config'
import { buildCodexProviderEnvironment } from '../cli-providers/codex-cli-provider-config'
import {
  localProviderConfigDirEnv,
  resolveLocalProviderConfigDir
} from './local-provider-config-dir'

function isClaudeLaunch(launchAgent: TuiAgent | undefined, command: string | undefined): boolean {
  if (launchAgent === 'claude' || launchAgent === 'claude-agent-teams') {
    return true
  }
  return /(?:^|[\\/])claude(?:\.exe)?(?:\s|$)/i.test(command ?? '')
}

function isCodexLaunch(launchAgent: TuiAgent | undefined, command: string | undefined): boolean {
  if (launchAgent === 'codex') {
    return true
  }
  return /(?:^|[\\/])codex(?:\.exe)?(?:\s|$)/i.test(command ?? '')
}

export function buildEnabledLocalProviderEnvironment(args: {
  store: LocalProviderStore | undefined
  launchAgent?: TuiAgent
  command?: string
  baseEnv: Record<string, string>
  configDirs?: { claudeConfigDir?: string | null; codexConfigDir?: string | null }
}): Record<string, string> {
  const { store, launchAgent, command, baseEnv, configDirs } = args
  const type = isClaudeLaunch(launchAgent, command)
    ? 'claude-code'
    : isCodexLaunch(launchAgent, command)
      ? 'codex'
      : null
  if (!type) {
    return baseEnv
  }
  // Why before the provider lookup: the config dir is a type-level setting, so it
  // still applies to a session with no local provider enabled.
  const configDirEnvironment = configDirs
    ? localProviderConfigDirEnv({
        type,
        configDir: resolveLocalProviderConfigDir({
          type,
          claudeConfigDir: configDirs.claudeConfigDir,
          codexConfigDir: configDirs.codexConfigDir
        })
      })
    : {}
  const provider = getEnabledLocalProvider(store, type)
  if (!provider) {
    return { ...baseEnv, ...configDirEnvironment }
  }
  const providerEnvironment: LocalProviderEnvironment =
    provider.type === 'claude-code'
      ? buildClaudeCodeEnvironment(provider)
      : buildCodexProviderEnvironment(provider)
  return { ...baseEnv, ...configDirEnvironment, ...providerEnvironment }
}

export function getEnabledProviderForSession(
  store: LocalProviderStore | undefined,
  type: LocalProviderRecord['type']
): LocalProviderRecord | null {
  return getEnabledLocalProvider(store, type)
}
