import assert from "node:assert/strict";
import { test } from "vitest";
import type { Action } from "../src/action-model.ts";
import {
  ACTION_TYPES,
  createDefaultAction,
  parseActionsPayload,
  serializeActionsPayload,
  validateActionDefinitions,
} from "../src/action-model.ts";
import {
  PRE_TIMER_ROUNDING,
  PRE_TIMER_TYPES,
  evaluatePreTimerFormula,
  getPreTimerFormulaVariables,
  normalizePreTimerDefinition,
  parsePreTimerFormula,
} from "../src/pre-timer-model.ts";

test("duplicate action names report the original row after invalid rows", () => {
  const validation = validateActionDefinitions([
    {
      type: ACTION_TYPES.SECONDS,
      name: "Invalid",
      settings: { seconds: 0 },
    },
    {
      type: ACTION_TYPES.MANUAL,
      name: "Alpha",
      settings: { limitSeconds: null },
    },
    {
      type: ACTION_TYPES.MANUAL,
      name: "Beta",
      settings: { limitSeconds: null },
    },
    {
      type: ACTION_TYPES.MANUAL,
      name: "alpha",
      settings: { limitSeconds: null },
    },
  ]);

  const duplicateError = validation.errors.find(
    (error) => error.index === 3 && error.field === "name",
  );
  assert.ok(duplicateError);
  assert.match(duplicateError.message, /"Alpha"/);
  assert.doesNotMatch(duplicateError.message, /"Beta"/);
});

test("imported action IDs are discarded and generated locally", () => {
  const parsed = parseActionsPayload(
    JSON.stringify([
      {
        id: "remote-id",
        type: ACTION_TYPES.SECONDS,
        name: "Pause",
        settings: { seconds: 15 },
      },
    ]),
  );

  if (!parsed.valid) {
    throw new Error(parsed.error);
  }
  const importedAction = parsed.actions[0];
  assert.ok(importedAction && typeof importedAction === "object");
  assert.equal("id" in importedAction, false);

  const validation = validateActionDefinitions(parsed.actions);
  assert.equal(validation.valid, true);
  assert.notEqual(validation.actions[0]?.id, "remote-id");
});

test("action exports omit local IDs and preserve ordered action settings", () => {
  const actions: Action[] = [
    {
      id: "local-id",
      type: ACTION_TYPES.SECONDS,
      name: "Warm-up",
      settings: { seconds: 12 },
    },
  ];

  assert.deepEqual(JSON.parse(serializeActionsPayload(actions)), [
    {
      type: ACTION_TYPES.SECONDS,
      name: "Warm-up",
      settings: { seconds: 12 },
    },
  ]);
});

test("default Stoppuhr actions have a usable dynamic result range", () => {
  const action = createDefaultAction(ACTION_TYPES.STOPWATCH, []);

  assert.equal(action.settings.min, 10);
  assert.equal(action.settings.max, null);
});

test("dynamic stopwatch formulas validate their beat bounds", () => {
  const valid = normalizePreTimerDefinition({
    type: PRE_TIMER_TYPES.STOPWATCH,
    name: "Timer",
    formula: "sekunden",
    rounding: PRE_TIMER_ROUNDING.FLOOR,
    min: "5",
    max: "20",
  });
  const invalid = normalizePreTimerDefinition({
    type: PRE_TIMER_TYPES.STOPWATCH,
    name: "Timer",
    formula: "sekunden",
    rounding: PRE_TIMER_ROUNDING.FLOOR,
    min: "20",
    max: "5",
  });

  assert.equal(valid.valid, true);
  if (!valid.valid || valid.value.type !== PRE_TIMER_TYPES.STOPWATCH) {
    throw new Error("Expected a normalized stopwatch action.");
  }
  assert.equal(valid.value.min, 5);
  assert.equal(valid.value.max, 20);
  assert.equal(invalid.valid, false);
  if (invalid.valid) {
    throw new Error("Expected invalid stopwatch bounds.");
  }
  assert.ok(invalid.errors.max);
});

test("a static stopwatch formula must be a positive safe integer", () => {
  const validation = normalizePreTimerDefinition({
    type: PRE_TIMER_TYPES.STOPWATCH,
    name: "Timer",
    formula: "0",
    rounding: PRE_TIMER_ROUNDING.FLOOR,
  });

  assert.equal(validation.valid, false);
  if (validation.valid) {
    throw new Error("Expected an invalid static formula.");
  }
  assert.ok(validation.errors.formula);
});

test("stopwatch formulas honor operator precedence and minute rounding", () => {
  const variables = getPreTimerFormulaVariables(
    150,
    PRE_TIMER_ROUNDING.ROUND,
    30,
  );
  const result = evaluatePreTimerFormula(
    "summe-minuten + minuten * 2 + rest-sekunden",
    variables,
  );

  if (!result.valid) {
    throw new Error(result.error);
  }
  assert.equal(result.result, 42);
});

test("stopwatch formulas reject incomplete expressions", () => {
  const result = parsePreTimerFormula("minuten +");

  assert.equal(result.valid, false);
  if (result.valid) {
    throw new Error("Expected the formula to be rejected.");
  }
  assert.match(result.error, /unvollständig/);
});
