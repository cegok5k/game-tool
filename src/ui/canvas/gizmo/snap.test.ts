import { describe, expect, test } from 'vitest'
import { snapToGrid, snapAngle, snapPoint } from './snap'

describe('snapToGrid', () => {
  test('returns input unchanged when grid <= 0', () => {
    expect(snapToGrid(17, 0)).toBe(17)
    expect(snapToGrid(17, -1)).toBe(17)
  })
  test('snaps to nearest multiple', () => {
    expect(snapToGrid(15, 32)).toBe(0)
    expect(snapToGrid(16, 32)).toBe(32)
    expect(snapToGrid(31, 32)).toBe(32)
    expect(snapToGrid(48, 32)).toBe(64)
    expect(snapToGrid(49, 32)).toBe(64)
  })
  test('handles negatives symmetrically', () => {
    expect(snapToGrid(-15, 32)).toBe(0)
    expect(snapToGrid(-17, 32)).toBe(-32)
    expect(snapToGrid(-31, 32)).toBe(-32)
  })
})

describe('snapAngle', () => {
  test('snaps degrees to nearest step', () => {
    expect(snapAngle(7, 15)).toBe(0)
    expect(snapAngle(8, 15)).toBe(15)
    expect(snapAngle(22, 15)).toBe(15)
    expect(snapAngle(23, 15)).toBe(30)
    expect(snapAngle(-7, 15)).toBe(0)
    expect(snapAngle(-8, 15)).toBe(-15)
  })
  test('returns input unchanged when step <= 0', () => {
    expect(snapAngle(7, 0)).toBe(7)
  })
})

describe('snapPoint', () => {
  test('snaps x and y independently', () => {
    expect(snapPoint({ x: 15, y: 17 }, 32)).toEqual({ x: 0, y: 32 })
  })
})
