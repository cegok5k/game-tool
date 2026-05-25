import type { PlatformAdapter } from '../types/platform'
import { useProjectStore } from '../stores/projectStore'
import { deriveGameUrl, readProjectConfig } from './projectConfig'

export async function openProject(platform: PlatformAdapter): Promise<boolean> {
  const folder = await platform.fs.openFolder()
  if (folder === null) return false
  const cfg = await readProjectConfig(platform.fs, folder)
  const store = useProjectStore.getState()
  store.setFolder(folder)
  store.loadProjectConfig(cfg)
  const url = deriveGameUrl({
    gameName: cfg.projectName,
    devPortOffset: cfg.devPortOffset,
    balanceType: cfg.balanceTypes.length > 0 ? cfg.balanceTypes[0] : null,
  })
  if (url !== null) store.setGameUrl(url)
  return true
}
