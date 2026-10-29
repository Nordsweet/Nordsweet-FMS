let audio: AudioContext | null = null;
let availableAt = 0;
export type Chime = "high" | "high-low" | "timer";

/** Resume in a real user gesture so later automatic notices can sound on iPad too. */
export function enableChimeAudio() {
  const unlock = () => {
    try {
      if (!audio || audio.state === "closed") {
        audio = new AudioContext();
        availableAt = 0;
      }
      if (audio.state === "suspended")
        void audio.resume().catch(() => undefined);
    } catch {
      // Visual notifications remain available without Web Audio.
    }
  };
  const gestures = ["click", "touchend", "keydown"] as const;
  const options = { capture: true };
  gestures.forEach((event) =>
    document.addEventListener(event, unlock, options),
  );
  return () => {
    gestures.forEach((event) =>
      document.removeEventListener(event, unlock, options),
    );
  };
}

/** Synthesized offline; serialize notes so simultaneous popups do not mask one another. */
export function playChime(kind: Chime = "timer") {
  try {
    // Do not queue old notices behind autoplay restrictions: the next gesture only unlocks audio.
    if (audio?.state !== "running") return;
    const context = audio;
    const frequencies =
      kind === "high"
        ? [880]
        : kind === "high-low"
          ? [880, 587.33]
          : [587.33, 783.99];
    const start = Math.max(context.currentTime + 0.02, availableAt);
    frequencies.forEach((frequency, i) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const at = start + i * 0.22;
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, at);
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.11, at + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.28);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(at);
      oscillator.stop(at + 0.3);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
      };
    });
    availableAt = start + (frequencies.length - 1) * 0.22 + 0.38;
  } catch {
    // The timers stay usable when the browser blocks audio.
  }
}
