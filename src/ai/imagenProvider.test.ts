import { describe, expect, test, afterEach } from 'vitest'
import { ProviderUnavailableError } from './provider'
import { createImagenProvider } from './imagenProvider'

const originalFetch = globalThis.fetch

describe('ImagenProvider', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  test('isAvailable returns false when env has neither candidate key', () => {
    const provider = createImagenProvider({ env: { get: () => undefined, has: () => false } })
    expect(provider.isAvailable()).toBe(false)
  })

  test('isAvailable returns true when env has GOOGLE_GENAI_API_KEY', () => {
    const provider = createImagenProvider({
      env: { get: (k) => (k === 'GOOGLE_GENAI_API_KEY' ? 'abc' : undefined), has: (k) => k === 'GOOGLE_GENAI_API_KEY' },
    })
    expect(provider.isAvailable()).toBe(true)
  })

  test('isAvailable returns true when env has CEGO_GEMINI_API_KEY', () => {
    const provider = createImagenProvider({
      env: { get: (k) => (k === 'CEGO_GEMINI_API_KEY' ? 'cego' : undefined), has: (k) => k === 'CEGO_GEMINI_API_KEY' },
    })
    expect(provider.isAvailable()).toBe(true)
  })

  test('CEGO_GEMINI_API_KEY takes precedence over GOOGLE_GENAI_API_KEY', async () => {
    let capturedUrl: unknown
    globalThis.fetch = (async (url: unknown) => {
      capturedUrl = url
      return new Response(JSON.stringify({ predictions: [{ bytesBase64Encoded: 'A', mimeType: 'image/png' }] }), { status: 200 })
    }) as typeof fetch
    const env = {
      get: (k: string) => (k === 'CEGO_GEMINI_API_KEY' ? 'cego' : k === 'GOOGLE_GENAI_API_KEY' ? 'public' : undefined),
      has: (k: string) => k === 'CEGO_GEMINI_API_KEY' || k === 'GOOGLE_GENAI_API_KEY',
    }
    const provider = createImagenProvider({ env })
    await provider.generateImage({ prompt: 'x' })
    expect(String(capturedUrl)).toContain('key=cego')
  })

  test('generateImage throws ProviderUnavailableError when no key', async () => {
    const provider = createImagenProvider({ env: { get: () => undefined, has: () => false } })
    await expect(provider.generateImage({ prompt: 'a cat' })).rejects.toBeInstanceOf(ProviderUnavailableError)
  })

  test('generateImage POSTs to the Imagen endpoint with the prompt', async () => {
    let capturedUrl: unknown
    let capturedInit: RequestInit | undefined
    globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
      capturedUrl = url
      capturedInit = init
      return new Response(JSON.stringify({
        predictions: [{ bytesBase64Encoded: 'AAAA', mimeType: 'image/png' }],
      }), { status: 200 })
    }) as typeof fetch

    const provider = createImagenProvider({
      env: { get: (k) => (k === 'GOOGLE_GENAI_API_KEY' ? 'abc' : undefined), has: (k) => k === 'GOOGLE_GENAI_API_KEY' },
    })
    const result = await provider.generateImage({ prompt: 'a cat' })

    expect(result).toEqual({ base64: 'AAAA', mimeType: 'image/png' })
    expect(capturedUrl).toBeDefined()
    const url = capturedUrl
    const init = capturedInit
    expect(String(url)).toContain('imagen-3.0-generate-002')
    expect(String(url)).toContain('key=abc')
    expect(init?.method).toBe('POST')
    const body = JSON.parse(init!.body as string)
    expect(body.instances[0].prompt).toBe('a cat')
  })

  test('generateImage throws on non-200 response with body message', async () => {
    globalThis.fetch = (async () => new Response('{"error":{"message":"bad prompt"}}', { status: 400 })) as typeof fetch
    const provider = createImagenProvider({
      env: { get: (k) => (k === 'GOOGLE_GENAI_API_KEY' ? 'abc' : undefined), has: (k) => k === 'GOOGLE_GENAI_API_KEY' },
    })
    await expect(provider.generateImage({ prompt: 'x' })).rejects.toThrow(/bad prompt/)
  })

  test('passes aspectRatio in parameters when provided', async () => {
    let captured: Record<string, unknown> | null = null
    globalThis.fetch = (async (_url: unknown, init: Record<string, unknown> | undefined) => {
      captured = JSON.parse(init?.body as string)
      return new Response(JSON.stringify({ predictions: [{ bytesBase64Encoded: 'AAA', mimeType: 'image/png' }] }), { status: 200 })
    }) as typeof fetch
    const provider = createImagenProvider({
      env: { get: (k) => (k === 'GOOGLE_GENAI_API_KEY' ? 'abc' : undefined), has: (k) => k === 'GOOGLE_GENAI_API_KEY' },
    })
    await provider.generateImage({ prompt: 'a', aspectRatio: '16:9' })
    expect((captured as unknown as Record<string, unknown>).parameters).toMatchObject({ aspectRatio: '16:9' })
  })
})
