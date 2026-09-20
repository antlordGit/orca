import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  localProviderConfigDirEnv,
  resolveLocalProviderConfigDir
} from './local-provider-config-dir'

describe('resolveLocalProviderConfigDir', () => {
  it('falls back to the CLI default home per type', () => {
    expect(resolveLocalProviderConfigDir({ type: 'claude-code', homePath: '/home/u' })).toBe(
      join('/home/u', '.claude')
    )
    expect(resolveLocalProviderConfigDir({ type: 'codex', homePath: '/home/u' })).toBe(
      join('/home/u', '.codex')
    )
  })

  it('uses the configured dir verbatim, without a per-type segment', () => {
    expect(
      resolveLocalProviderConfigDir({
        type: 'claude-code',
        homePath: '/home/u',
        claudeConfigDir: '/custom/claude'
      })
    ).toBe('/custom/claude')
    expect(
      resolveLocalProviderConfigDir({
        type: 'codex',
        homePath: '/home/u',
        codexConfigDir: '/custom/codex'
      })
    ).toBe('/custom/codex')
  })

  it('ignores a blank or missing pin', () => {
    expect(
      resolveLocalProviderConfigDir({
        type: 'codex',
        homePath: '/home/u',
        codexConfigDir: '   '
      })
    ).toBe(join('/home/u', '.codex'))
    expect(resolveLocalProviderConfigDir({ type: 'codex', homePath: '/home/u' })).toBe(
      join('/home/u', '.codex')
    )
  })

  it('keeps each type independent', () => {
    expect(
      resolveLocalProviderConfigDir({
        type: 'claude-code',
        homePath: '/home/u',
        codexConfigDir: '/custom/codex'
      })
    ).toBe(join('/home/u', '.claude'))
  })
})

describe('localProviderConfigDirEnv', () => {
  it('pins the matching env var when the dir differs from the default', () => {
    expect(
      localProviderConfigDirEnv({
        type: 'claude-code',
        configDir: '/custom/claude',
        homePath: '/home/u'
      })
    ).toEqual({ CLAUDE_CONFIG_DIR: '/custom/claude' })
    expect(
      localProviderConfigDirEnv({ type: 'codex', configDir: '/custom/codex', homePath: '/home/u' })
    ).toEqual({ CODEX_HOME: '/custom/codex' })
  })

  it('emits no pin when the dir is the CLI default', () => {
    expect(
      localProviderConfigDirEnv({
        type: 'claude-code',
        configDir: join('/home/u', '.claude'),
        homePath: '/home/u'
      })
    ).toEqual({})
    expect(
      localProviderConfigDirEnv({
        type: 'codex',
        configDir: join('/home/u', '.codex'),
        homePath: '/home/u'
      })
    ).toEqual({})
  })
})
