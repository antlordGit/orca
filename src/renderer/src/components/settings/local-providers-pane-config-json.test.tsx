// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LocalProvidersPaneConfigJson } from './local-providers-pane-config-json'
import { INITIAL_FORM, type ProviderFormState } from './local-providers-pane-form'

function claudeForm(overrides: Partial<ProviderFormState> = {}): ProviderFormState {
  return {
    ...INITIAL_FORM,
    name: 'Personal Claude',
    baseUrl: 'http://10.0.0.1:8012/v1',
    authField: 'ANTHROPIC_AUTH_TOKEN',
    model: 'gpt-5.6-luna',
    ...overrides
  }
}

function textarea(container: HTMLDivElement): HTMLTextAreaElement {
  const element = container.querySelector<HTMLTextAreaElement>('textarea')
  if (!element) {
    throw new Error('Config JSON textarea was not rendered')
  }
  return element
}

function typeInto(element: HTMLTextAreaElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    'value'
  )?.set
  setter?.call(element, value)
  element.dispatchEvent(new Event('input', { bubbles: true }))
}

describe('LocalProvidersPaneConfigJson', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>
  let latest: ProviderFormState | null

  function render(form: ProviderFormState, hasApiKey = false): void {
    latest = null
    act(() => {
      root.render(
        <LocalProvidersPaneConfigJson
          form={form}
          hasApiKey={hasApiKey}
          onFormChange={(next) => {
            latest = next
          }}
        />
      )
    })
  }

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    document.body.innerHTML = ''
  })

  it('renders the cc-switch shaped projection without a fields block', () => {
    render(claudeForm())

    const parsed: unknown = JSON.parse(textarea(container).value)
    expect(parsed).not.toHaveProperty('fields')
    expect(parsed).toMatchObject({
      name: 'Personal Claude',
      type: 'claude-code',
      env: {
        ANTHROPIC_BASE_URL: 'http://10.0.0.1:8012/v1',
        ANTHROPIC_MODEL: 'gpt-5.6-luna'
      }
    })
  })

  it('folds an edited env block back onto the form fields', () => {
    render(claudeForm())

    act(() => {
      typeInto(
        textarea(container),
        JSON.stringify({
          env: {
            ANTHROPIC_BASE_URL: 'http://other:9000/v1',
            ANTHROPIC_MODEL: 'next-model',
            ANTHROPIC_DEFAULT_OPUS_MODEL: 'opus-model',
            CLAUDE_CODE_SUBAGENT_MODEL: 'sub-model'
          }
        })
      )
    })

    expect(latest).toMatchObject({
      baseUrl: 'http://other:9000/v1',
      model: 'next-model',
      opusModel: 'opus-model',
      subagentModel: 'sub-model'
    })
  })

  it('keeps unowned env keys in the environment textarea', () => {
    render(claudeForm())

    act(() => {
      typeInto(
        textarea(container),
        JSON.stringify({ env: { ANTHROPIC_MODEL: 'next-model', MY_CUSTOM: 'kept' } })
      )
    })

    expect(latest?.model).toBe('next-model')
    expect(latest?.env).toBe('MY_CUSTOM=kept')
  })

  it('keeps the stored secret when the projection mask round-trips', () => {
    render(claudeForm(), true)

    const projected: unknown = JSON.parse(textarea(container).value)
    expect(projected).toMatchObject({
      env: { ANTHROPIC_AUTH_TOKEN: '••••••' }
    })

    act(() => {
      typeInto(
        textarea(container),
        JSON.stringify(projected)
      )
    })

    // A masked echo must never be written back as the credential.
    expect(latest?.env).toBe('')
    expect(latest?.baseUrl).toBe('http://10.0.0.1:8012/v1')
  })

  it('reports invalid JSON without writing back to the form', () => {
    render(claudeForm())

    act(() => {
      typeInto(textarea(container), '{ not json')
    })

    expect(latest).toBeNull()
    expect(textarea(container).getAttribute('aria-invalid')).toBe('true')
  })

  it('copies through the IPC clipboard channel and confirms on the button', async () => {
    // Why IPC, not navigator.clipboard: the Electron renderer is not a secure
    // context in every configuration, where writeText is absent and the click
    // silently does nothing.
    const writeClipboardText = vi.fn(async () => undefined)
    Object.assign(window, { api: { ui: { writeClipboardText } } })
    render(claudeForm())

    const copyButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === '复制'
    )
    if (!copyButton) {
      throw new Error('Copy button was not rendered')
    }

    await act(async () => {
      copyButton.click()
      await Promise.resolve()
    })

    expect(writeClipboardText).toHaveBeenCalledWith(textarea(container).value)
    expect(container.textContent).toContain('已复制')
  })

  it('surfaces nothing misleading when the clipboard write fails', async () => {
    const writeClipboardText = vi.fn(async () => {
      throw new Error('clipboard unavailable')
    })
    Object.assign(window, { api: { ui: { writeClipboardText } } })
    render(claudeForm())

    const copyButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === '复制'
    )
    if (!copyButton) {
      throw new Error('Copy button was not rendered')
    }

    await act(async () => {
      copyButton.click()
      await Promise.resolve()
    })

    expect(container.textContent).not.toContain('已复制')
  })
})
