import assert from "node:assert/strict";
import { test } from "vitest";
import {
  ACTION_TYPES,
  createDefaultAction,
  parseActionsPayload,
  serializeActionsPayload,
  validateActionDefinitions,
} from "../src/action-model.ts";
import type { Action } from "../src/action-model.ts";
import {
  createDefaultMetronomeSettings,
  validateMetronomeActionSettings,
} from "../src/models/metronome-settings.ts";
import {
  createNumericFormulaInput,
  createStaticFormulaNode,
} from "../src/formula-model.ts";

function validate(actions: unknown[]) {
  return validateActionDefinitions(actions, {
    validateMetronomeSettings: validateMetronomeActionSettings,
  });
}

function referenceInput(actionId: string, metric = "seconds-absolute") {
  return {
    expression: {
      id: `fallback-${actionId}`,
      type: "fallback",
      input: {
        id: `reference-${actionId}`,
        type: "reference",
        actionId,
        metric,
      },
      fallback: 10,
    },
    min: createStaticFormulaNode(1),
    max: createStaticFormulaNode(600),
  };
}

test("duplicate action names report the original row after invalid rows", () => {
  const validation = validate([
    {
      type: ACTION_TYPES.SECONDS,
      name: " ",
      settings: { seconds: 1 },
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

test("imports preserve stable action IDs referenced by formulas", () => {
  const parsed = parseActionsPayload(
    JSON.stringify([
      {
        id: "watch-id",
        type: ACTION_TYPES.STOPWATCH,
        name: "Messung",
        settings: {},
      },
      {
        id: "seconds-id",
        type: ACTION_TYPES.SECONDS,
        name: "Wartezeit",
        settings: { seconds: referenceInput("watch-id") },
      },
    ]),
  );

  if (!parsed.valid) {
    throw new Error(parsed.error);
  }
  const validation = validate(parsed.actions);
  assert.equal(validation.valid, true);
  assert.deepEqual(
    validation.actions.map((action) => action.id),
    ["watch-id", "seconds-id"],
  );
  const seconds = validation.actions[1];
  assert.ok(seconds?.type === ACTION_TYPES.SECONDS);
  assert.equal(
    seconds.settings.seconds.expression?.type === "fallback" &&
      seconds.settings.seconds.expression.input?.type === "reference"
      ? seconds.settings.seconds.expression.input.actionId
      : "",
    "watch-id",
  );
});

test("action exports retain IDs, formulas, and action order", () => {
  const actions: Action[] = [
    {
      id: "local-id",
      type: ACTION_TYPES.SECONDS,
      name: "Wartezeit",
      settings: {
        seconds: createNumericFormulaInput(12, 1, 600),
      },
    },
    {
      id: "watch-id",
      type: ACTION_TYPES.STOPWATCH,
      name: "Messung",
      settings: {},
    },
  ];

  assert.deepEqual(JSON.parse(serializeActionsPayload(actions)), actions);
});

test("default Stopwatch actions only record elapsed time", () => {
  const action = createDefaultAction(ACTION_TYPES.STOPWATCH, []);

  assert.deepEqual(action.settings, {});
});

test("references must point backward and End-BPM requires a Metronome source", () => {
  const seconds = {
    id: "seconds",
    type: ACTION_TYPES.SECONDS,
    name: "Wartezeit",
    settings: { seconds: referenceInput("watch") },
  };
  const stopwatch = {
    id: "watch",
    type: ACTION_TYPES.STOPWATCH,
    name: "Messung",
    settings: {},
  };
  const valid = validate([stopwatch, seconds]);
  const reordered = validate([seconds, stopwatch]);
  const invalidEndBpm = validate([
    stopwatch,
    {
      ...seconds,
      settings: { seconds: referenceInput("watch", "end-bpm") },
    },
  ]);

  assert.equal(valid.valid, true);
  assert.equal(reordered.valid, false);
  assert.ok(
    reordered.errors.some((error) =>
      error.message.includes("vorherige Aktion"),
    ),
  );
  assert.equal(invalidEndBpm.valid, false);
  assert.ok(
    invalidEndBpm.errors.some((error) =>
      error.message.includes("End-BPM"),
    ),
  );

  const metronomeSource = {
    id: "tempo",
    type: ACTION_TYPES.METRONOME,
    name: "Tempo",
    settings: createDefaultMetronomeSettings(),
  };
  const validEndBpm = validate([
    metronomeSource,
    {
      ...seconds,
      settings: { seconds: referenceInput("tempo", "end-bpm") },
    },
  ]);
  assert.equal(validEndBpm.valid, true);
});
