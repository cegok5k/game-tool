import styles from './AIStudioPanel.module.css'
import { useAiStudioStore } from '../../stores/aiStudioStore'
import { useProjectStore } from '../../stores/projectStore'
import { useConsoleStore } from '../../stores/consoleStore'
import { getPlatform } from '../../platform'
import { createImagenProvider } from '../../ai/imagenProvider'
import type { AiProvider } from '../../ai/provider'

let _provider: AiProvider | null = null

function getProvider(): AiProvider {
  if (_provider !== null) return _provider
  _provider = createImagenProvider({ env: getPlatform().env })
  return _provider
}

// eslint-disable-next-line react-refresh/only-export-components
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
            No Imagen API key found. Set either <strong>CEGO_GEMINI_API_KEY</strong> (Cego internal)
            or <strong>GOOGLE_GENAI_API_KEY</strong> (public Gemini API) as a <code>VITE_</code>-prefixed
            env var in <code>.env.local</code>, then restart the dev server.
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
