import { describe, expect, test, beforeEach } from 'vitest'
import { useEditorStore } from './editorStore'

describe('editorStore', () => {
  beforeEach(() => {
    useEditorStore.getState().reset()
  })

  test('initial state has no selection', () => {
    expect(useEditorStore.getState().selectedId).toBeNull()
    expect(useEditorStore.getState().activeBottomTab).toBe('console')
  })

  test('select sets the selected id', () => {
    useEditorStore.getState().select('node-1')
    expect(useEditorStore.getState().selectedId).toBe('node-1')
  })

  test('select(null) clears selection', () => {
    useEditorStore.getState().select('node-1')
    useEditorStore.getState().select(null)
    expect(useEditorStore.getState().selectedId).toBeNull()
  })

  test('setActiveBottomTab updates the tab', () => {
    useEditorStore.getState().setActiveBottomTab('assets')
    expect(useEditorStore.getState().activeBottomTab).toBe('assets')
  })
})
