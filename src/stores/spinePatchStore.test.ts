// src/stores/spinePatchStore.test.ts
import { beforeEach, describe, expect, test } from 'vitest'
import { useSpinePatchStore } from './spinePatchStore'

describe('spinePatchStore', () => {
  beforeEach(() => {
    useSpinePatchStore.getState().reset()
  })

  test('enqueue stores a patch under (file, bone)', () => {
    useSpinePatchStore.getState().enqueue('media/skeletons_json/a/b/c.json', 'bob', { x: 10 })
    const pending = useSpinePatchStore.getState().pending
    expect(pending.get('media/skeletons_json/a/b/c.json')?.get('bob')).toEqual({ x: 10 })
  })

  test('subsequent enqueue merges into the same bone entry', () => {
    const file = 'media/skeletons_json/a/b/c.json'
    useSpinePatchStore.getState().enqueue(file, 'bob', { x: 10 })
    useSpinePatchStore.getState().enqueue(file, 'bob', { y: 20 })
    expect(useSpinePatchStore.getState().pending.get(file)?.get('bob')).toEqual({ x: 10, y: 20 })
  })

  test('different bones in the same file are kept separate', () => {
    const file = 'media/skeletons_json/a/b/c.json'
    useSpinePatchStore.getState().enqueue(file, 'bob', { x: 10 })
    useSpinePatchStore.getState().enqueue(file, 'alice', { rotation: 90 })
    const map = useSpinePatchStore.getState().pending.get(file)
    expect(map?.size).toBe(2)
    expect(map?.get('alice')).toEqual({ rotation: 90 })
  })

  test('clearFile removes only that file', () => {
    useSpinePatchStore.getState().enqueue('f1.json', 'bob', { x: 1 })
    useSpinePatchStore.getState().enqueue('f2.json', 'alice', { y: 2 })
    useSpinePatchStore.getState().clearFile('f1.json')
    expect(useSpinePatchStore.getState().pending.has('f1.json')).toBe(false)
    expect(useSpinePatchStore.getState().pending.has('f2.json')).toBe(true)
  })

  test('pendingFiles lists files with patches', () => {
    useSpinePatchStore.getState().enqueue('f1.json', 'bob', { x: 1 })
    useSpinePatchStore.getState().enqueue('f2.json', 'alice', { y: 2 })
    expect(new Set(useSpinePatchStore.getState().pendingFiles())).toEqual(new Set(['f1.json', 'f2.json']))
  })
})
