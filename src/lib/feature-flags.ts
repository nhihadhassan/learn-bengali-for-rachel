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
  listening: false,
  dialogue: false,
  aiRoleplay: false,
} as const;

export type FeatureName = keyof typeof FEATURES;

export function isFeatureEnabled(name: FeatureName): boolean {
  return FEATURES[name];
}
