import { createServer } from 'node:http'
import { describe, expect, it } from 'vitest'
import {
  createLlmProxyServer,
  createStoreProviderResolver,
  isLlmProxyUrl,
  waitForLlmProxyReady
} from './llm-proxy-server'

describe('llm proxy server', () => {
  it('recognizes only the local Orca proxy URL', () => {
    expect(isLlmProxyUrl('http://127.0.0.1:8787/v1/dsant')).toBe(true)
    expect(isLlmProxyUrl('http://127.0.0.1:8788/v1/dsant')).toBe(false)
    expect(isLlmProxyUrl('https://gateway.example/v1')).toBe(false)
    expect(isLlmProxyUrl(undefined)).toBe(false)
  })

  it('waits for the local proxy port to become connectable', async () => {
    const server = createLlmProxyServer(undefined)
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    if (!address || typeof address === 'string') {
      throw new Error('Proxy server did not bind to a TCP port')
    }

    try {
      await waitForLlmProxyReady(`http://127.0.0.1:${address.port}/v1`, 1000, 10)
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      )
    }
  })

  it('forwards the request and streams the upstream response', async () => {
    const upstream = createServer((request, response) => {
      expect(request.url).toBe('/chat/completions')
      expect(request.headers.authorization).toBe('Bearer configured-key')
      expect(request.headers['content-type']).toBe('application/json')
      let body = ''
      request.setEncoding('utf8')
      request.on('data', (chunk: string) => {
        body += chunk
      })
      request.on('end', () => {
        expect(JSON.parse(body)).toMatchObject({ model: 'configured-model', stream: true })
      })
      response.writeHead(200, { 'content-type': 'text/event-stream' })
      response.write('data: first\n\n')
      setTimeout(() => {
        response.end('data: [DONE]\n\n')
      }, 5)
    })
    await new Promise<void>((resolve) => upstream.listen(0, '127.0.0.1', resolve))
    const upstreamAddress = upstream.address()
    if (!upstreamAddress || typeof upstreamAddress === 'string') {
      throw new Error('Upstream server did not bind to a TCP port')
    }

    const proxy = createLlmProxyServer(undefined, () => ({
      type: 'codex',
      baseUrl: `http://127.0.0.1:${upstreamAddress.port}`,
      apiKey: 'configured-key',
      model: 'configured-model'
    }))
    await new Promise<void>((resolve) => proxy.listen(0, '127.0.0.1', resolve))
    const proxyAddress = proxy.address()
    if (!proxyAddress || typeof proxyAddress === 'string') {
      throw new Error('Proxy server did not bind to a TCP port')
    }

    try {
      const response = await fetch(`http://127.0.0.1:${proxyAddress.port}/v1/chat/completions`, {
        method: 'POST',
        headers: { authorization: 'Bearer caller-key', 'content-type': 'application/json' },
        body: '{"stream":true}'
      })
      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toBe('text/event-stream')
      expect(await response.text()).toBe('data: first\n\ndata: [DONE]\n\n')
    } finally {
      await new Promise<void>((resolve, reject) =>
        proxy.close((error) => (error ? reject(error) : resolve()))
      )
      await new Promise<void>((resolve, reject) =>
        upstream.close((error) => (error ? reject(error) : resolve()))
      )
    }
  })

  it('uses an enabled Claude provider for OpenAI-compatible routes', () => {
    const resolver = createStoreProviderResolver({
      getLocalProviders: () => [
        {
          id: 'claude-provider',
          type: 'claude-code',
          name: 'sub2api',
          command: 'claude',
          args: [],
          env: {
            ANTHROPIC_BASE_URL: 'http://127.0.0.1:8012/v1',
            ANTHROPIC_AUTH_TOKEN: 'configured-token',
            ANTHROPIC_MODEL: 'gpt-5.6-luna'
          },
          secret: null,
          enabled: true,
          createdAt: '',
          updatedAt: ''
        }
      ],
      replaceLocalProviders: () => {}
    })

    expect(resolver('codex')).toEqual({
      type: 'codex',
      baseUrl: 'http://127.0.0.1:8012/v1',
      apiKey: 'configured-token',
      model: 'gpt-5.6-luna'
    })
  })

  it('sends both Anthropic-compatible authentication headers', async () => {
    const upstream = createServer((request, response) => {
      expect(request.url).toBe('/anthropic/v1/messages')
      expect(request.headers['x-api-key']).toBe('configured-token')
      expect(request.headers.authorization).toBe('Bearer configured-token')
      response.end('ok')
    })
    await new Promise<void>((resolve) => upstream.listen(0, '127.0.0.1', resolve))
    const address = upstream.address()
    if (!address || typeof address === 'string') {
      throw new Error('Upstream server did not bind to a TCP port')
    }

    const proxy = createLlmProxyServer(undefined, () => ({
      type: 'claude-code',
      baseUrl: `http://127.0.0.1:${address.port}/anthropic`,
      apiKey: 'configured-token',
      model: 'deepseek-flash'
    }))
    await new Promise<void>((resolve) => proxy.listen(0, '127.0.0.1', resolve))
    const proxyAddress = proxy.address()
    if (!proxyAddress || typeof proxyAddress === 'string') {
      throw new Error('Proxy server did not bind to a TCP port')
    }

    try {
      const response = await fetch(`http://127.0.0.1:${proxyAddress.port}/v1/messages`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model: 'caller-model', max_tokens: 10, messages: [] })
      })
      expect(response.status).toBe(200)
    } finally {
      await new Promise<void>((resolve, reject) =>
        proxy.close((error) => (error ? reject(error) : resolve()))
      )
      await new Promise<void>((resolve, reject) =>
        upstream.close((error) => (error ? reject(error) : resolve()))
      )
    }
  })

  it('maps Claude role aliases to the configured upstream model', async () => {
    const upstream = createServer((request, response) => {
      let body = ''
      request.setEncoding('utf8')
      request.on('data', (chunk: string) => {
        body += chunk
      })
      request.on('end', () => {
        expect(JSON.parse(body)).toMatchObject({ model: 'deepseek-flash' })
        response.end('ok')
      })
    })
    await new Promise<void>((resolve) => upstream.listen(0, '127.0.0.1', resolve))
    const address = upstream.address()
    if (!address || typeof address === 'string') {
      throw new Error('Upstream server did not bind to a TCP port')
    }

    const proxy = createLlmProxyServer(undefined, (_type, _format, prefix) =>
      prefix === 'dsant'
        ? {
            type: 'claude-code',
            baseUrl: `http://127.0.0.1:${address.port}`,
            apiKey: 'key',
            model: 'deepseek-flash'
          }
        : null
    )
    await new Promise<void>((resolve) => proxy.listen(0, '127.0.0.1', resolve))
    const proxyAddress = proxy.address()
    if (!proxyAddress || typeof proxyAddress === 'string') {
      throw new Error('Proxy server did not bind to a TCP port')
    }

    try {
      const response = await fetch(`http://127.0.0.1:${proxyAddress.port}/v1/dsant/messages`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model: 'claude-haiku-4-5', messages: [] })
      })
      expect(response.status).toBe(200)
    } finally {
      await new Promise<void>((resolve, reject) =>
        proxy.close((error) => (error ? reject(error) : resolve()))
      )
      await new Promise<void>((resolve, reject) =>
        upstream.close((error) => (error ? reject(error) : resolve()))
      )
    }
  })

  it('rejects an enabled provider without a base URL', async () => {
    const proxy = createLlmProxyServer(undefined, () => ({
      type: 'claude-code',
      apiKey: 'configured-token'
    }))
    await new Promise<void>((resolve) => proxy.listen(0, '127.0.0.1', resolve))
    const address = proxy.address()
    if (!address || typeof address === 'string') {
      throw new Error('Proxy server did not bind to a TCP port')
    }

    try {
      const response = await fetch(`http://127.0.0.1:${address.port}/v1/messages`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}'
      })
      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({
        error: { message: 'Enabled local provider has no base URL configured' }
      })
    } finally {
      await new Promise<void>((resolve, reject) =>
        proxy.close((error) => (error ? reject(error) : resolve()))
      )
    }
  })

  it('routes a gateway prefix to its selected provider', async () => {
    const upstream = createServer((request, response) => {
      expect(request.url).toBe('/v1/messages')
      response.end('gateway response')
    })
    await new Promise<void>((resolve) => upstream.listen(0, '127.0.0.1', resolve))
    const address = upstream.address()
    if (!address || typeof address === 'string') {
      throw new Error('Upstream server did not bind to a TCP port')
    }
    const proxy = createLlmProxyServer(undefined, (_type, _format, prefix) =>
      prefix === 'sub2api'
        ? { type: 'claude-code', baseUrl: `http://127.0.0.1:${address.port}`, apiKey: 'key' }
        : null
    )
    await new Promise<void>((resolve) => proxy.listen(0, '127.0.0.1', resolve))
    const proxyAddress = proxy.address()
    if (!proxyAddress || typeof proxyAddress === 'string') {
      throw new Error('Proxy server did not bind to a TCP port')
    }
    try {
      const response = await fetch(`http://127.0.0.1:${proxyAddress.port}/v1/sub2api/messages`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}'
      })
      expect(response.status).toBe(200)
      expect(await response.text()).toBe('gateway response')
    } finally {
      await new Promise<void>((resolve, reject) =>
        proxy.close((error) => (error ? reject(error) : resolve()))
      )
      await new Promise<void>((resolve, reject) =>
        upstream.close((error) => (error ? reject(error) : resolve()))
      )
    }
  })

  it('answers Claude model discovery for a gateway prefix', async () => {
    const proxy = createLlmProxyServer(undefined, (_type, _format, prefix) =>
      prefix === 'dsant' ? { type: 'claude-code', apiKey: 'key', model: 'MiniMax-M3' } : null
    )
    await new Promise<void>((resolve) => proxy.listen(0, '127.0.0.1', resolve))
    const address = proxy.address()
    if (!address || typeof address === 'string') {
      throw new Error('Proxy server did not bind to a TCP port')
    }
    try {
      const modelsResponse = await fetch(`http://127.0.0.1:${address.port}/v1/dsant/models`)
      expect(modelsResponse.status).toBe(200)
      expect(await modelsResponse.json()).toEqual({
        object: 'list',
        data: [
          {
            type: 'model',
            id: 'claude-haiku-4-5',
            display_name: 'claude-haiku-4-5',
            created_at: '2025-01-01T00:00:00Z'
          }
        ],
        has_more: false
      })

      const response = await fetch(
        `http://127.0.0.1:${address.port}/v1/dsant/models/claude-haiku-4-5`
      )
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({
        object: 'list',
        data: [
          {
            type: 'model',
            id: 'claude-haiku-4-5',
            display_name: 'claude-haiku-4-5',
            created_at: '2025-01-01T00:00:00Z'
          }
        ],
        has_more: false
      })
    } finally {
      await new Promise<void>((resolve, reject) =>
        proxy.close((error) => (error ? reject(error) : resolve()))
      )
    }
  })
})
