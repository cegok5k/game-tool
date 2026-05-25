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
