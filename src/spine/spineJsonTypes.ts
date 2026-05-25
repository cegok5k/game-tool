// src/spine/spineJsonTypes.ts

export type SpineInherit =
  | 'normal'
  | 'onlyTranslation'
  | 'noRotationOrReflection'
  | 'noScale'
  | 'noScaleOrReflection'

export type SpineBone = {
  name: string
  parent?: string
  length?: number
  x?: number
  y?: number
  rotation?: number
  scaleX?: number
  scaleY?: number
  shearX?: number
  shearY?: number
  inherit?: SpineInherit
}

export type SpineSkeletonHeader = {
  hash?: string
  spine?: string
  x?: number
  y?: number
  width?: number
  height?: number
}

export type SpineSkeletonJson = {
  skeleton?: SpineSkeletonHeader
  bones?: SpineBone[]
  slots?: unknown[]
  skins?: unknown[]
  events?: Record<string, unknown>
  animations?: Record<string, unknown>
  ik?: unknown[]
  transform?: unknown[]
  path?: unknown[]
  physics?: unknown[]
}

export type BonePatch = Partial<Pick<SpineBone,
  'x' | 'y' | 'rotation' | 'scaleX' | 'scaleY' | 'shearX' | 'shearY' | 'length'
>>
