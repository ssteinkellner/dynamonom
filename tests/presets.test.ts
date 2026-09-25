import assert from "node:assert/strict";
import { test } from "vitest";
import {
  ACTION_TYPES,
  validateActionDefinitions,
} from "../src/action-model.ts";
import {
  validateMetronomeActionSettings,
} from "../src/models/metronome-settings.ts";
import { validateStopwatchActionSettings } from "../src/models/stopwatch-settings.ts";
import { METRONOME_PRESETS } from "../src/presets.ts";

function validatePreset(id: keyof typeof METRONOME_PRESETS) {
  return validateActionDefinitions(METRONOME_PRESETS[id].actions, {
    validateMetronomeSettings: validateMetronomeActionSettings,
    validateStopwatchSettings: validateStopwatchActionSettings,
    requireMetronome: true,
  });
}

function staticValue(input: {
  expression: { type: string; value?: number } | null;
}) {
  return input.expression?.type === "static" ? input.expression.value : null;
}

function getNode(
  input: { expression: import("../src/formula-model.ts").FormulaNode | null },
) {
  assert.ok(input.expression);
  return input.expression;
}

test("built-in presets keep hideProgress beside autoStart", () => {
  for (const preset of Object.values(METRONOME_PRESETS)) {
    assert.equal(typeof preset.autoStart, "boolean");
    assert.equal(typeof preset.hideProgress, "boolean");
    assert.equal(Object.hasOwn(preset, "values"), false);
    assert.equal(Object.hasOwn(preset, "actions"), true);
    assert.equal(Object.isFrozen(preset.actions), false);
    assert.equal(preset.actions.every((action) => Object.isFrozen(action)), true);
  }
});

test("new built-in presets validate with stable action references", () => {
  for (const id of [
    "unterwegs",
    "zu-hause",
    "two-stopwatches-metronome",
  ] as const) {
    const validation = validatePreset(id);
    assert.equal(
      validation.valid,
      true,
      validation.errors.map((error) => error.message).join(" "),
    );
    assert.deepEqual(
      validation.actions.map((action) => action.id),
      METRONOME_PRESETS[id].actions.map((action) => action.id),
    );
  }
});

test("unterwegs uses the requested date-based session end and lock", () => {
  const preset = METRONOME_PRESETS.unterwegs;
  const action = preset.actions[0];
  assert.equal(preset.label, "unterwegs");
  assert.equal(preset.autoStart, true);
  assert.ok(action?.type === ACTION_TYPES.METRONOME);
  assert.equal(action.name, "unterwegs");
  assert.equal(staticValue(action.settings.bpm), 160);
  assert.equal(action.settings.increaseTempo, false);
  assert.equal(action.settings.sessionEndEnabled, true);
  assert.equal(action.settings.lockSettings, true);

  const sessionEnd = getNode(action.settings.sessionEndBeats);
  assert.equal(sessionEnd.type, "operator");
  assert.equal(sessionEnd.operator, "*");
  assert.equal(sessionEnd.right?.type, "static");
  assert.equal(sessionEnd.right?.value, 10);
  assert.equal(sessionEnd.left?.type, "operator");
  assert.equal(sessionEnd.left?.operator, "+");
  assert.equal(sessionEnd.left?.right?.type, "static");
  assert.equal(sessionEnd.left?.right?.value, 2);
  assert.equal(sessionEnd.left?.left?.type, "fallback");
  assert.equal(sessionEnd.left?.left?.fallback, 1);
  assert.equal(sessionEnd.left?.left?.input?.type, "days");
  assert.equal(sessionEnd.left?.left?.input?.date, "2026-09-13");

  const lock = getNode(action.settings.lockBeats);
  assert.equal(lock.type, "fallback");
  assert.equal(lock.fallback, 1);
  assert.equal(lock.input?.type, "current");
  assert.equal(lock.input?.property, "sessionEndBeats");
});

