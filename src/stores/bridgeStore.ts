import { create } from 'zustand'
import type { Capability, GameMetadata } from '../types/capabilities'

type Status = 'disconnected' | 'connecting' | 'connected' | 'error'

type GameReadyData = {
  gameName: string
  capabilities: readonly Capability[]
  metadata?: GameMetadata
}

type State = {
  status: Status
  gameName: string | null
  capabilities: readonly Capability[]
  metadata: GameMetadata | null
  errorMessage: string | null
  markConnecting: () => void
  markConnected: (data: GameReadyData) => void
  markError: (message: string) => void
  hasCapability: (cap: Capability) => boolean
  reset: () => void
}

export const useBridgeStore = create<State>((set, get) => ({
  status: 'disconnected',
  gameName: null,
  capabilities: [],
  metadata: null,
  errorMessage: null,
  markConnecting: () => set({ status: 'connecting', errorMessage: null }),
  markConnected: (data) =>
    set({
      status: 'connected',
      gameName: data.gameName,
      capabilities: data.capabilities,
      metadata: data.metadata ?? null,
      errorMessage: null,
    }),
  markError: (message) => set({ status: 'error', errorMessage: message }),
  hasCapability: (cap) => get().capabilities.includes(cap),
  reset: () =>
    set({
      status: 'disconnected',
      gameName: null,
      capabilities: [],
      metadata: null,
      errorMessage: null,
    }),
}))
