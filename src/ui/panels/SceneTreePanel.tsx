import styles from './SceneTreePanel.module.css'
import { useSceneStore } from '../../stores/sceneStore'
import { useEditorStore } from '../../stores/editorStore'

export function SceneTreePanel() {
  const nodes = useSceneStore((s) => s.nodes)
  const selectedId = useEditorStore((s) => s.selectedId)
  const select = useEditorStore((s) => s.select)

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>Scene Tree</div>
      {nodes.length === 0 ? (
        <div className={styles.empty}>No nodes — game not connected yet.</div>
      ) : (
        <div className={styles.list}>
          {nodes.map((n) => (
            <button
              key={n.id}
              type="button"
              className={styles.item}
              data-selected={n.id === selectedId}
              onClick={() => select(n.id)}
            >
              {n.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
