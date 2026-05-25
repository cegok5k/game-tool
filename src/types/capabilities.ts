export type Capability =
  | 'spine'
  | 'jst-nodes'
  | 'node-debug'
  | 'config-files'
  | 'hot-reload'
  | 'balance-types'
  | 'webgl'
  | 'webgpu'
  | 'canvas2d'

export type GameMetadata = {
  balanceTypes?: readonly string[]
  configFiles?: readonly string[]
  spineSkeletons?: readonly string[]
}
