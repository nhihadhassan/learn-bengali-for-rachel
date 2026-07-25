# Learn Bengali for Rachel

A Duolingo-style language-learning web app. It started as a Bengali app for one
learner and is now **multi-language**: Bengali, Spanish (including a full
131-unit research-grounded course), Malayalam, and bite-size History lessons.

> The repo name and the localStorage key still say "bengali" for historical
> reasons — the app is multi-curriculum now. See the handoff doc before renaming
> anything.

## Docs

- **[docs/HANDOFF.md](docs/HANDOFF.md)** — the full handoff: architecture,
  curricula, the Spanish curriculum pipeline, the lesson engine, local progress,
  and the **audio protocol**. Start here.
- `AGENTS.md` — quick guide for coding agents working in this repo.

## Stack

- Next.js 16 (App Router, webpack) · React 19 · TypeScript (strict) · Tailwind v4
- Local browser progress (`localStorage`); Supabase-ready SQL in `db/` (not live)

## Features

- Unit-based lesson path with generated exercises (recognize, produce, word-bank,
  cloze, ordering, listening)
- XP, streaks, lesson completion, mistake review, spaced-repetition practice
- Adaptive placement test, per-lesson tips, unit-review checkpoints
- Learned Words vocabulary review
- Installable PWA with offline support for visited lessons

## Run

```bash
npm run dev     # http://localhost:3000
npm run lint
npm run build   # if SWC fails locally, use the WASM fallback in docs/HANDOFF.md §2
```

## Curriculum pipeline (Spanish)

```bash
npm run validate:curriculum        # validate content/spanish-curriculum.json
npm run seed:curriculum            # build the DB-ready seed bundle (db/seed/)
npm run test:exercise-generation   # exercise-generator tests
```

## Local progress

Stored in `localStorage` under `learn-bengali-rachel-progress`, per curriculum
(completed lessons, XP, streaks, mistakes, spaced-repetition memory). Keep this
key stable and keep the shape backward-compatible.
