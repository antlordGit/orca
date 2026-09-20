import { LinearIcon } from '@/components/icons/LinearIcon'
import { getAgentsPaneSearchEntries } from '@/components/settings/agents-search'
import { getComputerUsePaneSearchEntries } from '@/components/settings/computer-use-search'
import { getGeneralPaneSearchEntries } from '@/components/settings/general-search'
import { getLinearAgentSkillPaneSearchEntries } from '@/components/settings/linear-agent-skill-search'
import { getMobileSettingsPaneSearchEntries } from '@/components/settings/mobile-settings-search'
import { getOrcaAccountSettingsSearchEntries } from '@/components/settings/orca-account-settings-search'
import { OrcaLogoSettingsIcon } from '@/components/settings/orca-logo-settings-icon'
import { getOrchestrationPaneSearchEntries } from '@/components/settings/orchestration-search'
import { getVoicePaneSearchEntries } from '@/components/settings/voice-pane-search'
import { translate } from '@/i18n/i18n'
import type { SettingsNavSection } from '@/lib/settings-navigation-types'
import {
  Bot,
  CircleUserRound,
  Mic,
  MousePointerClick,
  Network,
  Server,
  SlidersHorizontal,
  Smartphone
} from 'lucide-react'
import type { SettingsNavigationBuildOptions } from './settings-navigation-build-options'

export function buildCapabilitySettingsSections({
  isLocalWindowsHost,
  isWebClient,
  isLinearConnected
}: SettingsNavigationBuildOptions): SettingsNavSection[] {
  const showDesktopOnlySettings = !isWebClient
  return [
    {
      id: 'agents',
      title: translate('auto.hooks.useSettingsNavigationMetadata.b49abbd2f7', 'Agents'),
      description: translate(
        'auto.hooks.useSettingsNavigationMetadata.4121f7a0a2',
        'Manage AI agents, set a default, and customize commands.'
      ),
      icon: Bot,
      searchEntries: getAgentsPaneSearchEntries({
        includeAgentAwake: !isWebClient,
        includeAgentRuntime: isLocalWindowsHost
      }),
      group: 'capabilities'
    },
    ...(showDesktopOnlySettings
      ? [
          {
            id: 'local-providers',
            title: translate(
              'auto.hooks.useSettingsNavigationMetadata.localProvidersTitle',
              '模型配置'
            ),
            description: translate(
              'auto.hooks.useSettingsNavigationMetadata.localProvidersDescription',
              '配置 Claude Code 和 Codex 的请求地址、认证、模型与环境变量。'
            ),
            icon: Server,
            searchEntries: [
              {
                title: translate(
                  'auto.hooks.useSettingsNavigationMetadata.localProvidersTitle',
                  'Local Providers'
                ),
                description: translate(
                  'auto.hooks.useSettingsNavigationMetadata.localProvidersDescription',
                  'Configure local Claude and Codex provider commands.'
                ),
                keywords: ['claude', 'codex', 'command', 'secret', 'environment']
              }
            ],
            group: 'capabilities'
          }
        ]
      : []),
    {
      id: 'orchestration',
      title: translate('auto.hooks.useSettingsNavigationMetadata.58a868e8e4', 'Orchestration'),
      description: translate(
        'auto.hooks.useSettingsNavigationMetadata.cd50cec5d7',
        'Coordinate multiple coding agents through Orca.'
      ),
      icon: Network,
      searchEntries: getOrchestrationPaneSearchEntries({
        includeNestedWorkerDepth: !isWebClient
      }),
      group: 'capabilities'
    },
    // Why: only surfaced once Linear is connected — a capability that needs a
    // linked provider before the agent skill has anything to act on.
    ...(isLinearConnected
      ? [
          {
            id: 'linear',
            title: translate('auto.hooks.useSettingsNavigationMetadata.linearTitle', 'Linear'),
            description: translate(
              'auto.hooks.useSettingsNavigationMetadata.linearDescription',
              'How Linear works in Orca, setup checklist, agent skill, and example prompts.'
            ),
            icon: LinearIcon,
            searchEntries: getLinearAgentSkillPaneSearchEntries(),
            group: 'capabilities'
          }
        ]
      : []),
    ...(showDesktopOnlySettings
      ? [
          {
            id: 'computer-use',
            title: translate('auto.hooks.useSettingsNavigationMetadata.b35e92364b', 'Computer Use'),
            description: translate(
              'auto.hooks.useSettingsNavigationMetadata.0059bd17f3',
              'Enable agents to control any app on your computer.'
            ),
            icon: MousePointerClick,
            searchEntries: getComputerUsePaneSearchEntries(),
            group: 'capabilities'
          },
          {
            id: 'voice',
            title: translate('auto.hooks.useSettingsNavigationMetadata.6a50cdcd7c', 'Voice'),
            description: translate(
              'auto.hooks.useSettingsNavigationMetadata.8ac3de82f5',
              'Local speech-to-text dictation with on-device models.'
            ),
            icon: Mic,
            searchEntries: getVoicePaneSearchEntries(),
            group: 'capabilities'
          }
        ]
      : [])
  ]
}

