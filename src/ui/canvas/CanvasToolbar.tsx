import styles from './CanvasToolbar.module.css'
import { useEditorStore } from '../../stores/editorStore'

export function CanvasToolbar() {
  const snapEnabled = useEditorStore((s) => s.snapEnabled)
  const gridSize = useEditorStore((s) => s.gridSize)
  const setSnapEnabled = useEditorStore((s) => s.setSnapEnabled)

  return (
    <div className={styles.bar}>
      <button
        type="button"
        className={styles.toggle}
        aria-pressed={snapEnabled}
        onClick={() => setSnapEnabled(!snapEnabled)}
      >
        ◇ Snap
      </button>
      <span className={styles['grid-label']}>Grid: {gridSize}px</span>
    </div>
  )
}
