export function capitalizeDisplayText(value: string) {
  return value.replace(
    /^(\P{L}*)(\p{L})/u,
    (_match, prefix: string, firstLetter: string) =>
      `${prefix}${firstLetter.toLocaleUpperCase("en-US")}`,
  );
}

/**
 * Present target-language text.
 *
 * Title-casing every word is a readability aid for a *romanization* — "kemon
 * achho" reads better as "Kemon Achho", because it is a transcription and has
 * no casing of its own. Real orthography already has casing, and title-casing
 * it is simply wrong: the Spanish course was rendering "Hola, ¿cómo estás?" as
 * "Hola, ¿Cómo Estás?".
 *
 * The discriminator is the text itself. Anything that already contains a
 * capital letter is carrying its own casing and only needs its first letter
 * ensured; anything entirely lowercase is a romanization and is title-cased as
 * before.
 */
export function formatRomanizedDisplay(value: string) {
  if (/\p{Lu}/u.test(value)) {
    return capitalizeDisplayText(value);
  }

  return value.replace(/(-?)(\p{L}[\p{L}'’]*)/gu, (_match, hyphen: string, word: string) => {
    // A hyphen joins a clitic to its host, and a clitic is not a word: Bengali
    // `ami-o` ("me too") is one spoken word carrying one stress, so "Ami-O"
    // reads as two. Leave what follows a hyphen alone.
    if (hyphen) {
      return `${hyphen}${word}`;
    }

    if (word.length <= 2 && word === word.toUpperCase()) {
      return word;
    }

    return `${hyphen}${word.slice(0, 1).toLocaleUpperCase("en-US")}${word.slice(1)}`;
  });
}

export function formatPromptDisplay(value: string) {
  return capitalizeDisplayText(value).replace(
    /(["“])([^"”]+)(["”])/g,
    (match, open: string, phrase: string, close: string) => {
      if (!/[a-z]/.test(phrase)) {
        return match;
      }

      return `${open}${formatRomanizedDisplay(phrase)}${close}`;
    },
  );
}
