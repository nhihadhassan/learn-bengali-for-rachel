/**
 * The course registry: the single source of truth for *what courses exist* and
 * *what each course can do*.
 *
 * This module is deliberately **metadata only** — it imports no lesson content,
 * so it is cheap enough to live in the app shell and in the progress store,
 * which every route loads. Actual units/lessons/phrases are attached in
 * `src/lib/content.ts`, which is the heavy module.
 *
 * Adding a course should mean: add an entry here + a `units` provider in
 * `content.ts`. Platform code (navigation, progress persistence, the lesson
 * engine, the course picker) reads this registry instead of testing for
 * specific ids, so it needs no changes.
 *
 * Ids are **persisted** (they key local progress under
 * `learn-bengali-rachel-progress`). Never rename one without a migration.
 */

/** Every registered course id, in display order. Persisted — do not rename. */
export const COURSE_IDS = [
  "bengali",
  "spanish-peru",
  "spanish",
  "malayalam",
  "history",
] as const;

export type CourseId = (typeof COURSE_IDS)[number];

/**
 * What a course supports. Platform code branches on these, never on the course
 * id, so "if Spanish then listening" becomes "if this course supports
 * listening".
 */
export type CourseCapabilities = {
  /** Language drills vs. read-through history stories. */
  kind: "language" | "history";
  /** Has a native script alongside the romanized form (passed to TTS). */
  script: boolean;
  /** Learners read a romanized form rather than the native script. */
  transliteration: boolean;
  /**
   * Listening exercises ("tap what you hear"). Requires text-to-speech that is
   * actually reliable for the locale — romanized Bengali/Malayalam read by an
   * English voice is not, which is why those stay off.
   */
  listening: boolean;
  /** Dialogue exercises ("how do you reply?"). */
  dialogue: boolean;
  /** Spoken-repetition practice (archived; no course enables it yet). */
  speaking: boolean;
  /** Free-form AI roleplay practice. */
  roleplay: boolean;
  /** Can be placement-tested into, to skip ahead. */
  placement: boolean;
  /** Has practice songs in the Music section. */
  music: boolean;
  /**
   * How lessons are built.
   *
   * `"simple"` — a lesson teaches its own hand-authored phrase set. This is the
   * right model for the short phrase-book courses, where a unit *is* the
   * content and there is no deep backlog to interleave.
   *
   * `"cumulative"` — the course carries a curriculum plan per lesson
   * (`Lesson.plan`): a small set of genuinely new items plus prior material to
   * retrieve, with the six lesson types generating different kinds of work.
   * Only worth the machinery for a long, sequenced course.
   */
  lessonStrategy: "simple" | "cumulative";
};

/** The words a course uses for its own units of work. */
export type CourseNouns = {
  lesson: string;
  lessons: string;
  unit: string;
  units: string;
  /** What the vocabulary/recall surface is called. */
  wordBank: string;
};

/** Visual identity for a course, used by the course picker and course chip. */
export type CourseAccent = {
  emoji: string;
  /** Tailwind background class for the course tile. */
  tile: string;
  /** Tailwind background class for progress bars. */
  bar: string;
  /** Tailwind text class for course-colored labels. */
  text: string;
};

export type CourseDescriptor = {
  id: CourseId;
  label: string;
  shortLabel: string;
  description: string;
  /** BCP-47 locale used for pronunciation. */
  locale: string;
  capabilities: CourseCapabilities;
  nouns: CourseNouns;
  accent: CourseAccent;
};

const LANGUAGE_NOUNS: CourseNouns = {
  lesson: "lesson",
  lessons: "lessons",
  unit: "unit",
  units: "units",
  wordBank: "Word bank",
};

const HISTORY_NOUNS: CourseNouns = {
  lesson: "chapter",
  lessons: "chapters",
  unit: "era",
  units: "eras",
  wordBank: "Timeline",
};

function languageCapabilities(
  overrides: Partial<CourseCapabilities> = {},
): CourseCapabilities {
  return {
    kind: "language",
    script: false,
    transliteration: false,
    listening: false,
    dialogue: false,
    speaking: false,
    roleplay: false,
    placement: true,
    music: false,
    lessonStrategy: "simple",
    ...overrides,
  };
}

