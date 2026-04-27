export type AnswerCheckResult = {
  isCorrect: boolean;
  normalizedExpected: string;
  normalizedSubmitted: string;
  similarity: number;
};

export function normalizeAnswer(answer: string): string {
  return answer
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[“”"'‘’.,?!:;()]/g, "")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ");
}

function phoneticKey(answer: string): string {
  return normalizeAnswer(answer)
    .replace(/\bbh/g, "v")
    .replace(/bh/g, "v")
    .replace(/ph/g, "f")
    .replace(/sh/g, "s")
    .replace(/aa/g, "a")
    .replace(/ee/g, "i")
    .replace(/oo/g, "u");
}

function levenshteinDistance(left: string, right: string): number {
  const rows = left.length + 1;
  const columns = right.length + 1;
  const matrix = Array.from({ length: rows }, () => new Array<number>(columns));

  for (let row = 0; row < rows; row += 1) {
    matrix[row][0] = row;
  }

  for (let column = 0; column < columns; column += 1) {
    matrix[0][column] = column;
  }

  for (let row = 1; row < rows; row += 1) {
    for (let column = 1; column < columns; column += 1) {
      const substitutionCost = left[row - 1] === right[column - 1] ? 0 : 1;

      matrix[row][column] = Math.min(
        matrix[row - 1][column] + 1,
        matrix[row][column - 1] + 1,
        matrix[row - 1][column - 1] + substitutionCost,
      );
    }
  }

  return matrix[left.length][right.length];
}

function similarity(left: string, right: string): number {
  const maxLength = Math.max(left.length, right.length);

  if (maxLength === 0) {
    return 1;
  }

  return 1 - levenshteinDistance(left, right) / maxLength;
}

function isReasonablePartial(expected: string, submitted: string) {
  const expectedTokens = expected.split(" ");
  const submittedTokens = submitted.split(" ");

  if (expectedTokens.length < 3 || submittedTokens.length < 2) {
    return false;
  }

  return expectedTokens.slice(-submittedTokens.length).join(" ") === submitted;
}

export function checkTypedAnswer(
  submittedAnswer: string,
  expectedAnswer: string,
): AnswerCheckResult {
  const normalizedExpected = normalizeAnswer(expectedAnswer);
  const normalizedSubmitted = normalizeAnswer(submittedAnswer);
  const expectedPhonetic = phoneticKey(expectedAnswer);
  const submittedPhonetic = phoneticKey(submittedAnswer);
  const normalizedSimilarity = similarity(normalizedSubmitted, normalizedExpected);
  const phoneticSimilarity = similarity(submittedPhonetic, expectedPhonetic);
  const bestSimilarity = Math.max(normalizedSimilarity, phoneticSimilarity);
  const maxLength = Math.max(normalizedExpected.length, normalizedSubmitted.length);

  if (!normalizedSubmitted) {
    return {
      isCorrect: false,
      normalizedExpected,
      normalizedSubmitted,
      similarity: 0,
    };
  }

  if (
    normalizedSubmitted === normalizedExpected ||
    submittedPhonetic === expectedPhonetic ||
    isReasonablePartial(normalizedExpected, normalizedSubmitted) ||
    isReasonablePartial(expectedPhonetic, submittedPhonetic)
  ) {
    return {
      isCorrect: true,
      normalizedExpected,
      normalizedSubmitted,
      similarity: 1,
    };
  }

  const isShortAnswer = maxLength <= 3;
  const isCorrect = !isShortAnswer && bestSimilarity >= 0.82;

  return {
    isCorrect,
    normalizedExpected,
    normalizedSubmitted,
    similarity: bestSimilarity,
  };
}
