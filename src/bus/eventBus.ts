import mitt from 'mitt'
import type { EditorEvent, EventOf } from './events'

type HandlerMap = {
  [K in EditorEvent['type']]: EventOf<K>
}

export type EventBus = {
  on<K extends EditorEvent['type']>(type: K, handler: (event: EventOf<K>) => void): void
  off<K extends EditorEvent['type']>(type: K, handler: (event: EventOf<K>) => void): void
  emit(event: EditorEvent): void
}

export function createEventBus(): EventBus {
  const inner = mitt<HandlerMap>()
  return {
    on(type, handler) {
      inner.on(type, handler as never)
    },
    off(type, handler) {
      inner.off(type, handler as never)
    },
    emit(event) {
      inner.emit(event.type, event as never)
    },
  }
}
