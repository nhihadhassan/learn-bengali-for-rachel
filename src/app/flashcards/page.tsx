import type { Metadata } from "next";
import { FlashcardGame } from "@/components/flashcards/flashcard-game";

export const metadata: Metadata = {
  title: "Flashcards | Learning Bengali",
  description: "A spaced-repetition flashcard game for language practice.",
};

export default function FlashcardsPage() {
  return <FlashcardGame />;
}
