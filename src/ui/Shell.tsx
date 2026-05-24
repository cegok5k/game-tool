import styles from './Shell.module.css'
import { MenuBar } from './MenuBar'
import { SceneTreePanel } from './panels/SceneTreePanel'
import { CanvasPanel } from './panels/CanvasPanel'
import { InspectorPanel } from './panels/InspectorPanel'
import { BottomTabs } from './panels/BottomTabs'

export function Shell() {
  return (
    <div className={styles.shell}>
      <div className={styles.menu}      aria-label="Menu Bar"><MenuBar /></div>
      <div className={styles.tree}      aria-label="Scene Tree"><SceneTreePanel /></div>
      <div className={styles.canvas}    aria-label="Canvas"><CanvasPanel /></div>
      <div className={styles.inspector} aria-label="Inspector"><InspectorPanel /></div>
      <div className={styles.bottom}    aria-label="Bottom Tabs"><BottomTabs /></div>
    </div>
  )
}
