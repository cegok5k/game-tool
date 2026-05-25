import { describe, expect, test, beforeEach } from 'vitest'
import { useBridgeStore } from './bridgeStore'

describe('bridgeStore', () => {
  beforeEach(() => {
    useBridgeStore.getState().reset()
  })

  test('initial state is disconnected', () => {
    expect(useBridgeStore.getState().status).toBe('disconnected')
    expect(useBridgeStore.getState().gameName).toBeNull()
  })

  test('markConnected stores GAME_READY data', () => {
    useBridgeStore.getState().markConnected({
      gameName: 'BigBait',
      capabilities: ['spine', 'webgl'],
      metadata: { balanceTypes: ['rhodium', 'natrium'] },
    })
    const s = useBridgeStore.getState()
    expect(s.status).toBe('connected')
    expect(s.gameName).toBe('BigBait')
    expect(s.capabilities).toEqual(['spine', 'webgl'])
    expect(s.metadata?.balanceTypes).toEqual(['rhodium', 'natrium'])
  })

  test('hasCapability checks capability list', () => {
    useBridgeStore.getState().markConnected({
      gameName: 'X',
      capabilities: ['spine', 'jst-nodes'],
    })
    expect(useBridgeStore.getState().hasCapability('spine')).toBe(true)
    expect(useBridgeStore.getState().hasCapability('webgpu')).toBe(false)
  })

  test('reset returns to disconnected', () => {
    useBridgeStore.getState().markConnected({ gameName: 'X', capabilities: [] })
    useBridgeStore.getState().reset()
    expect(useBridgeStore.getState().status).toBe('disconnected')
  })
})
