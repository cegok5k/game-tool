import styles from './MenuBar.module.css'
import { useProjectStore } from '../stores/projectStore'
import { openProject } from '../project/openProject'
import { deriveGameUrl } from '../project/projectConfig'
import { getPlatform } from '../platform'

export function MenuBar() {
  const projectName = useProjectStore((s) => s.projectName)
  const balanceTypes = useProjectStore((s) => s.balanceTypes)
  const selectedBalanceType = useProjectStore((s) => s.selectedBalanceType)
  const devPortOffset = useProjectStore((s) => s.devPortOffset)
  const gameUrl = useProjectStore((s) => s.gameUrl)
  const setGameUrl = useProjectStore((s) => s.setGameUrl)
  const selectBalanceType = useProjectStore((s) => s.selectBalanceType)

  async function handleOpen() {
    await openProject(getPlatform())
  }

  function handleBalanceChange(name: string) {
    selectBalanceType(name)
    const url = deriveGameUrl({ gameName: projectName, devPortOffset, balanceType: name })
    if (url !== null) setGameUrl(url)
  }

  return (
    <div className={styles.bar}>
      <span className={styles.brand}>◈ {projectName ?? 'game-tool'}</span>
      <button type="button" className={styles['open-btn']} onClick={handleOpen}>
        Open Project
      </button>
      {balanceTypes.length > 0 && (
        <select
          aria-label="Balance type"
          value={selectedBalanceType ?? ''}
          onChange={(e) => handleBalanceChange(e.target.value)}
          className={styles.select}
        >
          {balanceTypes.map((bt) => (
            <option key={bt} value={bt}>{bt}</option>
          ))}
        </select>
      )}
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
