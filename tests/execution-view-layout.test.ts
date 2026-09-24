// @vitest-environment jsdom

import assert from "node:assert/strict";
import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { nextTick } from "vue";
import { test } from "vitest";
import {
  ACTION_TYPES,
  createDefaultStopwatchSettings,
} from "../src/action-model.ts";
import MetronomeExecutionView from "../src/components/execution/MetronomeExecutionView.vue";
import StopwatchExecutionView from "../src/components/execution/StopwatchExecutionView.vue";
import AppDialogHost from "../src/components/common/AppDialogHost.vue";
import { createDefaultMetronomeSettings } from "../src/models/metronome-settings.ts";
import type {
  RuntimeStopwatchSettings,
  RuntimeMetronomeSettings,
  StopwatchActionResult,
} from "../src/models/session.ts";
import { useMetronomeStore } from "../src/stores/metronome.ts";

function mountWithStore(component: Parameters<typeof mount>[0], props: object) {
  return mount(component, {
    props,
    global: { plugins: [createPinia()] },
  });
}

function stopwatchRuntime(
  overrides: Partial<RuntimeStopwatchSettings> = {},
): RuntimeStopwatchSettings {
  return {
    endMode: "unlimited",
    automaticSeconds: null,
    hideDuration: false,
    manualLimitSeconds: null,
    earlyContinueWarning: false,
    earlyContinueWarningSeconds: null,
    ...overrides,
  };
}

test("Metronome title is a section heading and Pause spans the first row", () => {
  const wrapper = mountWithStore(MetronomeExecutionView, {
    action: {
      id: "metronome",
      type: ACTION_TYPES.METRONOME,
      name: "Warm-up",
      settings: createDefaultMetronomeSettings(),
    },
  });

  assert.equal(wrapper.get("#execution-title").element.tagName, "H2");
  assert.equal(wrapper.get("#execution-title").text(), "Warm-up");
  assert.equal(wrapper.find("h1").exists(), false);
  assert.equal(
    wrapper.findAll(".eyebrow").some((element) => element.text() === "Metronom"),
    false,
  );

  const rows = wrapper.findAll(".action-execution-actions");
  assert.equal(rows.length, 2);
  assert.deepEqual(
    rows[0]?.findAll("button").map((button) => button.text()),
    ["Pause"],
  );
  assert.ok(rows[0]?.get("button").classes().includes("full-width-button"));
  assert.deepEqual(
    rows[1]?.findAll("button").map((button) => button.text()),
    ["Abbrechen", "Weiter"],
  );
  wrapper.unmount();
});

test("metronome cards reflect tempo progression and the hide-next setting", async () => {
  const pinia = createPinia();
  setActivePinia(pinia);
  const store = useMetronomeStore();
  store.settings = {
    initialBpm: 120,
    accentuate: false,
    accentRepeat: 10,
    increaseTempo: true,
    increaseBy: 2,
    increaseAfter: 10,
    maximum: "none",
    maximumLimit: 180,
    decreaseBy: 1,
    decreaseAfter: 10,
    breaks: "none",
    breakCount: null,
    breakSecondsFormula: null,
    breakSecondsRaw: "",
    lockSettings: false,
    hideLockText: false,
    hideNextTempo: false,
    lockBeats: 10,
    sessionEndEnabled: false,
    sessionEndBeats: 100,
  };
  store.phase = "running";
  store.currentBpm = 120;
  store.beatCount = 4;
  store.tempoCounter = 4;

  const wrapper = mount(MetronomeExecutionView, {
    props: {
      action: {
        id: "metronome",
        type: ACTION_TYPES.METRONOME,
        name: "Warm-up",
        settings: createDefaultMetronomeSettings(),
      },
    },
    global: { plugins: [pinia] },
  });

  assert.deepEqual(
    wrapper.findAll(".metric .metric-label").map((label) => label.text()),
    ["Beats", "Tempo", "Ab 10 Beats"],
  );
  assert.deepEqual(
    wrapper.findAll(".metric .metric-value").map((value) => value.text()),
    ["4", "120", "122"],
  );

  store.settings = { ...store.settings!, increaseAfter: 1 };
  store.beatCount = 0;
  store.tempoCounter = 0;
  await nextTick();
  assert.equal(
    wrapper.findAll(".metric .metric-label")[2]?.text(),
    "Ab 1 Beat",
  );

  store.settings = { ...store.settings!, hideNextTempo: true };
  await nextTick();
  assert.deepEqual(
    wrapper.findAll(".metric .metric-label").map((label) => label.text()),
    ["Beats", "Tempo"],
  );
  assert.equal(wrapper.find(".metric-grid--progressing").exists(), false);

  store.settings = { ...store.settings!, increaseTempo: false };
  await nextTick();
  assert.deepEqual(
    wrapper.findAll(".metric .metric-label").map((label) => label.text()),
    ["Beats", "Tempo"],
  );
  wrapper.unmount();
});

