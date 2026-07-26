# Project Handoff — Language Learning App ("Learn Bengali for Rachel")

A Duolingo-style language-learning web app. It began as a Bengali app for one
learner (Rachel) and has grown into a **multi-language** app that also teaches
Spanish (including a full 131-unit, research-grounded course), Malayalam, and
bite-size History lessons. This document is the single source of truth for how
the app is put together and how to work on it.

> Naming note: the repo, the localStorage key, and some legacy identifiers still
> say "bengali". That's historical — the app is multi-curriculum now. Don't rename
> these without a migration; the storage key in particular must stay stable or
> learners lose their progress.

---

## 1. What the app is

- A mobile-first lesson app: a lesson path of units → lessons, each lesson a
  sequence of short exercises (recognize, produce, word-bank, listening, etc.).
- Progress (XP, streaks, completed lessons, mistakes, spaced-repetition memory)
  is stored **locally in the browser** — there is no live backend yet.
- Installable as a PWA and works offline for already-visited lessons.

### Curricula (the language/subject the learner picks)

Registered in `src/lib/content.ts` as `curricula`; switch via the language menu.

| id             | Label                  | Source                                   | Notes |
|----------------|------------------------|------------------------------------------|-------|
| `bengali`      | Bengali                | `content/learn-bengali.json`             | Original course; default. |
| `spanish-peru` | Spanish for Peru       | `content/learn-spanish-peru.json`        | Travel Spanish. |
| `spanish`      | Spanish (full course)  | `content/spanish-curriculum.json`        | **131 units / 786 lessons**, generated from the curriculum pipeline (§4). |
| `malayalam`    | Malayalam              | `content/learn-malayalam.json`           | |
| `history`      | History                | `content/learn-history.json`             | `mode: "history"` — story cards, not language drills. |

---

## 2. Stack & how to run

- **Next.js 16** (App Router, **webpack**), **React 19**, **TypeScript** (strict),
  **Tailwind CSS v4**.
- Path alias: `@/*` → `src/*`.
- Supabase-ready SQL lives in `db/`, but **no live database** is wired in.

```bash
npm run dev        # local dev server (http://localhost:3000)
npm run lint       # eslint
npm run build      # production build
```

**Production build in this environment** may need the WASM SWC fallback:

```bash
NEXT_TEST_WASM=1 NEXT_TEST_WASM_DIR="$PWD/node_modules/@next/swc-wasm-nodejs" npm run build
```

Curriculum pipeline scripts (see §4):

```bash
npm run validate:curriculum        # validate the Spanish pack against its schema
npm run seed:curriculum            # build the DB-ready seed bundle (db/seed/, gitignored)
npm run test:exercise-generation   # node:test suite for the exercise generators
```

**Deployment:** Vercel (preview per PR, production on merge). The full Spanish
course's 786 lesson pages are **not** prerendered — `generateStaticParams` in
`src/app/practice/[lessonId]/page.tsx` intentionally excludes `curriculumId ===
"spanish"`, so those render on demand (`dynamicParams`) and are cached. This keeps
build time/output reasonable.

---

## 3. Architecture map

```
content/*.json ──► src/lib/content.ts ──► curricula[]  ─┐
                                                        │
content/spanish-curriculum.json ─► src/lib/spanish-curriculum.ts (adapter) ─┘
                                                        │
                            Unit → Lesson → Phrase model (src/types/learning.ts)
                                                        │
              src/components/lesson/lesson-flow.tsx ──► buildLessonSteps()
                                                        │  (generates exercises
                                                        │   from a lesson's phrases)
                                                        ▼
                     recognize / produce / order / complete / translate /
                     listen / dialogue / (exercise) steps  →  rendered UI
```

Key files:

- `src/lib/content.ts` — registers curricula and exposes lookups (`getLesson`,
  `getCurriculumForLesson`, `getLessonsForCurriculum`, …).
- `src/types/learning.ts` — the app's core types: `CurriculumId`, `Curriculum`,
  `Unit`, `Lesson`, `Phrase`, `Exercise`, `ProgressState`, etc.
- `src/lib/spanish-curriculum.ts` — **adapter** that converts the Spanish
  curriculum pack (`Course` shape) into the app's `Unit`/`Lesson`/`Phrase`
  model. Each lesson's phrases are drawn from its `content_focus` vocabulary +
  phrase patterns, interleaved so the taught set mixes words and full sentences.
- `src/components/lesson/lesson-flow.tsx` — **the lesson engine**.
  `buildLessonSteps()` turns a lesson's phrases into the actual question steps
  (this is why adding phrase data automatically produces exercises — see §5).
