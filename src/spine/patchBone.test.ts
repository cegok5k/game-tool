// src/spine/patchBone.test.ts
import { describe, expect, test } from 'vitest'
import sample from './__fixtures__/main_scene_skeleton.sample.json'
import type { SpineSkeletonJson } from './spineJsonTypes'
import { patchBone } from './patchBone'

describe('patchBone', () => {
  test('updates x and y on a named bone', () => {
    const result = patchBone(sample as SpineSkeletonJson, 'spinner_container', { x: 50, y: -100 })
    const bone = result.bones?.find((b) => b.name === 'spinner_container')
    expect(bone?.x).toBe(50)
    expect(bone?.y).toBe(-100)
  })

  test('partial patch preserves unchanged fields', () => {
    const result = patchBone(sample as SpineSkeletonJson, 'suspense_reel_3', { rotation: 12 })
    const bone = result.bones?.find((b) => b.name === 'suspense_reel_3')
    // suspense_reel_3 has x: 260 in the fixture; that must survive a rotation-only patch
    expect(bone?.x).toBe(260)
    expect(bone?.rotation).toBe(12)
  })

  test('throws when the bone does not exist', () => {
    expect(() =>
      patchBone(sample as SpineSkeletonJson, 'nonexistent_bone', { x: 0 }),
    ).toThrow(/nonexistent_bone/)
  })

  test('does not mutate the input', () => {
    const before = JSON.stringify(sample)
    patchBone(sample as SpineSkeletonJson, 'spinner_container', { x: 999 })
    expect(JSON.stringify(sample)).toBe(before)
  })
})
