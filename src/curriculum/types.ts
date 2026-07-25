// Types for the Spanish curriculum pack (content/spanish-curriculum.json).
// The source-of-truth shapes mirror the pack's own types.ts; the exercise and
// seed types below are what this pipeline produces.

export type CEFR = "Intro" | "A1" | "A2" | "B1" | "B2";

export type ExerciseType =
  | "picture_select"
  | "match_pairs"
  | "word_bank_translation"
  | "typed_translation"
  | "fill_blank"
  | "sentence_order"
  | "listen_select"
  | "listen_type"
  | "speak_repeat"
  | "dialogue_response"
  | "reading_comprehension"
  | "open_response";

export interface VocabularyItem {
  id: string;
  spanish: string;
  english: string;
  part_of_speech: string;
  status: string;
}

export interface PhrasePattern {
  id: string;
  spanish: string;
  english: string;
  status: string;
}

export interface Lesson {
  lesson_index: number;
  name: string;
  goal: string;
  exercise_mix: ExerciseType[];
  estimated_exercises: number;
  new_content_ratio: number;
  content_focus: {
    vocabulary_ids: string[];
    phrase_ids: string[];
  };
}

export interface Unit {
  id: string;
  section: number;
  unit: number;
  title: string;
  cefr: CEFR;
  score_range: string;
  communicative_goal: string;
  grammar_targets: string[];
  vocabulary: VocabularyItem[];
  phrase_patterns: PhrasePattern[];
  lesson_sequence: Lesson[];
  unit_assessment: {
    can_do_statement: string;
    minimum_mastery: {
      vocabulary_recall: number;
      sentence_accuracy: number;
      listening_accuracy: number;
      open_response_required: boolean;
    };
  };
  review_schedule_days: number[];
  provenance: {
    unit_title: string;
    vocabulary_phrases_grammar: string;
    duolingo_sentence_bank_copied: boolean;
  };
}

export interface CourseSection {
  section: number;
  title_es: string;
  description: string;
  cefr: CEFR;
  score_range: string;
  unit_ids: string[];
}

export interface Course {
  course_id: string;
  title: string;
  version: string;
  target: string;
  legal_note: string;
  sections: CourseSection[];
  units: Unit[];
}

// ---------------------------------------------------------------------------
// Generated exercises
// ---------------------------------------------------------------------------

export interface MatchPair {
  spanish: string;
  english: string;
}

/** A generated exercise. `acceptable_answers` is always an array (see CLAUDE.md). */
export interface GeneratedExercise {
  /** Stable external id, derived from the lesson + type + index. */
  external_id: string;
  type: ExerciseType;
  prompt: string;
  skills: string[];
  /** Spanish-facing content, populated per type. */
  pairs?: MatchPair[];
  sentence?: string;
  before?: string;
  after?: string;
  tokens?: string[];
  options?: string[];
  dialogue_prompt?: { spanish: string; english: string };
  english_prompt?: string;
  /** Every valid answer; grading normalizes case/punctuation. */
  acceptable_answers: string[];
  /** Source ids so seeds can trace provenance. */
  source: {
    unit_id: string;
    lesson_index: number;
    vocabulary_ids: string[];
    phrase_ids: string[];
  };
}

// ---------------------------------------------------------------------------
// Seed records (external id from JSON, internal uuid generated separately)
// ---------------------------------------------------------------------------

export interface SeedRecord {
  id: string; // internal uuid
  external_id: string; // stable id from the pack
}

export interface SeedBundle {
  course: SeedRecord & {
    course_id: string;
    title: string;
    version: string;
    target: string;
  };
  sections: Array<SeedRecord & { course_id: string; section: number; cefr: string }>;
  units: Array<
    SeedRecord & {
      course_id: string;
      section: number;
      unit: number;
      title: string;
      cefr: string;
      review_schedule_days: number[];
      provenance: Unit["provenance"];
    }
  >;
  vocabulary_items: Array<SeedRecord & { unit_external_id: string; spanish: string; english: string; part_of_speech: string }>;
  phrase_patterns: Array<SeedRecord & { unit_external_id: string; spanish: string; english: string }>;
  lessons: Array<SeedRecord & { unit_external_id: string; lesson_index: number; name: string; goal: string }>;
  exercises: Array<SeedRecord & { lesson_external_id: string; type: ExerciseType; payload: GeneratedExercise }>;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}
