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
