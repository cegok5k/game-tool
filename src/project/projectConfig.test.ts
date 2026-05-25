import { describe, expect, test, vi } from 'vitest'
import type { FolderHandle, FsAdapter } from '../types/platform'
import { readProjectConfig, deriveGameUrl } from './projectConfig'

function makeFs(files: Record<string, string>): FsAdapter {
  return {
    openFolder: vi.fn(),
    readFile: vi.fn(),
    readText: vi.fn(async (_h, p) => {
      if (p in files) return files[p]
      throw new Error('ENOENT')
    }),
    writeFile: vi.fn(),
    listDir: vi.fn(),
    watch: vi.fn(() => () => {}),
  }
}

const folder: FolderHandle = { name: 'big-bait', rootPath: 'big-bait', fsHandle: null }

describe('readProjectConfig', () => {
  test('returns null fields when no config files exist', async () => {
    const fs = makeFs({})
    const cfg = await readProjectConfig(fs, folder)
    expect(cfg.projectName).toBe('big-bait')
    expect(cfg.devPortOffset).toBeNull()
    expect(cfg.balanceTypes).toEqual([])
    expect(cfg.spineVersion).toBeNull()
  })

  test('reads gamename + devportoffset + spineversion from client/jsbuildconfig.json', async () => {
    const fs = makeFs({
      'client/jsbuildconfig.json': JSON.stringify({
        gamename: 'BigBait',
        devportoffset: 100,
        spineversion: '4.2.37',
      }),
    })
    const cfg = await readProjectConfig(fs, folder)
    expect(cfg.projectName).toBe('BigBait')
    expect(cfg.devPortOffset).toBe(100)
    expect(cfg.spineVersion).toBe('4.2.37')
  })

  test('reads balance types from supports.json', async () => {
    const fs = makeFs({
      'supports.json': JSON.stringify({
        gameName: 'BigBait',
        balanceTypes: { rhodium: {}, natrium: {}, magnesium: {} },
      }),
    })
    const cfg = await readProjectConfig(fs, folder)
    expect(cfg.balanceTypes).toEqual(['rhodium', 'natrium', 'magnesium'])
  })

  test('merges jsbuildconfig + supports.json into one project config', async () => {
    const fs = makeFs({
      'client/jsbuildconfig.json': JSON.stringify({ gamename: 'BigBait', devportoffset: 100 }),
      'supports.json': JSON.stringify({ balanceTypes: { rhodium: {} } }),
    })
    const cfg = await readProjectConfig(fs, folder)
    expect(cfg.projectName).toBe('BigBait')
    expect(cfg.devPortOffset).toBe(100)
    expect(cfg.balanceTypes).toEqual(['rhodium'])
  })

  test('tolerates malformed JSON without throwing', async () => {
    const fs = makeFs({
      'client/jsbuildconfig.json': '{ not valid json',
    })
    const cfg = await readProjectConfig(fs, folder)
    expect(cfg.projectName).toBe('big-bait')
    expect(cfg.devPortOffset).toBeNull()
  })
})

describe('deriveGameUrl', () => {
  test('returns null when gameName is null', () => {
    expect(deriveGameUrl({ gameName: null, devPortOffset: 100, balanceType: 'rhodium' })).toBeNull()
  })

  test('returns null when devPortOffset is null', () => {
    expect(deriveGameUrl({ gameName: 'BigBait', devPortOffset: null, balanceType: 'rhodium' })).toBeNull()
  })

  test('returns null when no balance type selected', () => {
    expect(deriveGameUrl({ gameName: 'BigBait', devPortOffset: 100, balanceType: null })).toBeNull()
  })

  test('builds the GLaDOS path-based URL from gameName + offset + balance', () => {
    expect(deriveGameUrl({ gameName: 'BigBait', devPortOffset: 100, balanceType: 'rhodium' }))
      .toBe('http://localhost/games/BigBait_8100/client/debug/testfullscreen.html?balance_type=rhodium')
    expect(deriveGameUrl({ gameName: 'Argo', devPortOffset: 4, balanceType: 'argon' }))
      .toBe('http://localhost/games/Argo_8004/client/debug/testfullscreen.html?balance_type=argon')
  })

  test('honors a custom host', () => {
    expect(deriveGameUrl({ gameName: 'BigBait', devPortOffset: 100, balanceType: 'rhodium', host: '127.0.0.1' }))
      .toBe('http://127.0.0.1/games/BigBait_8100/client/debug/testfullscreen.html?balance_type=rhodium')
  })
})
