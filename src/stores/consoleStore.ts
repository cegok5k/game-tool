import { create } from 'zustand'

export type LogLevel = 'info' | 'warn' | 'error'

export type LogEntry = {
  id: number
  level: LogLevel
  message: string
  timestamp: number
}

export const MAX_ENTRIES = 1000

type State = {
  entries: readonly LogEntry[]
  nextId: number
  addEntry: (entry: { level: LogLevel; message: string }) => void
  clear: () => void
}

export const useConsoleStore = create<State>((set, get) => ({
  entries: [],
  nextId: 1,
  addEntry: (entry) => {
    const { entries, nextId } = get()
    const next: LogEntry = {
      id: nextId,
      level: entry.level,
      message: entry.message,
      timestamp: Date.now(),
    }
    const combined = entries.length >= MAX_ENTRIES
      ? [...entries.slice(entries.length - MAX_ENTRIES + 1), next]
      : [...entries, next]
    set({ entries: combined, nextId: nextId + 1 })
  },
  clear: () => set({ entries: [], nextId: 1 }),
}))
