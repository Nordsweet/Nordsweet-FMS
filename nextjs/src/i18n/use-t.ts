import { type Language, useSettings } from "~/stores/settings";
import { type MessageKey, messages } from "./messages";
import { translate } from "./translate";

export function useT() {
  const language = useSettings((s) => s.language);
  return (key: MessageKey, vars: Record<string, string | number> = {}) =>
    translate(language, messages[language][key], key, vars);
}

const locales: Record<Language, string> = { pl: "pl-PL", en: "en-GB" };

/** Locale for dates and numbers: the app language, not the browser's. */
export function useLocale() {
  return locales[useSettings((s) => s.language)];
}
