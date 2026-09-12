import './style.css'

const root = document.documentElement
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)')

function ready() {
  root.classList.remove('is-pending')
  root.classList.add('is-ready')
}

if (reduce.matches) {
  ready()
} else {
  const done = Promise.race([
    document.fonts.ready,
    new Promise<void>((resolve) => {
      window.setTimeout(resolve, 1200)
    }),
  ])
  void done.then(ready)
}

reduce.addEventListener('change', (e) => {
  if (e.matches) ready()
})
