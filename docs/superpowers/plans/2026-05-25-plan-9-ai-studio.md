# Plan 9 — AI Studio (Imagen image generation)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development.

**Goal:** Replace the AI Studio placeholder with a working image-generation surface that calls Google's Gemini API (Imagen 3) using `GOOGLE_GENAI_API_KEY`. User types a prompt → generated image previews → click "Save to project" → image is written to `media/ai-generated/<timestamp>.png` in the open project. Gracefully disabled when the API key is missing.

**Architecture:** A small `AiProvider` interface (per spec §9.3) with one concrete implementation, `ImagenProvider`. The provider lives in `src/ai/`. `aiStudioStore` tracks prompt, status, last result (data URL), and history. `AIStudioPanel` reads the env var via `getPlatform().env` to decide if generation is available. **The real network call is gated behind a provider so tests can swap in a fake** without burning credits.

**Tech Stack:** Uses native `fetch()` against `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict`. The model name is exported as a config constant so it's easy to swap to another Imagen variant or Vertex AI later.

**Reference:** Spec §9 (AI Studio configuration, generation pipeline, provider abstraction).

**Out of scope:**
- Veo 3 video generation — Plan 11
- Seedance animation — Plan 12
- Reference-image-conditioned generation — later
- Inline asset replacement (drop a generated image onto an Inspector field) — Plan 10
- Streaming / multi-image generation — single image per request for now

---

### Task 1: AiProvider interface + ImagenProvider

**Files:**
- Create: `src/ai/provider.ts`
- Create: `src/ai/imagenProvider.ts`
- Create: `src/ai/imagenProvider.test.ts`

- [ ] **Step 1: Write `src/ai/provider.ts`**

```ts
export type ImageRequest = {
  prompt: string
  /** "1:1" | "16:9" | "9:16" | "4:3" | "3:4" — provider may map to nearest supported */
  aspectRatio?: string
}

export type ImageResult = {
  /** Base64-encoded PNG/JPEG data — without the data: URI prefix */
  base64: string
  mimeType: string
}

export interface AiProvider {
  readonly name: string
  /** True if the necessary env vars / keys are configured. */
  isAvailable(): boolean
  generateImage(req: ImageRequest): Promise<ImageResult>
}

export class ProviderUnavailableError extends Error {
  constructor(name: string) {
    super(`${name} provider is unavailable (missing API key)`)
    this.name = 'ProviderUnavailableError'
  }
}
```

- [ ] **Step 2: Write failing test `src/ai/imagenProvider.test.ts`**

```ts
import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest'
import { ProviderUnavailableError } from './provider'
import { createImagenProvider } from './imagenProvider'

const originalFetch = globalThis.fetch

describe('ImagenProvider', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  test('isAvailable returns false when env has no GOOGLE_GENAI_API_KEY', () => {
    const provider = createImagenProvider({ env: { get: () => undefined, has: () => false } })
    expect(provider.isAvailable()).toBe(false)
  })

  test('isAvailable returns true when env has GOOGLE_GENAI_API_KEY', () => {
    const provider = createImagenProvider({
      env: { get: (k) => (k === 'GOOGLE_GENAI_API_KEY' ? 'abc' : undefined), has: (k) => k === 'GOOGLE_GENAI_API_KEY' },
    })
    expect(provider.isAvailable()).toBe(true)
  })

  test('generateImage throws ProviderUnavailableError when no key', async () => {
    const provider = createImagenProvider({ env: { get: () => undefined, has: () => false } })
    await expect(provider.generateImage({ prompt: 'a cat' })).rejects.toBeInstanceOf(ProviderUnavailableError)
  })

  test('generateImage POSTs to the Imagen endpoint with the prompt', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      predictions: [{ bytesBase64Encoded: 'AAAA', mimeType: 'image/png' }],
    }), { status: 200 }))
    globalThis.fetch = fetchMock as typeof fetch

    const provider = createImagenProvider({
      env: { get: (k) => (k === 'GOOGLE_GENAI_API_KEY' ? 'abc' : undefined), has: (k) => k === 'GOOGLE_GENAI_API_KEY' },
    })
    const result = await provider.generateImage({ prompt: 'a cat' })

    expect(result).toEqual({ base64: 'AAAA', mimeType: 'image/png' })
    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0]
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
    expect((captured as Record<string, unknown>).parameters).toMatchObject({ aspectRatio: '16:9' })
  })
})
```

