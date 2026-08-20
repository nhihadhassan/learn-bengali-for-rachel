import type { CourseId } from "@/lib/courses";

/**
 * The id of a registered course. Defined by the course registry
 * (`src/lib/courses.ts`) and aliased here under its legacy name, which is used
 * throughout the app and in persisted progress.
 */
export type CurriculumId = CourseId;

export type ExerciseType =
  | "multiple-choice"
  | "translation"
  | "matching"
  | "listen-type"
  | "fill-blank"
  | "speaking";

export type Phrase = {
  id: string;
  romanized: string;
  bengaliScript?: string;
  english: string;
  pronunciation: string;
  category: string;
  audioFile?: string;
  audioUrl?: string;
  breakdown?: Array<{
    word: string;
    pronunciation: string;
    meaning: string;
  }>;
};

export type MatchingPair = {
  left: string;
  right: string;
};

export type Exercise = {
  id: string;
  type: ExerciseType;
  prompt: string;
  answer: string;
  options?: string[];
  pairs?: MatchingPair[];
  phraseId?: string;
  sourceType?: string;
  audioPromptId?: string;
  acceptedAnswers?: string[];
  after?: string;
  before?: string;
  tokens?: string[];
  feedback?: string;
};

export type VocabularyItem = {
  bn: string;
  roman: string;
  en: string;
  tags: string[];
};

export type GrammarPoint = {
  point: string;
  notes: string;
};

export type AudioPrompt = {
  id: string;
  audioFile?: string;
  audioUrl?: string;
  locale: string;
  voiceStyle: string;
  textBn: string;
  roman: string;
  textEn: string;
  speed: number;
};

export type LessonUiText = {
  startCta: string;
  lessonGoal: string;
  correct: string;
  almost: string;
  complete: string;
};

export type LessonMetadata = {
  estimatedMinutes: number;
  difficulty: string;
  tags: string[];
  xp: number;
  unlockAfter?: string[];
  assessment?: {
    attempted: string;
    passed: string;
    strong: string;
    mastered: string;
  };
};

export type ReviewSchedule = {
  initialReviewDays: number[];
  masteryThreshold: number;
  recycleOnMistake: boolean;
};

export type Lesson = {
  id: string;
  unitId: string;
  unitNumber: number;
  title: string;
  difficulty: string;
  summary: string;
  phrases: Phrase[];
  exercises: Exercise[];
  curriculumId?: CurriculumId;
  locale?: string;
  slug?: string;
  objectives?: string[];
  vocabulary?: VocabularyItem[];
  grammar?: GrammarPoint[];
  audioPrompts?: AudioPrompt[];
  uiText?: LessonUiText;
  /**
   * Cumulative teaching plan. Present only for courses whose capabilities
   * declare `lessonStrategy: "cumulative"`; its absence is what keeps the four
   * phrase-oriented courses on the original engine path.
   */
  plan?: LessonPlan;
  metadata?: LessonMetadata;
  reviewSchedule?: ReviewSchedule;
  history?: {
    icon: string;
    layout?: "story-cards" | "travel-story";
    hook?: string;
    story: string[];
    keyTakeaway?: string;
    whyItMatters?: string;
    remember?: {
      person?: string;
      place?: string;
      theme?: string;
      consequence?: string;
    };
  };
};

/**
 * The six lesson types the Spanish course's unit sequence uses, plus the two
 * synthetic session kinds the Practice surfaces build. A course whose
 * capabilities declare `lessonStrategy: "simple"` never produces these — its
 * lessons carry no plan and the engine keeps its original behaviour.
 */
export type LessonKind =
  | "discover"
  | "build"
  | "grammar"
  | "listen"
  | "context"
  | "review"
  | "strengthen";

export type GrammarExample = {
  /** The example in the target language. */
  target: string;
  english: string;
  /** A few words on *why* — "masculine, so el", not a paragraph. */
  note?: string;
};

/**
 * A grammar point small enough to teach inside a lesson: a rule in one or two
 * sentences, a couple of examples built from words the learner already has, and
 * the name of a drill generator that practises the pattern itself.
 */
export type GrammarFocus = {
  id: string;
  title: string;
  explanation: string;
  examples: GrammarExample[];
  /** Drill generator id (see `@/lib/grammar-drills`). Unknown ids degrade. */
  drill?: string;
};

