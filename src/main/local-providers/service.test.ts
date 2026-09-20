import { mkdtempSync, mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir, tmpdir } from 'node:os'
import { afterEach, describe, expect, it } from 'vitest'
import type { LocalProviderRecord } from '../../shared/local-provider-types'
import { buildEnabledLocalProviderEnvironment } from './local-provider-session-environment'
import { LocalProviderService, type LocalProviderStore } from './service'

function makeStore(initial: LocalProviderRecord[] = []): LocalProviderStore {
  let providers = initial
  return {
    getLocalProviders: () =>
      providers.map((provider) => ({
        ...provider,
        args: [...provider.args],
        env: { ...provider.env }
      })),
    replaceLocalProviders: (next) => {
      providers = next
    }
  }
}

describe('LocalProviderService', () => {
  const directories: string[] = []

  afterEach(() => {
    for (const directory of directories.splice(0)) {
      void directory
    }
  })

  it('keeps API keys out of list snapshots and projects Claude fields', () => {
    const homePath = mkdtempSync(join(tmpdir(), 'orca-local-provider-'))
    directories.push(homePath)
    const settingsPath = join(homePath, '.claude', 'settings.json')
    const store = makeStore()
    const service = new LocalProviderService(store, { homePath })
    const snapshot = service.create({
      type: 'claude-code',
      name: 'Gateway',
      apiKey: 'secret-value',
      fields: {
        baseUrl: 'https://gateway.example/v1',
        authField: 'ANTHROPIC_API_KEY',
        model: 'gateway-default',
        fallbackModel: 'gateway-fallback',
        haikuModel: 'gateway-haiku',
        sonnetModel: 'gateway-sonnet',
        opusModel: 'gateway-opus',
        subagentModel: 'gateway-subagent',
        modelMappings: { 'claude-sonnet': 'gateway-sonnet' }
      }
    })

    expect(JSON.stringify(snapshot)).not.toContain('secret-value')
    expect(snapshot.providers[0]?.apiKeyConfigured).toBe(true)
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8')) as {
      env: Record<string, string>
    }
    expect(settings.env).toMatchObject({
      ANTHROPIC_API_KEY: 'secret-value',
      ANTHROPIC_BASE_URL: 'https://gateway.example/v1',
      ANTHROPIC_MODEL: 'gateway-default',
      ANTHROPIC_DEFAULT_FALLBACK_MODEL: 'gateway-fallback',
      ANTHROPIC_DEFAULT_HAIKU_MODEL: 'gateway-haiku',
      ANTHROPIC_DEFAULT_SONNET_MODEL: 'gateway-sonnet',
      ANTHROPIC_DEFAULT_OPUS_MODEL: 'gateway-opus',
      CLAUDE_CODE_SUBAGENT_MODEL: 'gateway-subagent'
    })
  })

  it('preserves unknown Claude JSON and reports unsupported Codex fields', () => {
    const homePath = mkdtempSync(join(tmpdir(), 'orca-local-provider-'))
    directories.push(homePath)
    const claudePath = join(homePath, '.claude')
    const codexPath = join(homePath, '.codex')
    mkdirSync(claudePath, { recursive: true })
    mkdirSync(codexPath, { recursive: true })
    writeFileSync(
      join(claudePath, 'settings.json'),
      JSON.stringify({ permissions: { allow: ['Read'] } })
    )
    const store = makeStore()
    const service = new LocalProviderService(store, { homePath })
    service.create({ type: 'claude-code', name: 'Claude', fields: { model: 'model' } })
    expect(JSON.parse(readFileSync(join(claudePath, 'settings.json'), 'utf8'))).toMatchObject({
      permissions: { allow: ['Read'] }
    })
    const codexSnapshot = service.create({
      type: 'codex',
      name: 'Codex',
      fields: {
        baseUrl: 'https://api.example',
        modelMappings: { alias: 'target' },
        upstreamFormat: 'openai'
      }
    })
    expect(codexSnapshot.diagnostics?.map((diagnostic) => diagnostic.code)).toEqual([
      'codex-model-mappings-not-projectable',
      'codex-upstream-format-not-projectable'
    ])
    expect(readFileSync(join(codexPath, 'config.toml'), 'utf8')).toContain(
      'base_url = "https://api.example"'
    )
  })

  it('reveals a stored secret only on explicit request', () => {
    const store = makeStore()
    const service = new LocalProviderService(store)
    const snapshot = service.create({
      type: 'claude-code',
      name: 'Gateway',
      apiKey: 'secret-value'
    })
    const id = snapshot.providers[0]?.id
    if (!id) {
      throw new Error('Expected a provider to be created')
    }

    // The reveal channel is the only path back to the plaintext.
    expect(JSON.stringify(service.list())).not.toContain('secret-value')
    expect(service.revealSecret(id)).toBe('secret-value')
  })

  it('reports null rather than an empty credential when no secret is stored', () => {
    const store = makeStore()
    const service = new LocalProviderService(store)
    const snapshot = service.create({ type: 'codex', name: 'No Key' })
    const id = snapshot.providers[0]?.id
    if (!id) {
      throw new Error('Expected a provider to be created')
    }
    expect(service.revealSecret(id)).toBeNull()
  })

  it('keeps the stored secret when an update omits the api key', () => {
    const store = makeStore()
    const service = new LocalProviderService(store)
    const snapshot = service.create({
      type: 'claude-code',
      name: 'Gateway',
      apiKey: 'secret-value'
    })
    const id = snapshot.providers[0]?.id
    if (!id) {
      throw new Error('Expected a provider to be created')
    }

    service.update(id, { name: 'Renamed' })

    expect(service.revealSecret(id)).toBe('secret-value')
  })

  it('disables other providers of the same kind when one is enabled', () => {
    const store = makeStore()
    const service = new LocalProviderService(store)
    service.create({
      type: 'claude-code',
      name: 'First',
      fields: { model: 'first-model' }
    })
    service.create({
      type: 'claude-code',
      name: 'Second',
      fields: { model: 'second-model' }
    })
    const first = service.readSnapshot().providers.find((p) => p.name === 'First')
    const second = service.readSnapshot().providers.find((p) => p.name === 'Second')
    if (!first || !second) {
      throw new Error('Expected both providers to be present')
    }
    service.enable(first.id, true)
    service.enable(second.id, true)
    const finalProviders = service.readSnapshot().providers
    expect(finalProviders.find((p) => p.id === first.id)?.enabled).toBe(false)
    expect(finalProviders.find((p) => p.id === second.id)?.enabled).toBe(true)
    expect(finalProviders.filter((p) => p.enabled).length).toBe(1)
  })

  it('keeps Codex providers independent of Claude providers when enabling', () => {
    const store = makeStore()
    const service = new LocalProviderService(store)
    service.create({ type: 'claude-code', name: 'Claude' })
    service.create({ type: 'codex', name: 'Codex' })
    const claude = service.readSnapshot().providers.find((p) => p.type === 'claude-code')
    const codex = service.readSnapshot().providers.find((p) => p.type === 'codex')
    if (!claude || !codex) {
      throw new Error('Expected both providers to be present')
    }
    service.enable(claude.id, true)
    service.enable(codex.id, true)
    const finalProviders = service.readSnapshot().providers
    expect(finalProviders.find((p) => p.id === claude.id)?.enabled).toBe(true)
    expect(finalProviders.find((p) => p.id === codex.id)?.enabled).toBe(true)
  })

  it('applies the enabled provider to new local Claude and Codex sessions', () => {
    const provider: LocalProviderRecord = {
      id: 'claude-1',
      type: 'claude-code',
      name: 'Claude',
      command: 'claude',
      args: [],
      env: { EXISTING: 'yes' },
      secret: 'token',
      fields: { model: 'selected-model' },
      enabled: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z'
    }
    const env = buildEnabledLocalProviderEnvironment({
      store: makeStore([provider]),
      launchAgent: 'claude',
      baseEnv: { PATH: '/bin' }
    })
    expect(env).toMatchObject({ ANTHROPIC_MODEL: 'selected-model', ANTHROPIC_AUTH_TOKEN: 'token' })
  })

  it('projects into the configured config dir instead of the type default', () => {
    const homePath = mkdtempSync(join(tmpdir(), 'orca-local-provider-'))
    directories.push(homePath)
    const customDir = mkdtempSync(join(tmpdir(), 'orca-claude-config-'))
    directories.push(customDir)
    const store = makeStore()
    const service = new LocalProviderService(store, {
      homePath,
      resolveConfigDirs: () => ({ claudeConfigDir: customDir })
    })
    const snapshot = service.create({
      type: 'claude-code',
      name: 'Gateway',
      fields: { baseUrl: 'https://gateway.example/v1' }
    })

    // The pin is CLAUDE_CONFIG_DIR itself: settings.json sits directly inside it.
    const settingsPath = join(customDir, 'settings.json')
    expect(snapshot.affectedFiles).toEqual([settingsPath])
    expect(JSON.parse(readFileSync(settingsPath, 'utf8'))).toMatchObject({
      env: { ANTHROPIC_BASE_URL: 'https://gateway.example/v1' }
    })
    expect(existsSync(join(homePath, '.claude', 'settings.json'))).toBe(false)
  })

  it('applies the configured config dir to sessions with no provider enabled', () => {
    const env = buildEnabledLocalProviderEnvironment({
      store: makeStore(),
      launchAgent: 'codex',
      baseEnv: { PATH: '/bin' },
      configDirs: { codexConfigDir: '/custom/codex' }
    })
    expect(env).toMatchObject({ PATH: '/bin', CODEX_HOME: '/custom/codex' })
  })

  it('does not pin the config dir env var when the setting is the CLI default', () => {
    const env = buildEnabledLocalProviderEnvironment({
      store: makeStore(),
      launchAgent: 'claude',
      baseEnv: { PATH: '/bin' },
      // The resolver compares against homedir(), so the real default must be used here.
      configDirs: { claudeConfigDir: join(homedir(), '.claude') }
    })
    expect(env).not.toHaveProperty('CLAUDE_CONFIG_DIR')
  })
})
