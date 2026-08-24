/**
 * Spanish Curriculum v2 — the reworked first twelve units.
 *
 * **Why a second file rather than an edit.** The 131-unit pack
 * (`content/spanish-curriculum.json`) is the working course; Units 13+ still
 * run on it and must keep working while the pilot is critiqued and reworked.
 * Editing the first twelve units in place would have made "compare v1 and v2"
 * a git operation rather than a flag. So the pilot lives here, the pack is
 * never touched, and `FEATURES.spanishPilotV2` decides which head the path has.
 *
 * **Why the same shape.** A pilot unit is a pack unit with extra optional
 * fields, not a new format. That is what lets one adapter, one planner walk and
 * one audit cover both halves of the course — and, more importantly, it is what
 * lets Unit 13 interleave review against pilot units. A post-hoc overlay would
 * have broken cumulative review at exactly the seam that matters.
 *
 * **Why vocabulary ids are reused.** Where a pilot unit teaches a word v1 also
 * taught, it keeps that word's id. Spaced-repetition memory, the word bank and
 * mistake history are keyed by phrase id, so a learner who already knows `hola`
 * does not start again from zero. New items get pilot ids.
 */

import rawPilot from "../../content/spanish-pilot.json";
import type { Lesson as PackLesson, Unit as PackUnit } from "@/curriculum/types";
import type { ScaffoldLevel } from "@/types/learning";

/** How many units at the head of the path the pilot replaces. */
export const PILOT_UNIT_COUNT = 12;

export type PilotDialogueLine = {
  spanish: string;
  english: string;
  receptive?: boolean;
};

export type PilotDialogue = {
  id?: string;
  scenario: string;
  turns: Array<{
    speaker?: string;
    prompt: PilotDialogueLine;
    reply: PilotDialogueLine;
    distractors?: string[];
  }>;
};

export type PilotChoice = {
  prompt: string;
  options: string[];
  answer: string;
  /** Shown after answering. On a prediction this is the rule. */
  explanation?: string;
  concepts?: string[];
};

export type PilotNotice = {
  id: string;
  title: string;
  examples: Array<{ spanish: string; english: string; note?: string }>;
  question: PilotChoice;
};

export type PilotStory = {
  id: string;
  title: string;
  setup?: string;
  lines: PilotDialogueLine[];
  questions: PilotChoice[];
};

export type PilotPattern = {
  id: string;
  template: string;
  english: string;
  fills: Array<{ spanish: string; english: string }>;
  concepts?: string[];
};

/** A vocabulary item that can arrive in a sentence rather than as a gloss. */
export type PilotVocabulary = PackUnit["vocabulary"][number] & {
  /** Meaning support that isn't a translation. Concrete nouns only. */
  emoji?: string;
  /** A sentence, in language the learner already has, that uses the word. */
  context_es?: string;
  context_en?: string;
};

/**
 * Which authored blocks a lesson uses.
 *
 * Optional: a unit with one story and one story lesson needs no wiring. It
 * earns its keep when a unit has two dialogues and wants a specific one in a
 * specific lesson.
 */
export type PilotLessonUses = {
  notices?: string[];
  stories?: string[];
  dialogues?: string[];
};

/**
 * A pilot lesson carries only what the app reads.
 *
 * `exercise_mix`, `estimated_exercises`, `new_content_ratio` and
 * `content_focus` exist in the pack for the seeding pipeline; the runtime has
 * ignored them since lessons became cumulative. Requiring authors to write four
 * dead fields per lesson would be ceremony.
 */
export type PilotLesson = Pick<PackLesson, "lesson_index" | "name" | "goal"> & {
  uses?: PilotLessonUses;
};

export type PilotUnit = Omit<
  PackUnit,
  "vocabulary" | "lesson_sequence" | "unit_assessment" | "provenance" | "review_schedule_days"
> & {
  vocabulary: PilotVocabulary[];
  lesson_sequence: PilotLesson[];
  /** The can-do statement this unit exists to deliver. */
  objective?: string;
  /** How much support this unit's lessons give; 5 (most) down to 1 (least). */
  scaffold?: ScaffoldLevel;
  grammar_focus?: string;
  patterns?: PilotPattern[];
  notices?: PilotNotice[];
  stories?: PilotStory[];
  dialogues?: PilotDialogue[];
  unit_assessment?: PackUnit["unit_assessment"];
  review_schedule_days?: number[];
};

type PilotPack = {
  pilot_id: string;
  version: string;
  /** Replaces the pack's own section 1 in the path browser. */
  section: { section: number; title_es: string; description: string };
  units: PilotUnit[];
};

const pack = rawPilot as unknown as PilotPack;

export const pilotSection = pack.section;

/** The pilot units, in path order. */
export const pilotUnits: PilotUnit[] = [...pack.units].sort((a, b) => a.unit - b.unit);

export const pilotMeta = { id: pack.pilot_id, version: pack.version };
