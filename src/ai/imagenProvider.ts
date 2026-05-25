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
