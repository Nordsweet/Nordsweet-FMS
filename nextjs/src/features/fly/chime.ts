let audio: AudioContext | null = null;

/** Legacy playFlightTimerChime: two short sine notes. Silently skipped where audio is blocked. */
export function playChime() {
  try {
    audio ??= new AudioContext();
    if (audio.state === "suspended") void audio.resume();
    const start = audio.currentTime + 0.02;
    [587.33, 783.99].forEach((frequency, i) => {
      const oscillator = audio!.createOscillator();
      const gain = audio!.createGain();
      const at = start + i * 0.22;
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, at);
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.11, at + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.28);
      oscillator.connect(gain).connect(audio!.destination);
      oscillator.start(at);
      oscillator.stop(at + 0.3);
    });
  } catch {
    // The timers stay usable when the browser blocks audio.
  }
}
