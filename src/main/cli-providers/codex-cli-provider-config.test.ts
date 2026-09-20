import { describe, expect, it } from 'vitest'
import type { LocalProviderRecord } from '../../shared/local-provider-types'
import { buildCodexTomlUpdates } from './codex-cli-provider-config'

function provider(env: Record<string, string>): LocalProviderRecord {
  return {
    id: 'codex-1',
    type: 'codex',
    name: 'Codex',
    command: 'codex',
    args: [],
    env,
    secret: null,
    enabled: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  }
}

describe('buildCodexTomlUpdates', () => {
  it('quotes string values as TOML basic strings', () => {
    expect(buildCodexTomlUpdates(provider({ OPENAI_MODEL: 'model "quoted"' }))).toEqual({
      model: '"model \\"quoted\\""'
    })
  })
})
