import assert from "node:assert/strict";
import { test } from "vitest";
import { ACTION_TYPES } from "../src/action-model.ts";
import {
  createDefaultMetronomeSettings,
  getStopwatchSourcesBeforeMetronome,
  parseBreakInput,
  validateMetronomeActionSettings,
} from "../src/models/metronome-settings.ts";
import type { Action } from "../src/action-model.ts";

test("default metronome settings pass runtime validation unchanged", () => {
  const defaults = createDefaultMetronomeSettings();
  const validation = validateMetronomeActionSettings(defaults, 0, []);

  assert.equal(validation.valid, true);
  if (!validation.valid) {
    throw new Error("Expected default metronome settings to be valid.");
  }
  assert.deepEqual(validation.settings, defaults);
});

test("active maximum and pause settings are validated", () => {
  const invalidMaximum = validateMetronomeActionSettings(
    {
      ...createDefaultMetronomeSettings(),
      maximum: "stick",
      maximumLimitStick: 120,
    },
    0,
    [],
  );
  const invalidPause = validateMetronomeActionSettings(
    {
      ...createDefaultMetronomeSettings(),
      breaks: "limited",
      breakSeconds: "BPM-120",
    },
    0,
    [],
  );

  assert.equal(invalidMaximum.valid, false);
  assert.ok(invalidMaximum.errors.some((error) => error.field === "maximumLimitStick"));
  assert.equal(invalidPause.valid, false);
  assert.ok(invalidPause.errors.some((error) => error.field === "breakSeconds"));
});

test("break expressions parse into typed inputs", () => {
  assert.deepEqual(parseBreakInput("15"), {
    valid: true,
    value: { type: "seconds", seconds: 15 },
  });
  assert.deepEqual(parseBreakInput("BPM/2"), {
    valid: true,
    value: { type: "expression", operator: "/", operand: 2 },
  });
  assert.equal(parseBreakInput("BPM-120").valid, true);
});

test("stopwatch-derived limits reset after each metronome action", () => {
  const actions = [
    {
      id: "first-stopwatch",
      type: ACTION_TYPES.STOPWATCH,
      name: "Vorbereitung",
      settings: {
        formula: "sekunden",
        rounding: "floor",
        roundingThreshold: null,
        min: 10,
        max: null,
      },
    },
    {
      id: "first-metronome",
      type: ACTION_TYPES.METRONOME,
      name: "Erster Lauf",
      settings: createDefaultMetronomeSettings(),
    },
    {
      id: "second-stopwatch",
      type: ACTION_TYPES.STOPWATCH,
      name: "Zusatz",
      settings: {
        formula: "sekunden",
        rounding: "floor",
        roundingThreshold: null,
        min: 10,
        max: null,
      },
    },
    {
      id: "second-metronome",
      type: ACTION_TYPES.METRONOME,
      name: "Zweiter Lauf",
      settings: createDefaultMetronomeSettings(),
    },
  ] satisfies Action[];

  assert.deepEqual(getStopwatchSourcesBeforeMetronome(actions, 3), [
    { id: "second-stopwatch", name: "Zusatz" },
  ]);
});
