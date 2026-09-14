import './style.css'

const root = document.documentElement
const reduceMq = window.matchMedia('(prefers-reduced-motion: reduce)')
const fineMq = window.matchMedia('(pointer: fine)')
const hoverMq = window.matchMedia('(hover: hover)')

type ShelfId = 'apps' | 'work' | 'contact'

const home = document.getElementById('main')
const scrim = document.querySelector<HTMLElement>('.scrim')
const shelves = [...document.querySelectorAll<HTMLElement>('[data-shelf]')]
const openers = [...document.querySelectorAll<HTMLAnchorElement>('[data-open]')]
const closers = [...document.querySelectorAll('[data-close]')]
const wash = document.querySelector<HTMLElement>('[data-scroll-wash]')
const mark = document.querySelector<HTMLElement>('[data-mark]')
const cursor = document.querySelector<HTMLElement>('.cursor')
const auroraCanvas = document.querySelector<HTMLCanvasElement>('[data-aurora-canvas]')
let auroraSync: (() => void) | null = null

let lastFocus: HTMLElement | null = null
let openId: ShelfId | null = null
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
  for(int i=0;i<5;i++){ v += a*noise(p); p = p*2.02 + vec2(1.7,9.2); a *= 0.5; }
  return v;
}
void main(){
  vec2 uv = gl_FragCoord.xy / u_res;
  uv.x *= u_res.x / u_res.y;
  float t = u_t * 0.125;
  // traveling liquid field — visible from across the room
  vec2 p = uv * 2.4 + vec2(t * 0.55, -t * 0.32);
  float n = fbm(p);
  float m = fbm(p * 1.35 + vec2(-t * 0.4, t * 0.55));
  float field = smoothstep(0.28, 0.78, n * 0.65 + m * 0.55);
  // soft ribbon / pool bias like the clip path
  float ribbon = smoothstep(0.15, 0.85, 1.0 - abs(uv.y - (0.55 + 0.28 * sin(t * 0.7 + uv.x * 1.8))));
  float glow = field * (0.55 + 0.45 * ribbon);
  glow = pow(glow, 0.92);
  vec3 ink = vec3(0.047, 0.051, 0.063);
  vec3 pink = vec3(0.894, 0.0, 0.486);
  vec3 col = mix(ink, pink, glow * 0.92);
  // slight hot core
  col = mix(col, pink, glow * glow * 0.35);
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
    const dpr = Math.min(window.devicePixelRatio || 1, 1.75)
    const w = Math.max(1, Math.floor(window.innerWidth * dpr))
    const h = Math.max(1, Math.floor(window.innerHeight * dpr))
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

function isShelfId(value: string): value is ShelfId {
  return value === 'apps' || value === 'work' || value === 'contact'
}

function shelfFromPath(): ShelfId | null {
  const path = window.location.pathname.replace(/\/+$/, '') || '/'
  if (path === '/apps') return 'apps'
  if (path === '/work') return 'work'
  if (path === '/contact') return 'contact'
  return null
}

function titleFor(id: ShelfId | null) {
  if (id === 'apps') return 'Apps — Acidity'
  if (id === 'work') return 'Work — Acidity'
  if (id === 'contact') return 'Contact — Acidity'
  return 'Acidity'
}

function setShelf(id: ShelfId | null, push = false) {
  const was = openId
  openId = id
  document.body.classList.toggle('is-shelf', id !== null)
  if (scrim) scrim.hidden = id === null
  if (home) home.inert = id !== null

  shelves.forEach((el) => {
    const on = el.dataset.shelf === id
    el.classList.toggle('is-on', on)
    el.setAttribute('aria-hidden', String(!on))
  })
  openers.forEach((a) => {
    a.setAttribute('aria-expanded', String(a.dataset.open === id))
  })

  document.title = titleFor(id)

  if (id) {
    if (!was) {
      lastFocus =
        document.activeElement instanceof HTMLElement ? document.activeElement : openers[0] ?? null
    }
    const panel = shelves.find((el) => el.dataset.shelf === id)
    panel?.focus({ preventScroll: true })
    if (push) {
      const href = `/${id}`
      if (window.location.pathname.replace(/\/+$/, '') !== href) {
        history.pushState({ shelf: id }, '', href)
      }
    }
  } else {
    lastFocus?.focus()
    lastFocus = null
    if (push && shelfFromPath()) history.pushState({ shelf: null }, '', '/')
  }
  requestPaint()
}

function progress() {
  const h = window.innerHeight || 1
  return Math.min(1, Math.max(0, window.scrollY / (h * 0.92)))
}

function easeOut(t: number) {
  return 1 - (1 - t) ** 2
}

function paint() {
  raf = 0
  parX += (parTX - parX) * 0.08
  parY += (parTY - parY) * 0.08
  const e = easeOut(progress())
  const scale = 1 - e * 0.78
  const lift = e * window.innerHeight * -0.47
  const live = !openId && !reduced() && fineMq.matches
  const px = live ? parX * -11 * (1 - e * 0.65) : 0
  const py = live ? parY * -8 * (1 - e * 0.65) : 0
  if (mark) {
    mark.style.transform = `translate(-50%, -50%) translate3d(${px.toFixed(1)}px, ${(lift + py).toFixed(1)}px, 0) scale(${scale.toFixed(4)})`
  }
  if (wash && !reduced()) {
    wash.style.transform = `translate3d(0, ${(window.scrollY * 0.16).toFixed(1)}px, 0)`
  }
  if (Math.abs(parTX - parX) > 0.001 || Math.abs(parTY - parY) > 0.001) {
    raf = requestAnimationFrame(paint)
  }
}

function requestPaint() {
  if (!raf) raf = requestAnimationFrame(paint)
}

function prepareWords() {
  if (reduced()) return
  document.querySelectorAll<HTMLElement>('.letter p[data-enter]').forEach((p) => {
    const raw = p.textContent ?? ''
    p.textContent = ''
    let i = 0
    raw.split(/(\s+)/).forEach((chunk) => {
      if (!chunk) return
      if (/^\s+$/.test(chunk)) {
        p.append(chunk)
        return
      }
      const span = document.createElement('span')
      span.className = 'word'
      span.textContent = chunk
      span.style.setProperty('--i', String(i))
      i += 1
      p.append(span)
    })
  })
}

function watchEnter() {
  const nodes = [...document.querySelectorAll<HTMLElement>('[data-enter]')]
  if (reduced()) {
    nodes.forEach((el) => el.classList.add('is-in'))
    return
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        entry.target.classList.add('is-in')
        io.unobserve(entry.target)
      }
    },
    { threshold: 0.18, rootMargin: '0px 0px -8% 0px' },
  )
  nodes.forEach((el) => io.observe(el))
}

