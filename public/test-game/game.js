/* global GameToolBridge */

const { createBridge } = GameToolBridge

const bridge = createBridge()
const stage = document.getElementById('stage')
const status = document.getElementById('status')

const state = {
  player:    { id: 'player',    name: 'Player',    x: 200, y: 200, w: 80, h: 80, color: '#7c6af7', health: 100, speed: 180 },
  enemy:     { id: 'enemy',     name: 'Enemy',     x: 480, y: 240, w: 70, h: 70, color: '#f87171', health: 60,  damage: 12 },
  pickup:    { id: 'pickup',    name: 'Pickup',    x: 360, y: 380, w: 40, h: 40, color: '#fbbf24', value: 50 },
}

const nodes = {}

function makeNode(s) {
  const el = document.createElement('div')
  el.className = 'entity'
  el.dataset.entityId = s.id
  el.style.width = s.w + 'px'
  el.style.height = s.h + 'px'
  el.style.background = s.color
  el.textContent = s.name
  applyTransform(el, s)
  stage.appendChild(el)
  return el
}

function applyTransform(el, s) {
  el.style.left = s.x + 'px'
  el.style.top = s.y + 'px'
}

for (const key of Object.keys(state)) {
  const s = state[key]
  nodes[s.id] = makeNode(s)
}

function register(s) {
  bridge.register({
    id: s.id,
    kind: 'sprite',
    name: s.name,
    transform: { x: s.x, y: s.y, rotation: 0, scaleX: 1, scaleY: 1 },
    bounds: { x: s.x, y: s.y, width: s.w, height: s.h },
    schema: schemaFor(s),
    get: () => valuesFor(s),
    set: (props) => {
      Object.assign(s, props)
      applyTransform(nodes[s.id], s)
    },
  })
}

function schemaFor(s) {
  const fields = []
  if ('health' in s) fields.push({ key: 'health', type: 'number', label: 'Health', min: 0, max: 100 })
  if ('speed'  in s) fields.push({ key: 'speed',  type: 'number', label: 'Speed',  min: 0, max: 500 })
  if ('damage' in s) fields.push({ key: 'damage', type: 'number', label: 'Damage', min: 0, max: 100 })
  if ('value'  in s) fields.push({ key: 'value',  type: 'number', label: 'Value',  min: 0, max: 1000 })
  return fields
}

function valuesFor(s) {
  const v = {}
  for (const k of ['health', 'speed', 'damage', 'value']) {
    if (k in s) v[k] = s[k]
  }
  return v
}

for (const s of Object.values(state)) register(s)

window.addEventListener('message', (e) => {
  const data = e.data
  if (!data || data.__gameTool !== 'bridge' || data.v !== 1) return
  const p = data.payload
  if (p.type === 'NODE_SELECTED') {
    Object.values(nodes).forEach((el) => { el.dataset.selected = 'false' })
    if (p.node) {
      const el = nodes[p.node.id]
      if (el) el.dataset.selected = 'true'
    }
  }
})

bridge.connect({
  gameName: 'TestGame',
  capabilities: ['canvas2d', 'hot-reload'],
})

bridge.notifyLog('info', 'TestGame connected with ' + Object.keys(state).length + ' entities')

status.dataset.connected = 'true'
status.textContent = '● Bridge connected'

// Local click handler exists for completeness; selection is actually driven by
// PICK_AT messages from the editor's overlay (see CanvasPanel.tsx). This handler
// is a no-op stub kept for symmetry / future use.
stage.addEventListener('click', (e) => {
  const x = e.clientX
  const y = e.clientY
  for (const s of Object.values(state)) {
    if (x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h) {
      return
    }
  }
})
