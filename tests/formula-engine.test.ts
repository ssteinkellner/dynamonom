import assert from "node:assert/strict";
import { test } from "vitest";
import {
  evaluateFormulaNode,
  evaluateNumericFormulaInput,
} from "../src/formula-engine.ts";
import {
  createNumericFormulaInput,
  type FormulaNode,
} from "../src/formula-model.ts";

const previousActions = [
  {
    id: "watch",
    type: "stoppuhr",
    name: "Messung",
    elapsedSeconds: 160,
  },
  {
    id: "metronome",
    type: "metronom",
    name: "Lauf",
    elapsedSeconds: 120,
    endBpm: 132,
  },
];

test("formula operators preserve intermediate precision", () => {
  const expression: FormulaNode = {
    id: "divide",
    type: "operator",
    operator: "/",
    left: { id: "left", type: "static", value: 11 },
    right: { id: "right", type: "static", value: 2 },
  };
  const result = evaluateFormulaNode(expression, {
    previousActions: [],
    currentValues: {},
  });

  assert.deepEqual(result, {
    valid: true,
    value: 5.5,
    fallbackUsed: false,
    clamped: false,
  });
});

test("references expose elapsed time metrics and End-BPM", () => {
  const metrics = [
    ["minutes", 160 / 60],
    ["sum-minutes", (160 / 60) * (160 / 60 + 1) / 2],
    ["seconds-absolute", 160],
    ["seconds-rest", 40],
    ["end-bpm", 132],
  ] as const;

  for (const [metric, expected] of metrics) {
    const actionId = metric === "end-bpm" ? "metronome" : "watch";
    const result = evaluateFormulaNode(
      {
        id: `reference-${metric}`,
        type: "reference",
        actionId,
        metric,
      },
      { previousActions, currentValues: {} },
    );
    assert.equal(result.valid, true);
    if (result.valid) {
      assert.equal(result.value, expected);
    }
  }
});

test("Round applies the seconds threshold before triangular minute summation", () => {
  const context = { previousActions, currentValues: {} };
  const round = (
    metric: "minutes" | "sum-minutes",
    threshold: number,
  ): FormulaNode => ({
    id: `round-${metric}-${threshold}`,
    type: "round",
    input: {
      id: `reference-${metric}-${threshold}`,
      type: "reference",
      actionId: "watch",
      metric,
    },
    threshold,
  });

  assert.deepEqual(evaluateFormulaNode(round("minutes", 30), context), {
    valid: true,
    value: 3,
    fallbackUsed: false,
    clamped: false,
  });
  assert.deepEqual(evaluateFormulaNode(round("minutes", 50), context), {
    valid: true,
    value: 2,
    fallbackUsed: false,
    clamped: false,
  });
  assert.deepEqual(evaluateFormulaNode(round("sum-minutes", 30), context), {
    valid: true,
    value: 6,
    fallbackUsed: false,
    clamped: false,
  });
});

test("Current reads current properties or the live BPM", () => {
  const context = {
    previousActions: [],
    currentValues: { increaseBy: 4 },
    liveBpm: 138,
  };

  assert.equal(
    evaluateFormulaNode(
      { id: "current-field", type: "current", property: "increaseBy" },
      context,
    ).valid,
    true,
  );
  assert.equal(
    evaluateFormulaNode(
      { id: "current-live", type: "current", property: "current-bpm" },
      context,
    ).valid,
    true,
  );
  const live = evaluateFormulaNode(
    { id: "current-live", type: "current", property: "current-bpm" },
    context,
  );
  assert.equal(live.valid && live.value, 138);
});

test("final formula output rounds once and respects field clamps", () => {
  const half: FormulaNode = {
    id: "half",
    type: "fallback",
    fallback: 3,
    input: {
      id: "division",
      type: "operator",
      operator: "/",
      left: { id: "one", type: "static", value: 1 },
      right: { id: "two", type: "static", value: 2 },
    },
  };
  const rounding = evaluateNumericFormulaInput(
    { ...createNumericFormulaInput(3, 1, 10), expression: half },
    { previousActions: [], currentValues: {} },
    { min: 1, max: 10 },
  );
  const relation = evaluateNumericFormulaInput(
    createNumericFormulaInput(120, 60, 400),
    { previousActions: [], currentValues: {} },
    { min: 60, max: 400 },
    { min: 121, max: 400 },
  );

  assert.equal(rounding.valid, true);
  if (rounding.valid) {
    assert.equal(rounding.value, 1);
    assert.equal(rounding.rounded, true);
  }
  assert.equal(relation.valid, true);
  if (relation.valid) {
    assert.equal(relation.value, 121);
    assert.equal(relation.clamped, true);
  }
});

test("Fallback handles an unusable expression and retains its adjustment flag", () => {
  const input = {
    ...createNumericFormulaInput(5, 1, 10),
    expression: {
      id: "fallback",
      type: "fallback" as const,
      fallback: 8,
      input: {
        id: "divide",
        type: "operator" as const,
        operator: "/" as const,
        left: { id: "one", type: "static" as const, value: 1 },
        right: { id: "zero", type: "static" as const, value: 0 },
      },
    },
  };
  const result = evaluateNumericFormulaInput(
    input,
    { previousActions: [], currentValues: {} },
    { min: 1, max: 10 },
  );

  assert.equal(result.valid, true);
  if (result.valid) {
    assert.equal(result.value, 8);
    assert.equal(result.fallbackUsed, true);
  }
});

test("fallbacks used by formula bounds are included in the field result", () => {
  const input = {
    expression: { id: "value", type: "static" as const, value: 5 },
    min: {
      id: "minimum-fallback",
      type: "fallback" as const,
      fallback: 1,
      input: {
        id: "divide",
        type: "operator" as const,
        operator: "/" as const,
        left: { id: "one", type: "static" as const, value: 1 },
        right: { id: "zero", type: "static" as const, value: 0 },
      },
    },
    max: { id: "maximum", type: "static" as const, value: 10 },
  };
  const result = evaluateNumericFormulaInput(
    input,
    { previousActions: [], currentValues: {} },
    { min: 1, max: 10 },
  );

  assert.equal(result.valid, true);
  if (result.valid) {
    assert.equal(result.value, 5);
    assert.equal(result.fallbackUsed, true);
  }
});
