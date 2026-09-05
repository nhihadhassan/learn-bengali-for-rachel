# Spoken Bengali Curriculum Summary

Romanized spoken Bengali for one learner, in the register she will actually
need: colloquial Bangladeshi Bengali, taught `apni` first. A learner's first
hundred conversations are with strangers, shopkeepers, drivers, hosts and
elders, and all of them want the respectful forms; familiar `tumi` gets unit 3,
where the contrast with `apni` is the lesson rather than a footnote.

The pack is `content/bengali-curriculum.json`; the shape it has to keep is in
`content/bengali-curriculum.schema.json`. The eight-unit v1 phrase book
(`content/learn-bengali.json`) is still in the repo, unedited, behind
`FEATURES.bengaliCurriculumV2`.

## Scope

- 3 sections, 14 sequenced units, 68 lessons
- 289 items: 205 vocabulary entries and 84 phrase patterns
- Every item declares its level of address (`apni` / `tumi` / `neutral`), and 8
  are marked receptive: host and driver language, taught to be understood and
  never asked for as production
- 13 named grammar rules (`content/bengali-grammar.json`), only 3 of which a
  unit stops to explain; the rest of the course works its patterns out from a
  discovery card first
- 13 discovery cards, 2 mini-stories, 20 conversations including a ten-turn
  capstone with three speakers, and 18 authored sentence frames
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

`npm run audit:curriculum` holds all 68 lessons to that: a sentence the learner
is asked to build must be fully readable when it appears, a pattern must have
been met before it is explained, a dialogue reply may never use untaught
language, and nothing may be introduced and then never seen again.
