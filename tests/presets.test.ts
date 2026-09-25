import assert from "node:assert/strict";
import { test } from "vitest";
import {
  ACTION_TYPES,
  getActionFormulaFields,
  getEnabledCurrentFormulaProperties,
  validateActionDefinitions,
} from "../src/action-model.ts";
import {
  validateMetronomeActionSettings,
} from "../src/models/metronome-settings.ts";
import { validateStopwatchActionSettings } from "../src/models/stopwatch-settings.ts";
import { resolveActionFormulaValues } from "../src/models/action-formulas.ts";
import { METRONOME_PRESETS } from "../src/presets.ts";

function validatePreset(id: keyof typeof METRONOME_PRESETS) {
  return validateActionDefinitions(METRONOME_PRESETS[id].actions, {
    validateMetronomeSettings: validateMetronomeActionSettings,
    validateStopwatchSettings: validateStopwatchActionSettings,
    requireMetronome: true,
  });
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

test("all built-in presets validate with stable action references", () => {
  for (const id of Object.keys(METRONOME_PRESETS) as Array<
    keyof typeof METRONOME_PRESETS
  >) {
    const validation = validatePreset(id);
    assert.equal(
      validation.valid,
      true,
      validation.errors.map((error) => error.message).join(" "),
    );
    const configuredIds = METRONOME_PRESETS[id].actions.map(
      (action) => action.id,
    );
    if (configuredIds.every((actionId) => typeof actionId === "string")) {
      assert.deepEqual(
        validation.actions.map((action) => action.id),
        configuredIds,
      );
    } else {
      assert.equal(validation.actions.length, configuredIds.length);
    }
  }
});

test("test - maximal activates all action settings with formulas", () => {
  const preset = METRONOME_PRESETS["test-maximal"];
  assert.equal(preset.label, "test - maximal");
  assert.equal(preset.autoStart, false);
  assert.equal(preset.hideProgress, true);
  assert.deepEqual(
    preset.actions.map((action) => [action.id, action.name, action.type]),
    [
      [
        "test-maximal-stopwatch-unlimited",
        "Stoppuhr unbegrenzt",
        ACTION_TYPES.STOPWATCH,
      ],
      [
        "test-maximal-stopwatch-manual",
        "Stoppuhr manuell",
        ACTION_TYPES.STOPWATCH,
      ],
      [
        "test-maximal-stopwatch-automatic",
        "Stoppuhr automatisch",
        ACTION_TYPES.STOPWATCH,
      ],
      ["test-maximal-metronome-1", "Metronom 1", ACTION_TYPES.METRONOME],
      ["test-maximal-metronome-2", "Metronom 2", ACTION_TYPES.METRONOME],
    ],
  );

  const validatedActions = validatePreset("test-maximal").actions;
  for (const action of validatedActions) {
    const resolution = resolveActionFormulaValues(action, []);
    assert.equal(
      resolution.valid,
      true,
      resolution.valid ? "" : `${action.name}.${resolution.field}: ${resolution.error}`,
    );
    for (const { field, input } of getActionFormulaFields(action)) {
      assert.notEqual(
        input.expression?.type,
        "static",
        `${action.name}.${field} should contain a formula`,
      );
    }
    for (const field of getEnabledCurrentFormulaProperties(action)) {
      assert.ok(
        getActionFormulaFields(action).some(
          (formula) => formula.field === field,
        ),
        `${action.name}.${field} should be represented by a formula field`,
      );
    }
  }

  const [unlimited, manual, automatic, firstMetronome, secondMetronome] =
    preset.actions;
  assert.ok(unlimited?.type === ACTION_TYPES.STOPWATCH);
  assert.ok(manual?.type === ACTION_TYPES.STOPWATCH);
  assert.ok(automatic?.type === ACTION_TYPES.STOPWATCH);
  assert.ok(firstMetronome?.type === ACTION_TYPES.METRONOME);
  assert.ok(secondMetronome?.type === ACTION_TYPES.METRONOME);
  assert.equal(unlimited.settings.endMode, "unlimited");
  assert.equal(manual.settings.endMode, "manual");
  assert.equal(automatic.settings.endMode, "automatic");
  assert.equal(unlimited.settings.hideDuration, true);
  assert.equal(manual.settings.hideDuration, true);
  assert.equal(automatic.settings.hideDuration, true);
  assert.equal(unlimited.settings.earlyContinueWarning, true);
  assert.equal(manual.settings.earlyContinueWarning, true);
  assert.equal(automatic.settings.earlyContinueWarning, true);

  for (const action of [firstMetronome, secondMetronome]) {
    assert.equal(action.settings.accentuate, true);
    assert.equal(action.settings.increaseTempo, true);
    assert.equal(action.settings.maximum, "reverse");
    assert.equal(action.settings.breaks, "limited");
    assert.notEqual(action.settings.breakCount, null);
    assert.notEqual(action.settings.breakSeconds, null);
    assert.equal(action.settings.sessionEndEnabled, true);
    assert.equal(action.settings.lockSettings, true);
    assert.equal(action.settings.hideLockText, true);
    assert.equal(action.settings.hideNextTempo, true);
  }
});
