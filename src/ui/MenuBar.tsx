import styles from './MenuBar.module.css'
import { useProjectStore } from '../stores/projectStore'

export function MenuBar() {
  const gameUrl = useProjectStore((s) => s.gameUrl)
  const setGameUrl = useProjectStore((s) => s.setGameUrl)

  return (
    <div className={styles.bar}>
      <span className={styles.brand}>◈ game-tool</span>
      <span className={styles.spacer} />
      <span style={{ color: 'var(--text-tertiary)' }}>Game URL</span>
      <input
        className={styles['url-field']}
        value={gameUrl}
        onChange={(e) => setGameUrl(e.target.value)}
        aria-label="Game URL"
      />
    </div>
  )
}
