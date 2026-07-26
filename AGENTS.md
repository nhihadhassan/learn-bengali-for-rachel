# Agent Guide

## Project

Learn Bengali for Rachel is a small Next.js App Router app for beginner Bengali learning. The MVP focuses on romanized Bengali for learners, Bengali script for pronunciation, guided lesson flow, XP/streak progress, mistake review, and a learned-words vocabulary bank.

## Stack

- Next.js App Router with TypeScript
- Tailwind CSS v4
- Local JSON lesson content in `content/learn-bengali.json`
- Local browser progress via `localStorage`
- Supabase-ready schema/client boundaries, but no live Supabase dependency yet

## Commands

Use the bundled Node runtime if the system shell does not have npm available.

```bash
npm run dev
npm run lint
npm run build
npm audit --audit-level=moderate
```

In this environment, production build may need the existing WASM SWC fallback:

```bash
NEXT_TEST_WASM=1 NEXT_TEST_WASM_DIR="$PWD/node_modules/@next/swc-wasm-nodejs" npm run build
```

## Architecture Notes

- Lesson content lives in `content/learn-bengali.json`.
- Core content helpers live in `src/lib/content.ts`.
- Progress state lives in `src/lib/progress-store.ts` and is persisted under `learn-bengali-rachel-progress`.
- Learned vocabulary is derived in `src/lib/learned-words.ts` from `encounteredPhraseIds` plus completed lessons.
- Pronunciation is centralized in `src/lib/pronunciation.ts`; do not create a second TTS path.
- Speaker playback UI lives in `src/components/lesson/speaker-button.tsx`.
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
`public/audio/bengali/`.

## Development Rules

- Dynamic lesson flow is required: never test a word in the step right after it is introduced (no "learn adios" → "what does adios mean?" back to back). Space teaching and testing (see `TEACH_TEST_LAG` in `buildLessonSteps`) and keep mixing question types.
- Preserve XP, streaks, lesson completion, mistake review, and learned-word persistence unless explicitly asked to change them.
- Display romanized Bengali to learners, but pass Bengali script to pronunciation when available.
- Keep local progress shape backward-compatible when adding fields.
- Keep UI mobile-first and simple; prefer existing components before adding new ones.
- Run lint and build after code changes.
