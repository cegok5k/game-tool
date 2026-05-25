// src/stores/spinePatchStore.ts
import { create } from 'zustand'
import type { BonePatch } from '../spine/spineJsonTypes'

type State = {
  pending: ReadonlyMap<string, ReadonlyMap<string, BonePatch>>
  enqueue: (skeletonFile: string, boneName: string, patch: BonePatch) => void
  clearFile: (skeletonFile: string) => void
  pendingFiles: () => string[]
  reset: () => void
}

export const useSpinePatchStore = create<State>((set, get) => ({
  pending: new Map(),

  enqueue: (file, bone, patch) => {
    const next = new Map(get().pending as Map<string, Map<string, BonePatch>>)
    const inner = new Map(next.get(file) ?? new Map<string, BonePatch>())
    inner.set(bone, { ...inner.get(bone), ...patch })
    next.set(file, inner)
    set({ pending: next })
  },

  clearFile: (file) => {
    const next = new Map(get().pending as Map<string, Map<string, BonePatch>>)
    next.delete(file)
    set({ pending: next })
  },

  pendingFiles: () => Array.from(get().pending.keys()),

  reset: () => set({ pending: new Map() }),
}))
