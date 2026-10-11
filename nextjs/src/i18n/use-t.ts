import { useSettings } from "~/stores/settings";
import { type MessageKey, messages } from "./messages";

export function useT() {
  const language = useSettings((s) => s.language);
  return (key: MessageKey) => messages[language][key];
}