export const COURSES: CourseDescriptor[] = [
  {
    id: "bengali",
    label: "Bengali",
    shortLabel: "Bengali",
    description: "Simple spoken Bengali phrases for everyday conversation.",
    locale: "bn-BD",
    // Romanized Bengali with script kept for pronunciation. Listening stays off:
    // browser voices mangle romanized Bengali read as English.
    capabilities: languageCapabilities({ script: true, transliteration: true }),
    nouns: LANGUAGE_NOUNS,
    accent: {
      emoji: "🇧🇩",
      tile: "bg-violet-500",
      bar: "bg-violet-500",
      text: "text-violet-700 dark:text-violet-300",
    },
  },
  {
    id: "spanish-peru",
    label: "Spanish for Peru",
    shortLabel: "Peru",
    description:
      "Travel Spanish for Peru: taxis, food, hotels, tours, and emergencies.",
    locale: "es-PE",
    // Listening/dialogue are proven on the full Spanish course first; this
    // travel course can opt in once its shorter phrase set is checked.
    capabilities: languageCapabilities({ music: true }),
    nouns: LANGUAGE_NOUNS,
    accent: {
      emoji: "🇵🇪",
      tile: "bg-amber-500",
      bar: "bg-amber-500",
      text: "text-amber-700 dark:text-amber-300",
    },
  },
  {
    id: "spanish",
    label: "Spanish",
    shortLabel: "Spanish",
    description:
      "A research-grounded Spanish course: 131 units from café basics to real conversations.",
    locale: "es",
    // Spanish browser voices are widely available and accurate, so this course
    // gets the audio-dependent exercise types.
    // Long enough (131 units) for cumulative sequencing to pay off: lessons
    // build on each other and old units keep coming back.
    capabilities: languageCapabilities({
      listening: true,
      dialogue: true,
      music: true,
      lessonStrategy: "cumulative",
    }),
    nouns: LANGUAGE_NOUNS,
    accent: {
      emoji: "🇪🇸",
      tile: "bg-rose-500",
      bar: "bg-rose-500",
      text: "text-rose-700 dark:text-rose-300",
    },
  },
  {
    id: "malayalam",
    label: "Malayalam",
    shortLabel: "Malayalam",
    description:
      "Malayalam made gentle for beginners with spoken, romanized phrases.",
    locale: "ml-IN",
    capabilities: languageCapabilities({ transliteration: true }),
    nouns: LANGUAGE_NOUNS,
    accent: {
      emoji: "🇮🇳",
      tile: "bg-cyan-500",
      bar: "bg-cyan-500",
      text: "text-cyan-700 dark:text-cyan-300",
    },
  },
  {
    id: "history",
    label: "History",
    shortLabel: "History",
    description:
      "Bite-size story lessons about causes, turning points, and consequences.",
    locale: "en-US",
    capabilities: {
      kind: "history",
      script: false,
      transliteration: false,
      listening: false,
      dialogue: false,
      speaking: false,
      roleplay: false,
      placement: false,
      music: false,
      lessonStrategy: "simple",
    },
    nouns: HISTORY_NOUNS,
    accent: {
      emoji: "📜",
      tile: "bg-orange-500",
      bar: "bg-orange-500",
      text: "text-orange-700 dark:text-orange-300",
    },
  },
];

const courseById = new Map<CourseId, CourseDescriptor>(
  COURSES.map((course) => [course.id, course]),
);

/** The course a learner lands on when nothing is stored yet. */
export const defaultCourseId: CourseId = "bengali";

export function isCourseId(value: unknown): value is CourseId {
  return (
    typeof value === "string" && courseById.has(value as CourseId)
  );
}

/** Coerce persisted/user input to a known course id. */
export function toCourseId(value: unknown): CourseId {
  return isCourseId(value) ? value : defaultCourseId;
}

export function getCourse(courseId: CourseId): CourseDescriptor {
  return courseById.get(courseId) ?? COURSES[0];
}

export function getCapabilities(courseId: CourseId): CourseCapabilities {
  return getCourse(courseId).capabilities;
}

/** True when the course teaches a language (as opposed to history stories). */
export function isLanguageCourse(courseId: CourseId): boolean {
  return getCapabilities(courseId).kind === "language";
}

export function getCourseNouns(courseId: CourseId): CourseNouns {
  return getCourse(courseId).nouns;
}

/**
 * A short, human name for the course — used in sentences like "your Spanish
 * word bank". Strips the parenthetical/"course" suffixes older labels carried.
 */
export function getCourseShortName(courseId: CourseId): string {
  return getCourse(courseId).shortLabel;
}

/**
 * Above this many units, the lesson path switches from "show everything" to a
 * section-windowed browser. The full Spanish course has 131 units; the others
 * have a handful.
 */
export const LARGE_COURSE_UNIT_COUNT = 14;

/** Build a record keyed by every registered course. */
export function mapCourses<T>(create: (courseId: CourseId) => T): Record<CourseId, T> {
  return Object.fromEntries(
    COURSE_IDS.map((courseId) => [courseId, create(courseId)]),
  ) as Record<CourseId, T>;
}
