import { create } from 'zustand'
import type { DirEntry } from '../types/platform'

type State = {
  expanded: ReadonlySet<string>
  entriesByPath: ReadonlyMap<string, readonly DirEntry[]>
  selectedPath: string | null
  toggleExpanded: (path: string) => void
  setEntries: (path: string, entries: readonly DirEntry[]) => void
  select: (path: string | null) => void
  reset: () => void
}

export const useAssetBrowserStore = create<State>((set, get) => ({
  expanded: new Set(),
  entriesByPath: new Map(),
  selectedPath: null,
  toggleExpanded: (path) => {
    const next = new Set(get().expanded)
    if (next.has(path)) next.delete(path)
    else next.add(path)
    set({ expanded: next })
  },
  setEntries: (path, entries) => {
    const next = new Map(get().entriesByPath)
    next.set(path, entries)
    set({ entriesByPath: next })
  },
  select: (selectedPath) => set({ selectedPath }),
  reset: () => set({ expanded: new Set(), entriesByPath: new Map(), selectedPath: null }),
}))
