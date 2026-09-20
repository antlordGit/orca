import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { LocalProviderRecord } from '../../shared/local-provider-types'
import { normalizeLocalProviderRecords } from '../../shared/local-provider-normalization'
import { getCanonicalUserDataPath } from '../persistence/loading-store/user-data-path'
import { renameFileWithWindowsRetry } from '../codex-accounts/fs-utils'

export const LOCAL_CLI_PROVIDER_STORE_FILE_NAME = 'local-cli-providers.json'

export type PersistedLocalProviderRecord = Omit<LocalProviderRecord, 'secret'>

export type LocalCliProviderStore = {
  version: 1
  providers: PersistedLocalProviderRecord[]
}

export function getLocalCliProviderStorePath(userDataPath = getCanonicalUserDataPath()): string {
  return join(userDataPath, LOCAL_CLI_PROVIDER_STORE_FILE_NAME)
}

export function loadLocalCliProviderStore(
  storePath = getLocalCliProviderStorePath()
): LocalCliProviderStore {
  try {
    const parsed: unknown = JSON.parse(readFileSync(storePath, 'utf-8'))
    if (!isRecord(parsed) || parsed.version !== 1) {
      return emptyLocalCliProviderStore()
    }
    return {
      version: 1,
      providers: normalizeLocalProviderRecords(parsed.providers).map(
        ({ secret: _secret, ...provider }) => provider
      )
    }
  } catch {
    return emptyLocalCliProviderStore()
  }
}

export function saveLocalCliProviderStore(
  providers: LocalProviderRecord[],
  storePath = getLocalCliProviderStorePath()
): void {
  const directory = dirname(storePath)
  mkdirSync(directory, { recursive: true })
  const temporaryPath = join(
    directory,
    `.${LOCAL_CLI_PROVIDER_STORE_FILE_NAME}.${randomUUID()}.tmp`
  )
  const existingMode = existsSync(storePath) ? statSync(storePath).mode : undefined
  let published = false
  try {
    const store: LocalCliProviderStore = {
      version: 1,
      providers: providers.map(({ secret: _secret, ...provider }) => provider)
    }
    writeFileSync(temporaryPath, `${JSON.stringify(store, null, 2)}\n`, {
      encoding: 'utf-8',
      mode: existingMode
    })
    renameFileWithWindowsRetry(temporaryPath, storePath)
    published = true
  } finally {
    if (!published && existsSync(temporaryPath)) {
      try {
        unlinkSync(temporaryPath)
      } catch {
        // Cleanup must not hide the original write error.
      }
    }
  }
}

function emptyLocalCliProviderStore(): LocalCliProviderStore {
  return { version: 1, providers: [] }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
