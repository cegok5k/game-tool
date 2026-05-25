import { create } from 'zustand'

export type BottomTab = 'assets' | 'config' | 'ai' | 'console' | 'settings'

export const DEFAULT_GRID_SIZE = 32

type State = {
  selectedId: string | null
  activeBottomTab: BottomTab
  snapEnabled: boolean
  gridSize: number
  select: (id: string | null) => void
  setActiveBottomTab: (tab: BottomTab) => void
  setSnapEnabled: (on: boolean) => void
  reset: () => void
}

export const useEditorStore = create<State>((set) => ({
  selectedId: null,
  activeBottomTab: 'console',
  snapEnabled: false,
  gridSize: DEFAULT_GRID_SIZE,
  select: (selectedId) => set({ selectedId }),
  setActiveBottomTab: (activeBottomTab) => set({ activeBottomTab }),
  setSnapEnabled: (snapEnabled) => set({ snapEnabled }),
  reset: () => set({ selectedId: null, activeBottomTab: 'console', snapEnabled: false, gridSize: DEFAULT_GRID_SIZE }),
}))
