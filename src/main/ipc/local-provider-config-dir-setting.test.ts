import { homedir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { sanitizeLocalProviderConfigDir } from './local-provider-config-dir-setting'

describe('sanitizeLocalProviderConfigDir', () => {
  it('keeps an absolute path verbatim', () => {
    // Why verbatim: the CLI keys credential lookup on the literal string, so
    // canonicalizing a symlink would select a different identity.
    expect(sanitizeLocalProviderConfigDir('/custom/claude')).toBe('/custom/claude')
  })

  it('expands a leading tilde', () => {
    expect(sanitizeLocalProviderConfigDir('~')).toBe(homedir())
    expect(sanitizeLocalProviderConfigDir('~/.claude-test')).toBe(
      join(homedir(), '.claude-test')
    )
  })

  it('clears the setting for blank input', () => {
    expect(sanitizeLocalProviderConfigDir('')).toBe('')
    expect(sanitizeLocalProviderConfigDir('   ')).toBe('')
  })

  it('rejects a relative path and a NUL-bearing value', () => {
    expect(sanitizeLocalProviderConfigDir('relative/dir')).toBe('')
    expect(sanitizeLocalProviderConfigDir('/custom/\0dir')).toBe('')
  })
})
