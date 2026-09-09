/**
 * The cumulative teaching plan: *what* each lesson introduces and *what it
 * brings back*.
 *
 * The problem this replaces: the Spanish pack gives all six lessons in a unit
 * the same `content_focus`, so the adapter rotated a five-item window over it
 * (`offset = (lesson_index - 1) * 5 % length`). Each lesson was therefore "five
 * of this unit's fifteen items", nothing from an earlier unit ever returned,
 * and finishing a unit meant its vocabulary was never seen again.
 *
 * Here a unit's fifteen items are introduced **across** its six lessons, a few
 * at a time, and every lesson also carries prior material: the items from the
 * lessons just before it, plus a spaced sample from earlier units. So
 * lesson 3 is not "items 11-15", it is "three new things and everything you
 * met on Monday".
 *
 * This module is pure, deterministic and learner-independent on purpose. The
 * curriculum decides *what should be learned*; `@/lib/learner-model` then
 * decides which of the review candidates are worth the learner's time *today*.
 * Keeping the split means the schedule can be asserted offline
 * (`scripts/lesson-plan.test.ts`) and a brand-new learner still gets a
 * sensible, cumulative lesson.
 */

import { makeRng, seededShuffle } from "@/lib/rng";
import { isContentWord, normalizeWord, splitWords } from "@/lib/text-tokens";
import type { LessonKind, LessonPlan } from "@/types/learning";

export type PlanItemKind = "vocabulary" | "phrase";

export type PlanItem = {
  id: string;
  /** The target-language text, used for prerequisite ordering. */
  text: string;
  kind: PlanItemKind;
};

export type PlanUnit = {
  id: string;
  /** 1-based position in the course. */
  number: number;
  items: PlanItem[];
};

/**
 * The six lesson types, in path order. Names come from the pack's
 * `lesson_sequence[].name`; `toLessonKind` maps them.
 */
export const UNIT_LESSON_KINDS: LessonKind[] = [
  "discover",
  "build",
  "grammar",
  "listen",
  "context",
  "review",
];

const KIND_BY_NAME: Record<string, LessonKind> = {
  discover: "discover",
  build: "build",
  "grammar focus": "grammar",
  // The lesson was renamed once it was clear it contained no speaking. The old
  // name stays mapped so nothing breaks if a stale pack is loaded.
  "listen and understand": "listen",
  "listen and speak": "listen",
  "use in context": "context",
  "unit review": "review",
  // The pilot curriculum's lesson names. A unit names the lessons it needs, so
  // this table is a vocabulary rather than a sequence.
  "notice the pattern": "notice",
  "work it out": "notice",
  "story": "story",
  "listen to a story": "story",
  "read a story": "story",
  "have a conversation": "scenario",
  scenario: "scenario",
  capstone: "capstone",
  "put it together": "capstone",
};

const LESSON_KINDS = new Set<string>(Object.values(KIND_BY_NAME));

/**
 * Which recipe a lesson runs.
 *
 * A pack may say so outright (`kind`), and a pack that cares what its lessons
 * are *called* has to: the name is the title on the learner's screen, and
 * "Your First Greeting" is a better thing to read than "Discover". Deriving the
 * recipe from that title is what forced every unit to be a visible
 * Discover/Build/Grammar/Listen march — the learner saw the machinery because
 * the machinery was the only place the name could live.
 *
 * So `kind` decides when given. Without one, the old name table still maps the
 * Spanish pack's labels, and position still decides after that.
 */
export function toLessonKind(
  name: string,
  lessonIndex: number,
  kind?: string,
): LessonKind {
  if (kind && LESSON_KINDS.has(kind)) {
    return kind as LessonKind;
  }

  return (
    KIND_BY_NAME[name.trim().toLowerCase()] ??
    UNIT_LESSON_KINDS[lessonIndex - 1] ??
    "build"
  );
}

/**
 * How each lesson's share of a unit's new language is weighted, by item type.
 *
 * These are *weights*, not counts: a unit's actual items are divided among the
 * lessons in these proportions, so the schedule works whether a unit holds the
 * pack's usual 10 + 5 or the larger sets the hand-sequenced early units carry.
 * The shape is the pedagogy — most new words arrive early, phrase patterns
 * arrive once their words exist, and "Unit review" introduces nothing at all.
 */
