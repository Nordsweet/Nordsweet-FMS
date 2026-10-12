import { useSettings } from "~/stores/settings";
import { type MessageKey, messages } from "./messages";

export function useT() {
  const language = useSettings((s) => s.language);
  return (key: MessageKey, vars: Record<string, string | number> = {}) =>
    // A missing key shows the key rather than crashing the page.
    (messages[language][key] ?? key).replace(/\{(\w+)\}/g, (_, name: string) =>
      String(vars[name] ?? `{${name}}`),
    );
}
