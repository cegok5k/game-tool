import { create } from 'zustand'
import type { NodeSnapshot } from '../types/scene'

type State = {
  nodes: readonly NodeSnapshot[]
  index: ReadonlyMap<string, NodeSnapshot>
  setTree: (nodes: readonly NodeSnapshot[]) => void
  upsertNode: (node: NodeSnapshot) => void
  byId: (id: string) => NodeSnapshot | undefined
  reset: () => void
}

function buildIndex(nodes: readonly NodeSnapshot[]): Map<string, NodeSnapshot> {
  const m = new Map<string, NodeSnapshot>()
  for (const n of nodes) m.set(n.id, n)
  return m
}

export const useSceneStore = create<State>((set, get) => ({
  nodes: [],
  index: new Map(),
  setTree: (nodes) => set({ nodes, index: buildIndex(nodes) }),
  upsertNode: (node) => {
    const existing = get().nodes
    const idx = existing.findIndex((n) => n.id === node.id)
    const next = idx >= 0
      ? existing.map((n, i) => (i === idx ? node : n))
      : [...existing, node]
    set({ nodes: next, index: buildIndex(next) })
  },
  byId: (id) => get().index.get(id),
  reset: () => set({ nodes: [], index: new Map() }),
}))
