import { translate } from '@/i18n/i18n'
import { searchKeywords } from './settings-search-keywords'

const AGENT_TAB_RENAME_SLASH_COMMAND_TITLE_KEY =
  'auto.components.settings.agent-tab-rename-slash-command-copy.title'
const AGENT_TAB_RENAME_SLASH_COMMAND_DESCRIPTION_KEY =
  'auto.components.settings.agent-tab-rename-slash-command-copy.description'

export function getAgentTabRenameSlashCommandTitle(): string {
  return translate(
    AGENT_TAB_RENAME_SLASH_COMMAND_TITLE_KEY,
    'Rename the agent session with the tab'
  )
}

export function getAgentTabRenameSlashCommandDescription(): string {
  return translate(
    AGENT_TAB_RENAME_SLASH_COMMAND_DESCRIPTION_KEY,
    'After a manual tab rename, type `/rename <title>` and Enter into the tab so the agent keeps the same name. Agents without that command receive it as prompt text.'
  )
}

export function getAgentTabRenameSlashCommandSearchKeywords(): string[] {
  return searchKeywords([
    {
      key: 'auto.components.settings.agents.search.96ba2373b6',
      fallback: 'agent'
    },
    {
      key: 'auto.components.settings.agents.search.be7ea3553b',
      fallback: 'tab'
    },
    {
      key: 'auto.components.settings.agents.search.6956646a1e',
      fallback: 'title'
    },
    {
      key: 'auto.components.settings.agents.search.5784ae8c43',
      fallback: 'rename'
    },
    {
      key: 'auto.components.settings.agents.search.slashCommand',
      fallback: 'slash command'
    },
    {
      key: 'auto.components.settings.agents.search.sessionName',
      fallback: 'session name'
    }
  ])
}
