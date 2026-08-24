# Agent Guide

## Project

**Learning for Rachel** is a Next.js App Router learning platform. It began as a
Bengali app for one learner and now hosts several courses — Bengali, Spanish for
Peru, a full 131-unit Spanish course, Malayalam, and History chapters. Bengali is
one course, not the identity of the app.

Read **[docs/HANDOFF.md](docs/HANDOFF.md)** first; it is the source of truth.

## Stack

- Next.js 16 App Router (webpack) · React 19 · TypeScript (strict) · Tailwind v4
- Local JSON lesson content in `content/`
- Local browser progress via `localStorage`
- Supabase-ready schema/client boundaries, but no live Supabase dependency yet

## Commands

```bash
npm run dev
npm run lint
npm test
npm run build
npm audit --audit-level=moderate
```

In this environment, production build may need the existing WASM SWC fallback:

```bash
NEXT_TEST_WASM=1 NEXT_TEST_WASM_DIR="$PWD/node_modules/@next/swc-wasm-nodejs" npm run build
```

## Architecture Notes

- **`src/lib/courses.ts` is the course registry** — ids, labels, locales, nouns,
  accents and capabilities. Metadata only; it costs nothing to import.
- **`src/lib/course-index.ts`** is the generated titles-only outline
  (`content/course-index.json`). Navigation, the lesson path and progress maths
  read this.
- **`src/lib/content.ts` is heavy** (~1.2MB, mostly the Spanish pack). Import it
  only where real phrases/exercises are needed. `src/lib/core-content.ts` is the
  narrower door for the four hand-authored curricula.
- **`src/lib/lesson-steps.ts` is the lesson engine** — pure, no React, and
  tested. `lesson-flow.tsx` only handles state, answers and persistence;
  renderers live in `src/components/lesson/steps/`. It has **two paths**:
  cumulative (courses with `lessonStrategy: "cumulative"`, which carry a
  `Lesson.plan`) and the original phrase-book path for everything else.
- **`src/lib/curriculum-plan.ts` decides what a lesson teaches and revisits**;
  `src/lib/lesson-profiles.ts` is the config table that makes the Spanish lesson
  types different; `src/lib/learner-model.ts` turns saved progress into
  new/weak/due/strong (deriving everything from `review-policy.ts`).
- **`src/lib/learning-state.ts` decides *how hard* to ask** about an item, from
  what the learner has done with it. Derived, never a second scheduler, and it
  never chooses what to review. A brand-new item is **off** the ladder, not at
  the bottom of it — what to ask about a word taught ninety seconds ago is the
  profile's business.
- **Units 1-12 of Spanish come from `content/spanish-pilot.json`**, spliced over
  the head of the path behind `FEATURES.spanishPilotV2`. A pilot unit is a pack
  unit with extra optional fields, so one adapter and one planner walk cover
  both halves — which is what keeps Unit 13's interleaved review working across
  the seam. `content/spanish-curriculum.json` is never edited. See HANDOFF §5b.
- `src/lib/distractors.ts` owns wrong-answer selection; `src/lib/rng.ts` is the
  one seeded PRNG (`src/curriculum/rng.ts` re-exports it).
- **`src/lib/spanish-lexicon.ts` decides what counts as already known** —
  authored irregular verb forms plus computed plurals/gender pairs. Pass it as
  `resolveKnown` rather than importing it into `curriculum-plan`, which stays
  language-agnostic.
- **A unit's grammar is declared, not derived**: `grammar_focus` in
  `content/spanish-curriculum.json`, gated on the pattern having been met and
  the examples being readable. Un-authored units rank their targets by the
  evidence the unit shows. Never reintroduce index arithmetic here. A unit is
  **not** required to have a grammar lesson at all.
- **No two units may teach the same phrase set.** A third of the course once
  did; `npm test` fails if it happens again.
- `src/lib/review-policy.ts` owns spaced repetition. Nothing else defines
  intervals.
- `src/lib/date-keys.ts` owns calendar days. Never use `toISOString()` for a
  streak.
- `src/lib/progress-store.ts` holds progress, persisted under
  `learn-bengali-rachel-progress`.
- `src/lib/pronunciation.ts` is the only TTS path; do not create a second.
- Reusable UI primitives live in `src/components/ui/`.

## Content Model

Phrase objects should use:

```json
{
  "id": "p-kemon-acho",
  "romanized": "kemon acho",
  "bengaliScript": "কেমন আছো",
  "english": "how are you",
  "pronunciation": "KEH-mon AH-cho",
  "category": "greetings",
  "audioFile": "/audio/bengali/kemon-acho.mp3"
}
```

`audioFile` is optional and preferred for new custom recordings. `audioUrl` is
still supported for older content. Put new recorded files under
`public/audio/<language>/`.

## Development Rules

- **Dynamic lesson flow is required**: never test a word in the step right after
  it is introduced. See `TEACH_TEST_LAG` in `src/lib/lesson-steps.ts`; `npm test`
  enforces it. Keep mixing question types.
- **Branch on capabilities, not ids.** Ask
  `getCapabilities(courseId).listening`, never `courseId === "spanish"`. Add a
  capability to the registry if one is missing.
- **Adding a course** = a registry entry in `src/lib/courses.ts`, one line in
  `UNIT_SOURCES` in `src/lib/content.ts`, and `npm run build:course-index`.
  Nothing else — the progress store, shell and course menu follow the registry.
- **Regenerate the course index** after any content change, or `npm test` fails.
- Keep navigation off `@/lib/content`; use `@/lib/course-index` for titles/counts.
- Preserve XP, streaks, lesson completion, mistake review, and learned-word
  persistence unless explicitly asked to change them.
- Keep local progress **backward-compatible** when adding fields, and add a case
  to `scripts/progress-store.test.ts`.
- Display romanized text to learners, but pass native script to pronunciation
  when available.
- Keep UI mobile-first; prefer existing components before adding new ones.
- **Never repeat a question inside a lesson.** Every part of a planned lesson
  shares one `usage` map; `npm test` asserts no lesson asks the same
  (format, phrase) twice. Same for `TEACH_TEST_LAG`, and for
  `MIN_RETRIEVAL_GAP` — two questions about the same item may not sit next to
  each other.
- **Address lessons by path position and kind, not by id.** Ids move when units
  are replaced; every test that named `es-en-s01-u001-l1` broke at once.
- **Mistake recycling must not change the step count.** Slots are reserved and
  rewritten, so the progress bar only moves forward.
- After touching the Spanish curriculum or the plan layer, run
  `npm run audit:curriculum` — every finding, in any section, fails the run. It
  also builds every pilot lesson's real steps, twice, and fails on recognition
  dominance, low format variety, a lesson with no production, or repeated
  prompt wording.
- **Replacing units breaks later units.** The audit names every prerequisite the
  swap took away; teach them back rather than lowering the bar.
- **Never imply speech is being evaluated.** There is no speech recognition. The
  `pronounce` step says plainly that nothing is recorded or scored.
- **Never ask the learner to produce untaught language.** A dialogue prompt may
  carry new language if marked `receptive`; a reply may not.
- Run lint, tests and build after code changes.
