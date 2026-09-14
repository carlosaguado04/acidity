import './style.css'

const root = document.documentElement
const reduceMq = window.matchMedia('(prefers-reduced-motion: reduce)')
const fineMq = window.matchMedia('(pointer: fine)')
const hoverMq = window.matchMedia('(hover: hover)')

type GlanceId = 'about' | 'apps' | 'web' | 'contact'

const titles: Record<GlanceId, string> = {
  about: 'About Acidity',
  apps: 'Apps',
  web: 'Web works',
  contact: 'Contact',
}

const home = document.getElementById('main')
const glance = document.querySelector<HTMLElement>('#glance')
const glanceTitle = document.querySelector<HTMLElement>('#glance-title')
const panes = [...document.querySelectorAll<HTMLElement>('[data-pane]')]
const openers = [...document.querySelectorAll<HTMLButtonElement>('[data-open]')]
const closers = [...document.querySelectorAll('[data-close]')]
const mark = document.querySelector<HTMLElement>('[data-mark]')
const cursor = document.querySelector<HTMLElement>('.cursor')
const auroraCanvas = document.querySelector<HTMLCanvasElement>('[data-aurora-canvas]')
let auroraSync: (() => void) | null = null

let lastFocus: HTMLElement | null = null
let openId: GlanceId | null = null
let raf = 0
let parX = 0
let parY = 0
let parTX = 0
let parTY = 0
let cursorOn = false
let cursorRaf = 0
let ptrX = 0
let ptrY = 0
let curX = 0
let curY = 0
let cursorArmed = false
let cursorHot = false

function reduced() {
  return reduceMq.matches
}

/** Visible Mexican-pink noise wash (tiny WebGL). Seamless; no particles. */
function startAurora() {
  if (!auroraCanvas) return
  const gl =
    auroraCanvas.getContext('webgl', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: 'low-power',
    }) ||
    (auroraCanvas.getContext('experimental-webgl', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
    }) as WebGLRenderingContext | null)
  if (!gl) {
    auroraCanvas.style.display = 'none'
    return
  }
  const g = gl

  const vs = `
attribute vec2 a;
void main(){ gl_Position = vec4(a,0.0,1.0); }
`
  const fs = `
precision mediump float;
uniform vec2 u_res;
uniform float u_t;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p); vec2 f = fract(p);
  float a = hash(i);
  float b = hash(i + vec2(1.0,0.0));
  float c = hash(i + vec2(0.0,1.0));
  float d = hash(i + vec2(1.0,1.0));
  vec2 u = f*f*(3.0-2.0*f);
  return mix(a,b,u.x) + (c-a)*u.y*(1.0-u.x) + (d-b)*u.x*u.y;
}
float fbm(vec2 p){
  float v = 0.0; float a = 0.5;
  for(int i=0;i<3;i++){ v += a*noise(p); p *= 2.03; a *= 0.5; }
  return v;
}
vec2 curl(vec2 p){
  float e = 0.12;
  float n1 = fbm(p + vec2(0.0, e));
  float n2 = fbm(p - vec2(0.0, e));
  float n3 = fbm(p + vec2(e, 0.0));
  float n4 = fbm(p - vec2(e, 0.0));
  return vec2((n1 - n2) / (2.0 * e), (n4 - n3) / (2.0 * e));
}
void main(){
  vec2 uv = gl_FragCoord.xy / u_res;
  float aspect = u_res.x / max(u_res.y, 1.0);
  vec2 p = vec2(uv.x * aspect, uv.y);
  float t = u_t;

  // Strong advection so the field actually travels
  vec2 flow = vec2(t * 0.42, -t * 0.28);
  // Curl warps the domain — smoke filaments instead of a soft blot
  vec2 q = p * 2.35 + flow;
  vec2 c1 = curl(q * 0.85 + vec2(t * 0.15, -t * 0.11));
  q += c1 * 0.55;
  vec2 c2 = curl(q * 1.4 - vec2(t * 0.22, t * 0.18));
  q += c2 * 0.32;

  float n = fbm(q);
  float m = fbm(q * 1.55 + vec2(2.7, -1.3) + flow * 0.6);
  float field = smoothstep(0.22, 0.82, n * 0.58 + m * 0.52);

  // Rising plume bias (smoke lifts + drifts)
  float plume = smoothstep(0.05, 0.95, uv.y + 0.18 * sin(uv.x * 3.2 + t * 0.9));
  float filament = smoothstep(0.35, 0.9, abs(c1.x) + abs(c1.y));
  float glow = field * (0.45 + 0.35 * plume + 0.28 * filament);
  glow = pow(clamp(glow, 0.0, 1.0), 0.88);

  vec3 ink = vec3(0.047, 0.051, 0.063);
  vec3 pink = vec3(0.894, 0.0, 0.486);
  vec3 col = mix(ink, pink, glow * 0.95);
  col = mix(col, pink, glow * glow * 0.4);
  gl_FragColor = vec4(col, 1.0);
}
`

  function compile(type: number, src: string) {
    const s = g.createShader(type)
    if (!s) return null
    g.shaderSource(s, src)
    g.compileShader(s)
    if (!g.getShaderParameter(s, g.COMPILE_STATUS)) {
      g.deleteShader(s)
      return null
    }
    return s
  }

  const vsh = compile(g.VERTEX_SHADER, vs)
  const fsh = compile(g.FRAGMENT_SHADER, fs)
  if (!vsh || !fsh) {
    auroraCanvas.style.display = 'none'
    return
  }
  const prog = g.createProgram()
  if (!prog) return
  g.attachShader(prog, vsh)
  g.attachShader(prog, fsh)
  g.linkProgram(prog)
  if (!g.getProgramParameter(prog, g.LINK_STATUS)) {
    auroraCanvas.style.display = 'none'
    return
  }
  g.useProgram(prog)
  g.disable(g.DEPTH_TEST)
  g.disable(g.BLEND)
  g.disable(g.DITHER)

  const buf = g.createBuffer()
  g.bindBuffer(g.ARRAY_BUFFER, buf)
  g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), g.STATIC_DRAW)
  const loc = g.getAttribLocation(prog, 'a')
  g.enableVertexAttribArray(loc)
  g.vertexAttribPointer(loc, 2, g.FLOAT, false, 0, 0)

  const uRes = g.getUniformLocation(prog, 'u_res')
  const uT = g.getUniformLocation(prog, 'u_t')

  let raf = 0
  let start = performance.now()
  let running = false

  function resize() {
    // Internal low-res buffer; CSS stretches the canvas for smooth fill.
    const scale = 0.5
    const w = Math.max(1, Math.floor(window.innerWidth * scale))
    const h = Math.max(1, Math.floor(window.innerHeight * scale))
    if (auroraCanvas!.width !== w || auroraCanvas!.height !== h) {
      auroraCanvas!.width = w
      auroraCanvas!.height = h
      g.viewport(0, 0, w, h)
    }
  }

  function frame(now: number) {
    if (!running) return
    resize()
    const t = (now - start) / 1000
    g.uniform2f(uRes, auroraCanvas!.width, auroraCanvas!.height)
    g.uniform1f(uT, t)
    g.drawArrays(g.TRIANGLE_STRIP, 0, 4)
    raf = requestAnimationFrame(frame)
  }

  // Prefer vsync clock; never invent a setInterval fallback.

  function stop() {
    running = false
    cancelAnimationFrame(raf)
    raf = 0
  }

  function play() {
    if (running) return
    running = true
    start = performance.now()
    raf = requestAnimationFrame(frame)
  }

  function sync() {
    if (reduced()) {
      stop()
      // one static frame
      resize()
      g.uniform2f(uRes, auroraCanvas!.width, auroraCanvas!.height)
      g.uniform1f(uT, 2.4)
      g.drawArrays(g.TRIANGLE_STRIP, 0, 4)
      return
    }
    play()
  }

  window.addEventListener('resize', () => {
    if (reduced()) sync()
  }, { passive: true })
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop()
    else sync()
  })

  auroraSync = sync
  sync()
}

