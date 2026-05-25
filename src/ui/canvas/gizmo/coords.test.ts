import { describe, expect, test } from 'vitest'
import { handlePositions, ROTATE_HANDLE_OFFSET, type HandleId } from './coords'

const box = { x: 100, y: 200, width: 80, height: 40 }

describe('handlePositions', () => {
  test('returns 8 scale handles + 1 rotate handle = 9 entries', () => {
    const handles = handlePositions(box)
    expect(handles).toHaveLength(9)
    const ids: HandleId[] = handles.map((h) => h.id)
    expect(ids).toEqual([
      'nw', 'n', 'ne',
      'w',        'e',
      'sw', 's', 'se',
      'rotate',
    ])
  })

  test('places corner handles exactly at box corners', () => {
    const handles = handlePositions(box)
    const map = Object.fromEntries(handles.map((h) => [h.id, h]))
    expect(map.nw).toMatchObject({ x: 100, y: 200 })
    expect(map.ne).toMatchObject({ x: 180, y: 200 })
    expect(map.sw).toMatchObject({ x: 100, y: 240 })
    expect(map.se).toMatchObject({ x: 180, y: 240 })
  })

  test('places edge handles at midpoints', () => {
    const handles = handlePositions(box)
    const map = Object.fromEntries(handles.map((h) => [h.id, h]))
    expect(map.n).toMatchObject({ x: 140, y: 200 })
    expect(map.s).toMatchObject({ x: 140, y: 240 })
    expect(map.w).toMatchObject({ x: 100, y: 220 })
    expect(map.e).toMatchObject({ x: 180, y: 220 })
  })

  test('places rotate handle above top-center at ROTATE_HANDLE_OFFSET above', () => {
    const handles = handlePositions(box)
    const r = handles.find((h) => h.id === 'rotate')!
    expect(r.x).toBe(140)
    expect(r.y).toBe(200 - ROTATE_HANDLE_OFFSET)
  })
})
