import { getBrowserPaneCombinedSearchEntries } from '@/components/settings/browser-pane-search'
import { getFloatingWorkspaceSearchEntries } from '@/components/settings/floating-workspace-search'
import { getMobileEmulatorSearchEntries } from '@/components/settings/mobile-emulator-search'
import { getQuickCommandsPaneSearchEntries } from '@/components/settings/quick-commands-search'
import { getShareSkillsSettingsSearchEntries } from '@/components/settings/share-skills-settings-search'
import { translate } from '@/i18n/i18n'
import type { SettingsNavSection } from '@/lib/settings-navigation-types'
import {
  BookOpen,
  Globe,
  PanelsTopLeft,
  Play,
  SquareTerminal,
  TabletSmartphone
} from 'lucide-react'
import type { SettingsNavigationBuildOptions } from './settings-navigation-build-options'

export function buildWorkflowSettingsSections(
  { isWebClient }: SettingsNavigationBuildOptions,
  terminalPaneSearchEntries: SettingsNavSection['searchEntries']
): SettingsNavSection[] {
  const showDesktopOnlySettings = !isWebClient
  return [
    {
      id: 'share-skills',
      title: translate('auto.hooks.useSettingsNavigationMetadata.shareSkillsTitle', 'Share Skills'),
      description: translate(
        'auto.hooks.useSettingsNavigationMetadata.shareSkillsDescription',
        'Share your skills with an unlisted link. Anyone who has it can install them.'
      ),
      // Why: the sidebar entry and the page header both use BookOpen for
      // skills, so the settings row that opens them matches.
      icon: BookOpen,
      searchEntries: getShareSkillsSettingsSearchEntries(),
      group: 'workflows',
      badge: translate('auto.hooks.useSettingsNavigationMetadata.40d80bad8a', 'Beta')
    },
    {
      id: 'terminal',
      title: translate('auto.hooks.useSettingsNavigationMetadata.a9fb10afca', 'Terminal'),
      description: translate(
        'auto.hooks.useSettingsNavigationMetadata.c33bfd664c',
        'Shells, renderer, sessions, and terminal behavior.'
      ),
      icon: SquareTerminal,
      searchEntries: terminalPaneSearchEntries,
      group: 'workflows'
    },
    {
      id: 'quick-commands',
      title: translate('auto.hooks.useSettingsNavigationMetadata.3fc3db144f', 'Quick Commands'),
      description: translate(
        'auto.hooks.useSettingsNavigationMetadata.42ae40842f',
        'Saved terminal commands, scoped globally or per project.'
      ),
      icon: Play,
      searchEntries: getQuickCommandsPaneSearchEntries(),
      group: 'workflows'
    },
    ...(showDesktopOnlySettings
      ? [
          {
            id: 'browser',
            title: translate('auto.hooks.useSettingsNavigationMetadata.8c197f74a1', 'Browser'),
            description: translate(
              'auto.hooks.useSettingsNavigationMetadata.e815fd01bd',
              'Home page, link routing, and session cookies.'
            ),
            icon: Globe,
            searchEntries: getBrowserPaneCombinedSearchEntries(),
            group: 'workflows'
          }
        ]
      : []),
    ...(showDesktopOnlySettings
      ? [
          {
            id: 'mobile-emulator',
            title: translate(
              'auto.hooks.useSettingsNavigationMetadata.1e761cff2b',
              'Mobile Emulator'
            ),
            description: translate(
              'auto.hooks.useSettingsNavigationMetadata.3d65d3f1b9',
              'Configure mobile emulator support for Orca and coding agents.'
            ),
            icon: TabletSmartphone,
            searchEntries: getMobileEmulatorSearchEntries(),
            group: 'workflows'
          }
        ]
      : []),
    {
      id: 'floating-workspace',
      title: translate('auto.hooks.useSettingsNavigationMetadata.65b19f5bde', 'Floating Workspace'),
      description: showDesktopOnlySettings
        ? translate(
            'auto.hooks.useSettingsNavigationMetadata.2d0659f6f0',
            'Global terminal, browser, and markdown tabs.'
          )
        : translate(
            'auto.hooks.useSettingsNavigationMetadata.floatingWorkspaceWebDescription',
            'Global terminal and markdown tabs.'
          ),
      icon: PanelsTopLeft,
      searchEntries: getFloatingWorkspaceSearchEntries({
        includeBrowser: showDesktopOnlySettings
      }),
      group: 'workflows'
    }
  ]
}
