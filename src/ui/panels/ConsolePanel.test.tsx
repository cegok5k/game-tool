import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, test, beforeEach } from 'vitest'
import { useConsoleStore } from '../../stores/consoleStore'
import { ConsolePanel } from './ConsolePanel'

describe('ConsolePanel', () => {
  beforeEach(() => { useConsoleStore.getState().clear() })

  test('renders empty hint when no entries', () => {
    render(<ConsolePanel />)
    expect(screen.getByText(/no logs yet/i)).toBeInTheDocument()
  })

  test('renders log entries with level + message', () => {
    useConsoleStore.getState().addEntry({ level: 'info', message: 'hello' })
    useConsoleStore.getState().addEntry({ level: 'warn', message: 'careful' })
    useConsoleStore.getState().addEntry({ level: 'error', message: 'boom' })
    render(<ConsolePanel />)
    expect(screen.getByText('hello')).toBeInTheDocument()
    expect(screen.getByText('careful')).toBeInTheDocument()
    expect(screen.getByText('boom')).toBeInTheDocument()
  })

  test('Clear button empties the store', () => {
    useConsoleStore.getState().addEntry({ level: 'info', message: 'm' })
    render(<ConsolePanel />)
    expect(screen.getByText('m')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /clear/i }))
    expect(useConsoleStore.getState().entries).toEqual([])
  })

  test('level filter toggles hide info entries when info is off', () => {
    useConsoleStore.getState().addEntry({ level: 'info', message: 'i1' })
    useConsoleStore.getState().addEntry({ level: 'warn', message: 'w1' })
    render(<ConsolePanel />)
    expect(screen.getByText('i1')).toBeInTheDocument()
    expect(screen.getByText('w1')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /info/i }))
    expect(screen.queryByText('i1')).not.toBeInTheDocument()
    expect(screen.getByText('w1')).toBeInTheDocument()
  })
})
