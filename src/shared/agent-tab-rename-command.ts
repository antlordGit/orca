import type { TerminalAgent } from './terminal-agent'

/** CodeArts names the stored session directly, since its TUI has no `/rename` slash command. */
const CODEARTS_RENAME_BIN = '~/.codeartsdoer/bin/cs-rename'

/**
 * The line to type into a renamed tab's agent, or null when there is nothing to rename. Typing
 * path clears the line first, so a tab that no longer runs the launched agent cannot keep a stray
 * command in its composer.
 */
export function buildAgentTabRenameCommand(
  title: string,
  agent: TerminalAgent | undefined
): string | null {
  const trimmed = flattenTitle(title)
  if (!trimmed) {
    return null
  }
  if (agent === 'codearts') {
    return `${CODEARTS_RENAME_BIN} ${quotePosixArg(trimmed)}`
  }
  return agent ? `/rename ${trimmed}` : null
}

// Why: the title fills the rest of the line, so line breaks would submit half of it early.
function flattenTitle(title: string): string {
  return title.trim().replace(/[\r\n]+/g, ' ')
}

/** Single-quoted so `$`, backticks and globs in a title reach cs-rename as text, not expansions. */
function quotePosixArg(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}
