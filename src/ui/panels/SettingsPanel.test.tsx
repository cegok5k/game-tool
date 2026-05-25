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

  test('shows AI keys as missing when env is empty', () => {
    __setPlatformForTests(mockPlatform({}))
    render(<SettingsPanel />)
    const genaiRow = screen.getByText('GOOGLE_GENAI_API_KEY').closest('[data-key-row]')
    expect(genaiRow?.getAttribute('data-present')).toBe('false')
  })

  test('shows AI keys as present when env has them', () => {
    __setPlatformForTests(mockPlatform({ GOOGLE_GENAI_API_KEY: 'abc', GOOGLE_VEO_API_KEY: 'def' }))
    render(<SettingsPanel />)
    expect(screen.getByText('GOOGLE_GENAI_API_KEY').closest('[data-key-row]')?.getAttribute('data-present')).toBe('true')
    expect(screen.getByText('GOOGLE_VEO_API_KEY').closest('[data-key-row]')?.getAttribute('data-present')).toBe('true')
    expect(screen.getByText('GOOGLE_SEEDANCE_API_KEY').closest('[data-key-row]')?.getAttribute('data-present')).toBe('false')
  })
})