- [ ] **Step 3: Run — fail**

- [ ] **Step 4: Write `src/ai/imagenProvider.ts`**

```ts
import type { EnvAdapter } from '../types/platform'
import { ProviderUnavailableError, type AiProvider, type ImageRequest, type ImageResult } from './provider'

const KEY_NAME = 'GOOGLE_GENAI_API_KEY'
const MODEL = 'imagen-3.0-generate-002'
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:predict`

type Deps = { env: EnvAdapter }

type Prediction = { bytesBase64Encoded: string; mimeType: string }
type PredictResponse = { predictions?: Prediction[] }

export function createImagenProvider(deps: Deps): AiProvider {
  const env = deps.env

  return {
    name: 'Imagen 3',
    isAvailable: () => env.has(KEY_NAME),
    async generateImage(req: ImageRequest): Promise<ImageResult> {
      const key = env.get(KEY_NAME)
      if (key === undefined || key === '') {
        throw new ProviderUnavailableError('Imagen')
      }
      const body = {
        instances: [{ prompt: req.prompt }],
        parameters: {
          sampleCount: 1,
          ...(req.aspectRatio !== undefined ? { aspectRatio: req.aspectRatio } : {}),
        },
      }
      const url = `${ENDPOINT}?key=${encodeURIComponent(key)}`
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const text = await res.text()
        let message = `HTTP ${res.status}`
        try {
          const parsed = JSON.parse(text) as { error?: { message?: string } }
          if (parsed.error?.message !== undefined) message = parsed.error.message
        } catch { /* keep default */ }
        throw new Error(`Imagen generation failed: ${message}`)
      }
      const json = (await res.json()) as PredictResponse
      const prediction = json.predictions?.[0]
      if (prediction === undefined) {
        throw new Error('Imagen returned no predictions')
      }
      return { base64: prediction.bytesBase64Encoded, mimeType: prediction.mimeType }
    },
  }
}
```

- [ ] **Step 5: Verify tests pass + lint + typecheck**

- [ ] **Step 6: Commit**

```
git add src/ai/
git commit -m "ai: AiProvider interface + Imagen 3 provider over Gemini API"
```

Co-Authored-By: `Co-Authored-By: Claude <noreply@anthropic.com>`

---

### Task 2: aiStudioStore

**Files:**
- Create: `src/stores/aiStudioStore.ts`
- Create: `src/stores/aiStudioStore.test.ts`

Tracks the current prompt, generation status, last result, and a small history of recent generations.

- [ ] **Step 1: Write failing test**

```ts
import { describe, expect, test, beforeEach } from 'vitest'
import { useAiStudioStore } from './aiStudioStore'

