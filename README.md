# Learn Bengali for Rachel

A small Duolingo-style Bengali learning app focused on beginner spoken Bengali phrases.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Supabase-ready data boundary
- Local browser progress for the first playable MVP

## Current MVP

- Unit-based lesson path
- Flashcards with pronunciation hints
- Multiple choice, translation, and matching exercises
- XP, streaks, lesson completion, and mistake review
- Learned Words vocabulary review based on encountered phrases and completed lessons
- Supabase schema draft in `db/`

## Local Progress Storage

The MVP stores progress in `localStorage` under `learn-bengali-rachel-progress`.
This includes completed lessons, XP, streaks, active mistakes, and
`encounteredPhraseIds` for the Learned Words page.

## Run

Install dependencies with your preferred package manager, then:

```bash
npm run dev
```
