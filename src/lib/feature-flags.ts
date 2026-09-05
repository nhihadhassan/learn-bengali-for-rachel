/**
 * Feature flags let unfinished features ship "dark" — the code lives in main but
 * stays invisible until a flag flips on. Only explainMyAnswer is user-visible;
 * listening, dialogue, and aiRoleplay are scaffolded and awaiting testing /
 * a provider decision.
 */
export const FEATURES = {
  explainMyAnswer: true,
  /**
   * Cumulative lesson planning for courses that declare
   * `lessonStrategy: "cumulative"`. Turning this off makes those courses fall
   * back to the same engine path the phrase-book courses use — the documented
   * rollback for the learning-engine work, without a revert.
   */
  cumulativeLessons: true,
  /**
   * Spanish Curriculum v2 — the reworked Units 1-12.
   *
   * On, the pilot units replace the first twelve units of the path and Units
   * 13+ continue unchanged behind them. Off, the course is exactly what it was
   * before the pilot: `content/spanish-curriculum.json` is never edited, so
   * this flag is a complete rollback and not merely a hiding place.
   */
  spanishPilotV2: true,
  /**
   * Bengali Curriculum v2 — the rebuilt Bengali course.
   *
   * On, the path is `content/bengali-curriculum.json`: fourteen sequenced
   * units taught `apni` first, planned cumulatively, with authored grammar,
   * discovery cards, stories and conversations. Off, it is the original
   * eight-unit phrase book
   * in `content/learn-bengali.json`, which is never edited — so this flag is a
   * complete rollback and not merely a hiding place.
   */
  bengaliCurriculumV2: true,
  listening: false,
  dialogue: false,
  aiRoleplay: false,
} as const;

export type FeatureName = keyof typeof FEATURES;

export function isFeatureEnabled(name: FeatureName): boolean {
  return FEATURES[name];
}