describe('aiStudioStore', () => {
  beforeEach(() => { useAiStudioStore.getState().reset() })

  test('initial state', () => {
    const s = useAiStudioStore.getState()
    expect(s.prompt).toBe('')
    expect(s.status).toBe('idle')
    expect(s.error).toBeNull()
    expect(s.result).toBeNull()
    expect(s.history).toEqual([])
  })

  test('setPrompt updates the draft prompt', () => {
    useAiStudioStore.getState().setPrompt('a cat')
    expect(useAiStudioStore.getState().prompt).toBe('a cat')
  })

  test('beginGeneration sets status to running', () => {
    useAiStudioStore.getState().beginGeneration()
    expect(useAiStudioStore.getState().status).toBe('running')
    expect(useAiStudioStore.getState().error).toBeNull()
  })

  test('completeGeneration stores result + pushes to history + status done', () => {
    useAiStudioStore.getState().setPrompt('a cat')
    useAiStudioStore.getState().beginGeneration()
    useAiStudioStore.getState().completeGeneration({ base64: 'AAA', mimeType: 'image/png' })
    const s = useAiStudioStore.getState()
    expect(s.status).toBe('done')
    expect(s.result).toEqual({ base64: 'AAA', mimeType: 'image/png' })
    expect(s.history).toHaveLength(1)
    expect(s.history[0]).toMatchObject({ prompt: 'a cat', base64: 'AAA', mimeType: 'image/png' })
  })

  test('failGeneration stores error + status error', () => {
    useAiStudioStore.getState().beginGeneration()
    useAiStudioStore.getState().failGeneration('rate limited')
    expect(useAiStudioStore.getState().status).toBe('error')
    expect(useAiStudioStore.getState().error).toBe('rate limited')
  })

  test('history cap is enforced', () => {
    const s = useAiStudioStore.getState()
    for (let i = 0; i < 25; i++) {
      s.setPrompt(`p${i}`)
      s.completeGeneration({ base64: `b${i}`, mimeType: 'image/png' })
    }
    expect(useAiStudioStore.getState().history.length).toBeLessThanOrEqual(20)
  })

  test('reset clears everything', () => {
    useAiStudioStore.getState().setPrompt('x')
    useAiStudioStore.getState().completeGeneration({ base64: 'a', mimeType: 'image/png' })
    useAiStudioStore.getState().reset()
    const s = useAiStudioStore.getState()
    expect(s.prompt).toBe('')
    expect(s.result).toBeNull()
    expect(s.history).toEqual([])
  })
})
```

- [ ] **Step 2: Run — fail**

- [ ] **Step 3: Write `src/stores/aiStudioStore.ts`**

```ts
import { create } from 'zustand'

export type GenerationStatus = 'idle' | 'running' | 'done' | 'error'

export type GeneratedImage = { base64: string; mimeType: string }

export type HistoryEntry = {
  id: number
  prompt: string
  base64: string
  mimeType: string
  timestamp: number
}

const HISTORY_CAP = 20

type State = {
  prompt: string
  status: GenerationStatus
  error: string | null
  result: GeneratedImage | null
  history: readonly HistoryEntry[]
  nextId: number
  setPrompt: (p: string) => void
  beginGeneration: () => void
  completeGeneration: (img: GeneratedImage) => void
  failGeneration: (message: string) => void
  reset: () => void
}

