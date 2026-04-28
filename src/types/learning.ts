export type ExerciseType = "multiple-choice" | "translation" | "matching";

export type Phrase = {
  id: string;
  romanized: string;
  bengaliScript?: string;
  english: string;
  pronunciation: string;
  category: string;
  audioUrl?: string;
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
  slug?: string;
  objectives?: string[];
  vocabulary?: VocabularyItem[];
  grammar?: GrammarPoint[];
  audioPrompts?: AudioPrompt[];
  uiText?: LessonUiText;
  metadata?: LessonMetadata;
  reviewSchedule?: ReviewSchedule;
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

export type ProgressState = {
  completedLessons: string[];
  encounteredPhraseIds: string[];
  xp: number;
  streak: number;
  currentUnit: number;
  lastPracticeDate: string | null;
  mistakes: Mistake[];
};

export type LearnedWord = {
  phrase: Phrase;
  lessonId: string;
  lessonTitle: string;
  unitId: string;
  unitNumber: number;
  unitTitle: string;
};