test("locked metronome actions describe the lock and can hide its threshold", async () => {
  const pinia = createPinia();
  setActivePinia(pinia);
  const store = useMetronomeStore();
  const settings: RuntimeMetronomeSettings = {
    initialBpm: 120,
    accentuate: false,
    accentRepeat: 10,
    increaseTempo: false,
    increaseBy: 1,
    increaseAfter: 10,
    maximum: "none",
    maximumLimit: 180,
    decreaseBy: 1,
    decreaseAfter: 10,
    breaks: "none",
    breakCount: null,
    breakSecondsFormula: null,
    breakSecondsRaw: "",
    lockSettings: true,
    hideLockText: false,
    hideNextTempo: false,
    lockBeats: 10,
    sessionEndEnabled: false,
    sessionEndBeats: 100,
  };
  store.settings = settings;
  store.phase = "running";
  store.beatCount = 3;

  const wrapper = mount(MetronomeExecutionView, {
    props: {
      action: {
        id: "metronome",
        type: ACTION_TYPES.METRONOME,
        name: "Warm-up",
        settings: createDefaultMetronomeSettings(),
      },
    },
    global: { plugins: [pinia] },
  });
  const continueButton = wrapper
    .findAll(".action-execution-actions")[1]
    ?.get("button.primary-button");

  assert.equal(continueButton?.text(), "Weiter (gesperrt bis 10 Beats)");
  store.settings = { ...store.settings, hideLockText: true };
  await nextTick();
  assert.equal(continueButton?.text(), "Weiter (gesperrt)");
  store.beatCount = 10;
  await nextTick();
  assert.equal(continueButton?.text(), "Weiter");
  wrapper.unmount();
});

test("stopwatch end settings control its button label, limit text, and color", async () => {
  const pinia = createPinia();
  setActivePinia(pinia);
  const store = useMetronomeStore();
  const action = {
    id: "stopwatch",
    type: ACTION_TYPES.STOPWATCH,
    name: "Dauer",
    settings: createDefaultStopwatchSettings(),
  };
  store.actionPlan = [action];
  const stopwatchResult: StopwatchActionResult = {
    id: action.id,
    type: action.type,
    name: action.name,
    status: "active",
    settings: stopwatchRuntime({
      endMode: "automatic",
      automaticSeconds: 10,
      earlyContinueWarning: true,
      earlyContinueWarningSeconds: 10,
    }),
  };
  store.actionResults = [stopwatchResult];
  store.currentActionIndex = 0;
  store.phase = "action-stoppuhr";
  store.activeElapsedSeconds = 3;

  const wrapper = mount(StopwatchExecutionView, {
    props: { action },
    global: { plugins: [pinia] },
  });
  const continueButton = wrapper.get(".action-execution-actions .primary-button");
  assert.equal(continueButton.text(), "Weiter (automatisch nach 10 Sekunden)");
  assert.equal(
    wrapper.get(".stopwatch-metric-grid .metric-label").text(),
    "Vergangene Zeit",
  );
  assert.equal(
    wrapper.get(".stopwatch-metric-grid .metric-value").text(),
    "00:03",
  );
  assert.equal(wrapper.find(".action-options-summary").exists(), false);

  const limitedStopwatchResult: StopwatchActionResult = {
    ...stopwatchResult,
    settings: stopwatchRuntime({
      endMode: "manual",
      manualLimitSeconds: 5,
    }),
  };
  store.actionResults = [limitedStopwatchResult];
  store.activeElapsedSeconds = 5;
  await nextTick();

  const limitedButton = wrapper.get(
    ".action-execution-actions button:last-child",
  );
  assert.equal(limitedButton.text(), "Weiter");
  assert.ok(limitedButton.classes().includes("danger-button"));
  assert.equal(wrapper.get(".action-options-summary").text(), "Limit: 5 Sekunden");
  wrapper.unmount();
});

