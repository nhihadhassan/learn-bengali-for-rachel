export function capitalizeDisplayText(value: string) {
  return value.replace(
    /^(\P{L}*)(\p{L})/u,
    (_match, prefix: string, firstLetter: string) =>
      `${prefix}${firstLetter.toLocaleUpperCase("en-US")}`,
  );
}

export function formatRomanizedDisplay(value: string) {
  return value.replace(/\p{L}[\p{L}'’]*/gu, (word) => {
    if (word.length <= 2 && word === word.toUpperCase()) {
      return word;
    }

    return `${word.slice(0, 1).toLocaleUpperCase("en-US")}${word.slice(1)}`;
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
