import { useSettings } from "~/stores/settings";
import { type MessageKey, messages } from "./messages";

export function useT() {
  const language = useSettings((s) => s.language);
  return (key: MessageKey, vars: Record<string, string | number> = {}) =>
    messages[language][key].replace(/\{(\w+)\}/g, (_, name: string) =>
      String(vars[name] ?? `{${name}}`),
    );
}