function readyType() {
  root.classList.remove('is-pending')
  root.classList.add('is-ready')
}

async function waitForAnurati() {
  if (reduced()) {
    readyType()
    paint()
    return
  }
  try {
    await Promise.race([
      document.fonts.load('400 8rem "Anurati"').then(() => document.fonts.ready),
      new Promise<void>((resolve) => {
        window.setTimeout(resolve, 1800)
      }),
    ])
  } catch {
    // still show
  }
  readyType()
  paint()
}

function isGlanceId(value: string): value is GlanceId {
  return value === 'about' || value === 'apps' || value === 'web' || value === 'contact'
}

function setGlance(id: GlanceId | null) {
  const was = openId
  openId = id
  document.body.classList.toggle('is-glance', id !== null)
  document.body.style.overflow = id ? 'hidden' : ''
  if (home) home.inert = id !== null

  if (glance) {
    glance.classList.toggle('is-on', id !== null)
    glance.setAttribute('aria-hidden', String(id === null))
    glance.inert = id === null
  }

  panes.forEach((el) => {
    const on = el.dataset.pane === id
    el.hidden = !on
  })
  openers.forEach((btn) => {
    btn.setAttribute('aria-expanded', String(btn.dataset.open === id))
  })
  if (glanceTitle) glanceTitle.textContent = id ? titles[id] : ''

  if (id) {
    if (!was) {
      lastFocus =
        document.activeElement instanceof HTMLElement ? document.activeElement : openers[0] ?? null
    }
    const body = glance?.querySelector<HTMLElement>('.glance-body')
    if (body) body.scrollTop = 0
    glance?.focus({ preventScroll: true })
  } else {
    lastFocus?.focus()
    lastFocus = null
  }
  requestPaint()
}

