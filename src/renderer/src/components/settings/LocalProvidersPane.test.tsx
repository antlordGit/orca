// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LocalProviderSnapshot } from '../../../../shared/local-provider-types'
import { LocalProvidersPane } from './LocalProvidersPane'

const provider = {
  id: 'claude-1',
  type: 'claude-code' as const,
  name: 'Personal Claude',
  command: 'claude',
  args: [],
  env: {},
  enabled: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  secretConfigured: false,
  secretMasked: null
}

function snapshot(enabled = true): LocalProviderSnapshot {
  return {
    version: 1,
    providers: [{ ...provider, enabled }]
  }
}

describe('LocalProvidersPane', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>
  let list: ReturnType<typeof vi.fn>
  let enable: ReturnType<typeof vi.fn>

  beforeEach(() => {
    list = vi.fn(async () => snapshot())
    enable = vi.fn(async () => snapshot(false))
    Object.assign(window, {
      api: {
        localProviders: {
          list,
          enable,
          create: vi.fn(),
          update: vi.fn(),
          duplicate: vi.fn(),
          delete: vi.fn()
        }
      }
    })
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    document.body.innerHTML = ''
  })

  it('loads providers and toggles the enabled state through the preload API', async () => {
    await act(async () => {
      root.render(<LocalProvidersPane />)
    })
    await act(async () => {
      await Promise.resolve()
    })

    expect(list).toHaveBeenCalledOnce()
    expect(container.textContent).toContain('Personal Claude')
    const disableButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === '停用'
    )
    if (!disableButton) {
      throw new Error('Disable button was not rendered')
    }

    await act(async () => {
      disableButton.click()
      await Promise.resolve()
    })

    expect(enable).toHaveBeenCalledWith({ id: 'claude-1', enabled: false })
  })
})