test("an open early-continue dialog is accepted when a manual limit is reached", async () => {
  const pinia = createPinia();
  setActivePinia(pinia);
  const store = useMetronomeStore();
  const action = {
    id: "stopwatch",
    type: ACTION_TYPES.STOPWATCH,
    name: "Dauer",
    settings: {
      ...createDefaultStopwatchSettings(),
      endMode: "manual" as const,
      manualLimitSeconds: {
        ...createDefaultStopwatchSettings().manualLimitSeconds,
        expression: {
          id: "manual-limit",
          type: "static" as const,
          value: 20,
        },
      },
      earlyContinueWarningSeconds: {
        ...createDefaultStopwatchSettings().earlyContinueWarningSeconds,
        expression: {
          id: "warning-threshold",
          type: "static" as const,
          value: 10,
        },
      },
    },
  };
  const stopwatchResult: StopwatchActionResult = {
    id: action.id,
    type: action.type,
    name: action.name,
    status: "active",
    settings: stopwatchRuntime({
      endMode: "manual",
      manualLimitSeconds: 20,
      earlyContinueWarning: true,
      earlyContinueWarningSeconds: 10,
    }),
  };
  store.actionPlan = [action];
  store.actionResults = [stopwatchResult];
  store.currentActionIndex = 0;
  store.phase = "action-stoppuhr";
  store.activeElapsedSeconds = 3;

  const dialogHost = mount(AppDialogHost);
  const wrapper = mount(StopwatchExecutionView, {
    props: { action },
    global: { plugins: [pinia] },
  });

  await wrapper.get(".action-execution-actions .primary-button").trigger("click");
  await nextTick();
  const dialog = document.body.querySelector('[role="alertdialog"]');
  assert.ok(dialog);
  assert.equal(dialog.querySelector("h2")?.textContent, "Nächste Aktion starten?");
  assert.equal(
    dialog.querySelector(".app-dialog-message")?.textContent,
    "Wirklich vor dem konfigurierten Ende der Stoppuhr zur nächsten Aktion wechseln?",
  );
  assert.equal(
    dialog.querySelector("[data-dialog-confirm]")?.textContent,
    "Nächste Aktion starten",
  );
  assert.equal(
    dialog.querySelector("[data-dialog-cancel]")?.textContent,
    "Fortsetzen",
  );

  store.activeElapsedSeconds = 20;
  await nextTick();
  await flushPromises();
  await nextTick();

  assert.equal(store.phase, "finished");
  assert.equal(stopwatchResult.status, "completed");
  assert.equal(document.body.querySelector('[role="alertdialog"]'), null);
  wrapper.unmount();
  dialogHost.unmount();
});

test("stopwatch execution places Abbrechen before Weiter", () => {
  const wrapper = mountWithStore(StopwatchExecutionView, {
    action: {
      id: "stopwatch",
      type: ACTION_TYPES.STOPWATCH,
      name: "Dauer",
      settings: createDefaultStopwatchSettings(),
    },
  });

  assert.equal(wrapper.get("#execution-title").element.tagName, "H2");
  assert.deepEqual(
    wrapper
      .get(".action-execution-actions")
      .findAll("button")
      .map((button) => button.text()),
    ["Abbrechen", "Weiter"],
  );
  wrapper.unmount();
});