const NEW_WEIGHTS: Record<LessonKind, { vocabulary: number; phrases: number }> = {
  discover: { vocabulary: 3, phrases: 1 },
  build: { vocabulary: 3, phrases: 1 },
  grammar: { vocabulary: 3, phrases: 1 },
  listen: { vocabulary: 2, phrases: 0 },
  context: { vocabulary: 1, phrases: 2 },
  review: { vocabulary: 0, phrases: 0 },
  strengthen: { vocabulary: 0, phrases: 0 },
  // A discovery lesson needs the *words* in hand and one good sentence to
  // notice. Two new sentences at once and the pattern competes with the
  // vocabulary they are built from.
  notice: { vocabulary: 3, phrases: 1 },
  // A story is built from language the learner already has; it introduces the
  // odd word in passing rather than carrying a teaching load.
  story: { vocabulary: 1, phrases: 1 },
  scenario: { vocabulary: 1, phrases: 2 },
  // Like the unit review, a capstone introduces nothing: it is the check.
  capstone: { vocabulary: 0, phrases: 0 },
};

/**
 * The hard ceiling on new items in one lesson. Lesson length is held near five
 * minutes, and the slots that would have gone to a fifth new word are worth
 * more spent on retrieving old ones — that trade is the whole point of the
 * cumulative model.
 */
export const MAX_NEW_ITEMS_PER_LESSON = 4;

/**
 * Split `total` items across `weights` using the largest-remainder method, so
 * the counts always sum to exactly `total` — nothing in a unit is silently
 * left untaught by a rounding error.
 */
function distribute(total: number, weights: readonly number[]): number[] {
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);

  if (total <= 0 || weightSum <= 0) {
    return weights.map(() => 0);
  }

  const exact = weights.map((weight) => (total * weight) / weightSum);
  const counts = exact.map(Math.floor);
  let remaining = total - counts.reduce((sum, count) => sum + count, 0);

  const order = exact
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);

  for (const { index } of order) {
    if (remaining <= 0) break;
    counts[index] += 1;
    remaining -= 1;
  }

  return counts;
}

/**
 * Per-lesson new-item counts for a unit, respecting both the weighting and the
 * per-lesson ceiling. Anything the ceiling displaces moves to the next lesson
 * with room rather than being dropped.
 */
function newItemPlan(
  lessonKinds: readonly LessonKind[],
  vocabularyCount: number,
  phraseCount: number,
): Array<{ vocabulary: number; phrases: number }> {
  const vocabulary = distribute(
    vocabularyCount,
    lessonKinds.map((kind) => NEW_WEIGHTS[kind].vocabulary),
  );
  const phrases = distribute(
    phraseCount,
    lessonKinds.map((kind) => NEW_WEIGHTS[kind].phrases),
  );

  const plan = lessonKinds.map((_, index) => ({
    vocabulary: vocabulary[index],
    phrases: phrases[index],
  }));

  // Push overflow forward, moving *words* before sentences.
  //
  // Holding sentences back looks cheaper, but it produced units whose first
  // three lessons were nothing but vocabulary — so the grammar lesson arrived
  // having never shown the pattern in a sentence, and had nothing to explain.
  // One word of vocabulary always stays, so a lesson can still supply what its
  // sentence needs.
  for (let index = 0; index < plan.length; index += 1) {
    const entry = plan[index];
    let overflow = entry.vocabulary + entry.phrases - MAX_NEW_ITEMS_PER_LESSON;

    while (overflow > 0) {
      const next = plan[index + 1];

      // Never spill into a lesson that teaches nothing — a review or a
      // capstone. "Introduces nothing new" is what makes it a check rather than
      // a lesson. A slightly over-full teaching lesson is the lesser problem,
      // so the overflow stops here instead.
      if (!next || newItemWeight(lessonKinds[index + 1]) === 0) {
        break;
      }

      if (entry.vocabulary > 1 || entry.phrases === 0) {
        entry.vocabulary -= 1;
        next.vocabulary += 1;
      } else {
        entry.phrases -= 1;
        next.phrases += 1;
      }

      overflow -= 1;
    }
  }

  return plan;
}

