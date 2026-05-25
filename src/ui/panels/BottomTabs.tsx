import styles from './BottomTabs.module.css'
import { useEditorStore, type BottomTab } from '../../stores/editorStore'
import { ConsolePanel } from './ConsolePanel'
import { AssetTreePanel } from './AssetTreePanel'
import { SettingsPanel } from './SettingsPanel'
import { ConfigEditorPanel } from './ConfigEditorPanel'
import { AIStudioPanel } from './AIStudioPanel'

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
  const isAssets = active === 'assets'
  const isSettings = active === 'settings'
  const isConfig = active === 'config'
  const isAi = active === 'ai'
  const passThrough = isConsole || isAssets || isSettings || isConfig || isAi

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
      <div className={`${styles.content} ${passThrough ? styles['content-pass'] : ''}`}>
        {isConsole ? <ConsolePanel />
         : isAssets ? <AssetTreePanel />
         : isSettings ? <SettingsPanel />
         : isConfig ? <ConfigEditorPanel />
         : isAi ? <AIStudioPanel />
         : <span>{placeholderFor(active)}</span>}
      </div>
    </>
  )
}

function placeholderFor(tab: BottomTab): string {
  switch (tab) {
    case 'assets':   return ''
    case 'config':   return ''
    case 'ai':       return ''
    case 'console':  return ''
    case 'settings': return ''
  }
}
