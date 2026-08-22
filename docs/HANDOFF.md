# Project Handoff — "Learning for Rachel"

A Duolingo-style learning platform. It began as a Bengali app for one learner
(Rachel) and is now a **multi-course platform**: Bengali, Spanish for Peru, a
full 131-unit research-grounded Spanish course, Malayalam, and bite-size History
chapters. Bengali is one course among several, not the identity of the app.
This document is the single source of truth for how the app is put together.

> Naming note: the repo directory, the localStorage key, and some legacy
> identifiers still say "bengali". That's historical — user-facing copy says
> "Learning for Rachel". Don't rename the internal identifiers without a
> migration; the storage key in particular must stay stable or learners lose
> their progress.

---

## 1. What the app is

- A mobile-first lesson app: a lesson path of units → lessons, each lesson a
  sequence of short exercises (recognize, produce, word-bank, listening, etc.).
- Progress (XP, streaks, completed lessons, mistakes, spaced-repetition memory)
  is stored **locally in the browser** — there is no live backend yet.
- Installable as a PWA and works offline for already-visited lessons.

### Information architecture

Three places, plus course context:

- **Learn** (`/lessons`) — the current course's path and one continue action.
- **Practice** (`/practice`) — everything that isn't a new lesson: due reviews,
  mistakes, skipped audio, unit checkpoints, word bank, music.
- **Progress** (`/progress`) — real learning signals (completion, phrases in
  memory, recall strength, accuracy, weak units, activity), with XP/gems
  demoted to a "Rewards" row.
- **Course home** (`/`) and the header course chip — switching course.
- **Settings** (`/settings`) — theme, placement, offline note, and the
  destructive data actions (behind an explicit confirmation).

A running lesson hides the shell entirely; see §5.

### The course registry (`src/lib/courses.ts`)

**Courses are data, not `if` statements.** The registry is the source of truth
for what courses exist and what each one can do. Platform code asks about
capabilities (`listening`, `dialogue`, `script`, `placement`, `music`,
`kind: "language" | "history"`, per-course nouns and accent colours) instead of
testing for a specific id. `src/lib/content.ts` then attaches units to each
registered course.

Adding a course = one registry entry + one line in `UNIT_SOURCES` +
`npm run build:course-index`. `scripts/courses.test.ts` fails if anything is
missed.

| id             | Label            | Source                                   | Notes |
|----------------|------------------|------------------------------------------|-------|
| `bengali`      | Bengali          | `content/learn-bengali.json`             | Original course; default. Script + transliteration. |
| `spanish-peru` | Spanish for Peru | `content/learn-spanish-peru.json`        | Travel Spanish. |
| `spanish`      | Spanish          | `content/spanish-curriculum.json`        | **131 units / 786 lessons** (§4). Listening + dialogue capable. |
| `malayalam`    | Malayalam        | `content/learn-malayalam.json`           | Transliteration. |
| `history`      | History          | `content/learn-history.json`             | `kind: "history"` — story chapters, not drills. |

Ids are **persisted** in local progress. Never rename one without a migration.

### Two content tiers (this matters for bundle size)

| Module | Contains | Cost | Used by |
|--------|----------|------|---------|
| `src/lib/courses.ts` | Labels, locales, capabilities, nouns, accents | ~2KB | The app shell, progress store, anything that just needs to know *about* a course |
| `src/lib/course-index.ts` | Every unit/lesson **title**, generated into `content/course-index.json` | ~12KB gzipped | Navigation, the lesson path, progress maths |
| `src/lib/core-content.ts` | The four hand-authored curricula | ~430KB | Mistake review (needs authored exercises) |
| `src/lib/content.ts` | **Everything**, including the 1.2MB Spanish pack | ~1.2MB | Only where real phrases are needed: a running lesson, word bank, practice sessions, placement |

Before this split every route shipped the whole Spanish course. Measured with
`npm run build` + inspecting `.next/server/app/*.html` chunk references:

