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
  /**
   * A short sentence, made of language the learner already has, that shows the
   * word being used. The pilot curriculum introduces vocabulary through this
   * rather than through a bare gloss: "Tengo sed. Quiero agua." teaches `agua`
   * better than "agua = water" does, and the direct meaning question can then
   * come later, in a different lesson.
   */
  context?: { target: string; english: string };
  /** Meaning support that isn't a translation. Concrete nouns only. */
  emoji?: string;
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
  | "strengthen"
  // The pilot curriculum's kinds. A unit picks the lessons it needs rather than
  // running all six in order, so these are additions, not replacements.
  /** Pattern discovery: read examples, predict a form, *then* see the rule. */
  | "notice"
  /** Comprehensible input: a short story, understood rather than translated. */
  | "story"
  /** Dialogue-led: interpret and respond across several turns. */
  | "scenario"
  /** The end-of-pilot assessment shape. */
  | "capstone";

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
  /**
   * Language the learner only needs to *understand*, not produce.
   *
   * A real conversation sometimes has to use an expression before the course
   * formally teaches it — "Mucho gusto" is the natural reply to a first
   * introduction. Marking it receptive lets the UI say so plainly instead of
   * leaving the learner wondering what they missed. Replies are never
   * receptive: the learner is only ever asked to produce taught language.
   */
  receptive?: boolean;
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
/**
 * A reusable sentence frame and the things that can go in its slot.
 *
 * Authored, because which fills make sense in a frame is a judgement: "Quiero
 * un café" and "Quiero el agua" are both fine, "Quiero muy" is not. The engine
 * can infer frames from a grammar rule's markers, but an authored pattern says
 * what the unit actually wants the learner to be able to build.
 */
export type LanguagePattern = {
  id: string;
  /** The frame, with `{}` marking the slot: "Quiero {}". */
  template: string;
  english: string;
  /** What can fill the slot, in the target language. */
  fills: Array<{ target: string; english: string }>;
  /** Grammar concepts this pattern exercises. */
  concepts?: string[];
};

/**
 * A question with fixed options that isn't about one phrase.
 *
 * Pattern predictions and story comprehension both ask "which of these", but
 * neither maps to a vocabulary item the way `recognize` does. One shape covers
 * both rather than a step type per activity.
 */
export type ChoiceQuestion = {
  prompt: string;
  options: string[];
  answer: string;
  /** Shown after answering — the rule, or why that line means what it means. */
  explanation?: string;
  concepts?: string[];
};

/**
 * Pattern discovery, Language-Transfer style.
 *
 * The examples come first and the rule comes *last*: the learner is asked to
 * predict a form they were never taught, from three they have seen. Getting it
 * right is the point — it is evidence the pattern is already half-known, which
 * is exactly when an explanation lands.
 */
export type NoticeCard = {
  id: string;
  title: string;
  /** What the learner reads before being asked anything. */
  examples: GrammarExample[];
  /** The prediction. Its `explanation` is the rule, revealed after answering. */
  question: ChoiceQuestion;
};

/**
 * A short story, told in language the learner mostly has.
 *
 * Checked for *meaning* — a gist question and a detail question — rather than
 * word-by-word translation. The transcript is hidden until the learner asks
 * for it, so the first pass is genuinely comprehension.
 */
export type StoryScript = {
  id: string;
  title: string;
  /** English framing, one line, so the learner knows what they are hearing. */
  setup?: string;
  lines: DialogueLine[];
  questions: ChoiceQuestion[];
};

/**
 * How much support a lesson gives, 5 (most) down to 1 (least).
 *
 * Declared per unit so the pilot's twelve units visibly take the scaffolding
 * away: unit 1 hands the learner every prop, unit 12 hands them almost none.
 * Applied on top of the CEFR band; see `BAND_OVERRIDES` in
 * `@/lib/lesson-profiles`.
 */
export type ScaffoldLevel = 1 | 2 | 3 | 4 | 5;

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
  /** Reusable frames this lesson should practise. */
  patterns?: LanguagePattern[];
  /** Pattern-discovery cards, for a `notice` lesson. */
  notices?: NoticeCard[];
  /** Mini-stories, for a `story` lesson. */
  stories?: StoryScript[];
  /** How much support this lesson gives; see `ScaffoldLevel`. */
  scaffold?: ScaffoldLevel;
  /**
   * CEFR band, which decides how much scaffolding the profile keeps. See
   * `BAND_OVERRIDES` in `@/lib/lesson-profiles`.
   */
  band?: "Intro" | "A1" | "A2" | "B1";
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

/**
 * How a broader skill is going — "querer + noun", "adjective agreement".
 *
 * Deliberately *not* a second spaced-repetition system: there are no boxes and
 * no due dates, and it never feeds review selection. It is a running tally
 * derived from answers to exercises that exercise the concept, used to avoid
 * re-teaching something the learner has clearly got.
 */
export type ConceptMemory = {
  correct: number;
  total: number;
  lastSeenAt: string;
};

export type PhraseMemory = {
  // Leitner box 0-5: higher = better known = longer until next review.
  box: number;
  // ISO timestamp when this phrase is next due for review.
  dueAt: string;
  // ISO timestamp of the most recent time it was practiced.
  lastSeenAt: string;
  /**
   * Correct answers on a *production* format — build it, type it, complete it.
   *
   * The Leitner box says how well an item is remembered; this says whether the
   * learner has ever had to produce it, which is the difference between "has
   * seen `agua`" and "can say `agua`". It is the one thing the state model in
   * `@/lib/learning-state` cannot derive, so it is the one field added here.
   * Optional: saves written before it existed simply have none.
   */
  produced?: number;
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
   * Running accuracy per grammar concept. Added later, so saves written before
   * it exists simply have none.
   */
  conceptMemory: Record<string, ConceptMemory>;
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
