import { create } from 'zustand'
import type { FolderHandle } from '../types/platform'

type State = {
  folder: FolderHandle | null
  gameUrl: string
  isOpen: boolean
  setFolder: (folder: FolderHandle) => void
  setGameUrl: (url: string) => void
  close: () => void
}

const DEFAULT_GAME_URL = '/test-game/index.html'

export const useProjectStore = create<State>((set) => ({
  folder: null,
  gameUrl: DEFAULT_GAME_URL,
  isOpen: false,
  setFolder: (folder) => set({ folder, isOpen: true }),
  setGameUrl: (gameUrl) => set({ gameUrl }),
  close: () => set({ folder: null, isOpen: false }),
}))
