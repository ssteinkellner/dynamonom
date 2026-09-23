import assert from "node:assert/strict";
import test from "node:test";
import {
  ACTION_TYPES,
  createDefaultAction,
  parseActionsPayload,
  serializeActionsPayload,
  validateActionDefinitions,
} from "../src/action-model.js";
import {
  PRE_TIMER_ROUNDING,
  PRE_TIMER_TYPES,
  normalizePreTimerDefinition,
} from "../src/pre-timer-model.js";

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

  assert.equal(parsed.valid, true);
  assert.equal("id" in parsed.actions[0], false);
  const validation = validateActionDefinitions(parsed.actions);
  assert.equal(validation.valid, true);
  assert.notEqual(validation.actions[0].id, "remote-id");
});

test("action exports omit local IDs and preserve ordered action settings", () => {
  const actions = [
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
  const action = createDefaultAction(
    ACTION_TYPES.STOPWATCH,
    [],
    { bpm: 120 },
  );

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
  assert.equal(valid.value.min, 5);
  assert.equal(valid.value.max, 20);
  assert.equal(invalid.valid, false);
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
  assert.ok(validation.errors.formula);
});
