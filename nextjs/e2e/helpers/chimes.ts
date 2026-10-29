import type { Page } from "@playwright/test";

declare global {
  interface Window {
    testChimeNotes: number[];
  }
}

/** Observe actual Web Audio note scheduling without replacing audio or the autoplay policy. */
export async function observeChimes(page: Page) {
  await page.addInitScript(() => {
    const notes: number[] = [];
    window.testChimeNotes = notes;
    const create = Object.getOwnPropertyDescriptor(
      BaseAudioContext.prototype,
      "createOscillator",
    )!.value as AudioContext["createOscillator"];
    AudioContext.prototype.createOscillator = function () {
      const oscillator = create.call(this);
      const set = oscillator.frequency.setValueAtTime.bind(
        oscillator.frequency,
      );
      oscillator.frequency.setValueAtTime = (frequency, at) => {
        notes.push(frequency);
        return set(frequency, at);
      };
      return oscillator;
    };
  });
}

export const chimeNotes = (page: Page) =>
  page.evaluate(() => window.testChimeNotes);