openers.forEach((a) => {
  a.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
      return
    }
    const id = a.dataset.open
    if (!id || !isShelfId(id)) return
    e.preventDefault()
    setShelf(id, true)
  })
})

closers.forEach((el) => {
  el.addEventListener('click', () => setShelf(null, true))
})

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && openId) {
    e.preventDefault()
    setShelf(null, true)
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

window.addEventListener('popstate', () => setShelf(shelfFromPath()))
window.addEventListener('scroll', requestPaint, { passive: true })
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
    if (wash) wash.style.transform = 'none'
    document.querySelectorAll('[data-enter]').forEach((el) => el.classList.add('is-in'))
    readyType()
  }
  requestPaint()
})
fineMq.addEventListener('change', setCursorMode)
hoverMq.addEventListener('change', setCursorMode)

function wireForm() {
  const form = document.querySelector<HTMLFormElement>('[data-contact-form]')
  const status = document.querySelector<HTMLElement>('[data-form-status]')
  if (!form || !status) return

  const send = form.querySelector<HTMLButtonElement>('.form-send')

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    const data = new FormData(form)
    if (String(data.get('_honey') ?? '')) return
    const name = String(data.get('name') ?? '').trim()
    const email = String(data.get('email') ?? '').trim()
    const message = String(data.get('message') ?? '').trim()
    if (!name || !email || !message) {
      status.hidden = false
      status.classList.remove('is-ok')
      status.textContent = 'Name, email, and a message.'
      return
    }
    if (send) send.disabled = true
    status.hidden = false
    status.classList.remove('is-ok')
    status.textContent = 'Sending…'
    try {
      const res = await fetch('https://formsubmit.co/ajax/hello@acidity.lol', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          name,
          email,
          message,
          _subject: 'Acidity.lol',
          _template: 'table',
          _captcha: false,
        }),
      })
      if (!res.ok) throw new Error('send failed')
      form.reset()
      status.classList.add('is-ok')
      status.textContent = 'Sent. I’ll read it.'
    } catch {
      status.classList.remove('is-ok')
      status.textContent = 'Didn’t go through. Use hello@acidity.lol.'
    } finally {
      if (send) send.disabled = false
    }
  })
}

setCursorMode()
startAurora()
setShelf(shelfFromPath())
prepareWords()
watchEnter()
wireForm()
waitForAnurati()
requestPaint()
