import { create } from 'zustand'
import type { FolderHandle } from '../types/platform'
import type { ProjectConfig } from '../project/projectConfig'

type State = {
  folder: FolderHandle | null
  gameUrl: string
  isOpen: boolean
  projectName: string | null
  devPortOffset: number | null
  spineVersion: string | null
  balanceTypes: readonly string[]
  selectedBalanceType: string | null
  setFolder: (folder: FolderHandle) => void
  setGameUrl: (url: string) => void
  loadProjectConfig: (cfg: ProjectConfig) => void
  selectBalanceType: (name: string) => void
  close: () => void
}

const DEFAULT_GAME_URL = '/test-game/index.html'

export const useProjectStore = create<State>((set) => ({
  folder: null,
  gameUrl: DEFAULT_GAME_URL,
  isOpen: false,
  projectName: null,
  devPortOffset: null,
  spineVersion: null,
  balanceTypes: [],
  selectedBalanceType: null,
  setFolder: (folder) => set({ folder, isOpen: true }),
  setGameUrl: (gameUrl) => set({ gameUrl }),
  loadProjectConfig: (cfg) => set({
    projectName: cfg.projectName,
    devPortOffset: cfg.devPortOffset,
    spineVersion: cfg.spineVersion,
    balanceTypes: cfg.balanceTypes,
    selectedBalanceType: cfg.balanceTypes.length > 0 ? cfg.balanceTypes[0] : null,
  }),
  selectBalanceType: (selectedBalanceType) => set({ selectedBalanceType }),
  close: () => set({
    folder: null,
    isOpen: false,
    projectName: null,
    devPortOffset: null,
    spineVersion: null,
    balanceTypes: [],
    selectedBalanceType: null,
  }),
}))
