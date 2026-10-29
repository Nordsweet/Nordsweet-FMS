import { beforeEach, afterEach, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal("document", new EventTarget());
});
afterEach(() => vi.unstubAllGlobals());

it("unlocks silently on touch, distinguishes the chimes and serializes simultaneous notices", async () => {
  const notes: { frequency: number; at: number }[] = [];
  const resume = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal(
    "AudioContext",
    class {
      state = "running";
      currentTime = 10;
      destination = {};
      resume = resume;
      createOscillator() {
        let frequency = 0;
        return {
          frequency: {
            setValueAtTime: (value: number) => {
              frequency = value;
            },
          },
          connect: (gain: unknown) => gain,
          start: (at: number) => notes.push({ frequency, at }),
          stop: vi.fn(),
          disconnect: vi.fn(),
        };
      }
      createGain() {
        return {
          gain: {
            setValueAtTime: vi.fn(),
            exponentialRampToValueAtTime: vi.fn(),
          },
          connect: vi.fn(),
          disconnect: vi.fn(),
        };
      }
    },
  );
  const { enableChimeAudio, playChime } = await import("./chime");
  const dispose = enableChimeAudio();
  playChime("high");
  expect(notes).toEqual([]);
  document.dispatchEvent(new Event("touchend"));
  expect(notes).toEqual([]);
  playChime("high");
  playChime("high-low");
  playChime();
  expect(notes.map((n) => n.frequency)).toEqual([
    880, 880, 587.33, 587.33, 783.99,
  ]);
  expect(notes[1]!.at).toBeGreaterThan(notes[0]!.at + 0.3);
  expect(notes[2]!.at - notes[1]!.at).toBeCloseTo(0.22);
  expect(notes[3]!.at).toBeGreaterThan(notes[2]!.at + 0.3);
  dispose();
});

it("never queues stale notices while autoplay is blocked and catches rejected resume", async () => {
  const oscillator = vi.fn();
  const resume = vi.fn().mockRejectedValue(new Error("blocked"));
  vi.stubGlobal(
    "AudioContext",
    class {
      state = "suspended";
      resume = resume;
      createOscillator = oscillator;
    },
  );
  const { enableChimeAudio, playChime } = await import("./chime");
  const dispose = enableChimeAudio();
  document.dispatchEvent(new Event("click"));
  await Promise.resolve();
  playChime("high-low");
  expect(oscillator).not.toHaveBeenCalled();
  expect(resume).toHaveBeenCalledTimes(1);
  dispose();
  document.dispatchEvent(new Event("click"));
  expect(resume).toHaveBeenCalledTimes(1);
});

it("keeps notifications usable when Web Audio is unavailable", async () => {
  vi.stubGlobal("AudioContext", undefined);
  const { enableChimeAudio, playChime } = await import("./chime");
  const dispose = enableChimeAudio();
  expect(() => document.dispatchEvent(new Event("keydown"))).not.toThrow();
  expect(() => playChime("high")).not.toThrow();
  dispose();
});
