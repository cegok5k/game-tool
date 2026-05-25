import { describe, expect, test, vi } from 'vitest'
import { createEventBus } from './eventBus'

describe('eventBus', () => {
  test('fires subscriber for matching event type', () => {
    const bus = createEventBus()
    const handler = vi.fn()
    bus.on('bridge:connected', handler)
    bus.emit({ type: 'bridge:connected' })
    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler).toHaveBeenCalledWith({ type: 'bridge:connected' })
  })

  test('does not fire subscriber for non-matching event', () => {
    const bus = createEventBus()
    const handler = vi.fn()
    bus.on('bridge:connected', handler)
    bus.emit({ type: 'project:closed' })
    expect(handler).not.toHaveBeenCalled()
  })

  test('off() removes subscriber', () => {
    const bus = createEventBus()
    const handler = vi.fn()
    bus.on('bridge:connected', handler)
    bus.off('bridge:connected', handler)
    bus.emit({ type: 'bridge:connected' })
    expect(handler).not.toHaveBeenCalled()
  })

  test('passes typed payload to handler', () => {
    const bus = createEventBus()
    const handler = vi.fn()
    bus.on('project:opened', handler)
    bus.emit({ type: 'project:opened', rootPath: '/games/big-bait' })
    expect(handler).toHaveBeenCalledWith({ type: 'project:opened', rootPath: '/games/big-bait' })
  })
})
