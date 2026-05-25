import styles from './InspectorPanel.module.css'
import type { FieldSchema, NodeSnapshot } from '../../types/scene'
import { useEditorStore } from '../../stores/editorStore'
import { useSceneStore } from '../../stores/sceneStore'

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
  return (
    <div className={styles.section}>
      <div className={styles['section-header']}>Transform</div>
      <Row label="Position">
        <input className={styles['field-input']} value={node.transform.x} disabled readOnly />
        <input className={styles['field-input']} value={node.transform.y} disabled readOnly />
      </Row>
      <Row label="Rotation">
        <input className={styles['field-input']} value={node.transform.rotation} disabled readOnly />
      </Row>
      <Row label="Scale">
        <input className={styles['field-input']} value={node.transform.scaleX} disabled readOnly />
        <input className={styles['field-input']} value={node.transform.scaleY} disabled readOnly />
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
        <SchemaField key={field.key} field={field} value={node.values[field.key]} />
      ))}
    </div>
  )
}

function SchemaField({ field, value }: { field: FieldSchema; value: unknown }) {
  return (
    <Row label={field.label ?? field.key}>
      <input
        className={styles['field-input']}
        value={value === undefined ? '' : String(value)}
        disabled
        readOnly
      />
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
