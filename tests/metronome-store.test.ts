// @vitest-environment jsdom

import assert from "node:assert/strict";
import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, test, vi } from "vitest";
import { ACTION_TYPES } from "../src/action-model.ts";
import type { Action } from "../src/action-model.ts";
import { createDefaultMetronomeSettings } from "../src/models/metronome-settings.ts";
import { useMetronomeStore } from "../src/stores/metronome.ts";

const originalAudioContext = window.AudioContext;

class FakeAudioContext {
  state: AudioContextState = "running";
  currentTime = 0;
  destination = {};

  async resume(): Promise<void> {
    this.state = "running";
  }

  createOscillator() {
    return {
      type: "sine",
      frequency: { setValueAtTime() {} },
      connect() {},
      start() {},
      stop() {},
    };
  }

  createGain() {
    return {
      gain: {
        setValueAtTime() {},
        exponentialRampToValueAtTime() {},
      },
      connect() {},
    };
  }
}

beforeEach(() => {
  setActivePinia(createPinia());
  vi.useFakeTimers();
  Object.defineProperty(window, "AudioContext", {
    configurable: true,
    value: FakeAudioContext,
  });
});

afterEach(() => {
  vi.useRealTimers();
  Object.defineProperty(window, "AudioContext", {
    configurable: true,
    value: originalAudioContext,
  });
});

test("seconds actions advance automatically and abort produces a partial report", async () => {
  const store = useMetronomeStore();
  const actions: Action[] = [
    {
      id: "seconds",
      type: ACTION_TYPES.SECONDS,
      name: "Vorbereitung",
      settings: { seconds: 1 },
    },
    {
      id: "metronome",
      type: ACTION_TYPES.METRONOME,
      name: "Metronom",
      settings: createDefaultMetronomeSettings(),
    },
    {
      id: "manual",
      type: ACTION_TYPES.MANUAL,
      name: "Abschluss",
      settings: { limitSeconds: null },
    },
  ];

  assert.equal(store.replaceActionDefinitions(actions, true), true);
  assert.equal(await store.startSession(), true);
  assert.equal(store.phase, "action-sekunden");

  await vi.advanceTimersByTimeAsync(1000);

  assert.equal(store.actionResults[0]?.status, "completed");
  assert.equal(store.actionResults[0]?.completedBy, "auto");
  assert.equal(store.currentAction?.type, ACTION_TYPES.METRONOME);
  assert.equal(store.phase, "countdown");
  assert.equal(store.abortSession(), true);
  assert.equal(store.report?.aborted, true);
  assert.deepEqual(
    store.report?.actions.map((result) => result.status),
    ["completed", "active-aborted", "not-started"],
  );
});

test("metronome countdown and automatic end advance to the next action", async () => {
  const store = useMetronomeStore();
  const metronomeSettings = {
    ...createDefaultMetronomeSettings(),
    increaseTempo: false,
    breaks: "none" as const,
    sessionEndEnabled: true,
    sessionEndBeats: 2,
    lockSettings: true,
    lockBeats: 1,
  };
  const actions: Action[] = [
    {
      id: "metronome",
      type: ACTION_TYPES.METRONOME,
      name: "Metronom",
      settings: metronomeSettings,
    },
    {
      id: "manual",
      type: ACTION_TYPES.MANUAL,
      name: "Abschluss",
      settings: { limitSeconds: null },
    },
  ];

  assert.equal(store.replaceActionDefinitions(actions, true), true);
  assert.equal(await store.startSession(), true);

  await vi.advanceTimersByTimeAsync(3500);

  assert.equal(store.actionResults[0]?.status, "completed");
  assert.equal(store.actionResults[0]?.endReason, "automatic");
  assert.equal(store.actionResults[0]?.beatCount, 2);
  assert.equal(store.currentAction?.type, ACTION_TYPES.MANUAL);
  assert.equal(store.phase, "action-manuell");
});

test("stopwatch results determine the next metronome's end and lock", async () => {
  const store = useMetronomeStore();
  const actions: Action[] = [
    {
      id: "stopwatch",
      type: ACTION_TYPES.STOPWATCH,
      name: "Dauer",
      settings: {
        formula: "sekunden",
        rounding: "floor",
        roundingThreshold: null,
        min: 1,
        max: null,
      },
    },
    {
      id: "metronome",
      type: ACTION_TYPES.METRONOME,
      name: "Metronom",
      settings: createDefaultMetronomeSettings(),
    },
  ];

  assert.equal(store.replaceActionDefinitions(actions, true), true);
  assert.equal(await store.startSession(), true);
  await vi.advanceTimersByTimeAsync(2000);
  assert.equal(store.continueTimerAction(), true);

  assert.equal(store.actionResults[0]?.appliedBeats, 2);
  assert.equal(store.currentAction?.type, ACTION_TYPES.METRONOME);
  assert.equal(store.settings?.derivedEndTotal, 2);
  assert.equal(store.settings?.sessionEndBeats, 2);
  assert.equal(store.settings?.lockBeats, 2);
  assert.deepEqual(store.settings?.derivedEndSources, ["Dauer"]);
  store.abortSession();
});

test("manual metronome pauses resume and are recorded before abort", async () => {
  const store = useMetronomeStore();
  const actions: Action[] = [
    {
      id: "metronome",
      type: ACTION_TYPES.METRONOME,
      name: "Metronom",
      settings: createDefaultMetronomeSettings(),
    },
  ];

  assert.equal(store.replaceActionDefinitions(actions, true), true);
  assert.equal(await store.startSession(), true);
  await vi.advanceTimersByTimeAsync(3000);
  assert.equal(store.phase, "running");

  store.pauseOrResumeMetronome();
  assert.equal(store.phase, "paused");
  store.pauseOrResumeMetronome();
  assert.equal(store.phase, "running");
  assert.match(store.breakRecords[0]?.ended ?? "", /Manuell fortgesetzt/);
  assert.equal(store.abortSession(), true);
  assert.equal(store.report?.actions[0]?.breakRecords?.length, 1);
});
