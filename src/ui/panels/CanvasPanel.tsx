import { useEffect, useRef } from 'react'
import styles from './CanvasPanel.module.css'
import { useProjectStore } from '../../stores/projectStore'
import { useBridgeStore } from '../../stores/bridgeStore'
import { useSceneStore } from '../../stores/sceneStore'
import { useEditorStore } from '../../stores/editorStore'
import { createBridgeClient, type BridgeClient } from '../../bridge'

export function CanvasPanel() {
  const gameUrl = useProjectStore((s) => s.gameUrl)
  const status = useBridgeStore((s) => s.status)
  const markConnected = useBridgeStore((s) => s.markConnected)
  const markError = useBridgeStore((s) => s.markError)
  const setTree = useSceneStore((s) => s.setTree)
  const select = useEditorStore((s) => s.select)
  const selectedId = useEditorStore((s) => s.selectedId)
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const overlayRef = useRef<HTMLDivElement | null>(null)
  const clientRef = useRef<BridgeClient | null>(null)
  const skipNextSelectionPush = useRef(false)

  useEffect(() => {
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
          case 'TRANSFORM_CHANGED':
            return
        }
      },
    })
    clientRef.current = client

    return () => {
      client.dispose()
      clientRef.current = null
    }
  }, [gameUrl, markConnected, markError, setTree, select])

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
      <div className={styles.badge} data-status={status}>
        {status === 'connected' ? '● Connected' :
         status === 'connecting' ? '○ Connecting' :
         status === 'error' ? '● Error' : '○ Disconnected'}
      </div>
    </div>
  )
}
