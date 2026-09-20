import type {
  LocalProviderCreateInput,
  LocalProviderSnapshot,
  LocalProviderUpdateInput
} from '../../shared/local-provider-types'

export type LocalProvidersApi = {
  list: () => Promise<LocalProviderSnapshot>
  create: (input: LocalProviderCreateInput) => Promise<LocalProviderSnapshot>
  update: (input: {
    id: string
    updates: LocalProviderUpdateInput
  }) => Promise<LocalProviderSnapshot>
  duplicate: (input: { id: string; name?: string }) => Promise<LocalProviderSnapshot>
  delete: (input: { id: string }) => Promise<LocalProviderSnapshot>
  enable: (input: { id: string; enabled: boolean }) => Promise<LocalProviderSnapshot>
  /** Returns the stored secret in the clear; `null` when none is configured. */
  reveal: (input: { id: string }) => Promise<string | null>
}
