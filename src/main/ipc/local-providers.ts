import { ipcMain } from 'electron'
import { LocalProviderService } from '../local-providers/service'
import type { Store } from '../persistence/loading-store/store'
import { createInput, objectArgs, providerId, updateInput } from './local-providers-input'

export function registerLocalProviderHandlers(store: Store): void {
  const service = new LocalProviderService(store, {
    // Read at project time so a config-dir change reaches the next projection
    // without re-registering handlers.
    resolveConfigDirs: () => {
      const settings = store.getSettings()
      return {
        claudeConfigDir: settings.claudeConfigDir ?? null,
        codexConfigDir: settings.codexConfigDir ?? null
      }
    }
  })
  ipcMain.handle('localProviders:list', () => service.list())
  ipcMain.handle('localProviders:create', (_event, args: unknown) =>
    service.create(createInput(args))
  )
  ipcMain.handle('localProviders:update', (_event, args: unknown) => {
    const request = updateInput(args)
    return service.update(request.id, request.updates)
  })
  ipcMain.handle('localProviders:duplicate', (_event, args: unknown) => {
    const request = objectArgs(args, 'invalid_local_provider_request')
    return service.duplicate(
      providerId(args),
      typeof request.name === 'string' ? request.name : undefined
    )
  })
  ipcMain.handle('localProviders:delete', (_event, args: unknown) =>
    service.delete(providerId(args))
  )
  ipcMain.handle('localProviders:enable', (_event, args: unknown) => {
    const request = objectArgs(args, 'invalid_local_provider_request')
    if (typeof request.enabled !== 'boolean') {
      throw new Error('invalid_local_provider_enabled')
    }
    return service.enable(providerId(args), request.enabled)
  })
  // Explicit, per-provider secret read for the edit form's reveal toggle.
  ipcMain.handle('localProviders:reveal', (_event, args: unknown) =>
    service.revealSecret(providerId(args))
  )
}
