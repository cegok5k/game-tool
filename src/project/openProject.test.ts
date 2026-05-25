import { describe, expect, test, vi, beforeEach } from 'vitest'
import type { FolderHandle, PlatformAdapter } from '../types/platform'
import { useProjectStore } from '../stores/projectStore'
import { openProject } from './openProject'

function mockPlatform(folder: FolderHandle | null, files: Record<string, string>): PlatformAdapter {
  return {
    kind: 'browser',
    fs: {
      openFolder: vi.fn(async () => folder),
      readFile: vi.fn(),
      readText: vi.fn(async (_h, p) => {
        if (p in files) return files[p]
        throw new Error('ENOENT')
      }),
      writeFile: vi.fn(),
      listDir: vi.fn(),
      watch: vi.fn(() => () => {}),
    },
    env: { get: () => undefined, has: () => false },
    shell: { openExternal: vi.fn() },
    dialog: { openFile: vi.fn(), saveFile: vi.fn() },
  }
}

describe('openProject', () => {
  beforeEach(() => {
    useProjectStore.getState().close()
  })

  test('returns false if user cancels picker', async () => {
    const platform = mockPlatform(null, {})
    const result = await openProject(platform)
    expect(result).toBe(false)
    expect(useProjectStore.getState().isOpen).toBe(false)
  })

  test('opens folder, reads config, populates store, updates gameUrl', async () => {
    const folder: FolderHandle = { name: 'big-bait', rootPath: 'big-bait', fsHandle: null }
    const platform = mockPlatform(folder, {
      'client/jsbuildconfig.json': JSON.stringify({ gamename: 'BigBait', devportoffset: 100 }),
      'supports.json': JSON.stringify({ balanceTypes: { rhodium: {}, natrium: {} } }),
    })
    const result = await openProject(platform)
    expect(result).toBe(true)
    const s = useProjectStore.getState()
    expect(s.isOpen).toBe(true)
    expect(s.projectName).toBe('BigBait')
    expect(s.balanceTypes).toEqual(['rhodium', 'natrium'])
    expect(s.selectedBalanceType).toBe('rhodium')
    expect(s.gameUrl).toBe('http://localhost/games/BigBait_8100/client/debug/testfullscreen.html?balance_type=rhodium')
  })

  test('leaves gameUrl unchanged when project has no balance types or port offset', async () => {
    useProjectStore.getState().setGameUrl('/custom-url')
    const folder: FolderHandle = { name: 'plain', rootPath: 'plain', fsHandle: null }
    const platform = mockPlatform(folder, {})
    await openProject(platform)
    expect(useProjectStore.getState().gameUrl).toBe('/custom-url')
  })
})
