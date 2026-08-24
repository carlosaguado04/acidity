# Acidity

Studio site for [acidity.lol](https://acidity.lol) — indie software behind Mise, Vela, and whatever is next on the line.

## Run locally

```bash
npm install
npm run dev
```

Open the URL Vite prints (default `http://localhost:5173`).

On this box, Bun also works: `bun install && bun run dev`.

## Scripts

- `npm run dev` — Dev server with HMR
- `npm run build` — Typecheck + production build
- `npm run preview` — Preview the production build

## Stack

- Vite + TypeScript
- Three.js hero (wire crystal + soft core, pointer-aware, respects `prefers-reduced-motion`)
- System SF / Helvetica Neue stack — no web fonts
- Dark-first theme with light mode toggle

## Brand notes

Dark face tokens: ink `#0C0D10`, raised `#16181D`, edge `#23262C`, paper `#F4F4F2`, acid `#D8FF47`. Acid is used sparingly (tags, focus, primary CTA).
