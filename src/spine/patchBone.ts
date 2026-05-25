// src/spine/patchBone.ts
import type { BonePatch, SpineSkeletonJson } from './spineJsonTypes'

export function patchBone(
  json: SpineSkeletonJson,
  boneName: string,
  patch: BonePatch,
): SpineSkeletonJson {
  const bones = json.bones ?? []
  const next = bones.map((b) => (b.name === boneName ? { ...b, ...patch } : b))
  return { ...json, bones: next }
}
