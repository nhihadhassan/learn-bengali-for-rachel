# Spoken Bengali Curriculum Summary

Romanized spoken Bengali for one learner, in the register she will actually
hear: colloquial Bangladeshi Bengali, `tumi` by default, with `apni` taught
explicitly as the respectful level rather than left as a surprise.

The pack is `content/bengali-curriculum.json`; the shape it has to keep is in
`content/bengali-curriculum.schema.json`. The eight-unit v1 phrase book
(`content/learn-bengali.json`) is still in the repo, unedited, behind
`FEATURES.bengaliCurriculumV2`.

## Scope

- 3 sections, 19 sequenced units, 96 lessons
- 264 items: 143 vocabulary entries and 121 phrase patterns
- 12 named grammar rules (`content/bengali-grammar.json`), 8 of them taught in a
  Grammar focus lesson; the rest of the course discovers its patterns instead
- 16 discovery cards, 3 mini-stories, 13 conversations including a six-turn
  capstone, and 3 authored sentence frames
- Learner-facing text stays romanized. Every item also carries the Bengali
  script, which is what goes to pronunciation — so the audio is real Bengali
  rather than an English reading of a transliteration.
- No alphabet, vowel, consonant, reading or writing lessons. The learner is
  never asked to read or write the script.

## Sections

**Your first Bengali** (units 1-6) — greetings and their replies, `ach-` and how
its ending carries the person, goodbyes, names and possessives, this and that,
and the small words that keep a conversation going when you have not understood.

**Everyday Bengali** (units 7-12) — asking for water, tea and rice; hunger and
thirst as things that happen *to* you; family; the six question words; the `-ch-`
that makes an action happen now; and how you feel.

**Out in the world** (units 13-19) — asking for help in the right register,
directions, buses and taxis, arriving as a guest, tea and thanks, small talk,
and care when it matters, ending in one long conversation.

## Design principle

Every lesson introduces at most four new items and spends the rest of its time
retrieving things met earlier — the lessons before it, plus a spaced sample from
units N-1, N-2, N-4, N-8 and N-16. A unit names the lessons it needs rather than
running the same six every time, support falls away from scaffold 5 to scaffold
1 across the course, and grammar is named only once the unit's own sentences have
demonstrated it.

`npm run audit:curriculum` holds all 96 lessons to that: a sentence the learner
is asked to build must be fully readable when it appears, a pattern must have
been met before it is explained, a dialogue reply may never use untaught
language, and nothing may be introduced and then never seen again.
