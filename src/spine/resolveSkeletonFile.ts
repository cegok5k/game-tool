// src/spine/resolveSkeletonFile.ts
const ROOT = 'media/skeletons_json'

export function resolveSkeletonFile(skeletonId: string): string {
  if (!skeletonId) {
    throw new Error('resolveSkeletonFile: empty skeleton id')
  }
  const parts = skeletonId.split('.')
  if (parts.length < 2) {
    throw new Error(`resolveSkeletonFile: id must contain at least one dot, got "${skeletonId}"`)
  }
  const skeletonName = parts[parts.length - 1]
  const dirs = parts.slice(0, -1)
  return `${ROOT}/${dirs.join('/')}/${skeletonName}.json`
}
