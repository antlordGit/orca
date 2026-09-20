import { ipcRenderer } from 'electron'
import type { PreloadApi } from '../api-types'

export const localProvidersApi = {
  list: () => ipcRenderer.invoke('localProviders:list'),
  create: (input: Parameters<PreloadApi['localProviders']['create']>[0]) =>
    ipcRenderer.invoke('localProviders:create', input),
  update: (input: Parameters<PreloadApi['localProviders']['update']>[0]) =>
    ipcRenderer.invoke('localProviders:update', input),
  duplicate: (input: Parameters<PreloadApi['localProviders']['duplicate']>[0]) =>
    ipcRenderer.invoke('localProviders:duplicate', input),
  delete: (input: Parameters<PreloadApi['localProviders']['delete']>[0]) =>
    ipcRenderer.invoke('localProviders:delete', input),
  enable: (input: Parameters<PreloadApi['localProviders']['enable']>[0]) =>
    ipcRenderer.invoke('localProviders:enable', input),
  reveal: (input: Parameters<PreloadApi['localProviders']['reveal']>[0]) =>
    ipcRenderer.invoke('localProviders:reveal', input)
} satisfies PreloadApi['localProviders']