export const useAiStudioStore = create<State>((set, get) => ({
  prompt: '',
  status: 'idle',
  error: null,
  result: null,
  history: [],
  nextId: 1,
  setPrompt: (prompt) => set({ prompt }),
  beginGeneration: () => set({ status: 'running', error: null }),
  completeGeneration: (img) => {
    const { history, prompt, nextId } = get()
    const entry: HistoryEntry = { id: nextId, prompt, base64: img.base64, mimeType: img.mimeType, timestamp: Date.now() }
    const nextHistory = [entry, ...history].slice(0, HISTORY_CAP)
    set({ status: 'done', result: img, history: nextHistory, nextId: nextId + 1 })
  },
  failGeneration: (message) => set({ status: 'error', error: message }),
  reset: () => set({ prompt: '', status: 'idle', error: null, result: null, history: [], nextId: 1 }),
}))
```

- [ ] **Step 4: Verify tests pass**

- [ ] **Step 5: Commit**

```
git add src/stores/aiStudioStore.ts src/stores/aiStudioStore.test.ts
git commit -m "stores: aiStudioStore tracks prompt, generation status, result, history"
```

Co-Authored-By trailer.

---

### Task 3: AIStudioPanel UI

**Files:**
- Create: `src/ui/panels/AIStudioPanel.tsx`
- Create: `src/ui/panels/AIStudioPanel.module.css`
- Create: `src/ui/panels/AIStudioPanel.test.tsx`

The panel: prompt textarea + Generate button + image preview + "Save to project" button (only when a project is open).

- [ ] **Step 1: Write failing test**

```tsx
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

  test('shows "no API key" hint when env is empty', () => {
    __setPlatformForTests(mockPlatform({}))
    render(<AIStudioPanel />)
    expect(screen.getByText(/GOOGLE_GENAI_API_KEY/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /generate/i })).toBeDisabled()
  })

  test('enables Generate when env has the key', () => {
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
```

- [ ] **Step 2: Run — fail**

- [ ] **Step 3: Write `src/ui/panels/AIStudioPanel.module.css`**

```css
.wrap {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: var(--sp-3);
  gap: var(--sp-3);
  overflow: auto;
}
.section { display: flex; flex-direction: column; gap: var(--sp-2); }
.label {
  font-size: var(--fs-chrome);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-tertiary);
  font-weight: 700;
}
.unavailable {
  background: var(--glass-2);
  border: 1px solid rgba(248, 113, 113, 0.30);
  border-radius: var(--r-sm);
  padding: var(--sp-2) var(--sp-3);
  font-size: var(--fs-chrome);
  color: var(--text-secondary);
}
.prompt {
  background: var(--glass-input);
  border: 1px solid var(--border);
  border-radius: var(--r-sm);
  color: var(--text-primary);
  font-family: var(--font-sans);
  font-size: 13px;
  padding: var(--sp-2);
  resize: vertical;
  min-height: 60px;
  outline: none;
}
.prompt:focus { border-color: var(--border-focus); }
.toolbar { display: flex; align-items: center; gap: var(--sp-2); }
.generate {
  background: var(--accent-soft);
  border: 1px solid rgba(167, 139, 250, 0.30);
  border-radius: var(--r-sm);
  color: var(--accent);
  padding: 4px var(--sp-3);
  font-size: var(--fs-chrome);
  cursor: pointer;
  font-weight: 600;
}
.generate:disabled { opacity: 0.4; cursor: not-allowed; }
.generate:not(:disabled):hover { background: rgba(167, 139, 250, 0.30); }
.save {
  background: transparent;
  border: 1px solid var(--border);
  border-radius: var(--r-sm);
  color: var(--text-secondary);
  padding: 4px var(--sp-3);
  font-size: var(--fs-chrome);
  cursor: pointer;
}
.save:disabled { opacity: 0.4; cursor: not-allowed; }
.save:not(:disabled):hover { background: var(--glass-2); color: var(--text-primary); }
.status { font-size: var(--fs-chrome); color: var(--text-tertiary); }
.status[data-status="running"] { color: var(--info); }
.status[data-status="error"] { color: var(--error); }
.preview {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-canvas);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  padding: var(--sp-3);
  min-height: 200px;
}
.preview img {
  max-width: 100%;
  max-height: 400px;
  border-radius: var(--r-sm);
}
```

- [ ] **Step 4: Write `src/ui/panels/AIStudioPanel.tsx`**

```tsx
import styles from './AIStudioPanel.module.css'
import { useAiStudioStore } from '../../stores/aiStudioStore'
import { useProjectStore } from '../../stores/projectStore'
import { useConsoleStore } from '../../stores/consoleStore'
import { getPlatform } from '../../platform'
import { createImagenProvider } from '../../ai/imagenProvider'
import type { AiProvider } from '../../ai/provider'

// Provider is lazily constructed and may be overridden in tests.
let _provider: AiProvider | null = null

function getProvider(): AiProvider {
  if (_provider !== null) return _provider
  _provider = createImagenProvider({ env: getPlatform().env })
  return _provider
}

export function __setAiProviderForTests(provider: AiProvider | null): void {
  _provider = provider
}

