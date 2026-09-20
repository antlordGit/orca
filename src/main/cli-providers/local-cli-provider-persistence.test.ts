import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  loadLocalCliProviderStore,
  saveLocalCliProviderStore
} from './local-cli-provider-persistence'
import type { LocalProviderRecord } from '../../shared/local-provider-types'

function provider(): LocalProviderRecord {
  return {
    id: 'provider-1',
    type: 'claude-code',
    name: 'Claude',
    command: 'claude',
    args: [],
    env: { ANTHROPIC_BASE_URL: 'https://example.test' },
    secret: null,
    enabled: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  }
}

describe('local CLI provider persistence', () => {
  let directory: string

  afterEach(() => {
    if (directory) {
      rmSync(directory, { recursive: true, force: true })
    }
  })

  it('round trips the provider store through an atomic replacement', () => {
    directory = mkdtempSync(join(tmpdir(), 'orca-local-provider-'))
    const storePath = join(directory, 'nested', 'providers.json')
    saveLocalCliProviderStore([provider()], storePath)

    const { secret: _secret, ...persistedProvider } = provider()
    expect(loadLocalCliProviderStore(storePath)).toEqual({
      version: 1,
      providers: [persistedProvider]
    })
    expect(readFileSync(storePath, 'utf-8')).toContain('provider-1')
  })

  it('falls back to an empty store when the file is missing or invalid', () => {
    directory = mkdtempSync(join(tmpdir(), 'orca-local-provider-'))
    const storePath = join(directory, 'providers.json')

    expect(loadLocalCliProviderStore(storePath)).toEqual({ version: 1, providers: [] })
    writeFileSync(storePath, '{broken', 'utf-8')
    expect(loadLocalCliProviderStore(storePath)).toEqual({ version: 1, providers: [] })
  })
})
