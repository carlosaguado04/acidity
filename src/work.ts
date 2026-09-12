import './style.css'

const ids = ['mise', 'orza', 'hilo'] as const
type SlideId = (typeof ids)[number]

const stage = document.querySelector<HTMLElement>('[data-stage]')
const slides = [...document.querySelectorAll<HTMLElement>('[data-slide]')]
const picks = [...document.querySelectorAll<HTMLButtonElement>('[data-go]')]

function isSlideId(value: string): value is SlideId {
  return (ids as readonly string[]).includes(value)
}

function idFromHash(): SlideId {
  const raw = window.location.hash.replace('#', '')
  return isSlideId(raw) ? raw : 'mise'
}

function show(id: SlideId, push = false) {
  slides.forEach((slide) => {
    const on = slide.dataset.slide === id
    slide.classList.toggle('is-on', on)
    slide.inert = !on
    slide.setAttribute('aria-hidden', String(!on))
  })
  picks.forEach((btn) => {
    const on = btn.dataset.go === id
    if (on) btn.setAttribute('aria-current', 'true')
    else btn.removeAttribute('aria-current')
  })
  if (picks.some((btn) => btn === document.activeElement)) {
    picks.find((btn) => btn.dataset.go === id)?.focus()
  }
  const hash = `#${id}`
  if (push && location.hash !== hash) history.pushState(null, '', hash)
}

function step(dir: 1 | -1) {
  const current = slides.find((s) => s.classList.contains('is-on'))?.dataset.slide
  const i = ids.indexOf(current && isSlideId(current) ? current : 'mise')
  const next = ids[(i + dir + ids.length) % ids.length]
  if (next) show(next, true)
}

function loadCrop(slot: HTMLElement) {
  const id = slot.dataset.crop
  if (!id) return
  const candidates = [`/apps/${id}-crop.webp`, `/apps/${id}-crop.png`]
  const probe = (i: number) => {
    const src = candidates[i]
    if (!src) return
    const probeImg = new Image()
    probeImg.onload = () => {
      const img = document.createElement('img')
      img.src = src
      img.alt = ''
      img.decoding = 'async'
      slot.append(img)
      slot.hidden = false
      slot.closest('.slide')?.classList.add('has-crop')
    }
    probeImg.onerror = () => probe(i + 1)
    probeImg.src = src
  }
  probe(0)
}

picks.forEach((btn) => {
  btn.addEventListener('click', () => {
    const id = btn.dataset.go
    if (id && isSlideId(id)) show(id, true)
  })
})

window.addEventListener('keydown', (e) => {
  if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return
  const t = e.target
  if (t instanceof HTMLElement) {
    const tag = t.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable) {
      return
    }
  }
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'PageDown') {
    e.preventDefault()
    step(1)
  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') {
    e.preventDefault()
    step(-1)
  } else if (e.key === 'Home') {
    e.preventDefault()
    show('mise', true)
  } else if (e.key === 'End') {
    e.preventDefault()
    show('hilo', true)
  }
})

window.addEventListener('hashchange', () => show(idFromHash()))

document.querySelectorAll<HTMLElement>('[data-crop]').forEach(loadCrop)

if (stage) {
  let x0: number | null = null
  stage.addEventListener(
    'pointerdown',
    (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      x0 = e.clientX
    },
    { passive: true },
  )
  stage.addEventListener(
    'pointerup',
    (e) => {
      if (x0 === null) return
      const dx = e.clientX - x0
      x0 = null
      if (Math.abs(dx) < 48) return
      step(dx < 0 ? 1 : -1)
    },
    { passive: true },
  )
}

show(idFromHash())
