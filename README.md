# Learning for Rachel

A Duolingo-style learning platform. It started as a Bengali app for one learner
and is now **multi-course**: a rebuilt 19-unit Bengali course, Spanish for Peru,
a full 131-unit research-grounded Spanish course, Malayalam, and bite-size
History chapters. Bengali is one course among several, not the identity of the
app.

> The repo directory and the localStorage key still say "bengali" for historical
> reasons. See the handoff doc before renaming anything — the storage key must
> stay stable or learners lose their progress.

## Docs

- **[docs/HANDOFF.md](docs/HANDOFF.md)** — the full handoff: architecture,
  curricula, the Spanish curriculum pipeline, the lesson engine, local progress,
  and the **audio protocol**. Start here.
- `AGENTS.md` — quick guide for coding agents working in this repo.

## Stack

- Next.js 16 (App Router, webpack) · React 19 · TypeScript (strict) · Tailwind v4
- Local browser progress (`localStorage`); Supabase-ready SQL in `db/` (not live)

## Features

- **Learn / Practice / Progress** — three places, plus a course chip for
  switching between courses
- Unit-based lesson path that scales from 16 lessons to 786 (section browsing,
  windowed units, jump-to-unit)
- Distraction-free lessons: exit, progress, exercise, audio — nothing else
- Generated exercises (recognize, produce, word-bank, cloze, ordering,
  listening, dialogue, grammar) driven by per-course capabilities
- **Cumulative courses (Spanish and Bengali)**: each lesson introduces a few new
  items and keeps retrieving earlier ones, the lesson types do genuinely
  different work, grammar is explained then drilled, and mistakes come back
  later in a different format (see HANDOFF §5a)
- **Bengali, rebuilt**: 19 sequenced units and 96 lessons with named grammar,
  discovery cards, mini-stories and thirteen conversations, in colloquial
  Bangladeshi Bengali that teaches `tumi` and `apni` as the different things
  they are (HANDOFF §5c)
- Spaced repetition, mistake review, unit checkpoints, word bank — surfaced in
  one Practice hub
- Progress built on real signals: completion, phrases in memory, recall
  strength, accuracy, weak units, activity
- Adaptive placement test, XP/gems/streaks, installable offline PWA

## Run

```bash
npm run dev     # http://localhost:3000
npm run lint
npm test        # progress migration, streaks, registry, review policy, lesson engine
npm run build   # if SWC fails locally, use the WASM fallback in docs/HANDOFF.md §2
```

## Curriculum pipeline

```bash
npm run validate:curriculum        # validate every curriculum pack against its schema
npm run seed:curriculum            # build the DB-ready seed bundle (db/seed/)
npm run build:course-index         # regenerate the lightweight navigation index
npm run test:exercise-generation   # exercise-generator tests
npm run audit:curriculum           # pedagogical audit of both cumulative courses
npm run dump:lesson <lessonId>     # print the steps a learner actually sees
```

## Local progress

Stored in `localStorage` under `learn-bengali-rachel-progress`, per course
(completed lessons, XP, streaks, mistakes, spaced-repetition memory, practice
days, answer counts). Keep this key stable and keep the shape
backward-compatible — `npm test` checks that older saves still load.

## Licence

Released under the [MIT License](LICENSE).
