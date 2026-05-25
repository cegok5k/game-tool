import { describe, expect, test } from 'vitest'
import { createBrowserPlatform, stripVitePrefix } from './browser'

describe('browser platform adapter', () => {
  test('kind is "browser"', () => {
    const p = createBrowserPlatform()
    expect(p.kind).toBe('browser')
  })

  test('env adapter returns undefined for missing keys', () => {
    const p = createBrowserPlatform()
    expect(p.env.get('NONEXISTENT_KEY')).toBeUndefined()
    expect(p.env.has('NONEXISTENT_KEY')).toBe(false)
  })

  test('env adapter reads from injected store', () => {
    const p = createBrowserPlatform({ env: { GOOGLE_GENAI_API_KEY: 'abc' } })
    expect(p.env.get('GOOGLE_GENAI_API_KEY')).toBe('abc')
    expect(p.env.has('GOOGLE_GENAI_API_KEY')).toBe(true)
  })

  test('shell.spawn is undefined in browser', () => {
    const p = createBrowserPlatform()
    expect(p.shell.spawn).toBeUndefined()
  })

  test('stripVitePrefix strips VITE_ from keys and skips empty/non-string values', () => {
    expect(stripVitePrefix({
      VITE_GOOGLE_GENAI_API_KEY: 'from-vite',
      VITE_EMPTY: '',
      VITE_NUM: 42,
      MODE: 'development',  // non-VITE_ prefix is ignored
    })).toEqual({ GOOGLE_GENAI_API_KEY: 'from-vite' })
  })

  test('shell.openExternal opens in new tab', async () => {
    const p = createBrowserPlatform()
    const original = globalThis.open
    let called: string | null = null
    globalThis.open = ((url: string) => {
      called = url
      return null
    }) as typeof globalThis.open
    await p.shell.openExternal('https://example.com')
    expect(called).toBe('https://example.com')
    globalThis.open = original
  })
})
