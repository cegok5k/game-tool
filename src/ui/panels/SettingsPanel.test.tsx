import { render, screen } from '@testing-library/react'
import { describe, expect, test, beforeEach } from 'vitest'
import type { PlatformAdapter } from '../../types/platform'
import { useProjectStore } from '../../stores/projectStore'
import { __setPlatformForTests } from '../../platform'
import { SettingsPanel } from './SettingsPanel'

function mockPlatform(env: Record<string, string>): PlatformAdapter {
  return {
    kind: 'browser',
    fs: { openFolder: async () => null, readFile: async () => new Uint8Array(), readText: async () => '', writeFile: async () => {}, listDir: async () => [], watch: () => () => {} },
    env: { get: (k) => env[k], has: (k) => Object.hasOwn(env, k) },
    shell: { openExternal: async () => {} },
    dialog: { openFile: async () => null, saveFile: async () => null },
  }
}

describe('SettingsPanel', () => {
  beforeEach(() => {
    useProjectStore.getState().close()
    __setPlatformForTests(null)
  })

  test('shows "no project open" when no folder loaded', () => {
    render(<SettingsPanel />)
    expect(screen.getByText(/no project open/i)).toBeInTheDocument()
  })

  test('shows project info when a project is open', () => {
    useProjectStore.getState().setFolder({ name: 'big-bait', rootPath: 'big-bait', fsHandle: null })
    useProjectStore.getState().loadProjectConfig({
      projectName: 'BigBait',
      devPortOffset: 100,
      spineVersion: '4.2.37',
      balanceTypes: ['rhodium', 'natrium'],
    })
    render(<SettingsPanel />)
    expect(screen.getByText('BigBait')).toBeInTheDocument()
    expect(screen.getByText(/4\.2\.37/)).toBeInTheDocument()
    expect(screen.getByText(/rhodium/)).toBeInTheDocument()
    expect(screen.getByText(/natrium/)).toBeInTheDocument()
  })

  test('shows platform kind', () => {
    render(<SettingsPanel />)
    expect(screen.getByText(/browser/i)).toBeInTheDocument()
  })

  test('shows AI keys as missing when env is empty (joined candidate names)', () => {
    __setPlatformForTests(mockPlatform({}))
    render(<SettingsPanel />)
    // When no candidate is set, the row label shows both names joined by " or ".
    const imagenRow = screen.getByText(/CEGO_GEMINI_API_KEY or GOOGLE_GENAI_API_KEY/).closest('[data-key-row]')
    expect(imagenRow?.getAttribute('data-present')).toBe('false')
  })

  test('shows Imagen key as present (and resolved name) when GOOGLE_GENAI_API_KEY is set', () => {
    __setPlatformForTests(mockPlatform({ GOOGLE_GENAI_API_KEY: 'abc' }))
    render(<SettingsPanel />)
    const row = screen.getByText('GOOGLE_GENAI_API_KEY').closest('[data-key-row]')
    expect(row?.getAttribute('data-present')).toBe('true')
  })

  test('shows Imagen key as present using CEGO_GEMINI_API_KEY when that one is set', () => {
    __setPlatformForTests(mockPlatform({ CEGO_GEMINI_API_KEY: 'cego' }))
    render(<SettingsPanel />)
    const row = screen.getByText('CEGO_GEMINI_API_KEY').closest('[data-key-row]')
    expect(row?.getAttribute('data-present')).toBe('true')
  })
})