| Route | Before | After |
|-------|--------|-------|
| `/lessons` | ~1.75MB | ~757KB |
| `/practice`, `/progress`, `/`, `/settings` | ~1.75MB | ~745KB |
| `/practice/[lessonId]` | ~1.8MB | ~805KB |
| `/review` | ~1.77MB | ~1.0MB |
| `/vocabulary`, `/strengthen`, `/placement` | ~1.77MB | unchanged — they genuinely need phrases |

Regenerate the index after any content change:

```bash
npm run build:course-index
```

`npm test` fails if the committed index is stale.

---

## 2. Stack & how to run

- **Next.js 16** (App Router, **webpack**), **React 19**, **TypeScript** (strict),
  **Tailwind CSS v4**.
- Path alias: `@/*` → `src/*`.
- Supabase-ready SQL lives in `db/`, but **no live database** is wired in.

```bash
npm run dev        # local dev server (http://localhost:3000)
npm run lint       # eslint
npm test           # node:test suite (scripts/*.test.ts)
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
npm run build:course-index         # regenerate content/course-index.json after content changes
npm run test:exercise-generation   # just the exercise-generator tests
```

**Deployment:** Vercel (preview per PR, production on merge). The full Spanish
course's 786 lesson pages are **not** prerendered — `generateStaticParams` in
`src/app/practice/[lessonId]/page.tsx` intentionally excludes `curriculumId ===
"spanish"`, so those render on demand (`dynamicParams`) and are cached. This keeps
build time/output reasonable.

---

## 3. Architecture map

```
src/lib/courses.ts        ── the course registry (ids, labels, capabilities)
        │                      ↑ read by the shell, the progress store, the engine
        ├── src/lib/course-index.ts ── generated titles-only outline (navigation)
        │
content/*.json ──► src/lib/core-content.ts ──┐
content/spanish-curriculum.json              │
        └► src/lib/spanish-curriculum.ts ────┴─► src/lib/content.ts ─► curricula[]
                                                        │
                            Unit → Lesson → Phrase model (src/types/learning.ts)
                                                        │
                          src/lib/lesson-steps.ts ──► buildLessonSteps()
                                                        │  (pure; no React)
                                                        ▼
             lesson-flow.tsx (state/answers/persistence)
                    └─► steps/exercise-steps.tsx (renderers)
                    └─► lesson-chrome.tsx        (exit + progress)
                    └─► lesson-complete.tsx      (end of session)
                    └─► history-story-flow.tsx   (history courses)
```

Key files:

- `src/lib/courses.ts` — **the course registry**: ids, labels, locale,
  capabilities, nouns, accents. Metadata only, no content.
- `src/lib/course-index.ts` — the lightweight outline (`content/course-index.json`,
  generated) used by all navigation and progress maths.
- `src/lib/content.ts` — attaches real units/lessons/phrases to each course.
  **Heavy**; import only where phrases are needed.
- `src/lib/core-content.ts` — just the four hand-authored curricula, for code
  that needs authored `exercises` without the Spanish pack.
- `src/types/learning.ts` — core types. `CurriculumId` is now an alias of the
  registry's `CourseId`.
- `src/lib/spanish-curriculum.ts` — adapter converting the Spanish pack into the
  app's `Unit`/`Lesson`/`Phrase` model (and attaching the pack's four sections).
- `src/lib/lesson-steps.ts` — **the lesson engine**, pure and testable.
  `buildLessonSteps()` turns a lesson into question steps. Two paths: cumulative
  (§5a) and the original phrase-book path.
- `src/lib/curriculum-plan.ts` — the cumulative introduction/review schedule.
- `src/lib/lesson-profiles.ts` — what each of the six lesson types *is*.
- `src/lib/learner-model.ts` — new / weak / due / strong, derived from the
  review policy.
- `src/lib/distractors.ts` — wrong-answer selection.
- `src/lib/grammar-drills.ts` + `content/spanish-grammar.json` — grammar points
  and the generators that practise them.
