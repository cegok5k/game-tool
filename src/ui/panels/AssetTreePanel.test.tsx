import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, expect, test, beforeEach, vi } from 'vitest'
import type { DirEntry, PlatformAdapter, FolderHandle } from '../../types/platform'
import { useProjectStore } from '../../stores/projectStore'
import { useAssetBrowserStore } from '../../stores/assetBrowserStore'
import { __setPlatformForTests } from '../../platform'
import { AssetTreePanel } from './AssetTreePanel'

const folder: FolderHandle = { name: 'demo', rootPath: 'demo', fsHandle: null }

function mockPlatform(listings: Record<string, DirEntry[]>): PlatformAdapter {
  return {
    kind: 'browser',
    fs: {
      openFolder: vi.fn(),
      readFile: vi.fn(),
      readText: vi.fn(),
      writeFile: vi.fn(),
      listDir: vi.fn(async (_h, p) => listings[p] ?? []),
      watch: vi.fn(() => () => {}),
    },
    env: { get: () => undefined, has: () => false },
    shell: { openExternal: vi.fn() },
    dialog: { openFile: vi.fn(), saveFile: vi.fn() },
  }
}

describe('AssetTreePanel', () => {
  beforeEach(() => {
    useProjectStore.getState().close()
    useAssetBrowserStore.getState().reset()
    __setPlatformForTests(null)
  })

  test('shows empty hint when no project is open', () => {
    render(<AssetTreePanel />)
    expect(screen.getByText(/no project open/i)).toBeInTheDocument()
  })

  test('lists root entries when a project is open', async () => {
    __setPlatformForTests(mockPlatform({
      '': [
        { kind: 'directory', path: 'media',  name: 'media',  size: 0, modifiedAt: 0 },
        { kind: 'file',      path: 'README.md', name: 'README.md', size: 100, modifiedAt: 0 },
      ],
    }))
    useProjectStore.getState().setFolder(folder)
    render(<AssetTreePanel />)
    await waitFor(() => expect(screen.getByText('media')).toBeInTheDocument())
    expect(screen.getByText('README.md')).toBeInTheDocument()
  })

  test('clicking a directory expands and lazily loads its entries', async () => {
    __setPlatformForTests(mockPlatform({
      '': [{ kind: 'directory', path: 'media', name: 'media', size: 0, modifiedAt: 0 }],
      'media': [{ kind: 'file', path: 'media/hero.png', name: 'hero.png', size: 100, modifiedAt: 0 }],
    }))
    useProjectStore.getState().setFolder(folder)
    render(<AssetTreePanel />)
    await waitFor(() => expect(screen.getByText('media')).toBeInTheDocument())
    fireEvent.click(screen.getByText('media'))
    await waitFor(() => expect(screen.getByText('hero.png')).toBeInTheDocument())
  })

  test('hides node_modules + .git + dotfiles by default', async () => {
    __setPlatformForTests(mockPlatform({
      '': [
        { kind: 'directory', path: 'node_modules', name: 'node_modules', size: 0, modifiedAt: 0 },
        { kind: 'directory', path: '.git', name: '.git', size: 0, modifiedAt: 0 },
        { kind: 'file', path: '.env', name: '.env', size: 0, modifiedAt: 0 },
        { kind: 'file', path: 'package.json', name: 'package.json', size: 0, modifiedAt: 0 },
      ],
    }))
    useProjectStore.getState().setFolder(folder)
    render(<AssetTreePanel />)
    await waitFor(() => expect(screen.getByText('package.json')).toBeInTheDocument())
    expect(screen.queryByText('node_modules')).not.toBeInTheDocument()
    expect(screen.queryByText('.git')).not.toBeInTheDocument()
    expect(screen.queryByText('.env')).not.toBeInTheDocument()
  })

  test('clicking a file selects it', async () => {
    __setPlatformForTests(mockPlatform({
      '': [{ kind: 'file', path: 'README.md', name: 'README.md', size: 100, modifiedAt: 0 }],
    }))
    useProjectStore.getState().setFolder(folder)
    render(<AssetTreePanel />)
    await waitFor(() => expect(screen.getByText('README.md')).toBeInTheDocument())
    fireEvent.click(screen.getByText('README.md'))
    expect(useAssetBrowserStore.getState().selectedPath).toBe('README.md')
  })
})
