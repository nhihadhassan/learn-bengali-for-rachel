export function capitalizeDisplayText(value: string) {
  return value.replace(
    /^(\P{L}*)(\p{L})/u,
    (_match, prefix: string, firstLetter: string) =>
      `${prefix}${firstLetter.toLocaleUpperCase("en-US")}`,
  );
}
