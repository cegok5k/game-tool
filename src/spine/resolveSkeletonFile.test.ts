// src/spine/resolveSkeletonFile.test.ts
import { describe, expect, test } from 'vitest'
import { resolveSkeletonFile } from './resolveSkeletonFile'

describe('resolveSkeletonFile', () => {
  test('main_scene.main_scene.Skeleton resolves under skeletons_json', () => {
    expect(resolveSkeletonFile('main_scene.main_scene.Skeleton')).toBe(
      'media/skeletons_json/main_scene/main_scene/Skeleton.json',
    )
  })

  test('deeper path stays nested', () => {
    expect(resolveSkeletonFile('spinner.symbols.symbol_1.Skeleton')).toBe(
      'media/skeletons_json/spinner/symbols/symbol_1/Skeleton.json',
    )
  })

  test('non-Skeleton suffix supported', () => {
    expect(resolveSkeletonFile('gui.button.spin_button.SpinButton')).toBe(
      'media/skeletons_json/gui/button/spin_button/SpinButton.json',
    )
  })

  test('throws on empty id', () => {
    expect(() => resolveSkeletonFile('')).toThrow(/empty/i)
  })

  test('throws on single segment', () => {
    expect(() => resolveSkeletonFile('Skeleton')).toThrow(/at least one dot/i)
  })
})
