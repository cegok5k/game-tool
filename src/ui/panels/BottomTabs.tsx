import styles from './BottomTabs.module.css'
import { useEditorStore, type BottomTab } from '../../stores/editorStore'

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
      <div className={styles.content}>
        {placeholderFor(active)}
      </div>
    </>
  )
}

function placeholderFor(tab: BottomTab): string {
  switch (tab) {
    case 'assets':   return 'Asset browser — coming in Plan 3.'
    case 'config':   return 'Config editor — coming in Plan 4.'
    case 'ai':       return 'AI Studio — coming in Plan 5.'
    case 'console':  return 'Console — game logs will stream here.'
    case 'settings': return 'Settings — coming in Plan 6.'
  }
}
