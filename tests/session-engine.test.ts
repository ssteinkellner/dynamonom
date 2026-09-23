// @vitest-environment jsdom

import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
  SessionEngine,
  type AudioPlayer,
  type SessionEngineEvent,
} from "../src/services/session-engine.ts";

let engine: SessionEngine;
let events: SessionEngineEvent[];

beforeEach(() => {
  vi.useFakeTimers();
  events = [];
  const audioPlayer: AudioPlayer = {
    ensureReady: vi.fn().mockResolvedValue(undefined),
    playTone: vi.fn(),
  };
  engine = new SessionEngine({ audioPlayer });
  engine.subscribe((event) => events.push(event));
});

afterEach(() => {
  engine.dispose();
  vi.useRealTimers();
});

test("scheduled timers emit typed events with their session token", () => {
  engine.scheduleTimeout("countdown", 12, 1000);

  vi.advanceTimersByTime(999);
  expect(events).toHaveLength(0);
  vi.advanceTimersByTime(1);

  expect(events).toHaveLength(1);
  expect(events[0]).toMatchObject({
    type: "timer",
    timer: "countdown",
    kind: "timeout",
    token: 12,
  });
});

test("canceled timers do not emit stale events", () => {
  engine.scheduleTimeout("action-deadline", 3, 1000);
  engine.scheduleInterval("action-display", 3, 250);
  engine.cancelAll();

  vi.advanceTimersByTime(2000);

  expect(events).toHaveLength(0);
});

test("audio failures are emitted for the store to handle", () => {
  const failureEngine = new SessionEngine({
    audioPlayer: {
      ensureReady: vi.fn().mockResolvedValue(undefined),
      playTone: () => {
        throw new Error("Audio failed.");
      },
    },
  });
  const failures: SessionEngineEvent[] = [];
  failureEngine.subscribe((event) => failures.push(event));

  expect(failureEngine.playTone(440)).toBe(false);
  expect(failures).toEqual([
    { type: "audio-error", error: new Error("Audio failed.") },
  ]);
  failureEngine.dispose();
});