function decodeBase64(b64: string): Uint8Array {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function paddedTimestamp(): string {
  const d = new Date()
  const p = (n: number, w = 2) => String(n).padStart(w, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

export function AIStudioPanel() {
  const prompt = useAiStudioStore((s) => s.prompt)
  const status = useAiStudioStore((s) => s.status)
  const error = useAiStudioStore((s) => s.error)
  const result = useAiStudioStore((s) => s.result)
  const setPrompt = useAiStudioStore((s) => s.setPrompt)
  const beginGeneration = useAiStudioStore((s) => s.beginGeneration)
  const completeGeneration = useAiStudioStore((s) => s.completeGeneration)
  const failGeneration = useAiStudioStore((s) => s.failGeneration)

  const folder = useProjectStore((s) => s.folder)
  const addLog = useConsoleStore((s) => s.addEntry)

  const provider = getProvider()
  const available = provider.isAvailable()
  const canGenerate = available && prompt.trim() !== '' && status !== 'running'
  const canSave = result !== null && folder !== null

  async function handleGenerate(): Promise<void> {
    if (!canGenerate) return
    beginGeneration()
    try {
      const img = await provider.generateImage({ prompt })
      completeGeneration(img)
      addLog({ level: 'info', message: `AI: generated image for "${prompt.slice(0, 60)}"` })
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      failGeneration(message)
      addLog({ level: 'error', message: `AI: ${message}` })
    }
  }

  async function handleSave(): Promise<void> {
    if (!canSave || result === null || folder === null) return
    const ext = result.mimeType.includes('jpeg') ? 'jpg' : 'png'
    const path = `media/ai-generated/${paddedTimestamp()}.${ext}`
    try {
      await getPlatform().fs.writeFile(folder, path, decodeBase64(result.base64))
      addLog({ level: 'info', message: `AI: saved generated image to ${path}` })
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      addLog({ level: 'error', message: `AI save failed: ${message}` })
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.section}>
        <span className={styles.label}>Prompt</span>
        {!available && (
          <div className={styles.unavailable}>
            <strong>GOOGLE_GENAI_API_KEY</strong> environment variable is not set.
            Set it before launching the editor to enable Imagen 3 image generation.
          </div>
        )}
        <textarea
          className={styles.prompt}
          aria-label="prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe the image you want to generate..."
        />
        <div className={styles.toolbar}>
          <button type="button" className={styles.generate} onClick={handleGenerate} disabled={!canGenerate}>
            {status === 'running' ? 'Generating…' : `Generate (${provider.name})`}
          </button>
          <button type="button" className={styles.save} onClick={handleSave} disabled={!canSave}>
            Save to project
          </button>
          <span className={styles.status} data-status={status}>
            {status === 'running' && 'Generating image…'}
            {status === 'done' && 'Done'}
            {status === 'error' && (error ?? 'Error')}
          </span>
        </div>
      </div>

      <div className={styles.section}>
        <span className={styles.label}>Preview</span>
        <div className={styles.preview}>
          {result !== null ? (
            <img alt="generated" src={`data:${result.mimeType};base64,${result.base64}`} />
          ) : (
            <span className={styles.status}>No image generated yet.</span>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Verify tests pass + lint + typecheck**

- [ ] **Step 6: Commit**

```
git add src/ui/panels/AIStudioPanel.tsx src/ui/panels/AIStudioPanel.module.css src/ui/panels/AIStudioPanel.test.tsx
git commit -m "ui: AIStudioPanel — Imagen prompt → generate → preview → save"
```

Co-Authored-By trailer.

---

### Task 4: Wire AIStudioPanel into BottomTabs

**Files:**
- Modify: `src/ui/panels/BottomTabs.tsx`

- [ ] **Step 1: Add import + extend pattern**

```tsx
import { AIStudioPanel } from './AIStudioPanel'
```

```tsx
const isAi = active === 'ai'
const passThrough = isConsole || isAssets || isSettings || isConfig || isAi
```

```tsx
{isConsole ? <ConsolePanel />
 : isAssets ? <AssetTreePanel />
 : isSettings ? <SettingsPanel />
 : isConfig ? <ConfigEditorPanel />
 : isAi ? <AIStudioPanel />
 : <span>{placeholderFor(active)}</span>}
```

Update `placeholderFor` so `'ai'` returns empty string. At this point, every tab has a real implementation; `placeholderFor` can return empty string for all cases. But leave the function in place for future tabs.

- [ ] **Step 2: Verify + commit**

```
git add src/ui/panels/BottomTabs.tsx
git commit -m "tabs: render AIStudioPanel for AI Studio tab"
```

---

### Task 5: Final checks + merge

- [ ] Lint, typecheck, tests, build all PASS
- [ ] Merge to main

---

## Not in Plan 9

- Veo 3 video generation — Plan 11
- Seedance animation — Plan 12
- Reference-image conditioning — later
- Drop generated image onto Inspector asset field — Plan 10
- Multi-image / streaming — later
