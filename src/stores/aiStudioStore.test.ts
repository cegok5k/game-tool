import { describe, expect, test, beforeEach } from 'vitest'
import { useAiStudioStore } from './aiStudioStore'

describe('aiStudioStore', () => {
  beforeEach(() => { useAiStudioStore.getState().reset() })

  test('initial state', () => {
    const s = useAiStudioStore.getState()
    expect(s.prompt).toBe('')
    expect(s.status).toBe('idle')
    expect(s.error).toBeNull()
    expect(s.result).toBeNull()
    expect(s.history).toEqual([])
  })

  test('setPrompt updates the draft prompt', () => {
    useAiStudioStore.getState().setPrompt('a cat')
    expect(useAiStudioStore.getState().prompt).toBe('a cat')
  })

  test('beginGeneration sets status to running', () => {
    useAiStudioStore.getState().beginGeneration()
    expect(useAiStudioStore.getState().status).toBe('running')
    expect(useAiStudioStore.getState().error).toBeNull()
  })

  test('completeGeneration stores result + pushes to history + status done', () => {
    useAiStudioStore.getState().setPrompt('a cat')
    useAiStudioStore.getState().beginGeneration()
    useAiStudioStore.getState().completeGeneration({ base64: 'AAA', mimeType: 'image/png' })
    const s = useAiStudioStore.getState()
    expect(s.status).toBe('done')
    expect(s.result).toEqual({ base64: 'AAA', mimeType: 'image/png' })
    expect(s.history).toHaveLength(1)
    expect(s.history[0]).toMatchObject({ prompt: 'a cat', base64: 'AAA', mimeType: 'image/png' })
  })

  test('failGeneration stores error + status error', () => {
    useAiStudioStore.getState().beginGeneration()
    useAiStudioStore.getState().failGeneration('rate limited')
    expect(useAiStudioStore.getState().status).toBe('error')
    expect(useAiStudioStore.getState().error).toBe('rate limited')
  })

  test('history cap is enforced', () => {
    const s = useAiStudioStore.getState()
    for (let i = 0; i < 25; i++) {
      s.setPrompt(`p${i}`)
      s.completeGeneration({ base64: `b${i}`, mimeType: 'image/png' })
    }
    expect(useAiStudioStore.getState().history.length).toBeLessThanOrEqual(20)
  })

  test('reset clears everything', () => {
    useAiStudioStore.getState().setPrompt('x')
    useAiStudioStore.getState().completeGeneration({ base64: 'a', mimeType: 'image/png' })
    useAiStudioStore.getState().reset()
    const s = useAiStudioStore.getState()
    expect(s.prompt).toBe('')
    expect(s.result).toBeNull()
    expect(s.history).toEqual([])
  })
})
