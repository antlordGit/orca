import { randomUUID } from 'node:crypto'
import { homedir } from 'node:os'
import type {
  LocalProviderCreateInput,
  LocalProviderDiagnostic,
  LocalProviderRecord,
  LocalProviderSnapshot,
  LocalProviderType,
  LocalProviderUpdateInput
} from '../../shared/local-provider-types'
import { defaultLocalProviderCommand, isLocalProviderType } from '../../shared/local-provider-types'
import { projectLocalProvider, type LocalProviderProjectionOptions } from './local-provider-projection'
import {
  collectFields,
  copyRecord,
  MAX_COMMAND_LENGTH,
  MAX_NAME_LENGTH,
  normalizeArgs,
  normalizeEnvironment,
  normalizeFields,
  normalizeSettings,
  readInputSecret,
  requireText,
  toSummary,
  type InputWithFields
} from './service-validation'

export type LocalProviderStore = {
  getLocalProviders(): LocalProviderRecord[]
  replaceLocalProviders(providers: LocalProviderRecord[]): void
}

export type LocalProviderServiceOptions = {
  onChange?: () => void
  homePath?: string
  /** Read at project time, so a config-dir change applies without re-creating the service. */
  resolveConfigDirs?: () => { claudeConfigDir?: string | null; codexConfigDir?: string | null }
}

function hasOwn(value: object, key: string): boolean {
  return Object.hasOwn(value, key)
}

function projectSnapshot(
  snapshot: LocalProviderSnapshot,
  record: LocalProviderRecord,
  projectionOptions: LocalProviderProjectionOptions
): LocalProviderSnapshot {
  if (!record.enabled) {
    return snapshot
  }
  const projection = projectLocalProvider(record, projectionOptions)
  return {
    ...snapshot,
    affectedFiles: projection.affectedFiles,
    restartRequired: true,
    diagnostics: projection.diagnostics
  }
}

export class LocalProviderService {
  private readonly onChange: () => void
  private readonly homePath: string
  private readonly resolveConfigDirs: () => {
    claudeConfigDir?: string | null
    codexConfigDir?: string | null
  }

  constructor(
    private readonly store: LocalProviderStore,
    options: LocalProviderServiceOptions = {}
  ) {
    this.onChange = options.onChange ?? (() => {})
    this.homePath = options.homePath ?? homedir()
    this.resolveConfigDirs = options.resolveConfigDirs ?? (() => ({}))
  }

  private projectionOptions(): LocalProviderProjectionOptions {
    return { homePath: this.homePath, ...this.resolveConfigDirs() }
  }

  list(): LocalProviderSnapshot {
    return this.readSnapshot()
  }

  readSnapshot(): LocalProviderSnapshot {
    return { version: 1, providers: this.store.getLocalProviders().map(toSummary) }
  }

  create(input: LocalProviderCreateInput): LocalProviderSnapshot {
    const raw = input as unknown as InputWithFields
    if (!isLocalProviderType(input.type)) {
      throw new Error('invalid_local_provider_type')
    }
    const fields = collectFields(raw)
    const secret = readInputSecret(raw)
    const now = new Date().toISOString()
    const record: LocalProviderRecord = {
      id: randomUUID(),
      type: input.type,
      name: requireText(input.name, 'name', MAX_NAME_LENGTH),
      command:
        input.command === undefined
          ? defaultLocalProviderCommand(input.type)
          : requireText(input.command, 'command', MAX_COMMAND_LENGTH),
      args: normalizeArgs(input.args),
      env: normalizeEnvironment(input.env),
      secret: secret ?? null,
      enabled: input.enabled !== false,
      createdAt: now,
      updatedAt: now,
      ...(fields ? { fields } : {}),
      ...(input.settings !== undefined ? { settings: normalizeSettings(input.settings) } : {})
    }
    this.replaceTypeAndAppend(record)
    this.onChange()
    return projectSnapshot(this.readSnapshot(), record, this.projectionOptions())
  }

