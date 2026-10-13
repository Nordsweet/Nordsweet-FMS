export type ChecklistVoice = {
  name: string;
  voiceURI: string;
  lang: string;
  localService: boolean;
  default: boolean;
};

/** Select the remembered voice first, otherwise rank language and the legacy voice-name hints. */
export function checklistVoice<T extends ChecklistVoice>(
  voices: readonly T[],
  language: string,
  gender: "female" | "male",
  pinned?: string,
): T | undefined {
  const lang = language.toLowerCase();
  const matching = voices.filter((v) =>
    v.lang.toLowerCase().startsWith(lang.split("-")[0]!),
  );
  const candidates = matching.length ? matching : voices;
  const remembered = candidates.find(
    (v) => v.voiceURI === pinned || v.name === pinned,
  );
  if (remembered) return remembered;
  const hints = {
    male: /\b(male|man|guy|david|mark|daniel|george|alex|thomas|paul|james|ryan|adam|jacek|jan|marek|krzysztof|piotr|tomasz)\b/i,
    female:
      /\b(female|woman|zira|susan|samantha|joanna|victoria|aria|eva|ewa|maja|paulina|agnieszka|monika|hedda|katarzyna)\b/i,
  };
  const score = (v: T) =>
    (v.lang.toLowerCase() === lang
      ? 120
      : v.lang.toLowerCase().startsWith(lang.split("-")[0]!)
        ? 90
        : 0) +
    (hints[gender].test(v.name)
      ? 100
      : hints[gender === "male" ? "female" : "male"].test(v.name)
        ? -100
        : 0) +
    (v.localService ? 5 : 0) +
    (v.default ? 1 : 0);
  return [...candidates].sort(
    (a, b) => score(b) - score(a) || a.voiceURI.localeCompare(b.voiceURI),
  )[0];
}
