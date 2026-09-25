// @vitest-environment jsdom

import assert from "node:assert/strict";
import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, test, vi } from "vitest";
import { ACTION_TYPES } from "../src/action-model.ts";
import type {
  Action,
  MetronomeAction,
  StopwatchAction,
} from "../src/action-model.ts";
import {
  createPauseMessageUntilFormulaInput,
  createNumericFormulaInput,
  type FormulaNode,
  type FormulaMetric,
} from "../src/formula-model.ts";
import type { FormulaFallbackNode, FormulaReferenceNode } from "../src/formula-model.ts";
import { createDefaultMetronomeSettings } from "../src/models/metronome-settings.ts";
import { createDefaultStopwatchSettings } from "../src/action-model.ts";
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

function formula(value: number, min = 1, max: number | null = null) {
  return createNumericFormulaInput(value, min, max);
}

function metronomeAction(
  id: string,
  settings: MetronomeAction["settings"] = createDefaultMetronomeSettings(),
  name = id,
): MetronomeAction {
  return { id, type: ACTION_TYPES.METRONOME, name, settings };
}

function stopwatchAction(
  id: string,
  settings: StopwatchAction["settings"] = createDefaultStopwatchSettings(),
  name = id,
): StopwatchAction {
  return { id, type: ACTION_TYPES.STOPWATCH, name, settings };
}

function currentNode(property: string): FormulaNode {
  return { id: `current-${property}`, type: "current", property };
}

function referenceNode(
  actionId: string,
  metric: FormulaMetric,
): FormulaReferenceNode {
  return {
    id: `reference-${actionId}`,
    type: "reference",
    actionId,
    metric,
  };
}

