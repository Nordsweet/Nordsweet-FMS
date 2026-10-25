export const RADIO_GREETINGS = {
  sk: {
    greeting: "Dobrý deň",
    thanks: "Ďakujem",
    goodbye: "Dovidenia",
    hearYou: "Dopočutia",
  },
  cs: {
    greeting: "Dobrý den",
    thanks: "Děkuji",
    goodbye: "Na shledanou",
    hearYou: "Na slyšenou",
  },
  de: {
    greeting: "Guten Tag",
    thanks: "Danke",
    goodbye: "Auf Wiedersehen",
    hearYou: "Auf Wiederhören",
  },
  // Source: https://www.govilnius.lt/api/files/6569ec2fd70e0594011ee702/PL%20Vilnius%20Mini%20Guide.pdf
  lt: {
    greeting: "Laba diena",
    thanks: "Ačiū",
    goodbye: "Viso gero",
    hearYou: "",
  },
} as const;

/** Identify supported local languages from aerodrome/airspace codes before callsign aliases. */
export function radioLanguage(
  ...labels: (string | null | undefined)[]
): keyof typeof RADIO_GREETINGS | null {
  for (const label of labels) {
    if (!label) continue;
    if (/\bEP[A-Z]{2}\b/i.test(label)) return null;
    if (/\bLZ(?:[A-Z]{2}|CTR|TMA|FIR)\b/i.test(label)) return "sk";
    if (/\bLK(?:[A-Z]{2}|CTR|TMA|FIR)\b/i.test(label)) return "cs";
    if (/\bEY(?:[A-Z]{2}|CTR|TMA|FIR)\b/i.test(label)) return "lt";
    if (/\b(?:ED|ET|LO)(?:[A-Z]{2}|CTR|TMA|FIR)\b/i.test(label)) return "de";
  }
  const name = labels
    .filter(Boolean)
    .join(" ")
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  if (/\b(?:bratislava|tatry|poprad|ko[šs]ice|[žz]ilina)\b/i.test(name))
    return "sk";
  if (/\b(?:praha|prague|ostrava|brno)\b/i.test(name)) return "cs";
  if (/\b(?:vilnius|kaunas|palanga|siauliai)\b/i.test(name)) return "lt";
  if (
    /\b(?:langen|bremen|berlin|dresden|munich|m[üu]nchen|wien|vienna)\b/i.test(
      name,
    )
  )
    return "de";
  return null;
}
