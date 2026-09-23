// @vitest-environment jsdom

import assert from "node:assert/strict";
import { createPinia } from "pinia";
import { mount } from "@vue/test-utils";
import { test } from "vitest";
import {
  ACTION_TYPES,
} from "../src/action-model.ts";
import MetronomeExecutionView from "../src/components/execution/MetronomeExecutionView.vue";
import ManualExecutionView from "../src/components/execution/ManualExecutionView.vue";
import SecondsExecutionView from "../src/components/execution/SecondsExecutionView.vue";
import StopwatchExecutionView from "../src/components/execution/StopwatchExecutionView.vue";
import { createDefaultMetronomeSettings } from "../src/models/metronome-settings.ts";

function mountWithStore(component: Parameters<typeof mount>[0], props: object) {
  return mount(component, {
    props,
    global: { plugins: [createPinia()] },
  });
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

test("timer and manual execution views place Abbrechen before Weiter", () => {
  const wrappers = [
    mountWithStore(SecondsExecutionView, {
      action: {
        id: "seconds",
        type: ACTION_TYPES.SECONDS,
        name: "Wartezeit",
        settings: { seconds: 30 },
      },
    }),
    mountWithStore(StopwatchExecutionView, {
      action: {
        id: "stopwatch",
        type: ACTION_TYPES.STOPWATCH,
        name: "Dauer",
        settings: {
          formula: "sekunden",
          rounding: "floor",
          roundingThreshold: null,
          min: 10,
          max: null,
        },
      },
    }),
    mountWithStore(ManualExecutionView, {
      action: {
        id: "manual",
        type: ACTION_TYPES.MANUAL,
        name: "Abschluss",
        settings: { limitSeconds: null },
      },
    }),
  ];

  for (const wrapper of wrappers) {
    assert.equal(wrapper.get("#execution-title").element.tagName, "H2");
    assert.deepEqual(
      wrapper
        .get(".action-execution-actions")
        .findAll("button")
        .map((button) => button.text()),
      ["Abbrechen", "Weiter"],
    );
    wrapper.unmount();
  }
});
