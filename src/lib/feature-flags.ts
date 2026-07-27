/**
 * Feature flags let unfinished features ship "dark" — the code lives in main but
 * stays invisible until a flag flips on. Only explainMyAnswer is user-visible;
 * listening, dialogue, and aiRoleplay are scaffolded and awaiting testing /
 * a provider decision.
 */
export const FEATURES = {
  explainMyAnswer: true,
  listening: false,
  dialogue: false,
  aiRoleplay: true,
} as const;

export type FeatureName = keyof typeof FEATURES;

export function isFeatureEnabled(name: FeatureName): boolean {
  return FEATURES[name];
}
