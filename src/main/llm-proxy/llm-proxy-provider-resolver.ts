import type {
  LocalProviderRecord,
  LocalProviderUpstreamFormat
} from '../../shared/local-provider-types'
import { getEnabledLocalProvider, type LocalProviderStore } from '../local-providers/service'

export type ProxyProvider = {
  type: LocalProviderRecord['type']
  baseUrl?: string
  apiKey: string
  model?: string
  haikuModel?: string
  sonnetModel?: string
  opusModel?: string
}

export type ProviderResolver = (
  type: LocalProviderRecord['type'],
  format?: LocalProviderUpstreamFormat,
  gatewayPrefix?: string
) => ProxyProvider | null

export function createStoreProviderResolver(
  store: LocalProviderStore | undefined
): ProviderResolver {
  return (type, format, gatewayPrefix) => {
    const allProviders = store?.getLocalProviders() ?? []
    const providers = gatewayPrefix ? allProviders : allProviders.filter((entry) => entry.enabled)
    console.log('[llm-proxy] provider lookup', {
      type,
      format: format ?? null,
      gatewayPrefix: gatewayPrefix ?? null,
      enabledProviders: providers.map((entry) => ({
        id: entry.id,
        name: entry.name,
        type: entry.type,
        gatewayPrefix: entry.fields?.gatewayPrefix ?? null,
        hasApiKey: Boolean(
          entry.secret ??
          entry.env.ANTHROPIC_AUTH_TOKEN ??
          entry.env.ANTHROPIC_API_KEY ??
          entry.env.OPENAI_API_KEY
        )
      }))
    })
    const getFormat = (entry: LocalProviderRecord): LocalProviderUpstreamFormat =>
      entry.fields?.upstreamFormat ?? (entry.type === 'claude-code' ? 'anthropic' : 'openai')
    const provider = gatewayPrefix
      ? providers.find((entry) => entry.fields?.gatewayPrefix === gatewayPrefix)
      : format
        ? (providers.find((entry) => getFormat(entry) === format && entry.isDefault) ??
          providers.find((entry) => getFormat(entry) === format))
        : (getEnabledLocalProvider(store, type) ??
          getEnabledLocalProvider(store, type === 'claude-code' ? 'codex' : 'claude-code'))
    if (!provider) {
      console.warn('[llm-proxy] no provider matched request', { gatewayPrefix, format })
      return null
    }
    const baseUrl = (
      provider.fields?.baseUrl ??
      provider.env.ANTHROPIC_BASE_URL ??
      provider.env.OPENAI_BASE_URL
    )?.trim()
    const apiKey = (
      provider.secret ??
      provider.env.ANTHROPIC_AUTH_TOKEN ??
      provider.env.ANTHROPIC_API_KEY ??
      provider.env.OPENAI_API_KEY
    )?.trim()
    if (!apiKey) {
      console.warn('[llm-proxy] matched provider has no API key', {
        providerId: provider.id,
        gatewayPrefix: provider.fields?.gatewayPrefix ?? null
      })
      return null
    }
    return {
      type,
      baseUrl,
      apiKey,
      ...(provider.fields?.model
        ? { model: provider.fields.model }
        : provider.env.ANTHROPIC_MODEL
          ? { model: provider.env.ANTHROPIC_MODEL }
          : provider.env.OPENAI_MODEL
            ? { model: provider.env.OPENAI_MODEL }
            : {}),
      ...(provider.fields?.haikuModel || provider.fields?.claudeModels?.haikuModel
        ? { haikuModel: provider.fields.haikuModel ?? provider.fields.claudeModels?.haikuModel }
        : {}),
      ...(provider.fields?.sonnetModel || provider.fields?.claudeModels?.sonnetModel
        ? { sonnetModel: provider.fields.sonnetModel ?? provider.fields.claudeModels?.sonnetModel }
        : {}),
      ...(provider.fields?.opusModel || provider.fields?.claudeModels?.opusModel
        ? { opusModel: provider.fields.opusModel ?? provider.fields.claudeModels?.opusModel }
        : {})
    }
  }
}
