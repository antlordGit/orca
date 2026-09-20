import { homedir } from 'node:os'
import path from 'node:path'

/**
 * Normalizes a user-entered config-directory setting.
 *
 * Why not `realpath` like the floating-workspace sanitizer: the pin must stay the
 * literal string the user chose. A CLI keys its credential lookup on the literal
 * path, so re-spelling `~` or resolving a symlink would select a different
 * identity. Validation here is therefore shape-only — expand `~`, require an
 * absolute path, reject NUL. An empty string clears the setting.
 */
export function sanitizeLocalProviderConfigDir(value: string): string {
  const trimmed = value.trim()
  if (!trimmed || trimmed.includes('\0')) {
    return ''
  }
  const home = homedir()
  const expanded =
    trimmed === '~'
      ? home
      : trimmed.startsWith('~/')
        ? path.join(home, trimmed.slice(2))
        : trimmed.startsWith('~\\')
          ? path.join(home, trimmed.slice(2))
          : trimmed
  if (!path.isAbsolute(expanded)) {
    return ''
  }
  return expanded
}
