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
})