function fallbackNode(
  id: string,
  input: FormulaNode,
  fallback: number,
): FormulaFallbackNode {
  return { id, type: "fallback", input, fallback };
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

test("automatic Stopwatch actions advance and abort produces a partial report", async () => {
  const store = useMetronomeStore();
  const automaticSettings = {
    ...createDefaultStopwatchSettings(),
    endMode: "automatic" as const,
    automaticSeconds: formula(1, 1, 600),
  };
  const actions: Action[] = [
    stopwatchAction("stopwatch", automaticSettings, "Vorbereitung"),
    metronomeAction("metronome", createDefaultMetronomeSettings(), "Metronom"),
    stopwatchAction("final-stopwatch", undefined, "Abschluss"),
  ];

  assert.equal(store.replaceActionDefinitions(actions, true), true);
  assert.equal(await store.startSession(), true);
  assert.equal(store.phase, "action-stoppuhr");

  await vi.advanceTimersByTimeAsync(1000);

  const stopwatchResult = store.actionResults[0];
  assert.ok(stopwatchResult);
  if (stopwatchResult.type !== ACTION_TYPES.STOPWATCH) {
    throw new Error("Expected a stopwatch-action result.");
  }
  assert.equal(stopwatchResult.status, "completed");
  assert.equal(stopwatchResult.completedBy, "auto");
  assert.equal(stopwatchResult.elapsedSeconds, 1);
  assert.equal(store.currentAction?.type, ACTION_TYPES.METRONOME);
  assert.equal(store.phase, "countdown");
  assert.equal(store.abortSession(), true);
  assert.equal(store.report?.aborted, true);
  assert.deepEqual(
    store.report?.actions.map((result) => result.status),
    ["completed", "active-aborted", "not-started"],
  );
});

test("hideProgress keeps the current action number but hides the total", async () => {
  const store = useMetronomeStore();
  assert.equal(
    store.replaceActionDefinitions(
      [metronomeAction("metronome", createDefaultMetronomeSettings())],
      true,
    ),
    true,
  );
  assert.equal(await store.startSession(), true);

  assert.equal(store.progressLabel, "Aktion 1 von 1");
  store.hideProgress = true;
  assert.equal(store.progressLabel, "Aktion 1");

  assert.equal(store.abortSession(), true);
});

test("metronome countdown and automatic end advance to the next action", async () => {
  const store = useMetronomeStore();
  const defaults = createDefaultMetronomeSettings();
  const metronomeSettings = {
    ...defaults,
    increaseTempo: false,
    breaks: "none" as const,
    sessionEndEnabled: true,
    sessionEndBeats: formula(2),
    lockSettings: true,
    lockBeats: formula(1),
  };
  const actions: Action[] = [
    metronomeAction("metronome", metronomeSettings, "Metronom"),
    stopwatchAction("stopwatch", undefined, "Abschluss"),
  ];

  assert.equal(store.replaceActionDefinitions(actions, true), true);
  assert.equal(await store.startSession(), true);

  await vi.advanceTimersByTimeAsync(3500);

  const metronomeResult = store.actionResults[0];
  assert.ok(metronomeResult);
  if (metronomeResult.type !== ACTION_TYPES.METRONOME) {
    throw new Error("Expected a metronome-action result.");
  }
  assert.equal(metronomeResult.status, "completed");
  assert.equal(metronomeResult.endReason, "automatic");
  assert.equal(metronomeResult.beatCount, 2);
  assert.equal(metronomeResult.endBpm, 120);
  assert.equal(store.currentAction?.type, ACTION_TYPES.STOPWATCH);
  assert.equal(store.phase, "action-stoppuhr");
});

test("metronome elapsed time starts at the first beat and excludes pauses", async () => {
  const store = useMetronomeStore();
  const settings = {
    ...createDefaultMetronomeSettings(),
    increaseTempo: false,
    breaks: "none" as const,
  };

  assert.equal(
    store.replaceActionDefinitions(
      [metronomeAction("metronome", settings, "Metronom")],
      true,
    ),
    true,
  );
  assert.equal(await store.startSession(), true);
  assert.equal(store.phase, "countdown");
  assert.equal(store.activeElapsedSeconds, 0);

  await vi.advanceTimersByTimeAsync(2999);
  assert.equal(store.phase, "countdown");
  assert.equal(store.activeElapsedSeconds, 0);

  await vi.advanceTimersByTimeAsync(1);
  assert.equal(store.phase, "running");
  assert.equal(store.activeElapsedSeconds, 0);

  await vi.advanceTimersByTimeAsync(1000);
  assert.equal(store.activeElapsedSeconds, 1);

  store.pauseOrResumeMetronome();
  assert.equal(store.phase, "paused");
  await vi.advanceTimersByTimeAsync(3000);
  assert.equal(store.activeElapsedSeconds, 1);

  store.pauseOrResumeMetronome();
  assert.equal(store.phase, "running");
  await vi.advanceTimersByTimeAsync(1000);
  assert.equal(store.activeElapsedSeconds, 2);

  assert.equal(store.abortSession(), true);
  assert.equal(store.report?.actions[0]?.elapsedSeconds, 2);
});

test("metronome results record the highest BPM that actually sounded", async () => {
  const store = useMetronomeStore();
  const settings = {
    ...createDefaultMetronomeSettings(),
    bpm: createNumericFormulaInput(100, 20, 300),
    increaseTempo: true,
    increaseBy: formula(10),
    increaseAfter: formula(1),
    maximum: "none" as const,
    sessionEndEnabled: true,
    sessionEndBeats: formula(3),
    breaks: "none" as const,
  };

  assert.equal(
    store.replaceActionDefinitions(
      [metronomeAction("metronome", settings)],
      true,
    ),
    true,
  );
  assert.equal(await store.startSession(), true);

  await vi.advanceTimersByTimeAsync(4200);

  const result = store.actionResults[0];
  assert.ok(result?.type === ACTION_TYPES.METRONOME);
  assert.equal(result.beatCount, 3);
  assert.equal(result.endBpm, 120);
  assert.equal(result.maximumBpm, 120);
});

test("next BPM previews the scheduled change at progression boundaries", async () => {
  const store = useMetronomeStore();
  assert.equal(
    store.replaceActionDefinitions(
      [metronomeAction("metronome", createDefaultMetronomeSettings())],
      true,
    ),
    true,
  );
  assert.equal(await store.startSession(), true);

  assert.equal(store.nextBpm, 121);
  assert.equal(store.nextTempoChangeBeat, 10);
  store.beatCount = 4;
  store.tempoCounter = 4;
  assert.equal(store.nextTempoChangeBeat, 10);
  store.beatCount = 10;
  store.tempoCounter = 0;
  assert.equal(store.nextTempoChangeBeat, 20);

  store.settings = {
    ...store.settings!,
    initialBpm: 100,
    increaseBy: 5,
    decreaseBy: 3,
    maximum: "stick",
    maximumLimit: 120,
  };
  store.currentBpm = 118;
  store.direction = "up";
  store.stuckAtMaximum = false;
  assert.equal(store.nextBpm, 120);
  store.currentBpm = 120;
  store.stuckAtMaximum = true;
  assert.equal(store.nextBpm, 120);

  store.settings = { ...store.settings, maximum: "reset" };
  store.stuckAtMaximum = false;
  store.currentBpm = 118;
  assert.equal(store.nextBpm, 100);

  store.settings = { ...store.settings, maximum: "reverse" };
  store.currentBpm = 118;
  store.direction = "up";
  assert.equal(store.nextBpm, 120);
  store.currentBpm = 120;
  store.direction = "down";
  assert.equal(store.nextBpm, 117);
  store.abortSession();
});

test("Stopwatch values affect a later Metronome only through explicit references", async () => {
  const store = useMetronomeStore();
  const defaults = createDefaultMetronomeSettings();
  const reference = formula(2, 1, null);
  const referencedSettings = {
    ...defaults,
    increaseTempo: false,
    breaks: "none" as const,
    sessionEndEnabled: true,
    sessionEndBeats: {
      ...reference,
      expression: fallbackNode(
        "fallback-watch",
        referenceNode("stopwatch", "seconds-absolute"),
        2,
      ),
    },
  };
  const actions: Action[] = [
    {
      id: "stopwatch",
      type: ACTION_TYPES.STOPWATCH,
      name: "Dauer",
      settings: createDefaultStopwatchSettings(),
    },
    metronomeAction("metronome", referencedSettings, "Metronom"),
  ];

  assert.equal(store.replaceActionDefinitions(actions, true), true);
  assert.equal(await store.startSession(), true);
  await vi.advanceTimersByTimeAsync(2000);
  assert.equal(store.continueTimerAction(), true);

  const stopwatchResult = store.actionResults[0];
  assert.ok(stopwatchResult);
  if (stopwatchResult.type !== ACTION_TYPES.STOPWATCH) {
    throw new Error("Expected a stopwatch-action result.");
  }
  assert.equal(stopwatchResult.elapsedSeconds, 2);
  assert.equal("appliedBeats" in stopwatchResult, false);
  assert.equal(store.currentAction?.type, ACTION_TYPES.METRONOME);
  assert.equal(store.settings?.sessionEndBeats, 2);
  assert.equal(store.settings?.lockSettings, false);
  store.abortSession();
});

test("multiple Metronomes run in sequence and may reference an earlier End-BPM", async () => {
  const store = useMetronomeStore();
  const defaults = createDefaultMetronomeSettings();
  const firstSettings = {
    ...defaults,
    bpm: formula(140, 20, 300),
    increaseTempo: false,
    breaks: "none" as const,
    sessionEndEnabled: true,
    sessionEndBeats: formula(1),
  };
  const secondSettings = {
    ...defaults,
    bpm: {
      ...formula(120, 20, 300),
      expression: fallbackNode(
        "fallback-end-bpm",
        referenceNode("first-metronome", "end-bpm"),
        120,
      ),
    },
    increaseTempo: false,
    breaks: "none" as const,
    sessionEndEnabled: true,
    sessionEndBeats: formula(1),
  };
  assert.equal(
    store.replaceActionDefinitions(
      [
        metronomeAction("first-metronome", firstSettings, "Erster Lauf"),
        metronomeAction("second-metronome", secondSettings, "Zweiter Lauf"),
      ],
      true,
    ),
    true,
  );

  assert.equal(await store.startSession(), true);
  await vi.advanceTimersByTimeAsync(3000);

  const firstResult = store.actionResults[0];
  assert.ok(firstResult?.type === ACTION_TYPES.METRONOME);
  assert.equal(firstResult.endBpm, 140);
  assert.equal(store.currentActionIndex, 1);
  assert.equal(store.settings?.initialBpm, 140);
  await vi.advanceTimersByTimeAsync(3000);

  assert.equal(store.phase, "finished");
  assert.deepEqual(
    store.report?.actions.map((result) => result.status),
    ["completed", "completed"],
  );
});

test("removing or moving a referenced action is rejected", () => {
  const store = useMetronomeStore();
  const dependentStopwatch = {
    id: "dependent-stopwatch",
    type: ACTION_TYPES.STOPWATCH,
    name: "Wartezeit",
    settings: {
      ...createDefaultStopwatchSettings(),
      endMode: "automatic" as const,
      automaticSeconds: {
        ...formula(10, 1, 600),
        expression: fallbackNode(
          "fallback-watch",
          referenceNode("stopwatch", "seconds-absolute"),
          10,
        ),
      },
    },
  };
  assert.equal(
    store.replaceActionDefinitions(
      [
        stopwatchAction("stopwatch", createDefaultStopwatchSettings(), "Messung"),
        dependentStopwatch,
        metronomeAction("metronome", createDefaultMetronomeSettings(), "Lauf"),
      ],
      true,
    ),
    true,
  );

  assert.equal(store.moveAction("stopwatch", 1), false);
  assert.equal(store.removeAction("stopwatch"), false);
  assert.deepEqual(
    store.actionDefinitions.map((action) => action.id),
    ["stopwatch", "dependent-stopwatch", "metronome"],
  );
});

test("manual metronome pauses resume and are recorded before abort", async () => {
  const store = useMetronomeStore();
  assert.equal(
    store.replaceActionDefinitions(
      [metronomeAction("metronome", createDefaultMetronomeSettings())],
      true,
    ),
    true,
  );
  assert.equal(await store.startSession(), true);
  await vi.advanceTimersByTimeAsync(3000);
  assert.equal(store.phase, "running");

  store.pauseOrResumeMetronome();
  assert.equal(store.phase, "paused");
  store.pauseOrResumeMetronome();
  assert.equal(store.phase, "running");
  assert.match(store.breakRecords[0]?.ended ?? "", /Manuell fortgesetzt/);
  assert.equal(store.abortSession(), true);
  const reportResult = store.report?.actions[0];
  assert.ok(reportResult);
  if (reportResult.type !== ACTION_TYPES.METRONOME) {
    throw new Error("Expected the report to contain a metronome result.");
  }
  assert.equal(reportResult.breakRecords?.length, 1);
});

test("pause formulas use the current BPM and record their resolved duration", async () => {
  const store = useMetronomeStore();
  const defaults = createDefaultMetronomeSettings();
  const settings = {
    ...defaults,
    breaks: "limited" as const,
    breakSeconds: {
      ...formula(10),
      expression: fallbackNode(
        "fallback-live-bpm",
        currentNode("current-bpm"),
        10,
      ),
    },
  };
  assert.equal(
    store.replaceActionDefinitions(
      [metronomeAction("metronome", settings)],
      true,
    ),
    true,
  );
  assert.equal(await store.startSession(), true);
  await vi.advanceTimersByTimeAsync(3000);
  store.pauseOrResumeMetronome();

  assert.equal(store.phase, "paused");
  assert.equal(store.activeBreak?.durationSeconds, 120);
  assert.equal(store.breakRecords[0]?.scheduledDurationSeconds, 120);
  const result = store.currentActionResult;
  assert.ok(result?.type === ACTION_TYPES.METRONOME);
  assert.equal(
    result.formulaValues?.find((entry) => entry.field === "breakSeconds")
      ?.value,
    120,
  );
  store.abortSession();
});

test("pause messages match inclusively and persist until the next pause", async () => {
  const store = useMetronomeStore();
  const settings = {
    ...createDefaultMetronomeSettings(),
    increaseTempo: false,
    pauseMessages: [
      {
        id: "message-finite",
        fromPause: formula(0, 0),
        untilPause: formula(1, 0),
        text: "Erste Pause",
      },
      {
        id: "message-open",
        fromPause: formula(1, 0),
        untilPause: null,
        text: "Ab dieser Pause",
      },
      {
        id: "message-dynamic",
        fromPause: formula(0, 0),
        untilPause: createPauseMessageUntilFormulaInput(),
        text: "Aktuelle Pause",
      },
    ],
  };
  assert.equal(
    store.replaceActionDefinitions(
      [metronomeAction("metronome", settings)],
      true,
    ),
    true,
  );
  assert.equal(await store.startSession(), true);
  await vi.advanceTimersByTimeAsync(3000);

  store.pauseOrResumeMetronome();
  assert.deepEqual(store.pauseMessageTexts, [
    "Erste Pause",
    "Ab dieser Pause",
    "Aktuelle Pause",
  ]);
  store.pauseOrResumeMetronome();
  assert.deepEqual(store.pauseMessageTexts, [
    "Erste Pause",
    "Ab dieser Pause",
    "Aktuelle Pause",
  ]);

  store.pauseOrResumeMetronome();
  assert.deepEqual(store.pauseMessageTexts, [
    "Ab dieser Pause",
    "Aktuelle Pause",
  ]);
  assert.equal(store.report, null);
  assert.equal(store.abortSession(), true);
});

test("Current-property cycles block a session before execution", async () => {
  const store = useMetronomeStore();
  const defaults = createDefaultMetronomeSettings();
  const settings = {
    ...defaults,
    bpm: {
      ...formula(120, 20, 300),
      expression: fallbackNode(
        "fallback-bpm",
        currentNode("accentRepeat"),
        120,
      ),
    },
    accentRepeat: {
      ...formula(10),
      expression: fallbackNode(
        "fallback-accent",
        currentNode("bpm"),
        10,
      ),
    },
  };
  assert.equal(
    store.replaceActionDefinitions(
      [metronomeAction("metronome", settings)],
      true,
    ),
    true,
  );

  assert.equal(await store.startSession(), false);
  assert.match(store.actionError, /Zirkelbezug/);
  assert.equal(store.phase, "idle");
});

test("cross-field constraints clamp a maximum above the resolved start tempo", async () => {
  const store = useMetronomeStore();
  const defaults = createDefaultMetronomeSettings();
  const settings = {
    ...defaults,
    maximum: "stick" as const,
    maximumLimitStick: formula(120, 60, 400),
  };
  assert.equal(
    store.replaceActionDefinitions(
      [metronomeAction("metronome", settings)],
      true,
    ),
    true,
  );
  assert.equal(await store.startSession(), true);

  assert.equal(store.settings?.maximumLimit, 121);
  const result = store.currentActionResult;
  assert.ok(result?.type === ACTION_TYPES.METRONOME);
  assert.equal(
    result.formulaValues?.find(
      (entry) => entry.field === "maximumLimitStick",
    )?.clamped,
    true,
  );
  store.abortSession();
});