- `src/lib/progress-store.ts` — local progress (see §6).
- `src/lib/pronunciation.ts` — **audio** (see §7). Do not create a second TTS path.
- `src/components/lesson/speaker-button.tsx` — the speaker UI that calls the
  pronunciation module.

### Routes (`src/app/`)

`/` home · `/lessons` lesson path · `/practice/[lessonId]` a lesson ·
`/review` + `/strengthen` spaced-repetition practice · `/unit-review/[unitId]`
unit checkpoint · `/placement` adaptive placement test · `/progress` ·
`/vocabulary` learned words · `/roleplay` + `/api/roleplay` (behind a flag).

---

## 4. The Spanish curriculum pipeline (`src/curriculum/`)

This is the machinery that turns the research-grounded curriculum data file into
validated, database-ready, exercise-bearing content. It follows the rules in the
pack's `CLAUDE.md` (never label as official Duolingo content; preserve each
unit's `provenance`; validate before seeding; stable external ids + separate
internal ids; keep Spanish accents; answers are arrays, not single strings).

| File | Role |
|------|------|
| `src/curriculum/types.ts` | Types for the pack (`Course`/`Unit`/`Lesson`/…) and generated output. |
| `src/curriculum/loader.ts` | fs-based reader + lookups for `content/spanish-curriculum.json`. |
| `src/curriculum/validate.ts` | Zero-dependency JSON-Schema validator (the subset the pack uses). |
| `src/curriculum/rng.ts` | Deterministic PRNG (FNV-1a + mulberry32) for reproducible generation. |
| `src/curriculum/generators.ts` | Four exercise generators: `match_pairs`, `fill_blank`, `word_bank_translation`, `dialogue_response`. Deterministic; answers normalized (accents preserved). |
| `src/curriculum/seed.ts` | `buildSeedBundle()` → normalized rows; external ids from the pack, internal UUIDs generated deterministically; provenance preserved. |
| `db/curriculum-schema.sql` / `db/curriculum-policies.sql` | Catalog tables (external_id + internal uuid) + public-read RLS. |
| `scripts/validate-curriculum.ts` / `seed-curriculum.ts` / `exercise-generation.test.ts` | CLI entry points behind the npm scripts above. |

**Important:** this pipeline is the *offline/authoring* path (validation, seeding,
tests). The **live app does not import it**. The app surfaces the Spanish course
through the lightweight read-side adapter (`src/lib/spanish-curriculum.ts`), which
reads the same JSON. The generators are the reference for how exercises *should*
be built; the runtime lesson engine (`buildLessonSteps`) currently builds its own
equivalents from phrases.

---

## 5. How lessons are made (there is no per-lesson authoring)

For the Spanish course, **you do not hand-write 786 lessons.** They are generated
from data. To change what learners see, pull one of three levers:

1. **Curriculum data** (`content/spanish-curriculum.json`) — add/adjust
   vocabulary and phrase patterns in a unit; every phrase becomes more questions.
   Adding a unit adds a whole set of lessons for free.
2. **Generators / lesson engine** — `buildLessonSteps()` in `lesson-flow.tsx`
   (runtime) and `src/curriculum/generators.ts` (pipeline) control *how* questions
   are built. One change improves all lessons at once.
3. **Adapter** (`src/lib/spanish-curriculum.ts`) — controls how many phrases a
   lesson teaches, ordering, and difficulty labels.

Step types produced by the engine: `intro`, `learn`, `recognize` (target→English),
`produce` (English→target), `order` (arrange word bank), `complete` (cloze),
`translate` (word-bank translation), `listen` (tap what you hear), `dialogue`
(pick the reply), `exercise` (any pre-authored `lesson.exercises`). `speak`
(pronunciation practice) exists but is archived (`INCLUDE_SPEAKING_PRACTICE`).

### Feature flags (`src/lib/feature-flags.ts`)

Unfinished features ship "dark" and flip on via a flag:

- `explainMyAnswer: true` — live.
- `listening: false` — **but enabled per-curriculum for `spanish`** directly in
  `buildLessonSteps` (Spanish browser voices are reliable; romanized
  Bengali/Malayalam are not, which is why the global flag stays off).
- `dialogue: false`, `aiRoleplay: false` — scaffolded, awaiting testing / a
  provider decision.

---

## 6. Local progress (`src/lib/progress-store.ts`)

- Persisted in `localStorage` under **`learn-bengali-rachel-progress`** (keep this
  key stable).
- Progress is **per curriculum**: `{ activeCurriculumId, byCurriculum: { bengali,
  history, malayalam, "spanish-peru", spanish } }`. When you add a curriculum id,
  update `CurriculumId` (in `src/types/learning.ts`), the three `byCurriculum`
  literals + `normalizeCurriculumId` here, and the switcher guard in
  `src/components/layout/app-shell.tsx`.
