import { units } from "@/lib/content";
import type { LearnedWord, ProgressState } from "@/types/learning";

export function getLearnedWords(progress: ProgressState): LearnedWord[] {
  const completedLessons = new Set(progress.completedLessons);
  const encounteredPhrases = new Set(progress.encounteredPhraseIds);
  const learnedWords = new Map<string, LearnedWord>();

  for (const unit of units) {
    for (const lesson of unit.lessons) {
      const lessonIsComplete = completedLessons.has(lesson.id);

      for (const phrase of lesson.phrases) {
        if (!lessonIsComplete && !encounteredPhrases.has(phrase.id)) {
          continue;
        }

        if (!learnedWords.has(phrase.id)) {
          learnedWords.set(phrase.id, {
            phrase,
            lessonId: lesson.id,
            lessonTitle: lesson.title,
            unitId: unit.id,
            unitNumber: unit.number,
            unitTitle: unit.title,
          });
        }
      }
    }
  }

  return Array.from(learnedWords.values()).sort(
    (left, right) =>
      left.unitNumber - right.unitNumber ||
      left.lessonTitle.localeCompare(right.lessonTitle) ||
      left.phrase.romanized.localeCompare(right.phrase.romanized),
  );
}

export function getVocabularyUnitOptions(words: LearnedWord[]) {
  return Array.from(
    new Map(
      words.map((word) => [
        word.unitId,
        {
          id: word.unitId,
          label: `Unit ${word.unitNumber}: ${word.unitTitle}`,
        },
      ]),
    ).values(),
  );
}
