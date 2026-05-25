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

  test('loadProjectConfig stores parsed config', () => {
    useProjectStore.getState().loadProjectConfig({
      projectName: 'BigBait',
      devPortOffset: 100,
      spineVersion: '4.2.37',
      balanceTypes: ['rhodium', 'natrium'],
    })
    const s = useProjectStore.getState()
    expect(s.projectName).toBe('BigBait')
    expect(s.devPortOffset).toBe(100)
    expect(s.balanceTypes).toEqual(['rhodium', 'natrium'])
    expect(s.selectedBalanceType).toBe('rhodium')
  })

  test('selectBalanceType picks one of the available types', () => {
    useProjectStore.getState().loadProjectConfig({
      projectName: 'X', devPortOffset: 100, spineVersion: null, balanceTypes: ['rhodium', 'natrium'],
    })
    useProjectStore.getState().selectBalanceType('natrium')
    expect(useProjectStore.getState().selectedBalanceType).toBe('natrium')
  })

  test('close() resets project config fields', () => {
    useProjectStore.getState().loadProjectConfig({
      projectName: 'X', devPortOffset: 100, spineVersion: null, balanceTypes: ['rhodium'],
    })
    useProjectStore.getState().close()
    const s = useProjectStore.getState()
    expect(s.projectName).toBeNull()
    expect(s.devPortOffset).toBeNull()
    expect(s.balanceTypes).toEqual([])
    expect(s.selectedBalanceType).toBeNull()
  })
})
