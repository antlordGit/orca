import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type {
  LocalProviderDiagnostic,
  LocalProviderRecord
} from '../../shared/local-provider-types'
import {
  buildClaudeCodeEnvironment,
  mergeClaudeSettingsJson
} from '../cli-providers/claude-cli-provider-config'
import { buildCodexTomlUpdates } from '../cli-providers/codex-cli-provider-config'
import { upsertTopLevelSettingsInContent } from '../codex/codex-config-settings-upsert'
import { writeTomlConfigAtomically } from '../codex/config-toml-atomic-write'
import { renameFileWithWindowsRetry } from '../codex-accounts/fs-utils'
import { resolveLocalProviderConfigDir } from './local-provider-config-dir'

export type LocalProviderProjection = {
  affectedFiles: string[]
  diagnostics: LocalProviderDiagnostic[]
}

export type LocalProviderProjectionOptions = {
  homePath: string
  claudeConfigDir?: string | null
  codexConfigDir?: string | null
}

export function projectLocalProvider(
  provider: LocalProviderRecord,
  options: LocalProviderProjectionOptions
): LocalProviderProjection {
  return provider.type === 'claude-code'
    ? projectClaudeProvider(provider, options)
    : projectCodexProvider(provider, options)
}

function projectClaudeProvider(
  provider: LocalProviderRecord,
  options: LocalProviderProjectionOptions
): LocalProviderProjection {
  // Why no `.claude` segment: the pin is CLAUDE_CONFIG_DIR itself, which holds
  // settings.json directly — same shape the CLI resolves for its own default.
  const settingsPath = join(
    resolveLocalProviderConfigDir({ type: 'claude-code', ...options }),
    'settings.json'
  )
  try {
    const existing = existsSync(settingsPath) ? readFileSync(settingsPath, 'utf-8') : null
    const contents = mergeClaudeSettingsJson(existing, buildClaudeCodeEnvironment(provider))
    if (contents !== existing) {
      writeJsonConfigAtomically(settingsPath, contents)
    }
    return { affectedFiles: [settingsPath], diagnostics: [] }
  } catch (error) {
    return {
      affectedFiles: [],
      diagnostics: [
        {
          code: 'claude-settings-write-failed',
          message: error instanceof Error ? error.message : 'Could not write Claude settings.json.'
        }
      ]
    }
  }
}

function projectCodexProvider(
  provider: LocalProviderRecord,
  options: LocalProviderProjectionOptions
): LocalProviderProjection {
  // Why no `.codex` segment: the pin is CODEX_HOME itself, which holds config.toml directly.
  const configPath = join(
    resolveLocalProviderConfigDir({ type: 'codex', ...options }),
    'config.toml'
  )
  const diagnostics: LocalProviderDiagnostic[] = []
  try {
    const existing = existsSync(configPath) ? readFileSync(configPath, 'utf-8') : ''
    const updates = buildCodexTomlUpdates(provider)
    const rendered = new Map<string, string>(
      Object.entries(updates)
        .filter(([key]) => !key.startsWith('ORCA_'))
        .map(([key, value]) => [key, String(value)])
    )
    let contents = upsertTopLevelSettingsInContent(existing, rendered)
    if (provider.fields?.baseUrl || provider.fields?.customModels) {
      const providerId = provider.fields.modelProvider?.trim() || 'custom'
      const result = upsertCodexProviderSection(
        contents,
        providerId,
        provider.fields.baseUrl,
        provider.fields.customModels
      )
      contents = result.contents
      diagnostics.push(...result.diagnostics)
    }
    if (provider.fields?.modelMappings && Object.keys(provider.fields.modelMappings).length > 0) {
      diagnostics.push({
        code: 'codex-model-mappings-not-projectable',
        message:
          'Codex 模型映射没有等价的 config.toml 标准字段，已保留在供应商配置中但未写入 Codex。'
      })
    }
    if (provider.fields?.upstreamFormat && provider.fields.upstreamFormat !== 'auto') {
      diagnostics.push({
        code: 'codex-upstream-format-not-projectable',
        message: 'Codex 上游格式需要路由层能力协商，当前 local provider 不会伪称该字段已生效。'
      })
    }
    if (contents !== existing) {
      writeTomlConfigAtomically(configPath, contents)
    }
    return { affectedFiles: [configPath], diagnostics }
  } catch (error) {
    return {
      affectedFiles: [],
      diagnostics: [
        {
          code: 'codex-config-write-failed',
          message: error instanceof Error ? error.message : 'Could not write Codex config.toml.'
        }
      ]
    }
  }
}

function upsertCodexProviderSection(
  content: string,
  providerId: string,
  baseUrl: string | undefined,
  customModels: Record<string, string> | undefined
): { contents: string; diagnostics: LocalProviderDiagnostic[] } {
  const diagnostics: LocalProviderDiagnostic[] = []
  if (!/^[A-Za-z0-9_-]+$/.test(providerId)) {
    diagnostics.push({
      code: 'codex-model-provider-invalid',
      message: `Codex model provider 名称“${providerId}”包含无法安全写入 TOML section 的字符。`
    })
    return { contents: content, diagnostics }
  }
  if (customModels && Object.keys(customModels).length > 0) {
    diagnostics.push({
      code: 'codex-custom-models-not-projectable',
      message:
        'Codex custom models 不是 config.toml 的标准 provider 字段，已保留在供应商配置中但未写入。'
    })
  }
  if (!baseUrl) {
    return { contents: content, diagnostics }
  }
  const sectionHeader = `[model_providers.${providerId}]`
  const lines = content.split('\n')
  const headerIndex = lines.findIndex((line) => line.trim() === sectionHeader)
  const rendered = `base_url = ${quoteTomlString(baseUrl)}`
  if (headerIndex === -1) {
    const separator =
      lines.length > 0 && lines.at(-1)?.trim() !== '' ? ['', sectionHeader] : [sectionHeader]
    const suffix = lines.at(-1) === '' ? [sectionHeader, rendered] : [...separator, rendered]
    return { contents: `${[...lines.slice(0, -1), ...suffix].join('\n')}`, diagnostics }
  }
  let end = headerIndex + 1
  while (end < lines.length && !/^\s*\[[^\]]+\]\s*$/.test(lines[end] ?? '')) {
    end += 1
  }
  const baseIndex = lines.findIndex(
    (line, index) => index > headerIndex && index < end && /^\s*base_url\s*=/.test(line)
  )
  if (baseIndex === -1) {
    lines.splice(end, 0, rendered)
  } else {
    lines[baseIndex] = rendered
  }
  return { contents: lines.join('\n'), diagnostics }
}

function quoteTomlString(value: string): string {
  return `"${value
    .replaceAll('\\', '\\\\')
    .replaceAll('"', '\\"')
    .replaceAll('\n', '\\n')
    .replaceAll('\r', '\\r')}"`
}

function writeJsonConfigAtomically(path: string, contents: string): void {
  const directory = dirname(path)
  mkdirSync(directory, { recursive: true })
  const temporaryPath = `${path}.${process.pid}.${randomUUID()}.tmp`
  try {
    writeFileSync(temporaryPath, contents, 'utf-8')
    renameFileWithWindowsRetry(temporaryPath, path)
  } finally {
    if (existsSync(temporaryPath)) {
      try {
        unlinkSync(temporaryPath)
      } catch {
        // Cleanup must not mask the write failure.
      }
    }
  }
}
