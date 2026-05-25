import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, expect, test, beforeEach, vi } from 'vitest'
import type { PlatformAdapter, FolderHandle } from '../../types/platform'
import { useProjectStore } from '../../stores/projectStore'
import { useAiStudioStore } from '../../stores/aiStudioStore'
import { __setPlatformForTests } from '../../platform'
import { AIStudioPanel, __setAiProviderForTests } from './AIStudioPanel'

function mockPlatform(env: Record<string, string>, writes: { path: string; data: Uint8Array }[] = []): PlatformAdapter {
  return {
    kind: 'browser',
    fs: {
      openFolder: vi.fn(),
      readFile: vi.fn(),
      readText: vi.fn(),
      writeFile: vi.fn(async (_h, p, d) => { writes.push({ path: p, data: d }) }),
      listDir: vi.fn(async () => []),
      watch: vi.fn(() => () => {}),
    },
    env: { get: (k) => env[k], has: (k) => Object.hasOwn(env, k) },
    shell: { openExternal: vi.fn() },
    dialog: { openFile: vi.fn(), saveFile: vi.fn() },
  }
}

describe('AIStudioPanel', () => {
  beforeEach(() => {
    useProjectStore.getState().close()
    useAiStudioStore.getState().reset()
    __setPlatformForTests(null)
    __setAiProviderForTests(null)
  })

  test('shows "no API key" hint when env is empty (mentions both candidate names)', () => {
    __setPlatformForTests(mockPlatform({}))
    render(<AIStudioPanel />)
    expect(screen.getByText(/CEGO_GEMINI_API_KEY/i)).toBeInTheDocument()
    expect(screen.getByText(/GOOGLE_GENAI_API_KEY/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /generate/i })).toBeDisabled()
  })

  test('enables Generate when env has CEGO_GEMINI_API_KEY', () => {
    __setPlatformForTests(mockPlatform({ CEGO_GEMINI_API_KEY: 'cego' }))
    render(<AIStudioPanel />)
    const ta = screen.getByRole('textbox')
    fireEvent.change(ta, { target: { value: 'a cat' } })
    expect(screen.getByRole('button', { name: /generate/i })).not.toBeDisabled()
  })

  test('enables Generate when env has the key + prompt is non-empty', () => {
    __setPlatformForTests(mockPlatform({ GOOGLE_GENAI_API_KEY: 'abc' }))
    render(<AIStudioPanel />)
    const ta = screen.getByRole('textbox')
    fireEvent.change(ta, { target: { value: 'a cat' } })
    expect(screen.getByRole('button', { name: /generate/i })).not.toBeDisabled()
  })

  test('clicking Generate calls the provider and shows the result', async () => {
    __setPlatformForTests(mockPlatform({ GOOGLE_GENAI_API_KEY: 'abc' }))
    const generateImage = vi.fn(async () => ({ base64: 'AAAA', mimeType: 'image/png' }))
    __setAiProviderForTests({ name: 'Mock', isAvailable: () => true, generateImage })
    render(<AIStudioPanel />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'a cat' } })
    fireEvent.click(screen.getByRole('button', { name: /generate/i }))
    await waitFor(() => expect(generateImage).toHaveBeenCalled())
    await waitFor(() => expect(useAiStudioStore.getState().status).toBe('done'))
    const img = screen.getByRole('img', { name: /generated/i }) as HTMLImageElement
    expect(img.src).toContain('data:image/png;base64,AAAA')
  })

  test('shows an error when generation fails', async () => {
    __setPlatformForTests(mockPlatform({ GOOGLE_GENAI_API_KEY: 'abc' }))
    const generateImage = vi.fn(async () => { throw new Error('rate limited') })
    __setAiProviderForTests({ name: 'Mock', isAvailable: () => true, generateImage })
    render(<AIStudioPanel />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'a cat' } })
    fireEvent.click(screen.getByRole('button', { name: /generate/i }))
    await waitFor(() => expect(useAiStudioStore.getState().status).toBe('error'))
    expect(screen.getByText(/rate limited/i)).toBeInTheDocument()
  })

  test('Save to project writes the image as PNG into media/ai-generated/', async () => {
    const writes: { path: string; data: Uint8Array }[] = []
    __setPlatformForTests(mockPlatform({ GOOGLE_GENAI_API_KEY: 'abc' }, writes))
    const generateImage = vi.fn(async () => ({ base64: 'aGVsbG8=', mimeType: 'image/png' }))  // "hello"
    __setAiProviderForTests({ name: 'Mock', isAvailable: () => true, generateImage })
    useProjectStore.getState().setFolder({ name: 'demo', rootPath: 'demo', fsHandle: null } as FolderHandle)
    render(<AIStudioPanel />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'hi' } })
    fireEvent.click(screen.getByRole('button', { name: /generate/i }))
    await waitFor(() => expect(useAiStudioStore.getState().status).toBe('done'))
    fireEvent.click(screen.getByRole('button', { name: /save to project/i }))
    await waitFor(() => expect(writes).toHaveLength(1))
    expect(writes[0].path).toMatch(/^media\/ai-generated\/.+\.png$/)
    expect(new TextDecoder().decode(writes[0].data)).toBe('hello')
  })

  test('Save to project is disabled when no project is open', async () => {
    __setPlatformForTests(mockPlatform({ GOOGLE_GENAI_API_KEY: 'abc' }))
    __setAiProviderForTests({ name: 'Mock', isAvailable: () => true, generateImage: async () => ({ base64: 'A', mimeType: 'image/png' }) })
    render(<AIStudioPanel />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'hi' } })
    fireEvent.click(screen.getByRole('button', { name: /generate/i }))
    await waitFor(() => expect(useAiStudioStore.getState().status).toBe('done'))
    expect(screen.getByRole('button', { name: /save to project/i })).toBeDisabled()
  })
})
