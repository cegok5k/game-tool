import { useEffect } from 'react'
import styles from './ConfigEditorPanel.module.css'
import { useProjectStore } from '../../stores/projectStore'
import { useAssetBrowserStore } from '../../stores/assetBrowserStore'
import { useConfigEditorStore } from '../../stores/configEditorStore'
import { getPlatform } from '../../platform'

function isJsonPath(path: string | null): boolean {
  return path !== null && path.toLowerCase().endsWith('.json')
}

export function ConfigEditorPanel() {
  const folder = useProjectStore((s) => s.folder)
  const selectedPath = useAssetBrowserStore((s) => s.selectedPath)
  const loadedPath = useConfigEditorStore((s) => s.path)
  const draft = useConfigEditorStore((s) => s.draft)
  const isDirty = useConfigEditorStore((s) => s.isDirty)
  const parseError = useConfigEditorStore((s) => s.parseError)
  const loadFile = useConfigEditorStore((s) => s.loadFile)
  const setDraft = useConfigEditorStore((s) => s.setDraft)
  const validate = useConfigEditorStore((s) => s.validate)
  const markSaved = useConfigEditorStore((s) => s.markSaved)

  const shouldLoad = folder !== null && isJsonPath(selectedPath) && selectedPath !== loadedPath

  useEffect(() => {
    if (!shouldLoad || folder === null || selectedPath === null) return
    let cancelled = false
    void (async () => {
      try {
        const text = await getPlatform().fs.readText(folder, selectedPath)
        if (!cancelled) loadFile(selectedPath, text)
      } catch (e) {
        if (!cancelled) loadFile(selectedPath, `// Failed to load: ${String(e)}\n`)
      }
    })()
    return () => { cancelled = true }
  }, [shouldLoad, folder, selectedPath, loadFile])

  if (folder === null || selectedPath === null) {
    return <div className={styles.wrap}><div className={styles.empty}>Select a JSON file in the Asset Browser to edit it.</div></div>
  }
  if (!isJsonPath(selectedPath)) {
    return <div className={styles.wrap}><div className={styles.empty}>Selected file is not a JSON file.</div></div>
  }

  async function handleSave(): Promise<void> {
    if (folder === null || loadedPath === null) return
    if (parseError !== null) return
    try {
      const data = new TextEncoder().encode(draft)
      await getPlatform().fs.writeFile(folder, loadedPath, data)
      markSaved()
    } catch (e) {
      useConfigEditorStore.setState({ parseError: `Write failed: ${String(e)}` })
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>): void {
    setDraft(e.target.value)
    validate()
  }

  const canSave = isDirty && parseError === null

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <span className={styles.path}>{loadedPath ?? selectedPath}</span>
        {isDirty && <span className={styles.dirty}>● modified</span>}
        {parseError !== null && <span className={styles.error}>parse error: {parseError}</span>}
        <span className={styles.spacer} />
        <button type="button" className={styles.save} onClick={handleSave} disabled={!canSave}>Save</button>
      </div>
      <textarea
        className={styles.textarea}
        spellCheck={false}
        value={draft}
        onChange={handleChange}
      />
    </div>
  )
}
