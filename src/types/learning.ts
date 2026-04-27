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
};

export type Unit = {
  id: string;
  number: number;
  title: string;
  description: string;
  lessons: Lesson[];
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
