# Bengali Curriculum Expansion

Generated a 10-unit, 40-lesson beginner-to-intermediate bridge curriculum mapped to the app's existing `LearningContent` model. Runtime-compatible exercises use existing types: `multiple-choice`, `translation`, and `matching`. Richer Duolingo-style exercise intent is preserved in optional `sourceType` metadata.

## Research Basis

- FSI Bengali Short Course: dialogue-first unit sequencing for greetings, directions, appointments, market tasks, and practical communication.
- University of Texas Bangla resources: script/pronunciation support, grammar notes, time expressions, seasons, and dialogues.
- Peace Corps Bangla lessons: survival competencies for introductions, host-family life, getting around, communication facilities, shopping, and meals.
- University of Chicago Bengali instructional materials: conversation, vocabulary, audio, and drill-oriented lesson architecture.
- Omniglot Bengali writing reference: script awareness, vowel signs, inherent vowel, consonants, and numerals.
- Penn Bengali course descriptions: four-skill, culture-rich progression toward intermediate reading, writing, speaking, and listening.

## Generated Scope

- Units: 10
- Lessons: 40
- Vocabulary rows: 364
- Default review cadence: 1, 3, 7, 14, 30, 60 days
- Target outcome: ACTFL Novice High with emerging Intermediate Low in listening/speaking, and Novice High reading/writing with stretch content in later units.

## Assumptions

- Polite Bangladeshi/standard colloquial forms are the default unless a lesson explicitly contrasts register.
- Romanization is app-normalized for learner consistency, not a scholarly transliteration system.
- Audio is not generated here; `audioPrompts` are metadata-ready for future recorded MP3 or TTS workflows.
- Existing localStorage progress shape is unchanged.
