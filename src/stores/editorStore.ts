import { create } from 'zustand'

export type BottomTab = 'assets' | 'config' | 'ai' | 'console' | 'settings'

type State = {
  selectedId: string | null
  activeBottomTab: BottomTab
  select: (id: string | null) => void
  setActiveBottomTab: (tab: BottomTab) => void
  reset: () => void
}

export const useEditorStore = create<State>((set) => ({
  selectedId: null,
  activeBottomTab: 'console',
  select: (selectedId) => set({ selectedId }),
  setActiveBottomTab: (activeBottomTab) => set({ activeBottomTab }),
  reset: () => set({ selectedId: null, activeBottomTab: 'console' }),
}))