export type DialogueLine = {
  target: string;
  english: string;
};

/** One exchange: what the other speaker says, and what the learner should say. */
export type DialogueTurn = {
  speaker?: string;
  prompt: DialogueLine;
  reply: DialogueLine;
  /**
   * Wrong replies that are *plausible* — grammatical, on-topic-adjacent, and
   * drawn from language the learner knows. Authored, because "which of these
   * answers this question" is a semantic judgement the engine can't make.
   */
  distractors?: string[];
};

export type DialogueScript = {
  scenario: string;
  turns: DialogueTurn[];
};

/**
 * What a lesson should teach and what it should bring back — decided by the
 * curriculum layer (`@/lib/curriculum-plan`), before any learner state is
 * consulted. The engine turns this into steps; the learner model decides which
 * of `reviewPhraseIds` actually get drilled today.
 */
export type LessonPlan = {
  kind: LessonKind;
  /** Introduced here for the first time in the course, in teaching order. */
  newPhraseIds: string[];
  /** Already-met items worth retrieving, highest priority first. */
  reviewPhraseIds: string[];
  /** Ids of items from *earlier units* inside `reviewPhraseIds`. */
  interleavedPhraseIds?: string[];
  grammar?: GrammarFocus;
  dialogue?: DialogueScript;
};

export type UnitMetadata = {
  difficultyBand: string;
  estimatedTotalMinutes: number;
  tags: string[];
};

/**
 * A chapter of a long course (the Spanish course has four). Small courses leave
 * this unset and are presented as a single continuous path.
 */
export type UnitSection = {
  number: number;
  title: string;
  description?: string;
};

export type Unit = {
  id: string;
  number: number;
  title: string;
  description: string;
  section?: UnitSection;
  lessons: Lesson[];
  lessonIds?: string[];
  checkpointLessonId?: string | null;
  metadata?: UnitMetadata;
};

export type LearningContent = {
  units: Unit[];
};

export type Curriculum = {
  id: CurriculumId;
  label: string;
  shortLabel: string;
  description: string;
  locale: string;
  mode?: "language" | "history";
  travelTheme?: string;
  units: Unit[];
};

export type Mistake = {
  id: string;
  exerciseId: string;
  lessonId: string;
  /**
   * The phrase the learner got wrong, when the step maps to one. Optional and
   * added later: saves written before it exists simply have no value here, and
   * mistake recycling treats those as unattributable rather than failing.
   */
  phraseId?: string;
  prompt: string;
  correctAnswer: string;
  wrongAnswer: string;
  resolved: boolean;
  createdAt: string;
};

export type SkippedListeningExercise = {
  id: string;
  exerciseId: string;
  kind?: "listening" | "speaking";
  lessonId: string;
  prompt: string;
  createdAt: string;
};

export type PhraseMemory = {
  // Leitner box 0-5: higher = better known = longer until next review.
  box: number;
  // ISO timestamp when this phrase is next due for review.
  dueAt: string;
  // ISO timestamp of the most recent time it was practiced.
  lastSeenAt: string;
};

export type ProgressState = {
  completedLessons: string[];
  encounteredPhraseIds: string[];
  xp: number;
  gems: number;
  streak: number;
  streakRestoreAvailable: boolean;
  lastStreakBeforeMiss: number;
  currentUnit: number;
  lastPracticeDate: string | null;
  lastLessonId: string | null;
  lastStepIndex: number;
  lastActiveAt: string | null;
  mistakes: Mistake[];
  skippedListening: SkippedListeningExercise[];
  // Spaced-repetition memory, keyed by phrase id. Optional for backward compat.
  phraseMemory: Record<string, PhraseMemory>;
  /**
   * Local calendar days (YYYY-MM-DD) the learner practiced on, oldest first.
   * Powers the activity strip on Progress. Added later, so it may be empty for
   * progress saved before it existed.
   */
  practiceDays: string[];
  /** Lifetime graded answers, for a real accuracy figure. */
  answeredTotal: number;
  answeredCorrect: number;
};

export type LearnedWord = {
  phrase: Phrase;
  curriculumId: CurriculumId;
  locale?: string;
  lessonId: string;
  lessonTitle: string;
  unitId: string;
  unitNumber: number;
  unitTitle: string;
};
