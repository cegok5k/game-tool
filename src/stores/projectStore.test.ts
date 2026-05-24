import { describe, expect, test, beforeEach } from 'vitest'
import { useProjectStore } from './projectStore'

describe('projectStore', () => {
  beforeEach(() => {
    useProjectStore.getState().close()
  })

  test('initial state has no folder', () => {
    expect(useProjectStore.getState().folder).toBeNull()
    expect(useProjectStore.getState().isOpen).toBe(false)
  })

  test('setFolder() opens a project', () => {
    useProjectStore.getState().setFolder({ name: 'big-bait', rootPath: 'big-bait', fsHandle: null })
    const s = useProjectStore.getState()
    expect(s.isOpen).toBe(true)
    expect(s.folder?.name).toBe('big-bait')
  })

  test('close() resets the folder', () => {
    useProjectStore.getState().setFolder({ name: 'big-bait', rootPath: 'big-bait', fsHandle: null })
    useProjectStore.getState().close()
    expect(useProjectStore.getState().isOpen).toBe(false)
    expect(useProjectStore.getState().folder).toBeNull()
  })

  test('setGameUrl() persists in state', () => {
    useProjectStore.getState().setGameUrl('http://localhost:5173/test-game/index.html')
    expect(useProjectStore.getState().gameUrl).toBe('http://localhost:5173/test-game/index.html')
  })
})