/**
 * How many prior items each lesson may draw on: from earlier in the same unit,
 * and from units the learner finished before this one.
 *
 * These are *candidate pools*, not question counts. A lesson asks about a
 * dozen things at most; offering more candidates than that is what gives the
 * learner model room to pick the weak and due ones.
 */
const REVIEW_LOAD: Record<
  LessonKind,
  { fromUnit: number; fromEarlierUnits: number }
> = {
  discover: { fromUnit: 0, fromEarlierUnits: 3 },
  build: { fromUnit: 4, fromEarlierUnits: 3 },
  grammar: { fromUnit: 7, fromEarlierUnits: 3 },
  listen: { fromUnit: 8, fromEarlierUnits: 3 },
  context: { fromUnit: 10, fromEarlierUnits: 4 },
  review: { fromUnit: 15, fromEarlierUnits: 8 },
  strengthen: { fromUnit: 0, fromEarlierUnits: 12 },
  notice: { fromUnit: 6, fromEarlierUnits: 3 },
  story: { fromUnit: 9, fromEarlierUnits: 5 },
  scenario: { fromUnit: 10, fromEarlierUnits: 4 },
  // The capstone reaches across the whole pilot; that is what makes it earned.
  capstone: { fromUnit: 18, fromEarlierUnits: 14 },
};

/** The weighted share a lesson kind takes of a unit's new material. */
export function newItemWeight(kind: LessonKind): number {
  const weights = NEW_WEIGHTS[kind];
  return weights.vocabulary + weights.phrases;
}

/**
 * How far back to reach for interleaved review. Expanding gaps mean a unit
 * keeps resurfacing long after it is "finished" — unit 1 comes back in units 2,
 * 3, 5, 9 and 17 — rather than being revisited once and forgotten.
 */
const SPACED_UNIT_DISTANCES = [1, 2, 4, 8, 16];

/**
 * How much of the previous unit a new unit opens by bringing back.
 *
 * Enough that the seam between two units is a step rather than a jump; small
 * enough that the opening lesson is still about its own material.
 */
const CARRY_OVER_ITEMS = 4;

/**
 * Content words in `text`, with slash variants split apart.
 *
 * Vocabulary entries write gendered pairs as one token — `pequeño/pequeña`,
 * `español/española` — and treating that as a single word means neither half
 * ever matches a real sentence. Both halves are separate words to a learner.
 */
function contentWordSet(text: string): Set<string> {
  const words = new Set<string>();
  const tokens = splitWords(text);

  tokens.forEach((token, index) => {
    if (isProperNoun(token, index, tokens)) {
      return;
    }

    for (const word of token.split("/")) {
      if (word && isContentWord(word)) {
        words.add(normalizeWord(word));
      }
    }
  });

  return words;
}

/**
 * A name is not vocabulary.
 *
 * "Ella se llama Sofía." does not introduce a word the course owes the learner
 * an explanation for — Sofía is a person, and no curriculum teaches it. The
 * signal is capitalisation away from the start of a sentence, which is exactly
 * what Spanish orthography uses for names and nowhere else (months, days,
 * languages and nationalities are all lowercase).
 */