  update(id: string, input: LocalProviderUpdateInput): LocalProviderSnapshot {
    const current = this.find(id)
    const raw = input as unknown as InputWithFields
    const patch = collectFields(raw)
    const secret = readInputSecret(raw)
    const next: LocalProviderRecord = {
      ...current,
      ...(hasOwn(raw, 'name') ? { name: requireText(raw.name, 'name', MAX_NAME_LENGTH) } : {}),
      ...(hasOwn(raw, 'command')
        ? { command: requireText(raw.command, 'command', MAX_COMMAND_LENGTH) }
        : {}),
      ...(hasOwn(raw, 'args') ? { args: normalizeArgs(raw.args) } : {}),
      ...(hasOwn(raw, 'env') ? { env: normalizeEnvironment(raw.env) } : {}),
      ...(secret !== undefined ? { secret } : {}),
      ...(patch ? { fields: normalizeFields({ ...current.fields, ...patch }) } : {}),
      ...(hasOwn(raw, 'settings') ? { settings: normalizeSettings(raw.settings) } : {}),
      ...(hasOwn(raw, 'enabled') ? { enabled: raw.enabled === true } : {}),
      updatedAt: new Date().toISOString()
    }
    this.replaceTypeAndUpdate(next)
    this.onChange()
    return projectSnapshot(this.readSnapshot(), next, this.projectionOptions())
  }

  duplicate(id: string, name?: string): LocalProviderSnapshot {
    const source = this.find(id)
    const now = new Date().toISOString()
    const copy: LocalProviderRecord = {
      ...copyRecord(source),
      id: randomUUID(),
      name: name === undefined ? `${source.name} Copy` : requireText(name, 'name', MAX_NAME_LENGTH),
      enabled: false,
      createdAt: now,
      updatedAt: now
    }
    this.store.replaceLocalProviders([...this.store.getLocalProviders(), copy])
    this.onChange()
    return this.readSnapshot()
  }

  delete(id: string): LocalProviderSnapshot {
    this.find(id)
    this.store.replaceLocalProviders(
      this.store.getLocalProviders().filter((entry) => entry.id !== id)
    )
    this.onChange()
    return this.readSnapshot()
  }

  enable(id: string, enabled: boolean): LocalProviderSnapshot {
    const current = this.find(id)
    const next = { ...current, enabled, updatedAt: new Date().toISOString() }
    if (enabled) {
      this.replaceTypeAndUpdate(next)
    } else {
      this.replaceRecord(next)
    }
    this.onChange()
    return projectSnapshot(this.readSnapshot(), next, this.projectionOptions())
  }

  /**
   * The only path that returns a provider secret to the renderer. Callers must
   * gate it behind an explicit user reveal; `null` means no secret is stored,
   * never an empty credential.
   */
  revealSecret(id: string): string | null {
    return this.find(id).secret
  }

  private find(id: string): LocalProviderRecord {
    const normalizedId = requireText(id, 'id', 128)
    const record = this.store.getLocalProviders().find((entry) => entry.id === normalizedId)
    if (!record) {
      throw new Error('local_provider_not_found')
    }
    return copyRecord(record)
  }

  private replaceTypeAndAppend(record: LocalProviderRecord): void {
    const providers = record.enabled
      ? this.store
          .getLocalProviders()
          .map((entry) => (entry.type === record.type ? { ...entry, enabled: false } : entry))
      : this.store.getLocalProviders()
    this.store.replaceLocalProviders([...providers, record])
  }

  private replaceTypeAndUpdate(record: LocalProviderRecord): void {
    const providers = this.store
      .getLocalProviders()
      .map((entry) =>
        entry.type === record.type && entry.id !== record.id
          ? { ...entry, enabled: false }
          : entry.id === record.id
            ? record
            : entry
      )
    this.store.replaceLocalProviders(providers)
  }

  private replaceRecord(record: LocalProviderRecord): void {
    const providers = this.store.getLocalProviders()
    const index = providers.findIndex((entry) => entry.id === record.id)
    if (index === -1) {
      throw new Error('local_provider_not_found')
    }
    const next = providers.slice()
    next[index] = record
    this.store.replaceLocalProviders(next)
  }
}

export function getEnabledLocalProvider(
  store: LocalProviderStore | undefined,
  type: LocalProviderType
): LocalProviderRecord | null {
  const provider = store?.getLocalProviders().find((entry) => entry.type === type && entry.enabled)
  return provider ? copyRecord(provider) : null
}

export function getLocalProviderDiagnostics(error: unknown): LocalProviderDiagnostic[] {
  return [
    {
      code: 'local-provider-error',
      message: error instanceof Error ? error.message : 'Local provider operation failed.'
    }
  ]
}
