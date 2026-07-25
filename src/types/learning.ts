export type CurriculumId =
  | "bengali"
  | "spanish-peru"
  | "spanish"
  | "malayalam"
  | "history";

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

export type UnitMetadata = {
  difficultyBand: string;
  estimatedTotalMinutes: number;
  tags: string[];
};

export type Unit = {
  id: string;
  number: number;
  title: string;
  description: string;
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
