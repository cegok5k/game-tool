export function snapToGrid(value: number, grid: number): number {
  if (grid <= 0) return value
  const result = Math.round(value / grid) * grid
  // Avoid -0
  return result === 0 ? 0 : result
}

export function snapAngle(deg: number, stepDeg: number): number {
  if (stepDeg <= 0) return deg
  const result = Math.round(deg / stepDeg) * stepDeg
  // Avoid -0
  return result === 0 ? 0 : result
}

export function snapPoint(p: { x: number; y: number }, grid: number): { x: number; y: number } {
  return { x: snapToGrid(p.x, grid), y: snapToGrid(p.y, grid) }
}
