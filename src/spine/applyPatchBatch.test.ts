// src/spine/applyPatchBatch.test.ts
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, test } from 'vitest'
import { applyPatchBatch } from './applyPatchBatch'

const fixturePath = path.resolve(__dirname, '__fixtures__/main_scene_skeleton.sample.json')
const fixtureText = fs.readFileSync(fixturePath, 'utf8')

describe('applyPatchBatch', () => {
  test('applies a single bone patch and produces valid JSON', () => {
    const next = applyPatchBatch(fixtureText, new Map([['spinner_container', { x: 99 }]]))
    const parsed = JSON.parse(next) as { bones: Array<{ name: string; x?: number }> }
    expect(parsed.bones.find((b) => b.name === 'spinner_container')?.x).toBe(99)
  })

  test('applies multiple bones in one call', () => {
    const next = applyPatchBatch(
      fixtureText,
      new Map([
        ['suspense_reel_3', { x: 0 }],
        ['suspense_reel_4', { x: 0 }],
      ]),
    )
    const parsed = JSON.parse(next) as { bones: Array<{ name: string; x?: number }> }
    expect(parsed.bones.find((b) => b.name === 'suspense_reel_3')?.x).toBe(0)
    expect(parsed.bones.find((b) => b.name === 'suspense_reel_4')?.x).toBe(0)
  })

  test('empty patch map returns text equivalent to input', () => {
    const next = applyPatchBatch(fixtureText, new Map())
    expect(JSON.parse(next)).toEqual(JSON.parse(fixtureText))
  })

  test('detects tab indent when the original is tab-indented', () => {
    const next = applyPatchBatch(fixtureText, new Map([['spinner_container', { x: 1 }]]))
    // fixture uses tabs; spot-check that output also uses tabs
    expect(next.split('\n').some((line) => line.startsWith('\t'))).toBe(true)
  })
})