- `ProgressState` holds completed lessons, XP, gems, streak, mistakes, skipped
  listening, and `phraseMemory` (Leitner boxes for spaced repetition).
- `normalizeProgress`/`normalizeStore` keep old saved data **backward-compatible**
  — always add new fields defensively.

---

## 7. Audio protocol (`src/lib/pronunciation.ts`)

All audio goes through **one module** — never add a second TTS path. The UI entry
point is `SpeakerButton`, which calls `playPronunciation({ romanized, locale, …})`.

### Two providers, tried in order

1. **Recorded audio** (`recorded-audio`) — used first **if** the phrase has an
   `audioFile` or `audioUrl`. Recorded files live under
   `public/audio/<language>/` (e.g. `public/audio/bengali/kemon-acho.mp3`).
   Prefer `audioFile` for new recordings; `audioUrl` is legacy.
2. **Browser TTS** (`browser-tts`) — the fallback, using the Web Speech API
   (`speechSynthesis`). This is what most phrases use, since most have no recorded
   file. Voices are ranked per locale (`rankVoice`) to pick the best available
   Spanish / Bengali / Malayalam voice; `getSpeechSettings` sets rate/pitch per
   language (Spanish speaks at rate 0.84).

For romanized Bengali specifically, TTS is **skipped** unless Bengali script is
available, to avoid English-sounding mispronunciation.

### The cold-start fix (why the first tap used to say "unavailable")

Browsers (Chrome/Safari especially) routinely drop the **first** `speak()` after a
page load: voices aren't loaded yet, the engine is cold, and the synth can start
*paused*, so `onstart` never fires and the call looked like a failure — hence
"unavailable on the first tap, works on the second." Three mitigations now live in
`pronunciation.ts`:

1. **Warm-up on first gesture** — on the first `pointerdown`/`keydown` anywhere,
   `warmUpSpeech()` preloads voices and resumes the synth, so it's ready before the
   first speaker tap.
2. **Transparent retry** — `browserTtsProvider.speak` tries to speak; if the first
   attempt doesn't start, it cancels/resumes and retries once. A single tap
   succeeds instead of needing two.
3. **Lenient start detection** — the watchdog treats a `speaking`/`pending`
   utterance as started (some engines never fire `onstart`), with a ~2.4s window,
   rather than reporting failure.

### API surface

- `playPronunciation(input) => PronunciationResult` — main entry (recorded → TTS).
- `stopPronunciation()` — stop current audio/speech.
- `getPronunciationDiagnostics(locale)` and, in the browser console,
  `window.learnBengaliPronunciation.{diagnose,listVoices,getBestVoice,speak}` —
  for debugging which voices exist and what got picked.

### Caveats

- **Available voices depend on the user's OS/browser.** If a device has no Spanish
  voice at all, TTS falls back to a generic voice or reports unavailable; that's a
  platform limitation, not an app bug.
- Headless/CI browsers have **no audio engine**, so TTS can't be verified
  automatically — audio changes must be tested on a real device / the Vercel
  preview.

---

## 8. Development rules

- **Dynamic lesson flow (non-negotiable).** Never test a word in the step
  immediately after introducing it — no "here is *adios*" card followed by a
  "what does *adios* mean?" question. Teaching and testing must be spaced:
  introduce items, let other steps happen, then check recall. In
  `buildLessonSteps` this is the `TEACH_TEST_LAG` (comprehension checks lag the
  teach cards). Keep mixing question types (recognize, produce, word bank, cloze,
  ordering, listening, dialogue) rather than repeating one format.
- Preserve XP, streaks, lesson completion, mistake review, and learned-word
  persistence unless explicitly asked to change them.
- Keep the local progress shape **backward-compatible** when adding fields.
- Keep UI **mobile-first** and simple; prefer existing components before adding new
  ones.
- Display romanized text to learners; pass script (e.g. Bengali) to pronunciation
  when available.
- For the Spanish pack, follow its `CLAUDE.md` content rules (provenance, accents,
  answer arrays, validate-before-seed, no "official Duolingo" labeling).
- Run `npm run lint` and the (WASM) build after code changes. For pipeline changes,
  also run the three curriculum scripts.

---

## 9. Suggested next steps

- **Placement → jump into the Spanish course** so a learner starts at their level.
- **Recorded audio** for high-frequency Spanish phrases (drop files in
  `public/audio/spanish/` and set `audioFile`), for quality beyond TTS.
- **Smarter dialogue** using the pack's `dialogue_response` generator (real Q&A
  pairs) before enabling the `dialogue` step for Spanish.
- **Content spot-check** across a sample of the 131 units for accuracy.
- Longer term: wire a real Supabase backend using `db/` schema so progress syncs
  across devices.