test("zu hause keeps unterwegs settings with a static session end", () => {
  const preset = METRONOME_PRESETS["zu-hause"];
  const action = preset.actions[0];
  assert.equal(preset.label, "zu hause");
  assert.equal(preset.autoStart, true);
  assert.ok(action?.type === ACTION_TYPES.METRONOME);
  assert.equal(action.name, "zu hause");
  assert.equal(staticValue(action.settings.bpm), 160);
  assert.equal(action.settings.increaseTempo, false);
  assert.equal(action.settings.sessionEndEnabled, true);
  assert.equal(staticValue(action.settings.sessionEndBeats), 200);
  assert.equal(action.settings.lockSettings, true);
});

test("the two-stopwatch preset chains manual stopwatches into the metronome formulas", () => {
  const preset = METRONOME_PRESETS["two-stopwatches-metronome"];
  assert.equal(preset.label, "2x Stoppuhr + Metronom");
  assert.equal(preset.autoStart, true);
  assert.equal(preset.actions.length, 3);

  const [stopwatch1, stopwatch2, summe] = preset.actions;
  assert.ok(stopwatch1?.type === ACTION_TYPES.STOPWATCH);
  assert.ok(stopwatch2?.type === ACTION_TYPES.STOPWATCH);
  assert.ok(summe?.type === ACTION_TYPES.METRONOME);
  assert.equal(stopwatch1.id, "preset-stoppuhr-1");
  assert.equal(stopwatch1.name, "Stoppuhr 1");
  assert.equal(stopwatch1.settings.endMode, "manual");
  assert.equal(stopwatch2.id, "preset-stoppuhr-2");
  assert.equal(stopwatch2.name, "Stoppuhr 2");
  assert.equal(stopwatch2.settings.endMode, "manual");
  assert.equal(summe.name, "summe");
  assert.equal(staticValue(summe.settings.bpm), 160);
  assert.equal(summe.settings.increaseTempo, false);
  assert.equal(summe.settings.breaks, "limited");
  assert.equal(summe.settings.breakSeconds, null);

  const breakCount = getNode(summe.settings.breakCount!);
  assert.equal(breakCount.type, "operator");
  assert.equal(breakCount.operator, "+");
  assert.equal(breakCount.left?.type, "fallback");
  assert.equal(breakCount.left?.input?.type, "reference");
  assert.equal(breakCount.left?.input?.actionId, stopwatch1.id);
  assert.equal(breakCount.left?.input?.metric, "minutes");
  assert.equal(breakCount.right?.type, "fallback");
  assert.equal(breakCount.right?.input?.type, "reference");
  assert.equal(breakCount.right?.input?.actionId, stopwatch2.id);
  assert.equal(breakCount.right?.input?.metric, "minutes");

  const sessionEnd = getNode(summe.settings.sessionEndBeats);
  assert.equal(sessionEnd.type, "clamp");
  assert.equal(sessionEnd.min?.type, "static");
  assert.equal(sessionEnd.min?.value, 200);
  assert.equal(sessionEnd.max, null);
  assert.equal(sessionEnd.input?.type, "operator");
  assert.equal(sessionEnd.input?.operator, "*");
  assert.equal(sessionEnd.input?.right?.type, "static");
  assert.equal(sessionEnd.input?.right?.value, 10);
  assert.equal(sessionEnd.input?.left?.type, "operator");
  assert.equal(sessionEnd.input?.left?.operator, "+");
  assert.equal(sessionEnd.input?.left?.left?.type, "fallback");
  assert.equal(sessionEnd.input?.left?.left?.input?.type, "reference");
  assert.equal(sessionEnd.input?.left?.left?.input?.actionId, stopwatch1.id);
  assert.equal(sessionEnd.input?.left?.left?.input?.metric, "sum-minutes");
  assert.equal(sessionEnd.input?.left?.right?.type, "fallback");
  assert.equal(sessionEnd.input?.left?.right?.input?.type, "reference");
  assert.equal(sessionEnd.input?.left?.right?.input?.actionId, stopwatch2.id);
  assert.equal(sessionEnd.input?.left?.right?.input?.metric, "sum-minutes");

  const lock = getNode(summe.settings.lockBeats);
  assert.equal(lock.type, "fallback");
  assert.equal(lock.input?.type, "current");
  assert.equal(lock.input?.property, "sessionEndBeats");
});
