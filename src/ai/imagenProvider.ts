import type { EnvAdapter } from '../types/platform'
import { ProviderUnavailableError, type AiProvider, type ImageRequest, type ImageResult } from './provider'

/**
 * Environment variable names checked in order. The first one with a non-empty
 * value wins. CEGO_GEMINI_API_KEY is the studio's internal convention;
 * GOOGLE_GENAI_API_KEY is the public Gemini API name.
 */
export const KEY_CANDIDATES = ['CEGO_GEMINI_API_KEY', 'GOOGLE_GENAI_API_KEY'] as const

const MODEL = 'imagen-3.0-generate-002'
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:predict`

type Deps = { env: EnvAdapter }

type Prediction = { bytesBase64Encoded: string; mimeType: string }
type PredictResponse = { predictions?: Prediction[] }

function resolveKey(env: EnvAdapter): string | undefined {
  for (const name of KEY_CANDIDATES) {
    const v = env.get(name)
    if (v !== undefined && v !== '') return v
  }
  return undefined
}

export function createImagenProvider(deps: Deps): AiProvider {
  const env = deps.env

  return {
    name: 'Imagen 3',
    isAvailable: () => resolveKey(env) !== undefined,
    async generateImage(req: ImageRequest): Promise<ImageResult> {
      const key = resolveKey(env)
      if (key === undefined) {
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
