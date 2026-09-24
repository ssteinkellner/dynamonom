import assert from "node:assert/strict";
import { test } from "vitest";
import {
  ACTION_TYPES,
  createDefaultAction,
  createDefaultStopwatchSettings,
  parseActionsPayload,
  serializeActionsPayload,
  validateActionDefinitions,
} from "../src/action-model.ts";
import type { Action } from "../src/action-model.ts";
import {
  createNumericFormulaInput,
  createStaticFormulaNode,
  type FormulaFallbackNode,
  type FormulaMetric,
  type FormulaReferenceNode,
  type NumericFormulaInput,
} from "../src/formula-model.ts";
import {
  validateMetronomeActionSettings,
} from "../src/models/metronome-settings.ts";
import { validateStopwatchActionSettings } from "../src/models/stopwatch-settings.ts";

function validate(actions: unknown[]) {
  return validateActionDefinitions(actions, {
    validateMetronomeSettings: validateMetronomeActionSettings,
    validateStopwatchSettings: validateStopwatchActionSettings,
  });
}

function referenceInput(
  actionId: string,
  metric: FormulaMetric = "seconds-absolute",
): NumericFormulaInput {
  const input: FormulaReferenceNode = {
    id: `reference-${actionId}`,
    type: "reference",
    actionId,
    metric,
  };
  const expression: FormulaFallbackNode = {
    id: `fallback-${actionId}`,
    type: "fallback",
    input,
    fallback: 10,
  };
  return {
    expression,
    min: createStaticFormulaNode(1),
    max: createStaticFormulaNode(600),
  };
}

function stopwatchSettings(
  automaticSeconds = createNumericFormulaInput(10, 1, 600),
) {
  return {
    ...createDefaultStopwatchSettings(),
    endMode: "automatic" as const,
    automaticSeconds,
  };
}

test("duplicate action names report the original row after invalid rows", () => {
  const validation = validate([
    {
      type: ACTION_TYPES.STOPWATCH,
      name: " ",
      settings: createDefaultStopwatchSettings(),
    },
    {
      type: ACTION_TYPES.METRONOME,
      name: "Alpha",
      settings: {},
    },
    {
      type: ACTION_TYPES.STOPWATCH,
      name: "Beta",
      settings: createDefaultStopwatchSettings(),
    },
    {
      type: ACTION_TYPES.STOPWATCH,
      name: "alpha",
      settings: createDefaultStopwatchSettings(),
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
        settings: createDefaultStopwatchSettings(),
      },
      {
        id: "dependent-id",
        type: ACTION_TYPES.STOPWATCH,
        name: "Folgemessung",
        settings: stopwatchSettings(referenceInput("watch-id")),
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
    ["watch-id", "dependent-id"],
  );
  const dependent = validation.actions[1];
  assert.ok(dependent?.type === ACTION_TYPES.STOPWATCH);
  assert.equal(
    dependent.settings.automaticSeconds.expression?.type === "fallback" &&
      dependent.settings.automaticSeconds.expression.input?.type === "reference"
      ? dependent.settings.automaticSeconds.expression.input.actionId
      : "",
    "watch-id",
  );
});

test("action exports retain IDs, formulas, and action order", () => {
  const actions: Action[] = [
    {
      id: "local-id",
      type: ACTION_TYPES.STOPWATCH,
      name: "Wartezeit",
      settings: stopwatchSettings(createNumericFormulaInput(12, 1, 600)),
    },
    {
      id: "watch-id",
      type: ACTION_TYPES.STOPWATCH,
      name: "Messung",
      settings: createDefaultStopwatchSettings(),
    },
  ];

  assert.deepEqual(JSON.parse(serializeActionsPayload(actions)), actions);
});

test("default Stopwatch actions expose unlimited end settings", () => {
  const action = createDefaultAction(ACTION_TYPES.STOPWATCH, []);

  assert.equal(action.settings.endMode, "unlimited");
  assert.equal(action.settings.hideDuration, false);
  assert.equal(action.settings.earlyContinueWarning, true);
  assert.equal(action.settings.automaticSeconds.expression?.type, "static");
  assert.equal(
    action.settings.automaticSeconds.expression?.type === "static"
      ? action.settings.automaticSeconds.expression.value
      : null,
    10,
  );
  assert.equal(
    action.settings.manualLimitSeconds.expression?.type === "static"
      ? action.settings.manualLimitSeconds.expression.value
      : null,
    60,
  );
});

test("removed action types are rejected", () => {
  const validation = validate([
    {
      type: "sekunden",
      name: "Wartezeit",
      settings: { seconds: 10 },
    },
    {
      type: "manuell",
      name: "Abschluss",
      settings: { limitSeconds: null },
    },
  ]);

  assert.equal(validation.valid, false);
  assert.equal(validation.actions.length, 0);
  assert.equal(
    validation.errors.filter((error) => error.field === "type").length,
    2,
  );
});

test("references must point backward and End-BPM requires a Metronome source", () => {
  const stopwatch = {
    id: "watch",
    type: ACTION_TYPES.STOPWATCH,
    name: "Messung",
    settings: createDefaultStopwatchSettings(),
  };
  const dependent = {
    id: "dependent",
    type: ACTION_TYPES.STOPWATCH,
    name: "Folgemessung",
    settings: stopwatchSettings(referenceInput("watch")),
  };
  const valid = validate([stopwatch, dependent]);
  const reordered = validate([dependent, stopwatch]);
  const invalidEndBpm = validate([
    stopwatch,
    {
      ...dependent,
      settings: stopwatchSettings(referenceInput("watch", "end-bpm")),
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
    settings: {},
  };
  const validEndBpm = validate([
    metronomeSource,
    {
      ...dependent,
      settings: stopwatchSettings(referenceInput("tempo", "end-bpm")),
    },
  ]);
  assert.equal(validEndBpm.valid, true);
});
