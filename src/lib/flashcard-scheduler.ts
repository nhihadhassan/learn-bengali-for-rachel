import type { FlashcardReview, Phrase } from "@/types/learning";

export type FlashcardRating = "again" | "hard" | "good" | "easy";

export const FLASHCARD_SESSION_SIZE = 8;

const MAX_BOX = 5;
const GOOD_INTERVALS = [1, 3, 7, 14, 30];
const EASY_INTERVALS = [3, 7, 14, 30, 60];

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60 * 1000).toISOString();
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

function clampBox(box: number) {
  return Math.min(MAX_BOX, Math.max(0, box));
}

function intervalForBox(intervals: number[], box: number) {
  return intervals[Math.max(0, Math.min(intervals.length - 1, box - 1))] ?? 1;
}

export function scheduleFlashcard(
  phraseId: string,
  existing: FlashcardReview | undefined,
  rating: FlashcardRating,
  now = new Date(),
): FlashcardReview {
  const currentBox = clampBox(existing?.box ?? 0);
  let box = currentBox;
  let dueAt = addDays(now, 1);

  if (rating === "again") {
    box = 0;
    dueAt = addMinutes(now, 10);
  } else if (rating === "hard") {
    box = Math.max(1, currentBox);
    dueAt = addDays(now, 1);
  } else if (rating === "good") {
    box = Math.min(MAX_BOX, Math.max(1, currentBox + 1));
    dueAt = addDays(now, intervalForBox(GOOD_INTERVALS, box));
  } else {
    box = Math.min(MAX_BOX, Math.max(2, currentBox + 2));
    dueAt = addDays(now, intervalForBox(EASY_INTERVALS, box));
  }

  return {
    phraseId,
    box,
    dueAt,
    lastReviewedAt: now.toISOString(),
    correctCount: (existing?.correctCount ?? 0) + (rating === "again" ? 0 : 1),
    lapseCount: (existing?.lapseCount ?? 0) + (rating === "again" ? 1 : 0),
  };
}

export function getFlashcardReward(rating: FlashcardRating) {
  return rating === "again" ? 1 : rating === "hard" ? 2 : rating === "good" ? 3 : 4;
}

export function getNextReviewLabel(
  rating: FlashcardRating,
  review: FlashcardReview | undefined,
) {
  if (rating === "again") {
    return "10 min";
  }

  if (rating === "hard") {
    return "1 day";
  }

  const currentBox = clampBox(review?.box ?? 0);
  const nextBox =
    rating === "easy"
      ? Math.min(MAX_BOX, Math.max(2, currentBox + 2))
      : Math.min(MAX_BOX, Math.max(1, currentBox + 1));
  const intervals = rating === "easy" ? EASY_INTERVALS : GOOD_INTERVALS;
  const days = intervalForBox(intervals, nextBox);

  return `${days} ${days === 1 ? "day" : "days"}`;
}

export function getFlashcardQueue(
  phrases: Phrase[],
  reviews: FlashcardReview[],
  now = new Date(),
  limit = FLASHCARD_SESSION_SIZE,
) {
  const reviewMap = new Map(reviews.map((review) => [review.phraseId, review]));
  const nowTime = now.getTime();

  return phrases
    .filter((phrase) => {
      const review = reviewMap.get(phrase.id);
      return !review || new Date(review.dueAt).getTime() <= nowTime;
    })
    .sort((first, second) => {
      const firstReview = reviewMap.get(first.id);
      const secondReview = reviewMap.get(second.id);

      if (firstReview && !secondReview) {
        return -1;
      }

      if (!firstReview && secondReview) {
        return 1;
      }

      return (firstReview?.dueAt ?? "").localeCompare(secondReview?.dueAt ?? "");
    })
    .slice(0, limit);
}

export function getFlashcardStats(
  phrases: Phrase[],
  reviews: FlashcardReview[],
  now = new Date(),
) {
  const reviewMap = new Map(reviews.map((review) => [review.phraseId, review]));
  const nowTime = now.getTime();
  const newCount = phrases.filter((phrase) => !reviewMap.has(phrase.id)).length;
  const dueCount = phrases.filter((phrase) => {
    const review = reviewMap.get(phrase.id);
    return !review || new Date(review.dueAt).getTime() <= nowTime;
  }).length;
  const masteredCount = phrases.filter(
    (phrase) => (reviewMap.get(phrase.id)?.box ?? 0) >= MAX_BOX,
  ).length;
  const nextDueAt = reviews
    .filter((review) => new Date(review.dueAt).getTime() > nowTime)
    .sort((first, second) => first.dueAt.localeCompare(second.dueAt))[0]?.dueAt;

  return {
    totalCount: phrases.length,
    dueCount,
    newCount,
    masteredCount,
    nextDueAt: nextDueAt ?? null,
  };
}
