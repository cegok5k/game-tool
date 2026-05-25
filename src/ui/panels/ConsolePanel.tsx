import { useEffect, useRef, useState } from 'react'
import styles from './ConsolePanel.module.css'
import { useConsoleStore, type LogLevel } from '../../stores/consoleStore'

const ALL_LEVELS: readonly LogLevel[] = ['info', 'warn', 'error']

function formatTime(ts: number): string {
  const d = new Date(ts)
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  const s = String(d.getSeconds()).padStart(2, '0')
  return `${h}:${m}:${s}`
}

export function ConsolePanel() {
  const entries = useConsoleStore((s) => s.entries)
  const clear = useConsoleStore((s) => s.clear)
  const [enabled, setEnabled] = useState<Record<LogLevel, boolean>>({ info: true, warn: true, error: true })
  const listRef = useRef<HTMLDivElement | null>(null)

  const visible = entries.filter((e) => enabled[e.level])

  useEffect(() => {
    const el = listRef.current
    if (el === null) return
    const atBottom = el.scrollHeight - (el.scrollTop + el.clientHeight) < 50
    if (atBottom) el.scrollTop = el.scrollHeight
  }, [visible.length])

  function toggle(level: LogLevel): void {
    setEnabled((prev) => ({ ...prev, [level]: !prev[level] }))
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        {ALL_LEVELS.map((level) => (
          <button
            key={level}
            type="button"
            className={`${styles.filter} ${styles[level]}`}
            aria-pressed={enabled[level]}
            onClick={() => toggle(level)}
          >
            {level}
          </button>
        ))}
        <span className={styles.spacer} />
        <span>{visible.length} / {entries.length}</span>
        <button type="button" className={styles.clear} onClick={clear}>Clear</button>
      </div>
      <div ref={listRef} className={styles.list}>
        {visible.length === 0 ? (
          <div className={styles.empty}>No logs yet. Game LOG messages will stream here.</div>
        ) : (
          visible.map((e) => (
            <div key={e.id} className={styles.entry} data-level={e.level}>
              <span className={styles.timestamp}>{formatTime(e.timestamp)}</span>
              <span className={styles.level}>{e.level}</span>
              <span className={styles.message}>{e.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
