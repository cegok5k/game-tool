import { describe, expect, test, beforeEach } from 'vitest'
import { useConfigEditorStore } from './configEditorStore'

describe('configEditorStore', () => {
  beforeEach(() => { useConfigEditorStore.getState().reset() })

  test('initial state has nothing loaded', () => {
    const s = useConfigEditorStore.getState()
    expect(s.path).toBeNull()
    expect(s.draft).toBe('')
    expect(s.original).toBe('')
    expect(s.isDirty).toBe(false)
    expect(s.parseError).toBeNull()
  })

  test('loadFile stores path + content + clears dirty', () => {
    useConfigEditorStore.getState().loadFile('configs/foo.json', '{"a":1}')
    const s = useConfigEditorStore.getState()
    expect(s.path).toBe('configs/foo.json')
    expect(s.draft).toBe('{"a":1}')
    expect(s.original).toBe('{"a":1}')
    expect(s.isDirty).toBe(false)
  })

  test('setDraft marks dirty when content changes', () => {
    useConfigEditorStore.getState().loadFile('configs/foo.json', '{"a":1}')
    useConfigEditorStore.getState().setDraft('{"a":2}')
    const s = useConfigEditorStore.getState()
    expect(s.draft).toBe('{"a":2}')
    expect(s.isDirty).toBe(true)
  })

  test('setDraft back to original clears dirty', () => {
    useConfigEditorStore.getState().loadFile('configs/foo.json', '{"a":1}')
    useConfigEditorStore.getState().setDraft('{"a":2}')
    useConfigEditorStore.getState().setDraft('{"a":1}')
    expect(useConfigEditorStore.getState().isDirty).toBe(false)
  })

  test('validate sets parseError when JSON is malformed', () => {
    useConfigEditorStore.getState().loadFile('configs/foo.json', '{"a":1}')
    useConfigEditorStore.getState().setDraft('{not valid')
    useConfigEditorStore.getState().validate()
    expect(useConfigEditorStore.getState().parseError).not.toBeNull()
  })

  test('validate clears parseError when JSON is valid', () => {
    useConfigEditorStore.getState().loadFile('configs/foo.json', '{"a":1}')
    useConfigEditorStore.getState().setDraft('{not valid')
    useConfigEditorStore.getState().validate()
    expect(useConfigEditorStore.getState().parseError).not.toBeNull()
    useConfigEditorStore.getState().setDraft('{"a":2}')
    useConfigEditorStore.getState().validate()
    expect(useConfigEditorStore.getState().parseError).toBeNull()
  })

  test('markSaved snapshots draft as new original and clears dirty', () => {
    useConfigEditorStore.getState().loadFile('configs/foo.json', '{"a":1}')
    useConfigEditorStore.getState().setDraft('{"a":2}')
    useConfigEditorStore.getState().markSaved()
    const s = useConfigEditorStore.getState()
    expect(s.original).toBe('{"a":2}')
    expect(s.isDirty).toBe(false)
  })

  test('reset clears everything', () => {
    useConfigEditorStore.getState().loadFile('configs/foo.json', '{"a":1}')
    useConfigEditorStore.getState().setDraft('{"a":2}')
    useConfigEditorStore.getState().reset()
    expect(useConfigEditorStore.getState().path).toBeNull()
  })
})
