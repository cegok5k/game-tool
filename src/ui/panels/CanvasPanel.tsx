import { useEffect, useRef } from 'react'
import styles from './CanvasPanel.module.css'
import { useProjectStore } from '../../stores/projectStore'
import { useBridgeStore } from '../../stores/bridgeStore'
import { useSceneStore } from '../../stores/sceneStore'
import { useEditorStore } from '../../stores/editorStore'
import { useConsoleStore } from '../../stores/consoleStore'
import { useSpinePatchStore } from '../../stores/spinePatchStore'
import { applyPatchBatch } from '../../spine/applyPatchBatch'
import { getPlatform } from '../../platform'
import type { BonePatch } from '../../spine/spineJsonTypes'
import type { FolderHandle } from '../../types/platform'
import type { Transform } from '../../types/scene'
import { createBridgeClient, setActiveBridgeClient, type BridgeClient } from '../../bridge'
import { CanvasToolbar } from '../canvas/CanvasToolbar'
import { Gizmo } from '../canvas/gizmo/Gizmo'

const FLUSH_DEBOUNCE_MS = 300
let flushTimer: ReturnType<typeof setTimeout> | null = null

function scheduleFlush(): void {
  if (flushTimer !== null) clearTimeout(flushTimer)
  flushTimer = setTimeout(() => {
    flushTimer = null
    void flushPendingPatches()
  }, FLUSH_DEBOUNCE_MS)
}

async function flushPendingPatches(): Promise<void> {
  const handle: FolderHandle | null = useProjectStore.getState().folder
  if (handle === null) return
  const platform = getPlatform()
  const store = useSpinePatchStore.getState()
  const consoleStore = useConsoleStore.getState()
  for (const file of store.pendingFiles()) {
    const bonePatches = store.pending.get(file)
    if (bonePatches === undefined) continue
    try {
      const original = await platform.fs.readText(handle, file)
      const next = applyPatchBatch(original, bonePatches as ReadonlyMap<string, BonePatch>)
      await platform.fs.writeFile(handle, file, new TextEncoder().encode(next))
      // Only clear if no new patches arrived during the read/write window — otherwise
      // the store's inner map has been replaced and clearFile would discard the
      // freshly-enqueued bones. The next debounced flush will pick those up.
      if (useSpinePatchStore.getState().pending.get(file) === bonePatches) {
        store.clearFile(file)
      }
      consoleStore.addEntry({ level: 'info', message: `Saved ${file} (${bonePatches.size} bone${bonePatches.size === 1 ? '' : 's'})` })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      consoleStore.addEntry({ level: 'error', message: `Failed to save ${file}: ${message}` })
    }
  }
}

function diffTransform(prev: Transform, next: Transform): BonePatch {
  const patch: BonePatch = {}
  if (next.x !== prev.x) patch.x = next.x
  if (next.y !== prev.y) patch.y = next.y
  if (next.rotation !== prev.rotation) patch.rotation = next.rotation
  if (next.scaleX !== prev.scaleX) patch.scaleX = next.scaleX
  if (next.scaleY !== prev.scaleY) patch.scaleY = next.scaleY
  return patch
}

export function CanvasPanel() {
  const gameUrl = useProjectStore((s) => s.gameUrl)
  const status = useBridgeStore((s) => s.status)
  const markConnecting = useBridgeStore((s) => s.markConnecting)
  const markConnected = useBridgeStore((s) => s.markConnected)
  const markError = useBridgeStore((s) => s.markError)
  const setTree = useSceneStore((s) => s.setTree)
  const upsertNode = useSceneStore((s) => s.upsertNode)
  const select = useEditorStore((s) => s.select)
  const selectedId = useEditorStore((s) => s.selectedId)
  const addLogEntry = useConsoleStore((s) => s.addEntry)
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const overlayRef = useRef<HTMLDivElement | null>(null)
  const clientRef = useRef<BridgeClient | null>(null)
  const skipNextSelectionPush = useRef(false)

  useEffect(() => {
    markConnecting()
    const frame = iframeRef.current
    if (frame === null) return

    const client = createBridgeClient({
      iframe: frame,
      onMessage: (msg) => {
        switch (msg.type) {
          case 'GAME_READY':
            markConnected({
              gameName: msg.gameName,
              capabilities: msg.capabilities,
              metadata: msg.metadata,
            })
            client.send({ type: 'REQUEST_TREE' })
            return
          case 'NODE_TREE':
            setTree(msg.nodes)
            return
          case 'NODE_SELECTED':
            skipNextSelectionPush.current = true
            select(msg.node?.id ?? null)
            return
          case 'BRIDGE_ERROR':
            markError(msg.message)
            return
          case 'LOG':
            addLogEntry({ level: msg.level, message: msg.message })
            return
          case 'TRANSFORM_CHANGED': {
            const current = useSceneStore.getState().byId(msg.nodeId)
            if (current !== undefined) {
              upsertNode({ ...current, transform: msg.transform })
              if (current.owner !== undefined) {
                const patch = diffTransform(current.transform, msg.transform)
                if (Object.keys(patch).length > 0) {
                  useSpinePatchStore.getState().enqueue(
                    current.owner.skeletonFile,
                    current.owner.boneName,
                    patch,
                  )
                  scheduleFlush()
                }
              }
            }
            return
          }
        }
      },
    })
    clientRef.current = client
    setActiveBridgeClient(client)

    return () => {
      client.dispose()
      setActiveBridgeClient(null)
      clientRef.current = null
    }
  }, [gameUrl, markConnecting, markConnected, markError, setTree, upsertNode, select, addLogEntry])

  useEffect(() => {
    const client = clientRef.current
    if (client === null) return
    if (skipNextSelectionPush.current) {
      skipNextSelectionPush.current = false
      return
    }
    if (selectedId === null) return
    client.send({ type: 'SELECT_NODE', nodeId: selectedId })
  }, [selectedId])

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>): void {
    const client = clientRef.current
    if (client === null) return
    const overlay = overlayRef.current
    if (overlay === null) return
    const rect = overlay.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    client.send({ type: 'PICK_AT', x, y })
  }

  return (
    <div className={styles.wrap}>
      <iframe ref={iframeRef} className={styles.iframe} src={gameUrl} title="Game" />
      <div
        ref={overlayRef}
        className={styles.overlay}
        data-tool="select"
        onClick={handleOverlayClick}
        aria-label="Canvas overlay"
      />
      <Gizmo />
      <CanvasToolbar />
      <div className={styles.badge} data-status={status}>
        {status === 'connected' ? '● Connected' :
         status === 'connecting' ? '○ Connecting' :
         status === 'error' ? '● Error' : '○ Disconnected'}
      </div>
    </div>
  )
}
