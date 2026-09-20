import { describe, expect, it } from 'vitest'
import { buildSettingsNavigationMetadata } from './useSettingsNavigationMetadata'

const hiddenSectionIds = [
  'accounts',
  'automations',
  'artifacts',
  'tasks',
  'session-history',
  'git',
  'integrations'
]

describe('settings navigation hidden sections', () => {
  it('does not expose accounts, automations, artifacts, task sources, session search, Git, or integrations', () => {
    const sections = buildSettingsNavigationMetadata({
      isMac: true,
      isWindows: false,
      isWebClient: false,
      repos: []
    })
    const sectionIds = new Set(sections.map((section) => section.id))

    for (const hiddenSectionId of hiddenSectionIds) {
      expect(sectionIds.has(hiddenSectionId)).toBe(false)
    }
  })
})
