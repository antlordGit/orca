import { describe, expect, it } from 'vitest'
import { mergeClaudeSettingsJson } from './claude-cli-provider-config'

describe('mergeClaudeSettingsJson', () => {
  it('preserves unknown fields and merges only non-empty environment values', () => {
    const merged = JSON.parse(
      mergeClaudeSettingsJson(
        JSON.stringify({ permissions: { allow: ['Read'] }, env: { EXISTING: 'keep' } }),
        { ANTHROPIC_API_KEY: 'secret', ANTHROPIC_MODEL: '', EXTRA: 'value' }
      )
    )

    expect(merged).toEqual({
      permissions: { allow: ['Read'] },
      env: { EXISTING: 'keep', ANTHROPIC_API_KEY: 'secret', EXTRA: 'value' }
    })
  })

  it('starts a missing settings file with an env object', () => {
    expect(JSON.parse(mergeClaudeSettingsJson(null, { ANTHROPIC_MODEL: 'model' }))).toEqual({
      env: { ANTHROPIC_MODEL: 'model' }
    })
  })

  it('rejects malformed JSON and a non-object env value', () => {
    expect(() => mergeClaudeSettingsJson('{broken', { KEY: 'value' })).toThrow()
    expect(() => mergeClaudeSettingsJson('{"env": []}', { KEY: 'value' })).toThrow()
  })
})
