import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, expect, test, beforeEach, vi } from 'vitest'
import type { PlatformAdapter, FolderHandle } from '../../types/platform'
import { useProjectStore } from '../../stores/projectStore'
import { useAssetBrowserStore } from '../../stores/assetBrowserStore'
import { useConfigEditorStore } from '../../stores/configEditorStore'
import { __setPlatformForTests } from '../../platform'
import { ConfigEditorPanel } from './ConfigEditorPanel'

const folder: FolderHandle = { name: 'demo', rootPath: 'demo', fsHandle: null }

function mockPlatform(opts: { read?: Record<string, string>; writes?: { path: string; data: Uint8Array }[] }): PlatformAdapter {
  const read = opts.read ?? {}
  const writes = opts.writes ?? []
  return {
    kind: 'browser',
    fs: {
      openFolder: vi.fn(),
      readFile: vi.fn(),
      readText: vi.fn(async (_h, p) => {
        if (p in read) return read[p]
        throw new Error('ENOENT')
      }),
      writeFile: vi.fn(async (_h, p, d) => { writes.push({ path: p, data: d }) }),
      listDir: vi.fn(async () => []),
      watch: vi.fn(() => () => {}),
    },
    env: { get: () => undefined, has: () => false },
    shell: { openExternal: vi.fn() },
    dialog: { openFile: vi.fn(), saveFile: vi.fn() },
  }
}

describe('ConfigEditorPanel', () => {
  beforeEach(() => {
    useProjectStore.getState().close()
    useAssetBrowserStore.getState().reset()
    useConfigEditorStore.getState().reset()
    __setPlatformForTests(null)
  })

  test('shows empty hint when no project / no selection', () => {
    render(<ConfigEditorPanel />)
    expect(screen.getByText(/select a json file/i)).toBeInTheDocument()
  })

  test('shows non-json hint when selected file is not .json', () => {
    useProjectStore.getState().setFolder(folder)
    useAssetBrowserStore.getState().select('README.md')
    render(<ConfigEditorPanel />)
    expect(screen.getByText(/json file/i)).toBeInTheDocument()
  })

  test('loads the JSON content into the textarea', async () => {
    __setPlatformForTests(mockPlatform({ read: { 'configs/foo.json': '{"a":1}' } }))
    useProjectStore.getState().setFolder(folder)
    useAssetBrowserStore.getState().select('configs/foo.json')
    render(<ConfigEditorPanel />)
    const textarea = await waitFor(() => screen.getByRole('textbox') as HTMLTextAreaElement)
    await waitFor(() => expect(textarea.value).toBe('{"a":1}'))
  })

  test('editing the textarea marks the panel dirty', async () => {
    __setPlatformForTests(mockPlatform({ read: { 'configs/foo.json': '{"a":1}' } }))
    useProjectStore.getState().setFolder(folder)
    useAssetBrowserStore.getState().select('configs/foo.json')
    render(<ConfigEditorPanel />)
    const textarea = await waitFor(() => screen.getByRole('textbox') as HTMLTextAreaElement)
    await waitFor(() => expect(textarea.value).toBe('{"a":1}'))
    fireEvent.change(textarea, { target: { value: '{"a":2}' } })
    expect(useConfigEditorStore.getState().isDirty).toBe(true)
    expect(screen.getByRole('button', { name: /save/i })).not.toBeDisabled()
  })

  test('Save writes file via fs.writeFile and clears dirty', async () => {
    const writes: { path: string; data: Uint8Array }[] = []
    __setPlatformForTests(mockPlatform({ read: { 'configs/foo.json': '{"a":1}' }, writes }))
    useProjectStore.getState().setFolder(folder)
    useAssetBrowserStore.getState().select('configs/foo.json')
    render(<ConfigEditorPanel />)
    const textarea = await waitFor(() => screen.getByRole('textbox') as HTMLTextAreaElement)
    await waitFor(() => expect(textarea.value).toBe('{"a":1}'))
    fireEvent.change(textarea, { target: { value: '{"a":2}' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() => {
      expect(writes).toHaveLength(1)
      expect(writes[0].path).toBe('configs/foo.json')
      expect(new TextDecoder().decode(writes[0].data)).toBe('{"a":2}')
    })
    expect(useConfigEditorStore.getState().isDirty).toBe(false)
  })

  test('shows a parse-error indicator for invalid JSON', async () => {
    __setPlatformForTests(mockPlatform({ read: { 'configs/foo.json': '{"a":1}' } }))
    useProjectStore.getState().setFolder(folder)
    useAssetBrowserStore.getState().select('configs/foo.json')
    render(<ConfigEditorPanel />)
    const textarea = await waitFor(() => screen.getByRole('textbox') as HTMLTextAreaElement)
    await waitFor(() => expect(textarea.value).toBe('{"a":1}'))
    fireEvent.change(textarea, { target: { value: '{not valid' } })
    expect(await screen.findByText(/parse error/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled()
  })
})
