// src/spine/applyPatchBatch.ts
import { patchBone } from './patchBone'
import type { BonePatch, SpineSkeletonJson } from './spineJsonTypes'

function detectIndent(text: string): string | number {
  // Find the first indented line; prefer tab vs space.
  const match = text.match(/\n([ \t]+)/)
  if (!match) return 2
  const indent = match[1]
  if (indent.startsWith('\t')) return '\t'
  return indent.length
}

export function applyPatchBatch(
  originalText: string,
  patches: ReadonlyMap<string, BonePatch>,
): string {
  const indent = detectIndent(originalText)
  let json = JSON.parse(originalText) as SpineSkeletonJson
  for (const [boneName, patch] of patches) {
    json = patchBone(json, boneName, patch)
  }
  return JSON.stringify(json, null, indent) + (originalText.endsWith('\n') ? '\n' : '')
}
