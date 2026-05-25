import styles from './BottomTabs.module.css'
import { useEditorStore, type BottomTab } from '../../stores/editorStore'
import { ConsolePanel } from './ConsolePanel'

const TABS: readonly { id: BottomTab; label: string }[] = [
  { id: 'assets',   label: 'Assets' },
  { id: 'config',   label: 'Config' },
  { id: 'ai',       label: 'AI Studio' },
  { id: 'console',  label: 'Console' },
  { id: 'settings', label: 'Settings' },
]

export function BottomTabs() {
  const active = useEditorStore((s) => s.activeBottomTab)
  const setActive = useEditorStore((s) => s.setActiveBottomTab)

  const isConsole = active === 'console'

  return (
    <>
      <div className={styles.tabs} role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active === t.id}
            className={styles.tab}
            onClick={() => setActive(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className={`${styles.content} ${isConsole ? styles['content-pass'] : ''}`}>
        {isConsole ? <ConsolePanel /> : <span>{placeholderFor(active)}</span>}
      </div>
    </>
  )
}

function placeholderFor(tab: BottomTab): string {
  switch (tab) {
    case 'assets':   return 'Asset browser — coming in a later plan.'
    case 'config':   return 'Config editor — coming in a later plan.'
    case 'ai':       return 'AI Studio — coming in a later plan.'
    case 'console':  return ''
    case 'settings': return 'Settings — coming in a later plan.'
  }
}