function paint() {
  raf = 0
  parX += (parTX - parX) * 0.08
  parY += (parTY - parY) * 0.08
  const live = !openId && !reduced() && fineMq.matches
  const px = live ? parX * -11 : 0
  const py = live ? parY * -8 : 0
  if (mark && !reduced()) {
    mark.style.transform = `translate(-50%, -50%) translate3d(${px.toFixed(1)}px, ${py.toFixed(1)}px, 0)`
  }
  if (Math.abs(parTX - parX) > 0.001 || Math.abs(parTY - parY) > 0.001) {
    raf = requestAnimationFrame(paint)
  }
}

function requestPaint() {
  if (!raf) raf = requestAnimationFrame(paint)
}

function revealControls() {
  // Option 1: wordmark lands, then the four rise under Acidity. No document scroll.
  if (reduced()) {
    document.body.classList.add('is-controls')
    return
  }
  window.setTimeout(() => {
    document.body.classList.add('is-controls')
  }, 980)
}


function wireTilt() {
  const cards = [...document.querySelectorAll<HTMLElement>('[data-tilt]')]
  cards.forEach((card) => {
    const reset = () => {
      card.style.setProperty('--tilt-x', '0deg')
      card.style.setProperty('--tilt-y', '0deg')
    }
    card.addEventListener('pointermove', (e) => {
      if (reduced() || e.pointerType === 'touch' || !fineMq.matches) return
      const r = card.getBoundingClientRect()
      if (!r.width || !r.height) return
      const px = (e.clientX - r.left) / r.width
      const py = (e.clientY - r.top) / r.height
      const rx = (0.5 - py) * 8
      const ry = (px - 0.5) * 10
      card.style.setProperty('--tilt-x', `${rx.toFixed(2)}deg`)
      card.style.setProperty('--tilt-y', `${ry.toFixed(2)}deg`)
    })
    card.addEventListener('pointerleave', reset)
    card.addEventListener('pointercancel', reset)
  })
}

openers.forEach((btn) => {
  btn.addEventListener('click', () => {
    const id = btn.dataset.open
    if (!id || !isGlanceId(id)) return
    setGlance(openId === id ? null : id)
  })
})

closers.forEach((el) => {
  el.addEventListener('click', () => setGlance(null))
})

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && openId) {
    e.preventDefault()
    setGlance(null)
  }
})

function stepCursor() {
  if (!cursorOn || !cursor) return
  curX += (ptrX - curX) * 0.32
  curY += (ptrY - curY) * 0.32
  cursor.style.transform = `translate3d(${curX}px, ${curY}px, 0)`
  cursorRaf = requestAnimationFrame(stepCursor)
}

function setCursorMode() {
  const next = !reduced() && fineMq.matches && hoverMq.matches
  root.classList.toggle('has-cursor', next)
  if (cursorOn && !next) {
    cancelAnimationFrame(cursorRaf)
    cursorRaf = 0
    cursorOn = false
    if (cursor) cursor.style.opacity = '0'
  }
  if (next && !cursorOn) {
    cursorOn = true
    stepCursor()
  }
}

window.addEventListener(
  'pointermove',
  (e) => {
    if (e.pointerType === 'touch') return
    ptrX = e.clientX
    ptrY = e.clientY
    if (cursorOn && cursor) {
      if (!cursorArmed) {
        curX = ptrX
        curY = ptrY
        cursorArmed = true
        cursor.style.opacity = '1'
      }
      const hot = !!(e.target instanceof Element && e.target.closest('a, button'))
      if (hot !== cursorHot) {
        cursorHot = hot
        cursor.classList.toggle('is-hot', hot)
      }
    }
    if (reduced() || openId || !fineMq.matches) return
    parTX = e.clientX / window.innerWidth - 0.5
    parTY = e.clientY / window.innerHeight - 0.5
    requestPaint()
  },
  { passive: true },
)
document.documentElement.addEventListener('pointerleave', () => {
  cursorArmed = false
  if (cursor) cursor.style.opacity = '0'
  parTX = 0
  parTY = 0
  requestPaint()
})

reduceMq.addEventListener('change', () => {
  setCursorMode()
  auroraSync?.()
  if (reduced()) {
    if (mark) mark.style.transform = 'translate(-50%, -50%)'
    document.querySelectorAll<HTMLElement>('[data-tilt]').forEach((card) => {
      card.style.setProperty('--tilt-x', '0deg')
      card.style.setProperty('--tilt-y', '0deg')
    })
    readyType()
  }
  requestPaint()
})
fineMq.addEventListener('change', setCursorMode)
hoverMq.addEventListener('change', setCursorMode)

if (glance) glance.inert = true

setCursorMode()
startAurora()
wireTilt()
revealControls()
waitForAnurati()
requestPaint()
