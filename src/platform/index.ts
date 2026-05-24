import type { PlatformAdapter } from '../types/platform'
import { createBrowserPlatform } from './browser'

let cached: PlatformAdapter | null = null

export function getPlatform(): PlatformAdapter {
  if (cached === null) {
    cached = createBrowserPlatform()
  }
  return cached
}

// Test-only injection
export function __setPlatformForTests(p: PlatformAdapter | null): void {
  cached = p
}