- `src/lib/rng.ts` — the one seeded PRNG (the pipeline's `rng.ts` re-exports it).
- `src/lib/text-tokens.ts` — word/stopword/blank-picking helpers shared by the
  engine *and* the offline curriculum generators, so the two can't drift.
- `src/lib/review-policy.ts` — **the** spaced-repetition policy (Leitner ladder,
  due dates, strength/mastery). Nothing else defines intervals.
- `src/lib/date-keys.ts` — learner-local calendar day keys for streaks.
- `src/lib/progress-store.ts` — local progress (see §6).
- `src/lib/pronunciation.ts` — **audio** (see §7). Do not create a second TTS path.

### Routes (`src/app/`)

`/` course home · `/lessons` **Learn** · `/practice` **Practice hub** ·
`/practice/[lessonId]` a running lesson · `/progress` **Progress** ·
`/settings` appearance + data · `/review` fix mistakes · `/strengthen` spaced
repetition · `/unit-review/[unitId]` unit checkpoint · `/placement` adaptive
placement · `/vocabulary` word bank · `/music` + `/music/[songId]` ·
`/roleplay` + `/api/roleplay` (behind a flag).

**Focus routes.** `AppShell` hides its header *and* bottom nav for
`/practice/<lesson>`, `/strengthen`, `/unit-review`, `/placement` and the song
player. Those screens supply their own reading column (`mx-auto max-w-2xl px-4`)
and, for lessons, `LessonChrome` — an exit button and a progress bar, nothing
else.

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
2. **Generators / lesson engine** — `buildLessonSteps()` in
   `src/lib/lesson-steps.ts` (runtime) and `src/curriculum/generators.ts`
   (pipeline) control *how* questions are built. One change improves all lessons
   at once. Both now share `src/lib/text-tokens.ts` for tokenizing, stopwords and
   cloze blank-picking, so a pipeline test and a real lesson can't disagree about
   which word gets blanked.
3. **Adapter** (`src/lib/spanish-curriculum.ts`) — controls how many phrases a
   lesson teaches, ordering, and difficulty labels.

Step types produced by the engine: `intro`, `learn`, `recognize` (target→English),
`produce` (English→target), `order` (arrange word bank), `complete` (cloze),
`translate` (word-bank translation), `listen` (tap what you hear), `dialogue`
(pick the reply), `exercise` (any pre-authored `lesson.exercises`). `speak`
(pronunciation practice) exists but is archived (`INCLUDE_SPEAKING_PRACTICE`).

Progress within a lesson **excludes the intro card** (`isWorkStep` /
`countWorkSteps`), so a lesson reads 0% until real work is done rather than
jumping to "1 of 14" on the title screen.

`scripts/lesson-steps.test.ts` pins the rules against real content: the
teach/test lag, that every taught phrase is eventually checked, difficulty
ordering, ending on an easy win, unique step ids, word banks containing the
answer, and audio steps appearing only where capabilities allow.

## 5a. Cumulative lessons (the Spanish course)

Courses declare a **lesson strategy** in the registry
(`src/lib/courses.ts`). Spanish is `"cumulative"`; Bengali, Spanish for Peru and
Malayalam are `"simple"` and keep the original engine exactly as it was.

### What was wrong

The pack gives all six lessons in a unit the *same* `content_focus` (all 131
units), so the adapter rotated a five-item window over it. A lesson was "five of
this unit's fifteen items", nothing from an earlier unit ever came back, and the
six lesson names promised a difference the runtime never delivered.

### What happens now

1. **`curriculum-plan.ts`** spreads a unit's items across its six lessons —
   at most `MAX_NEW_ITEMS_PER_LESSON` (4) new items each, phrase patterns
   introduced only once the words they are built from exist — and gives every
   lesson prior material: the items from the lessons just before it, plus a
   sample from earlier units along a spaced ladder (units N‑1, N‑2, N‑4, N‑8,
   N‑16). The queues into old units are **shared across the whole course**, so
   every unit that reaches back to unit 2 continues where the last one left off.
   A unit's opening lesson draws only from the unit just finished.
2. **`spanish-curriculum.ts`** turns that into `Lesson.plan`
   (`kind`, `newPhraseIds`, `reviewPhraseIds`, `interleavedPhraseIds`, plus the
   unit's grammar focus and authored dialogue) and sets `lesson.phrases` to the
   resolved working set, so the word bank, the intro card and encountered-phrase
   tracking are unaffected.
3. **`learner-model.ts`** picks which review candidates are worth today's
   questions: weak > due > recent > strong, with mastered material capped.
   The snapshot is taken **once** per session in `lesson-flow.tsx` — reading
   live progress would re-plan the lesson after every answer.
4. **`lesson-profiles.ts`** decides the shape of the session per lesson type.

| Lesson | What it does |
|--------|--------------|
| Discover | ~4 new items, recognition + listening, full support |
| Build | combines known pieces: order, cloze, word-bank translation |
| Grammar focus | a grammar card, then drills on the pattern with known vocabulary |
| Listen and speak | listening-dominant, English hint removed from cloze |
| Use in context | a 3-turn authored dialogue in one scenario |
| Unit review | nothing new, hardest formats, smallest word banks, older units mixed in |

### Rules the engine enforces

- **Teach/test lag** — never test a phrase in the step after teaching it
  (`enforceTeachTestLag` is the safety net).
- **No repeated questions** — warm-up checks, grammar drills, the practice
  block, the recycle slots and the closer share one `usage` map.
- **Mistake recycling with a fixed step count** — a lesson reserves *recycle
  slots* pre-filled with review questions. A wrong answer rewrites the next
  unused slot (at least `MIN_RECYCLE_GAP` steps away) to ask about the missed
  item **in a different format**. The lesson never gets longer, so the progress
  bar never regresses, and the same question is never re-asked seconds after the
  correction.
- **Support adaptation** — two misses in the last four questions softens the
  next hard question (translate → order → complete) without changing its slot.

### Grammar: chosen, gated, and illustrated with known words

A unit declares **`grammar_focus`** — an explicit rule id — in
`content/spanish-curriculum.json`. That replaced picking
`grammar_targets[(unitNumber - 1) % targets.length]`, which is how a greetings
unit came to teach noun gender and a unit of twelve adjectives came to teach
articles. Sections 1-2 are authored; units without a focus still fall back to
the rotation.

Two gates stand between an authored choice and the learner
(`grammarFocusFor` in `src/lib/spanish-curriculum.ts`):

1. **Readiness.** An authored rule must be demonstrated at least once by the
   unit's own material; a rotation pick needs three sightings across the course.
   A pattern is named only after it has been met.
2. **Readability.** `toGrammarFocus` filters a rule's example bank down to
   sentences whose every word the learner has met *by the lesson the card
   appears in* — not by the end of the unit. If too few survive, examples are
   taken from the unit's own phrases. The audit fails any curated unit whose
   grammar card shows an unknown word.

The planner cooperates: `planUnit` front-loads phrases and vocabulary that
demonstrate the unit's focus, and the grammar lesson will not be reached
without at least one sentence showing the pattern.

`content/spanish-grammar.json` holds one entry per grammar target the pack
declares, plus seven rules written for the Intro section (`querer-pattern`,
`buenas-agreement`, `ser-de-origin`, `possessives`, `estar-location-hay`,
`question-words`, `weather-hace`). Each carries a two-sentence explanation, a few
examples, and `markerGroups` — confusable sets such as `["soy","eres","es"]`.
`grammar-drills.ts` blanks whichever marker appears in a sentence the learner
already knows and offers the rest of that group as the options, so the question
tests the pattern rather than the vocabulary. A rule with no usable sentence
returns nothing and the lesson falls back to ordinary practice. `avoidPhrases`
keeps famous exceptions (`el agua`) from being drilled as if they were the rule.

### Pattern drills

A `pattern` drill holds a frame steady and swaps what fills it — `Quiero ___`
against *un café* / *el té* / *el agua*. It is the difference between
remembering a sentence and owning a structure. Built in `buildPatternDrills`
and rendered with the existing cloze step, so no new renderer was needed.

### Concept strength

`ProgressState.conceptMemory` is a running accuracy tally per grammar concept,
written from the same answer path as phrase memory and read by
`conceptStrength()` in `@/lib/learner-model`. It is **not** a second
spaced-repetition system: no boxes, no due dates, and it never feeds review
selection — `review-policy.ts` remains the only scheduler.

### The lexicon (`content/spanish-lexicon.json`)

Prerequisite checking used a three-character stem match, which treated `tienes`
as a word the learner had never met and missed `voy`/`ir` entirely — noise that
hid the real gaps. `@/lib/spanish-lexicon` now answers "is this word covered by
something we taught?": **irregular forms are authored** (91 verbs), **regular
plurals and -o/-a pairs are computed**, and names, numerals and structural glue
count as transparent. `curriculum-plan` takes it as an injected
`KnownWordResolver`, so that module stays language-agnostic.

Note the two different word sets: `taughtWordSet` records everything a taught
item gives the learner (including two-letter verbs like `ir`), while
`contentWordSet` screens short and functional words out of *questions*. Using
the question-side filter for knowledge tracking is what made "Voy a comprar
fruta." look like it used an untaught verb.

### Receptive language

`DialogueLine.receptive` marks a prompt the learner only needs to *understand*
— "Mucho gusto" in the first unit. The lesson shows a "New expression — just
understand it for now" chip, and the audit exempts those lines from its
unknown-word check. Replies are never receptive: the learner is never asked to
produce untaught language.

### Later sections

`getLessonProfile(kind, band?)` accepts a CEFR band with an override table that
is **deliberately empty**. The shape of A2/B1 lessons — longer listening,
reading passages, mixed-skill sessions, less scaffolding — is a content decision
not yet made, and it belongs there as data when it is.

### Rolling back

`FEATURES.cumulativeLessons = false` in `src/lib/feature-flags.ts` restores the
previous behaviour: no plans are produced, the adapter falls back to its
five-item rotation and the engine to the phrase-book path. The pre-change tip is
tagged `rollback/pre-learning-engine-v2`.

### Curriculum audit

```bash
npm run audit:curriculum
```

Walks the generated course and reports: phrases introduced before their
prerequisites · grammar examples using unseen vocabulary · a pattern explained
before it has been met · dialogue prompts above an unknown-word threshold
(receptive lines exempt) · a dialogue reply the learner has not been taught ·
material never revisited outside its unit · new-content overload · consecutive
lessons that barely overlap · incoherent authored dialogue.

**Sections 1-2 (41 units) findings fail the run**, and they are held to a
stricter bar than the rest: a sentence the learner will be asked to *build* must
be fully readable when it appears, where Sections 3-4 are judged on being mostly
readable. Those later sections report warnings (13 at the time of writing, all
prerequisite gaps awaiting the same hand-sequencing treatment).

### Feature flags (`src/lib/feature-flags.ts`)

Unfinished features ship "dark" and flip on via a flag:

- `explainMyAnswer: true` — live.
- `cumulativeLessons: true` — live; the rollback switch for §5a.
- `listening: false`, `dialogue: false` — the **global** flags. Per-course
  support is no longer an id check: it comes from the course's capabilities in
  `src/lib/courses.ts` (the Spanish course declares `listening` and `dialogue`;
  romanized Bengali/Malayalam do not, because English voices mangle them).
- `aiRoleplay: false` — scaffolded, awaiting a provider decision.

---

## 6. Local progress (`src/lib/progress-store.ts`)

- Persisted in `localStorage` under **`learn-bengali-rachel-progress`** (keep this
  key stable).
- Progress is **per course**: `{ activeCurriculumId, byCurriculum: { ... } }`.
  The buckets are now built from the registry (`mapCourses`), so **adding a
  course needs no change here**.
- `ProgressState` holds completed lessons, XP, gems, streak, mistakes, skipped
  listening, `phraseMemory` (Leitner boxes), plus `practiceDays` (local day keys
  for the activity strip) and `answeredTotal`/`answeredCorrect` (real accuracy).
- `normalizeProgress`/`normalizeStore` keep old saved data **backward-compatible**
  — always add new fields defensively. Two shapes are supported forever: the
  current per-course store, and the original Bengali-only `ProgressState`.
  Buckets with unrecognised ids are **preserved**, not dropped.
- `scripts/progress-store.test.ts` covers all of the above.

### Streaks use the learner's local day

Day keys come from `src/lib/date-keys.ts` (`localDayKey`), **not**
`toISOString()`. The old UTC-based keys rolled the "learning day" over at UTC
midnight, so for a learner west of Greenwich an evening session was filed under
tomorrow. `relateDayKey` also classifies a stored key that is *ahead* of today as
`"future"` and treats it as already-practiced — that is exactly the state a
learner migrating off the UTC keys can be in, and resetting their streak to 1
would be the worse outcome.

### Spaced repetition has one definition

`src/lib/review-policy.ts` owns the Leitner ladder `[0, 1, 3, 7, 14, 30]`, box
promotion/demotion, due checks, review selection, and the mastery threshold.
The curricula also declare `reviewSchedule.initialReviewDays` in their content;
`scripts/review-policy.test.ts` asserts the two still agree, which is how the
previous drift (code said `[0,1,3,7,16,35]`, content said `[1,3,7,14,30]`) is
prevented from returning.

Review selection never returns an empty list when the learner has memory: if
nothing is due it falls back to the weakest items, so Practice is never a dead
end.

### Future cloud sync

Progress stays local-first. The store is already shaped for a later sync layer:
all writes funnel through `updateStore`/`updateCurriculumProgress`, the
persisted shape is a plain serialisable object keyed by course, and
`normalizeStore` is exported and tested — a sync layer can merge a remote
snapshot through the same normalizer. `db/` still holds the Supabase-ready SQL.
No auth or backend was added in this pass.

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
  `buildLessonSteps` (`src/lib/lesson-steps.ts`) this is `TEACH_TEST_LAG`, and
  `npm test` enforces it. Keep mixing question types (recognize, produce, word
  bank, cloze, ordering, listening, dialogue) rather than repeating one format.
- **Branch on capabilities, not ids.** `if (courseId === "spanish")` is a bug
  waiting to happen; ask `getCapabilities(courseId).listening` instead, and add
  the capability to `src/lib/courses.ts` if it doesn't exist yet.
- **Keep navigation off the heavy content module.** If a client component only
  needs titles or counts, import `@/lib/course-index`, not `@/lib/content`.
- **Regenerate the course index** (`npm run build:course-index`) after touching
  any curriculum content, or `npm test` will fail.
- Preserve XP, streaks, lesson completion, mistake review, and learned-word
  persistence unless explicitly asked to change them.
- Keep the local progress shape **backward-compatible** when adding fields.
- Keep UI **mobile-first** and simple; prefer existing components before adding new
  ones.
- Display romanized text to learners; pass script (e.g. Bengali) to pronunciation
  when available.
- For the Spanish pack, follow its `CLAUDE.md` content rules (provenance, accents,
  answer arrays, validate-before-seed, no "official Duolingo" labeling).
- Run `npm run lint`, `npm test` and the (WASM) build after code changes. For
  pipeline changes, also run the curriculum scripts.

---

## 9. Suggested next steps

- **Finish the bundle split.** `/vocabulary`, `/strengthen` and `/placement`
  still load the full Spanish pack because they need phrases for the *active*
  course, which is client state. Course-scoped routes (`/learn/[courseId]`) or a
  dynamic `import()` per course would let those load only what they use.
- **Cloud sync** on top of the local-first store (see §6), using `db/`.
- **Recorded audio** for high-frequency Spanish phrases (`public/audio/spanish/`,
  set `audioFile`) for quality beyond TTS.
- **Hand-sequence Sections 3-4** the way Sections 1-2 were (§5a): assign an
  explicit `grammar_focus`, close the 13 prerequisite gaps
  `npm run audit:curriculum` still warns about, and author a `dialogue` block
  per unit. Sections 3-4 currently rely on the grammar rotation and the
  relation-aware dialogue fallback.
- **Differentiate the duplicated Section 2 units.** `es-en-s02-u002` /
  `u026` and `u004` / `u028` still ship identical phrase sets; four units teach
  the same five sentences about hobbies.
- **Author `patterns` data.** Pattern drills are currently derived from a
  rule's markers. Explicit per-unit patterns would let a unit say which frames
  matter and which fills belong in them.
- **Listening for `spanish-peru`** — the capability is declared per course now,
  so it is a one-word change once the shorter phrase set has been checked.
- **Content spot-check** across a sample of the 131 units for accuracy.
