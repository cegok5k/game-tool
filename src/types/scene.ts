export type Transform = {
  x: number
  y: number
  rotation: number
  scaleX: number
  scaleY: number
}

export type Bounds = {
  x: number
  y: number
  width: number
  height: number
}

export type FieldType =
  | 'number'
  | 'string'
  | 'boolean'
  | 'color'
  | 'asset-ref'
  | 'enum'

export type FieldSchema = {
  key: string
  type: FieldType
  label?: string
  min?: number
  max?: number
  step?: number
  options?: readonly string[]  // for enum
  readOnly?: boolean
}

export type NodeKind =
  | 'spine-skeleton'
  | 'spine-bone'
  | 'sprite'
  | 'node'
  | 'group'

export type NodeSnapshot = {
  id: string
  kind: NodeKind
  name: string
  parentId: string | null
  childIds: readonly string[]
  transform: Transform
  bounds: Bounds | null
  schema: readonly FieldSchema[]
  values: Readonly<Record<string, unknown>>
}
