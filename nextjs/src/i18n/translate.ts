/** A message, or its plural forms chosen by `Intl.PluralRules` from the `count` variable. */
export type Message =
  string | ({ other: string } & Partial<Record<Intl.LDMLPluralRule, string>>);

export function translate(
  language: string,
  message: Message | undefined,
  key: string,
  vars: Record<string, string | number> = {},
) {
  const text =
    typeof message === "object"
      ? (message[
          typeof vars.count === "number"
            ? new Intl.PluralRules(language).select(vars.count)
            : "other"
        ] ?? message.other)
      : message;
  // A missing key shows the key rather than crashing the page.
  return (text ?? key).replace(/\{(\w+)\}/g, (_, name: string) =>
    String(vars[name] ?? `{${name}}`),
  );
}
