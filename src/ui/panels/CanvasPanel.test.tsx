import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, expect, test, beforeEach, vi } from 'vitest'
import { useProjectStore } from '../../stores/projectStore'
import { useBridgeStore } from '../../stores/bridgeStore'
import type { NodeSnapshot } from '../../types/scene'
import { useSceneStore } from '../../stores/sceneStore'
import { useConsoleStore } from '../../stores/consoleStore'
import { useSpinePatchStore } from '../../stores/spinePatchStore'
import { __setPlatformForTests } from '../../platform'
import { CanvasPanel } from './CanvasPanel'

describe('CanvasPanel', () => {
  beforeEach(() => {
    useProjectStore.getState().setGameUrl('http://localhost:5173/test-game/index.html')
    useBridgeStore.getState().reset()
  })

  test('renders an iframe with the game URL from projectStore', () => {
    render(<CanvasPanel />)
    const iframe = screen.getByTitle('Game') as HTMLIFrameElement
    expect(iframe.src).toContain('/test-game/index.html')
  })

  test('renders a connecting status badge by default', () => {
    render(<CanvasPanel />)
    expect(screen.getByText(/connecting/i)).toBeInTheDocument()
  })

  test('updates badge to connected when bridgeStore connects', () => {
    render(<CanvasPanel />)
    act(() => {
      useBridgeStore.getState().markConnected({ gameName: 'TestGame', capabilities: [] })
    })
    expect(screen.getByText(/connected/i)).toBeInTheDocument()
  })

  test('overlay exists and accepts click without throwing', () => {
    // Full PICK_AT plumbing is exercised by client.test.ts + sdk.test.ts + the e2e test.
    // This is a thin smoke check that the overlay element renders and is clickable.
    const { container } = render(<CanvasPanel />)
    const overlay = container.querySelector('[data-tool="select"]') as HTMLElement | null
    expect(overlay).toBeTruthy()
    fireEvent.click(overlay!, { clientX: 50, clientY: 50 })
    // No throw == pass.
  })

  test('TRANSFORM_CHANGED updates the sceneStore node via upsertNode', () => {
    const node: NodeSnapshot = {
      id: 'player',
      kind: 'sprite',
      name: 'Player',
      parentId: null,
      childIds: [],
      transform: { x: 100, y: 100, rotation: 0, scaleX: 1, scaleY: 1 },
      bounds: null,
      schema: [],
      values: {},
    }
    useSceneStore.getState().setTree([node])
    render(<CanvasPanel />)
    window.dispatchEvent(new MessageEvent('message', {
      data: {
        __gameTool: 'bridge',
        v: 1,
        payload: {
          type: 'TRANSFORM_CHANGED',
          nodeId: 'player',
          transform: { x: 200, y: 100, rotation: 0, scaleX: 1, scaleY: 1 },
        },
      },
    }))
    expect(useSceneStore.getState().byId('player')?.transform.x).toBe(200)
  })

  test('LOG messages from the bridge are appended to consoleStore', () => {
    useConsoleStore.getState().clear()
    render(<CanvasPanel />)
    window.dispatchEvent(new MessageEvent('message', {
      data: {
        __gameTool: 'bridge',
        v: 1,
        payload: { type: 'LOG', level: 'info', message: 'hello from game' },
      },
    }))
    const entries = useConsoleStore.getState().entries
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({ level: 'info', message: 'hello from game' })
  })

  test('TRANSFORM_CHANGED on a node with owner writes the patched skeleton JSON to disk', async () => {
    vi.useFakeTimers()
    try {
      // Mock platform: readText returns a tiny skeleton; writeFile captures calls.
      const writeCalls: Array<{ path: string; text: string }> = []
      const fakeSkeleton = JSON.stringify({
        skeleton: { spine: '4.2.37' },
        bones: [
          { name: 'root' },
          { name: 'spinner_container', parent: 'root', y: -150 },
        ],
      }, null, '\t')
      __setPlatformForTests({
        kind: 'browser',
        fs: {
          async openFolder() { return null },
          async readFile() { return new Uint8Array() },
          async readText(_h, path) {
            if (path === 'media/skeletons_json/main_scene/main_scene/Skeleton.json') return fakeSkeleton
            throw new Error(`Unexpected readText: ${path}`)
          },
          async writeFile(_h, path, data) {
            writeCalls.push({ path, text: new TextDecoder().decode(data) })
          },
          async listDir() { return [] },
          watch() { return () => {} },
        },
        env: { get: () => undefined, has: () => false },
        shell: { async openExternal() {} },
        dialog: { async openFile() { return null }, async saveFile() { return null } },
      })

      useProjectStore.getState().setFolder({ name: 'big-bait', rootPath: 'big-bait', fsHandle: null })
      useSpinePatchStore.getState().reset()
      useConsoleStore.getState().clear()

      const ownerNode: NodeSnapshot = {
        id: 'bone-1',
        kind: 'spine-bone',
        name: 'spinner_container',
        parentId: null,
        childIds: [],
        transform: { x: 0, y: -150, rotation: 0, scaleX: 1, scaleY: 1 },
        bounds: null,
        schema: [],
        values: {},
        owner: {
          skeletonFile: 'media/skeletons_json/main_scene/main_scene/Skeleton.json',
          boneName: 'spinner_container',
        },
      }
      useSceneStore.getState().setTree([ownerNode])

      render(<CanvasPanel />)

      await act(async () => {
        window.dispatchEvent(new MessageEvent('message', {
          data: {
            __gameTool: 'bridge',
            v: 1,
            payload: {
              type: 'TRANSFORM_CHANGED',
              nodeId: 'bone-1',
              transform: { x: 50, y: -150, rotation: 0, scaleX: 1, scaleY: 1 },
            },
          },
        }))
      })

      // Advance past the debounce. Allow microtasks to drain via runAllTimersAsync.
      await act(async () => {
        await vi.runAllTimersAsync()
      })

      expect(writeCalls).toHaveLength(1)
      expect(writeCalls[0].path).toBe('media/skeletons_json/main_scene/main_scene/Skeleton.json')
      const parsed = JSON.parse(writeCalls[0].text) as { bones: Array<{ name: string; x?: number }> }
      expect(parsed.bones.find((b) => b.name === 'spinner_container')?.x).toBe(50)

      // And a Saved log entry exists.
      expect(useConsoleStore.getState().entries.some((e) => e.message.startsWith('Saved '))).toBe(true)
    } finally {
      vi.useRealTimers()
      __setPlatformForTests(null)
    }
  })

  test('mid-flush enqueue is preserved by the next flush (race fix)', async () => {
    vi.useFakeTimers()
    try {
      const writeCalls: Array<{ path: string; text: string }> = []
      let resolveWrite: (() => void) | null = null
      const writeGate = new Promise<void>((resolve) => { resolveWrite = resolve })
      const fakeSkeleton = JSON.stringify({
        skeleton: { spine: '4.2.37' },
        bones: [
          { name: 'root' },
          { name: 'spinner_container', parent: 'root', y: -150 },
          { name: 'suspense_reel_3', parent: 'spinner_container', x: 260 },
        ],
      }, null, '\t')
      let currentSkeletonText = fakeSkeleton

      __setPlatformForTests({
        kind: 'browser',
        fs: {
          async openFolder() { return null },
          async readFile() { return new Uint8Array() },
          async readText(_h, path) {
            if (path === 'media/skeletons_json/main_scene/main_scene/Skeleton.json') return currentSkeletonText
            throw new Error(`Unexpected readText: ${path}`)
          },
          async writeFile(_h, path, data) {
            // Block the first write so we can sneak another enqueue in between.
            await writeGate
            const text = new TextDecoder().decode(data)
            writeCalls.push({ path, text })
            currentSkeletonText = text
          },
          async listDir() { return [] },
          watch() { return () => {} },
        },
        env: { get: () => undefined, has: () => false },
        shell: { async openExternal() {} },
        dialog: { async openFile() { return null }, async saveFile() { return null } },
      })

      useProjectStore.getState().setFolder({ name: 'big-bait', rootPath: 'big-bait', fsHandle: null })
      useSpinePatchStore.getState().reset()
      useConsoleStore.getState().clear()

      const ownerNode: NodeSnapshot = {
        id: 'bone-1',
        kind: 'spine-bone',
        name: 'spinner_container',
        parentId: null,
        childIds: [],
        transform: { x: 0, y: -150, rotation: 0, scaleX: 1, scaleY: 1 },
        bounds: null,
        schema: [],
        values: {},
        owner: {
          skeletonFile: 'media/skeletons_json/main_scene/main_scene/Skeleton.json',
          boneName: 'spinner_container',
        },
      }
      const siblingNode: NodeSnapshot = {
        ...ownerNode,
        id: 'bone-2',
        name: 'suspense_reel_3',
        owner: { skeletonFile: ownerNode.owner!.skeletonFile, boneName: 'suspense_reel_3' },
      }
      useSceneStore.getState().setTree([ownerNode, siblingNode])

      render(<CanvasPanel />)

      // First transform: queues spinner_container patch and schedules a 300ms flush
      await act(async () => {
        window.dispatchEvent(new MessageEvent('message', {
          data: { __gameTool: 'bridge', v: 1, payload: {
            type: 'TRANSFORM_CHANGED', nodeId: 'bone-1',
            transform: { x: 50, y: -150, rotation: 0, scaleX: 1, scaleY: 1 },
          }},
        }))
      })

      // Run the debounce timer; the flush starts but blocks at writeGate
      await act(async () => {
        await vi.advanceTimersByTimeAsync(300)
      })

      // While the first writeFile is still pending, enqueue a second patch
      await act(async () => {
        window.dispatchEvent(new MessageEvent('message', {
          data: { __gameTool: 'bridge', v: 1, payload: {
            type: 'TRANSFORM_CHANGED', nodeId: 'bone-2',
            transform: { x: 99, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
          }},
        }))
      })

      // Release the first writeFile. The flush completes; clearFile MUST NOT
      // discard the second patch.
      resolveWrite!()
      await act(async () => {
        await vi.runAllTimersAsync()
      })

      expect(writeCalls.length).toBeGreaterThanOrEqual(2)
      // The final written file should contain BOTH patched bones.
      const finalText = writeCalls[writeCalls.length - 1].text
      const parsed = JSON.parse(finalText) as { bones: Array<{ name: string; x?: number }> }
      expect(parsed.bones.find((b) => b.name === 'spinner_container')?.x).toBe(50)
      expect(parsed.bones.find((b) => b.name === 'suspense_reel_3')?.x).toBe(99)
    } finally {
      vi.useRealTimers()
      __setPlatformForTests(null)
    }
  })

  test('TRANSFORM_CHANGED with identical transform does not write to disk', async () => {
    vi.useFakeTimers()
    try {
      const writeCalls: Array<{ path: string; text: string }> = []
      __setPlatformForTests({
        kind: 'browser',
        fs: {
          async openFolder() { return null },
          async readFile() { return new Uint8Array() },
          async readText() { return '{}' },
          async writeFile(_h, path, data) { writeCalls.push({ path, text: new TextDecoder().decode(data) }) },
          async listDir() { return [] },
          watch() { return () => {} },
        },
        env: { get: () => undefined, has: () => false },
        shell: { async openExternal() {} },
        dialog: { async openFile() { return null }, async saveFile() { return null } },
      })

      useProjectStore.getState().setFolder({ name: 'big-bait', rootPath: 'big-bait', fsHandle: null })
      useSpinePatchStore.getState().reset()
      useConsoleStore.getState().clear()

      const ownerNode: NodeSnapshot = {
        id: 'bone-1',
        kind: 'spine-bone',
        name: 'spinner_container',
        parentId: null,
        childIds: [],
        transform: { x: 50, y: -150, rotation: 0, scaleX: 1, scaleY: 1 },
        bounds: null,
        schema: [],
        values: {},
        owner: {
          skeletonFile: 'media/skeletons_json/main_scene/main_scene/Skeleton.json',
          boneName: 'spinner_container',
        },
      }
      useSceneStore.getState().setTree([ownerNode])

      render(<CanvasPanel />)

      // Dispatch a TRANSFORM_CHANGED with identical values.
      await act(async () => {
        window.dispatchEvent(new MessageEvent('message', {
          data: { __gameTool: 'bridge', v: 1, payload: {
            type: 'TRANSFORM_CHANGED', nodeId: 'bone-1',
            transform: { x: 50, y: -150, rotation: 0, scaleX: 1, scaleY: 1 },
          }},
        }))
      })

      await act(async () => { await vi.runAllTimersAsync() })

      expect(writeCalls).toHaveLength(0)
    } finally {
      vi.useRealTimers()
      __setPlatformForTests(null)
    }
  })
})
