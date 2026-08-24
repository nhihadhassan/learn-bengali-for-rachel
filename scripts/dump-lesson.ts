/**
 * Print the real step sequence a lesson produces.
 *
 *   npx tsx scripts/dump-lesson.ts <unitNumberOrLessonId> [--learner]
 *
 * Reading the JSON tells you what a unit contains; this tells you what the
 * learner actually sees, which is the only thing worth reviewing.
 */
import { getCurriculum } from "../src/lib/content";
import { buildLessonSteps, getStepPrompt } from "../src/lib/lesson-steps";
import { emptyLearnerSnapshot, type LearnerSnapshot } from "../src/lib/learner-model";
import type { Lesson } from "../src/types/learning";

const arg = process.argv[2] ?? "1";
const withLearner = process.argv.includes("--learner");
const units = getCurriculum("spanish").units;

/** A learner who has met everything up to this lesson and produced some of it. */
function snapshotBefore(lesson: Lesson): LearnerSnapshot {
  const snapshot = emptyLearnerSnapshot(Date.now());
  const memory: LearnerSnapshot["memory"] = {};
  let seen = 0;

  for (const unit of units) {
    for (const item of unit.lessons) {
      if (item.id === lesson.id) {
        return { ...snapshot, memory };
      }

      for (const id of item.plan?.newPhraseIds ?? []) {
        seen += 1;
        memory[id] = {
          box: seen % 5,
          dueAt: new Date(Date.now() - 86400000).toISOString(),
          lastSeenAt: new Date(Date.now() - 86400000).toISOString(),
          produced: seen % 3,
        };
      }
    }
  }

  return { ...snapshot, memory };
}

function describe(lesson: Lesson) {
  const learner = withLearner ? snapshotBefore(lesson) : undefined;
  const steps = buildLessonSteps(lesson, { learner });

  console.log(`\n=== ${lesson.id} · ${lesson.title} · ${lesson.plan?.kind ?? "-"} · scaffold ${lesson.plan?.scaffold ?? "-"} ===`);
  console.log(`    goal: ${lesson.summary}`);
  console.log(`    new: ${lesson.plan?.newPhraseIds.length ?? 0}  review: ${lesson.plan?.reviewPhraseIds.length ?? 0}`);

  steps.forEach((step, index) => {
    const label = `${String(index + 1).padStart(2)} ${step.type.toUpperCase().padEnd(10)}`;

    switch (step.type) {
      case "intro":
        console.log(`${label} ${step.title}`);
        break;
      case "learn":
        console.log(
          `${label} ${step.phrase.emoji ?? ""} ${step.phrase.romanized} = ${step.phrase.english}` +
            (step.phrase.context ? `   [in use: ${step.phrase.context.target}]` : ""),
        );
        break;
      case "grammar":
        console.log(`${label} ${step.focus.title} — ${step.focus.explanation}`);
        step.focus.examples.forEach((e) => console.log(`              · ${e.target} (${e.english})`));
        break;
      case "notice":
        console.log(`${label} ${step.card.title}`);
        step.card.examples.forEach((e) => console.log(`              · ${e.target} — ${e.note ?? e.english}`));
        break;
      case "story":
        console.log(`${label} ${step.story.title}`);
        step.story.lines.forEach((l) => console.log(`              · ${l.target}`));
        break;
      case "pronounce":
        console.log(`${label} ${step.phrase.romanized}`);
        break;
      case "choice":
        console.log(`${label} ${step.prompt}  -> ${step.answer}  [${step.options.join(" | ")}]`);
        break;
      case "recognize":
      case "produce":
        console.log(`${label} ${step.prompt}  [${step.options.join(" | ")}]`);
        break;
      case "complete":
        console.log(`${label} ${step.before} ___ ${step.after}  -> ${step.answer}  [${step.options.join(" | ")}] hint="${step.hint}"`);
        break;
      case "order":
      case "listen":
        console.log(`${label} ${step.prompt}  -> ${step.phrase.romanized}  [${step.tokens.join(" ")}]`);
        break;
      case "translate":
        console.log(`${label} ${step.prompt}${step.typed ? " (TYPED)" : ""}  ${step.phrase.english} -> ${step.phrase.romanized}`);
        break;
      case "dialogue":
        console.log(`${label} ${step.speaker ?? "them"}: ${step.promptRomanized}  -> ${step.answer}  [${step.options.join(" | ")}]`);
        break;
      default:
        console.log(`${label} ${getStepPrompt(step)}`);
    }
  });
}

if (arg.includes("-")) {
  const lesson = units.flatMap((unit) => unit.lessons).find((item) => item.id === arg);
  if (!lesson) {
    console.error(`No lesson ${arg}`);
    process.exit(1);
  }
  describe(lesson);
} else {
  const unit = units[Number(arg) - 1];
  console.log(`UNIT ${unit.number}: ${unit.title} — ${unit.description}`);
  unit.lessons.forEach(describe);
}