function isProperNoun(token: string, index: number, tokens: readonly string[]): boolean {
  const bare = token.replace(/^[¿¡"'(]+/, "");

  if (!/^\p{Lu}/u.test(bare)) {
    return false;
  }

  if (index === 0) {
    return false;
  }

  // Capitalised because the previous token ended a sentence, not because it is
  // a name.
  return !/[.!?]$/.test(tokens[index - 1]);
}

/**
 * Undo Spanish's most common stem change so a conjugated form can be matched
 * back to the infinitive the learner was taught: quiero → quero (querer),
 * puedo → podo (poder).
 */
function unstem(word: string): string {
  return word.replace(/ie/, "e").replace(/ue/, "o");
}

/**
 * Decides whether a word is covered by what the learner has been taught.
 *
 * Injected rather than imported so this module stays language-agnostic: the
 * Spanish course passes `isKnownForm` from `@/lib/spanish-lexicon`, which knows
 * that `tienes` is `tener`. Without one, the crude stem match below applies.
 */
export type KnownWordResolver = (
  word: string,
  known: ReadonlySet<string>,
) => boolean;

/**
 * Loose match so "hablo" counts as knowing "hablar" without shipping a
 * stemmer. Three characters is enough to link tengo/tener and vivo/vivir while
 * still keeping, say, "casa" and "caro" apart.
 *
 * This is the fallback. A course with a real lexicon should pass a
 * `KnownWordResolver` instead — the stem heuristic quietly misses `voy`/`ir`
 * and `es`/`ser`, which are exactly the words that matter most.
 */
export function sharesStem(word: string, candidate: string): boolean {
  if (word === candidate) {
    return true;
  }

  const a = unstem(word);
  const b = unstem(candidate);

  if (a.length < 3 || b.length < 3) {
    return a === b;
  }

  return a.slice(0, 3) === b.slice(0, 3);
}

function isKnownWord(
  word: string,
  known: ReadonlySet<string>,
  resolve?: KnownWordResolver,
): boolean {
  if (known.has(word)) {
    return true;
  }

  if (resolve) {
    return resolve(word, known);
  }

  for (const candidate of known) {
    if (sharesStem(word, candidate)) {
      return true;
    }
  }

  return false;
}

/**
 * How much of a phrase the learner can already read, 0-1. Used to introduce
 * phrase patterns *after* the words they are built from, so a sentence is a new
 * arrangement of known pieces rather than five new words at once.
 */
export function coverage(
  text: string,
  knownWords: ReadonlySet<string>,
  resolve?: KnownWordResolver,
): number {
  const words = [...contentWordSet(text)];

  if (words.length === 0) {
    return 1;
  }

  const known = words.filter((word) => isKnownWord(word, knownWords, resolve)).length;
  return known / words.length;
}

/** The content words of `text` the learner has *not* met yet. */
export function unknownWords(
  text: string,
  knownWords: ReadonlySet<string>,
  resolve?: KnownWordResolver,
): string[] {
  return [...contentWordSet(text)].filter(
    (word) => !isKnownWord(word, knownWords, resolve),
  );
}

/**
 * Every word a taught item puts in the learner's hands.
 *
 * Deliberately wider than `contentWordSet`, which screens out short and
 * functional words because they make poor cloze blanks. That screen is right
 * for *choosing a question* and wrong for *recording what was taught*: `ir` is
 * two letters long, and dropping it meant "Voy a comprar fruta." looked like it
 * used a verb the course had never introduced.
 */
export function taughtWordSet(text: string): Set<string> {
  const words = new Set<string>();

  for (const token of splitWords(text)) {
    for (const part of token.split("/")) {
      const word = normalizeWord(part);

      if (word) {
        words.add(word);
      }
    }
  }

  return words;
}

function addWords(target: Set<string>, text: string) {
  for (const word of taughtWordSet(text)) {
    target.add(word);
  }
}

/**
 * Which vocabulary item to introduce next: the one the unit's remaining phrase
 * patterns need most. Ties fall back to curriculum order, so a hand-sequenced
 * unit keeps its intended shape.
 */
function pickNextVocabulary(
  vocabulary: readonly PlanItem[],
  remainingPhrases: readonly PlanItem[],
  knownWords: ReadonlySet<string>,
  resolve?: KnownWordResolver,
  grammarWords: readonly string[] = [],
): number {
  if (remainingPhrases.length === 0 && grammarWords.length === 0) {
    return 0;
  }

  // The phrase pattern closest to being readable is the one that will be
  // introduced next, so the words *it* is missing matter most. Spreading the
  // weight evenly across every remaining phrase leaves ties everywhere and the
  // unit falls back to arbitrary curriculum order.
  const nextPhrase = [...remainingPhrases].sort(
    (a, b) =>
      coverage(b.text, knownWords, resolve) - coverage(a.text, knownWords, resolve),
  )[0];

  const urgent = new Set(
    nextPhrase ? unknownWords(nextPhrase.text, knownWords, resolve) : [],
  );
  const laterNeed = new Map<string, number>();

  for (const phrase of remainingPhrases) {
    if (phrase === nextPhrase) continue;

    for (const word of contentWordSet(phrase.text)) {
      laterNeed.set(word, (laterNeed.get(word) ?? 0) + 1);
    }
  }

  let bestIndex = 0;
  let bestScore = -1;

  vocabulary.forEach((item, index) => {
    let score = 0;

    for (const word of contentWordSet(item.text)) {
      if (urgent.has(word)) {
        score += 10;
      }
      score += laterNeed.get(word) ?? 0;
    }

    // Words the unit's grammar lesson is about — buenos/buenas for a lesson on
    // greeting agreement — should be in hand before that lesson explains them.
    if (demonstrates(item.text, grammarWords)) {
      score += 5;
    }

    // Strictly greater keeps the earliest item on a tie.
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });

  return bestIndex;
}

/** Does `text` contain any of the words a grammar rule is built around? */
function demonstrates(text: string, grammarWords: readonly string[]): boolean {
  if (grammarWords.length === 0) {
    return false;
  }

  const words = new Set(splitWords(text).map(normalizeWord));

  return grammarWords.some((marker) => {
    const parts = splitWords(marker).map(normalizeWord);
    return parts.every((part) => words.has(part));
  });
}

export type PlannedLesson = {
  kind: LessonKind;
  newPhraseIds: string[];
  reviewPhraseIds: string[];
  interleavedPhraseIds: string[];
};

/**
 * Plan one unit's lessons.
 *
 * `priorUnits` are the units before this one in path order, oldest first; they
 * supply both the interleaved review and the vocabulary that makes a phrase
 * pattern "mostly known" already.
 */
export type PlanUnitOptions = {
  lessonKinds?: readonly LessonKind[];
  sharedQueues?: ReviewQueues;
  /** How to decide a word is already known; see `KnownWordResolver`. */
  resolveKnown?: KnownWordResolver;
  /**
   * Words the unit's grammar lesson will explain.
   *
   * A unit should have shown the pattern before it names it, so phrases that
   * demonstrate these words are introduced in the lessons *before* the grammar
   * lesson. Without this, a unit could explain "me gusta" having used it once.
   */
  grammarWords?: readonly string[];
  /**
   * The item ids each lesson teaches, indexed by lesson position.
   *
   * An empty (or missing) entry leaves that lesson to the planner's own
   * choosing, so a unit can hand-place its opening lessons and let the rest
   * fall out automatically.
   */
  assignedItems?: ReadonlyArray<readonly string[]>;
  /**
   * How hard this course reaches back for interleaved review, as a multiplier
   * on `REVIEW_LOAD.fromEarlierUnits`.
   *
   * The default suits a long course: across 131 units, three interleaved items
   * a lesson is plenty, because every unit gets many later units to resurface
   * it. A fourteen-unit course has to do the same recycling in a tenth of the
   * opportunities, and at the default a third of its vocabulary is introduced
   * and then never seen again — which is the phrase-book failure the cumulative
   * model exists to prevent.
   */
  interleaveScale?: number;
};

export function planUnit(
  unit: PlanUnit,
  priorUnits: readonly PlanUnit[],
  {
    lessonKinds = UNIT_LESSON_KINDS,
    sharedQueues = createReviewQueues(),
    resolveKnown,
    grammarWords = [],
    assignedItems = [],
    interleaveScale = 1,
  }: PlanUnitOptions = {},
): PlannedLesson[] {
  const vocabulary = unit.items.filter((item) => item.kind === "vocabulary");
  const phrases = unit.items.filter((item) => item.kind === "phrase");

  // Words the learner brings into this unit.
  const knownWords = new Set<string>();
  for (const prior of priorUnits) {
    for (const item of prior.items) {
      addWords(knownWords, item.text);
    }
  }

  const remainingVocabulary = [...vocabulary];
  const remainingPhrases = [...phrases];
  const loads = newItemPlan(lessonKinds, vocabulary.length, phrases.length);
  /** Items introduced in this unit so far, most recent last. */
  const introduced: string[] = [];
  const plans: PlannedLesson[] = [];
  const interleaver = createInterleaver(unit, priorUnits, sharedQueues);

  const grammarLesson = lessonKinds.indexOf("grammar");
  let patternShown = false;

  lessonKinds.forEach((kind, index) => {
    const load = loads[index] ?? { vocabulary: 0, phrases: 0 };
    // Before the grammar lesson, bias selection toward its pattern.
    const grammarNeeded = grammarLesson >= 0 && index <= grammarLesson;
    const newIds: string[] = [];

    // A lesson may name the items it teaches, and then it teaches exactly
    // those.
    //
    // The heuristic below is good at "which sentence can the learner read
    // next", which is the right question for a long pack nobody hand-sequences.
    // It is the wrong question for a unit whose lessons have titles: a lesson
    // called "Your first greeting" that opens by teaching `khub bhalo` is not
    // a scheduling imperfection, it is the lesson being about the wrong thing.
    // Authored assignment wins outright where it is given, per lesson, so a
    // unit can hand-place the four lessons that matter and leave the rest to
    // the planner.
    const assigned = assignedItems[index];

    if (assigned && assigned.length > 0) {
      for (const id of assigned) {
        const fromPhrases = remainingPhrases.findIndex((item) => item.id === id);

        if (fromPhrases >= 0) {
          const [item] = remainingPhrases.splice(fromPhrases, 1);
          newIds.push(item.id);
          addWords(knownWords, item.text);

          if (demonstrates(item.text, grammarWords)) {
            patternShown = true;
          }

          continue;
        }

        const fromVocabulary = remainingVocabulary.findIndex(
          (item) => item.id === id,
        );

        if (fromVocabulary >= 0) {
          const [item] = remainingVocabulary.splice(fromVocabulary, 1);
          newIds.push(item.id);
          addWords(knownWords, item.text);
        }
      }
    }

    // Phrases are chosen first, then the vocabulary they need.
    //
    // Doing it the other way round let a lesson commit to "Vivo en un
    // apartamento pequeño." and then teach a different set of words, so the
    // learner met the sentence a lesson before `el apartamento` existed.
    // Choosing the sentence first and supplying its words in the same lesson
    // makes that structurally impossible.
    const reachable = new Set(knownWords);
    for (const item of remainingVocabulary) {
      addWords(reachable, item.text);
    }

    const chosenPhrases: PlanItem[] = [];
    const phraseLoad = assigned && assigned.length > 0 ? 0 : load.phrases;
    const vocabularyLoad = assigned && assigned.length > 0 ? 0 : load.vocabulary;

    for (let taken = 0; taken < phraseLoad; taken += 1) {
      if (remainingPhrases.length === 0) break;

      // Last chance: the grammar lesson must not name a pattern this unit has
      // never shown, so if none of its sentences has demonstrated it yet, the
      // choice is restricted to ones that do (and that the learner can read).
      const mustShowPattern =
        grammarNeeded && index === grammarLesson && !patternShown;
      const candidates = mustShowPattern
        ? remainingPhrases.filter(
            (candidate) =>
              demonstrates(candidate.text, grammarWords) &&
              coverage(candidate.text, reachable, resolveKnown) === 1,
          )
        : remainingPhrases;
      const pool = candidates.length > 0 ? candidates : remainingPhrases;

      let bestIndex = 0;
      let bestScore = -Infinity;

      pool.forEach((candidate, candidateIndex) => {
        // How much of it the learner could read once this lesson's vocabulary
        // is taught, bucketed so grammar relevance only breaks near-ties.
        const readable = coverage(candidate.text, reachable, resolveKnown);
        // The bonus applies only to sentences that are *fully* readable, so
        // preferring the unit's pattern can never pull a phrase in ahead of the
        // words it needs. Among equally readable candidates it decides.
        const showsPattern =
          grammarNeeded && readable === 1 && demonstrates(candidate.text, grammarWords);
        const score = Math.round(readable * 4) / 4 + (showsPattern ? 0.5 : 0);

        if (score > bestScore) {
          bestScore = score;
          bestIndex = candidateIndex;
        }
      });

      const chosen = pool[bestIndex];
      remainingPhrases.splice(remainingPhrases.indexOf(chosen), 1);
      chosenPhrases.push(chosen);

      if (demonstrates(chosen.text, grammarWords)) {
        patternShown = true;
      }
    }

    // Vocabulary: whatever those sentences are still missing comes first.
    const needed = new Set<string>();
    for (const phrase of chosenPhrases) {
      for (const word of unknownWords(phrase.text, knownWords, resolveKnown)) {
        needed.add(word);
      }
    }

    // The loop runs for the lesson's share of vocabulary *and* for as long as
    // one of this lesson's chosen sentences is still missing a word.
    //
    // Holding to the share exactly is what produced "Buenas noches. Adiós."
    // in a lesson with only two vocabulary slots, both spent elsewhere: the
    // sentence arrived and `adiós` did not. A lesson one item over its share is
    // a much smaller problem than a sentence containing a word the course has
    // never shown.
    for (let taken = 0; taken < vocabularyLoad || needed.size > 0; taken += 1) {
      if (remainingVocabulary.length === 0) break;

      // Matched through the resolver, not by string equality: the sentence
      // needs "estoy" and the vocabulary entry is "estar", which is the same
      // word as far as the learner is concerned.
      const supplies = remainingVocabulary.findIndex((item) => {
        const supplied = contentWordSet(item.text);

        return [...needed].some(
          (word) =>
            supplied.has(word) ||
            (resolveKnown ? resolveKnown(word, supplied) : false),
        );
      });

      // Past the lesson's share, only a word one of its sentences needs is
      // worth taking. Nothing supplies the rest — a name, or a word this unit
      // simply does not teach — so stop rather than pull the whole unit in.
      if (taken >= vocabularyLoad && supplies < 0) {
        break;
      }

      const index =
        supplies >= 0
          ? supplies
          : pickNextVocabulary(
              remainingVocabulary,
              remainingPhrases,
              knownWords,
              resolveKnown,
              grammarNeeded ? grammarWords : [],
            );

      const [item] = remainingVocabulary.splice(index, 1);
      const supplied = contentWordSet(item.text);

      for (const word of [...needed]) {
        if (supplied.has(word) || (resolveKnown && resolveKnown(word, supplied))) {
          needed.delete(word);
        }
      }

      addWords(knownWords, item.text);
      newIds.push(item.id);
    }

    // Words before the sentences built from them.
    for (const phrase of chosenPhrases) {
      addWords(knownWords, phrase.text);
      newIds.push(phrase.id);
    }

    const reviewLoad = REVIEW_LOAD[kind];
    // Most recently introduced first: the previous lesson's material is what
    // needs consolidating, and older items in the unit have already had turns.
    const fromUnit = [...introduced].reverse().slice(0, reviewLoad.fromUnit);
    const interleaved = interleaver.take(
      Math.round(reviewLoad.fromEarlierUnits * interleaveScale),
      {
        // A unit's opening lesson has nothing of its own to look back on, so
        // everything it retrieves comes from earlier units. Drawing that from
        // the unit just finished is what makes a new unit feel like the next
        // one rather than a fresh start.
        nearestOnly: kind === "discover" || index === 0,
      },
    );

    // A unit's first lesson has nothing of its own to consolidate, and the
    // rotating queue may hand it items the learner last saw several units ago
    // — so a new unit could open sharing almost nothing with the lesson right
    // before it, which is what a unit boundary should least feel like. Opening
    // with the tail of the previous unit is the join.
    const carriedOver =
      index === 0 && priorUnits.length > 0
        ? priorUnits[priorUnits.length - 1].items
            .slice(-CARRY_OVER_ITEMS)
            .map((item) => item.id)
            .filter((id) => !interleaved.includes(id))
        : [];

    plans.push({
      kind,
      newPhraseIds: newIds,
      reviewPhraseIds: [...fromUnit, ...carriedOver, ...interleaved],
      interleavedPhraseIds: [...carriedOver, ...interleaved],
    });

    introduced.push(...newIds);
  });

  // Anything the loads left over (a unit with more items than the schedule
  // covers) is folded into the *last teaching* lesson, so nothing is dropped
  // and the review lesson keeps its defining property: it introduces nothing.
  const leftovers = [...remainingVocabulary, ...remainingPhrases].map((item) => item.id);
  if (leftovers.length > 0) {
    const lastTeaching =
      [...plans].reverse().find((plan) => newItemWeight(plan.kind) > 0) ??
      plans[plans.length - 1];

    if (lastTeaching) {
      lastTeaching.newPhraseIds = [...lastTeaching.newPhraseIds, ...leftovers];
    }
  }

  return plans;
}

/**
 * Draws older material for one unit's lessons, along the spaced ladder.
 *
 * The queues are built **once per unit**, not per lesson, and each lesson
 * advances a cursor. That is the difference between "unit 2 shows three random
 * unit-1 items six times" and "unit 2 works through all of unit 1" — with an
 * independent shuffle per lesson, a third of the previous unit was never
 * revisited at all.
 */
type ReviewQueue = { items: PlanItem[]; cursor: number };

/**
 * Per-unit review queues, shared across the whole course.
 *
 * The cursor into unit 2's material has to be shared by units 3, 4, 6 and 10 —
 * every unit that reaches back to it. With a fresh shuffle per consumer they
 * kept re-drawing the same handful and a third of each unit was never seen
 * again after its own six lessons.
 */
export type ReviewQueues = Map<string, ReviewQueue>;

export function createReviewQueues(): ReviewQueues {
  return new Map();
}

function queueFor(queues: ReviewQueues, unit: PlanUnit): ReviewQueue {
  const existing = queues.get(unit.id);

  if (existing) {
    return existing;
  }

  const created: ReviewQueue = {
    items: seededShuffle(unit.items, makeRng(`${unit.id}-review-queue`)),
    cursor: 0,
  };
  queues.set(unit.id, created);
  return created;
}

function createInterleaver(
  unit: PlanUnit,
  priorUnits: readonly PlanUnit[],
  shared: ReviewQueues,
) {
  const byNumber = new Map(priorUnits.map((prior) => [prior.number, prior]));
  const queues = SPACED_UNIT_DISTANCES.map((distance) =>
    byNumber.get(unit.number - distance),
  )
    .filter((prior): prior is PlanUnit => Boolean(prior))
    // Nearest unit first: the material most at risk of fading is what was
    // learned most recently but is no longer being taught.
    .map((prior) => queueFor(shared, prior));

  const taken = new Set<string>();

  return {
    /**
     * `nearestOnly` draws everything from the unit just finished. A unit's
     * opening lesson uses it so the learner starts by reconnecting with
     * yesterday's material rather than with something from eight units ago.
     */
    take(count: number, { nearestOnly = false } = {}): string[] {
      if (count <= 0 || queues.length === 0) {
        return [];
      }

      const rungs = nearestOnly ? queues.slice(0, 1) : queues;
      const picked: string[] = [];
      // The rungs may come round a second time, never a third: past that the
      // lesson genuinely has nothing left to offer and should ask for less.
      let recycled = false;

      // One item per rung per round, so a lesson that wants three old items
      // reaches three *different* units rather than draining the nearest one.
      while (picked.length < count) {
        let tookAny = false;

        for (const queue of rungs) {
          if (picked.length >= count) {
            break;
          }

          // Wrap once the queue is exhausted: a unit that has been fully
          // revisited should still be able to come back, just not before
          // everything else has had a turn.
          for (let step = 0; step < queue.items.length; step += 1) {
            const item = queue.items[queue.cursor % queue.items.length];
            queue.cursor += 1;

            if (taken.has(item.id)) {
              continue;
            }

            taken.add(item.id);
            picked.push(item.id);
            tookAny = true;
            break;
          }
        }

        if (!tookAny) {
          // Everything these rungs hold has already been interleaved once
          // somewhere in the course. On a long path that is the end of it —
          // there is always another unit to reach into. On a short one it
          // means later lessons get nothing at all, which is worse than
          // showing a word twice: the cursor already guarantees that
          // everything else has had its turn first, so let the rungs come
          // round again rather than handing back an empty list.
          const exhausted = rungs.every((queue) =>
            queue.items.every((item) => taken.has(item.id)),
          );

          if (!exhausted || recycled) {
            break;
          }

          recycled = true;

          for (const queue of rungs) {
            for (const item of queue.items) {
              taken.delete(item.id);
            }
          }

          // Anything already chosen for *this* lesson stays off the table, so
          // a lesson can never list the same item twice.
          for (const id of picked) {
            taken.add(id);
          }

          continue;
        }
      }

      return picked;
    },
  };
}

/** Build a `LessonPlan` from a planned lesson plus any authored extras. */
export function toLessonPlan(
  planned: PlannedLesson,
  extras: Pick<
    LessonPlan,
    | "grammar"
    | "dialogue"
    | "patterns"
    | "notices"
    | "stories"
    | "band"
    | "scaffold"
    | "shape"
  > = {},
): LessonPlan {
  return {
    kind: planned.kind,
    newPhraseIds: planned.newPhraseIds,
    reviewPhraseIds: planned.reviewPhraseIds,
    interleavedPhraseIds: planned.interleavedPhraseIds,
    ...extras,
  };
}
