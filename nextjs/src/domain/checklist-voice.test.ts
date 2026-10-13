import { expect, it } from "vitest";
import { checklistVoice } from "./checklist-voice";
const voice = (name: string, lang = "en-US") => ({
  name,
  lang,
  voiceURI: name,
  localService: true,
  default: false,
});
it("uses remembered voices and the chosen language/gender", () => {
  const voices = [voice("Zira"), voice("David"), voice("Jan", "pl-PL")];
  expect(checklistVoice(voices, "en-US", "male")?.name).toBe("David");
  expect(checklistVoice(voices, "pl-PL", "male")?.name).toBe("Jan");
  expect(checklistVoice(voices, "en-US", "male", "Zira")?.name).toBe("Zira");
});
it("does not mistake female/Samantha for male and tolerates unavailable voices", () => {
  expect(
    checklistVoice([voice("Samantha"), voice("David")], "en-US", "female")
      ?.name,
  ).toBe("Samantha");
  expect(checklistVoice([], "en-US", "female")).toBeUndefined();
});