export function buildSetupSettingsSections({
  isLocalWindowsHost,
  isWebClient
}: SettingsNavigationBuildOptions): SettingsNavSection[] {
  const showDesktopOnlySettings = !isWebClient
  return [
    ...(showDesktopOnlySettings
      ? [
          {
            id: 'orca-account',
            title: translate('auto.components.settings.orcaAccount.title', 'Orca Account'),
            description: translate(
              'auto.components.settings.orcaAccount.description',
              'Share work instantly and reach your desktop from Orca Mobile wherever you are.'
            ),
            icon: CircleUserRound,
            searchEntries: getOrcaAccountSettingsSearchEntries(),
            group: 'setup'
          }
        ]
      : []),
    {
      id: 'setup-guide',
      title: translate(
        'auto.hooks.useSettingsNavigationMetadata.ded9e9032f',
        'Onboarding checklist'
      ),
      description: translate(
        'auto.hooks.useSettingsNavigationMetadata.5f32ac08f3',
        'Finish the onboarding checklist for core Orca workflows.'
      ),
      icon: OrcaLogoSettingsIcon,
      searchEntries: [
        {
          title: translate(
            'auto.hooks.useSettingsNavigationMetadata.ded9e9032f',
            'Onboarding checklist'
          ),
          description: translate(
            'auto.hooks.useSettingsNavigationMetadata.17005c73d4',
            'Open the onboarding checklist for setup and milestone steps.'
          ),
          keywords: [
            translate('auto.hooks.useSettingsNavigationMetadata.ea0b1bc7b8', 'setup guide'),
            translate(
              'auto.hooks.useSettingsNavigationMetadata.0505d0df29',
              'get started with Orca'
            ),
            translate('auto.hooks.useSettingsNavigationMetadata.724c440e72', 'getting started')
          ]
        }
      ],
      group: 'setup'
    },
    {
      id: 'general',
      title: translate('auto.hooks.useSettingsNavigationMetadata.13241992bd', 'General'),
      description: translate(
        'auto.hooks.useSettingsNavigationMetadata.2cd4ea75da',
        'Workspace defaults, app setup, and maintenance.'
      ),
      icon: SlidersHorizontal,
      searchEntries: getGeneralPaneSearchEntries({ includeProjectRuntime: isLocalWindowsHost }),
      group: 'setup'
    },
    ...(showDesktopOnlySettings
      ? [
          {
            id: 'mobile',
            title: translate('auto.hooks.useSettingsNavigationMetadata.1cd25673df', 'Mobile'),
            description: translate(
              'auto.hooks.useSettingsNavigationMetadata.95a1886d94',
              'Control terminals and agents from your phone.'
            ),
            icon: Smartphone,
            searchEntries: getMobileSettingsPaneSearchEntries(),
            group: 'setup'
          }
        ]
      : [])
  ]
}
