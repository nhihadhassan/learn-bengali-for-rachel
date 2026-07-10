# Learn Bengali for Rachel — Handoff

Snapshot date: 2026-07-10

## What this is

Learn Bengali for Rachel is a small Next.js App Router language-learning app for beginner spoken Bengali. It now also includes Spanish for Peru, Malayalam support, a history curriculum experiment, active-language flashcards, and a static Spanish song-learning section.

The app includes:

- Unit-based lesson paths
- Romanized Bengali lessons with Bengali script available for pronunciation fallback
- Spanish-for-Peru lessons with Spanish and English learning metadata
- Malayalam and historical/experimental curriculum content
- Multiple-choice, translation, matching, listening, fill-in, and speaking exercises
- XP, streaks, lesson completion, mistake review, and learned-word review
- Active-language spaced-repetition flashcards for Bengali, Spanish, and Malayalam
- A clear History fallback because flashcards are intended for language courses
- Spanish song cards at /songs with phrase-level glosses and official listening links
- Mobile-first UI and service-worker/offline shell
- Local browser progress stored under learn-bengali-rachel-progress
- Supabase-ready schema/client boundaries, but no live Supabase dependency configured

## Current content

### Bengali

The Bengali curriculum remains the primary original curriculum:

- 8 topic groups
- 16 bite-size lessons
- 96 romanized spoken phrases

### Spanish for Peru

The Spanish curriculum now contains:

- 10 units
- 20 lessons
- 120 unique phrases
- Synchronized content/learn-spanish-peru.json and content/spanish-peru-vocabulary.csv
- New units covering social Spanish, plans, routines, feelings, and helpful care phrases

### Spanish songs

content/spanish-songs.json contains 29 static song-learning cards:

- 17 tracks from Bad Bunny’s DeBÍ TiRAR MáS FOToS album
- 6 Spanish-forward Kali Uchis tracks
- 6 earlier curated starter tracks

Cards contain artist, album where applicable, region, genre, curation date, source link, official listening link, learning focus, and short Spanish/English phrase glosses. Full copyrighted lyrics and unofficial full translations are intentionally not stored.

## Important locations

### Application routes

- / — learning home
- /lessons — lesson path/list
- /practice/[lessonId] — interactive lesson practice
- /flashcards — active-language spaced-repetition flashcards
- /songs — Spanish song learning section
- /progress — progress summary
- /review — mistake review
- /vocabulary — learned words review

### Core code

- src/app/ — Next.js App Router pages, layout, and global styles
- src/components/lesson/ — lesson path, lesson flow, home, speaker control
- src/components/exercises/ — quiz runner and exercise interactions
- src/components/flashcards/ — flashcard deck UI
- src/components/songs/ — static song-learning UI
- src/components/progress/ — progress and mistake-review UI
- src/components/vocabulary/ — learned-word review UI
- src/components/ui/ — reusable UI primitives
- src/lib/content.ts — content loading and curriculum helpers
- src/lib/progress-store.ts — local progress state and persistence
- src/lib/flashcard-scheduler.ts — shared spaced-repetition scheduling
- src/lib/learned-words.ts — vocabulary derived from encountered phrases/completed lessons
- src/lib/pronunciation.ts — centralized pronunciation/TTS/audio logic
- src/lib/answer-checking.ts — exercise answer validation
- src/lib/supabase.ts — Supabase client boundary
- src/types/learning.ts — shared learning/content types, including SpanishSong

### Content and data

- content/learn-bengali.json — Bengali lesson content
- content/learn-malayalam.json — Malayalam content
- content/learn-spanish-peru.json — Spanish/Peru lesson content
- content/learn-history.json — historical/experimental content
- content/spanish-songs.json — static Spanish song cards
- content/vocabulary.csv — Bengali vocabulary data
- content/spanish-peru-vocabulary.csv — synchronized Spanish vocabulary data
- db/schema.sql — Supabase schema draft
- db/policies.sql — Supabase policy draft

### Public assets

- Favicons and Apple touch icon
- public/sw.js — service worker
- public/audio/*/README.md — notes/placeholders for language audio
- Custom Bengali recordings, when added, belong under public/audio/bengali/

## Development

This is a Next.js App Router project using TypeScript, React, Tailwind CSS v4, and Webpack-based Next commands.

From the project directory:

~~~bash
npm install
npm run dev
~~~

Other useful commands:

~~~bash
npm run lint
npm run build
npm start
npm audit --audit-level=moderate
~~~

If the production build has trouble loading native SWC in this environment, use:

~~~bash
NEXT_TEST_WASM=1 NEXT_TEST_WASM_DIR="$PWD/node_modules/@next/swc-wasm-nodejs" npm run build
~~~

Progress is persisted in the browser under:

~~~text
learn-bengali-rachel-progress
~~~

Existing Bengali progress, XP, streaks, mistakes, and flashcard records must remain backward-compatible. Clearing browser storage clears the local MVP progress.

## Verification completed

- Spanish content validated at 10 units, 20 lessons, and 120 unique phrases.
- Spanish JSON and CSV phrase data are synchronized.
- Song data validated at 29 cards, 29 unique IDs, 17 DTMF tracks, and 6 Kali Uchis tracks.
- Every song card contains three short learning glosses.
- npm run lint passes.
- npm run build passes and prerenders 68 routes.
- npm audit --audit-level=moderate reports zero vulnerabilities.
- Browser checks confirmed the Spanish lesson route, flashcards route, and /songs route render without application console errors.

## Git and deployment

GitHub repository:

https://github.com/nhihadhassan/learn-bengali-for-rachel

The working changes are being published from an agent branch and deployed to Vercel production as part of this handoff. After publishing, record the final branch, commit, PR, deployment URL, and production verification here.

Useful recovery commands:

~~~bash
git clone https://github.com/nhihadhassan/learn-bengali-for-rachel.git
cd learn-bengali-for-rachel
npm install
npm run dev
~~~

## Notes for the next session

- Song cards are static by design; refresh the JSON manually when the curated set should change.
- No runtime music API, credentials, lyric scraper, or external content service is used.
- The /songs link is discoverable from the Spanish curriculum home and desktop navigation while Spanish is active.
- The app remains English-language while teaching Bengali, Spanish, Malayalam, or history.

