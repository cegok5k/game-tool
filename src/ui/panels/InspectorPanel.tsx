import styles from './InspectorPanel.module.css'
import type { FieldSchema, NodeSnapshot } from '../../types/scene'
import { useEditorStore } from '../../stores/editorStore'
import { useSceneStore } from '../../stores/sceneStore'
import { ScalarField } from './inspector/ScalarField'
import { sendToGame } from '../../bridge'

export function InspectorPanel() {
  const selectedId = useEditorStore((s) => s.selectedId)
  const node = useSceneStore((s) => (selectedId === null ? undefined : s.byId(selectedId)))

  if (node === undefined) {
    return (
      <div className={styles.wrap}>
        <div className={styles.empty}>No selection</div>
      </div>
    )
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.title}>{node.name}</div>
      <TransformSection node={node} />
      <SchemaFieldsSection node={node} />
    </div>
  )
}

function TransformSection({ node }: { node: NodeSnapshot }) {
  const dispatchTransform = (partial: Partial<NodeSnapshot['transform']>) => {
    sendToGame({ type: 'UPDATE_TRANSFORM', nodeId: node.id, transform: partial })
  }
  return (
    <div className={styles.section}>
      <div className={styles['section-header']}>Transform</div>
      <Row label="Position">
        <ScalarField label="Position X" value={node.transform.x} onCommit={(x) => dispatchTransform({ x })} />
        <ScalarField label="Position Y" value={node.transform.y} onCommit={(y) => dispatchTransform({ y })} />
      </Row>
      <Row label="Rotation">
        <ScalarField label="Rotation" value={node.transform.rotation} step={1} onCommit={(rotation) => dispatchTransform({ rotation })} />
      </Row>
      <Row label="Scale">
        <ScalarField label="Scale X" value={node.transform.scaleX} step={0.1} onCommit={(scaleX) => dispatchTransform({ scaleX })} />
        <ScalarField label="Scale Y" value={node.transform.scaleY} step={0.1} onCommit={(scaleY) => dispatchTransform({ scaleY })} />
      </Row>
    </div>
  )
}

function SchemaFieldsSection({ node }: { node: NodeSnapshot }) {
  if (node.schema.length === 0) return null
  return (
    <div className={styles.section}>
      <div className={styles['section-header']}>Properties</div>
      {node.schema.map((field) => (
        <SchemaField key={field.key} node={node} field={field} value={node.values[field.key]} />
      ))}
    </div>
  )
}

function SchemaField({ node, field, value }: { node: NodeSnapshot; field: FieldSchema; value: unknown }) {
  if (field.type === 'number' && typeof value === 'number') {
    return (
      <Row label={field.label ?? field.key}>
        <ScalarField
          label={field.label ?? field.key}
          value={value}
          min={field.min}
          max={field.max}
          step={field.step}
          onCommit={(next) => sendToGame({ type: 'UPDATE_PROPERTY', nodeId: node.id, key: field.key, value: next })}
        />
      </Row>
    )
  }
  // Non-number fields stay read-only for now — Plan 5+ will add color picker, asset-ref dropdown, etc.
  return (
    <Row label={field.label ?? field.key}>
      <input className={styles['field-input']} value={value === undefined ? '' : String(value)} disabled readOnly />
    </Row>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={styles.field}>
      <span className={styles['field-label']}>{label}</span>
      <div style={{ display: 'flex', gap: 4 }}>{children}</div>
    </div>
  )
}
