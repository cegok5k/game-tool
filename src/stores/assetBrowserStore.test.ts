import { describe, expect, test, beforeEach } from 'vitest'
import type { DirEntry } from '../types/platform'
import { useAssetBrowserStore } from './assetBrowserStore'

const dirA: DirEntry = { kind: 'directory', path: 'media', name: 'media', size: 0, modifiedAt: 0 }
const fileA: DirEntry = { kind: 'file', path: 'media/hero.png', name: 'hero.png', size: 1234, modifiedAt: 0 }

describe('assetBrowserStore', () => {
  beforeEach(() => { useAssetBrowserStore.getState().reset() })

  test('initial state: nothing expanded, nothing selected, no caches', () => {
    const s = useAssetBrowserStore.getState()
    expect(s.expanded.size).toBe(0)
    expect(s.selectedPath).toBeNull()
    expect(s.entriesByPath.size).toBe(0)
  })

  test('toggleExpanded flips a path', () => {
    useAssetBrowserStore.getState().toggleExpanded('media')
    expect(useAssetBrowserStore.getState().expanded.has('media')).toBe(true)
    useAssetBrowserStore.getState().toggleExpanded('media')
    expect(useAssetBrowserStore.getState().expanded.has('media')).toBe(false)
  })

  test('setEntries caches entries for a path', () => {
    useAssetBrowserStore.getState().setEntries('media', [dirA, fileA])
    const cached = useAssetBrowserStore.getState().entriesByPath.get('media')
    expect(cached).toEqual([dirA, fileA])
  })

  test('select sets the selectedPath', () => {
    useAssetBrowserStore.getState().select('media/hero.png')
    expect(useAssetBrowserStore.getState().selectedPath).toBe('media/hero.png')
    useAssetBrowserStore.getState().select(null)
    expect(useAssetBrowserStore.getState().selectedPath).toBeNull()
  })

  test('reset clears everything', () => {
    const s = useAssetBrowserStore.getState()
    s.toggleExpanded('media')
    s.setEntries('media', [fileA])
    s.select('media/hero.png')
    s.reset()
    const after = useAssetBrowserStore.getState()
    expect(after.expanded.size).toBe(0)
    expect(after.entriesByPath.size).toBe(0)
    expect(after.selectedPath).toBeNull()
  })
})
