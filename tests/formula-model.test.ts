import assert from "node:assert/strict";
import { test } from "vitest";
import {
  formatFormulaNode,
  getFormulaRoundConfig,
  getLocalFormulaDate,
  normalizeFormulaNode,
  normalizeNumericFormulaInput,
  validateNumericFormulaInput,
} from "../src/formula-model.ts";

test("date nodes validate and format their stored ISO dates", () => {
  const valid = normalizeFormulaNode({
    id: "days",
    type: "days",
    date: "2026-01-31",
  });
  const invalid = normalizeFormulaNode({
    id: "invalid-date",
    type: "months",
    date: "2026-02-29",
  });

  assert.equal(valid.valid, true);
  assert.equal(invalid.valid, false);
  assert.equal(
    formatFormulaNode({
      id: "months",
      type: "months",
      date: "2026-01-31",
    }),
    "Monate seit 31.01.2026",
  );
});

test("only target nodes require fallback ancestors", () => {
  const dateInput = normalizeNumericFormulaInput(
    {
      expression: {
        id: "days",
        type: "days",
        date: "2026-01-01",
      },
      min: { id: "min", type: "static", value: 1 },
      max: { id: "max", type: "static", value: 600 },
    },
    10,
    1,
    600,
  );
  const divisionInput = normalizeNumericFormulaInput(
    {
      expression: {
        id: "division",
        type: "operator",
        operator: "/",
        left: { id: "left", type: "static", value: 1 },
        right: { id: "right", type: "static", value: 2 },
      },
      min: { id: "min", type: "static", value: 1 },
      max: { id: "max", type: "static", value: 600 },
    },
    10,
    1,
    600,
  );
  const additionInput = normalizeNumericFormulaInput(
    {
      expression: {
        id: "addition",
        type: "operator",
        operator: "+",
        left: { id: "left", type: "static", value: 1 },
        right: { id: "right", type: "static", value: 2 },
      },
      min: { id: "min", type: "static", value: 1 },
      max: { id: "max", type: "static", value: 600 },
    },
    10,
    1,
    600,
  );

  assert.equal(dateInput.valid, true);
  assert.equal(dateInput.value.expression?.type, "days");
  assert.equal(divisionInput.valid, false);
  assert.equal(divisionInput.value.expression?.type, "operator");
  assert.match(divisionInput.errors.join(" "), /Ersatzwert/);
  assert.equal(additionInput.valid, true);
  assert.equal(additionInput.value.expression?.type, "operator");

  const futureDate = getLocalFormulaDate(new Date(2026, 8, 26));
  const futureNow = new Date(2026, 8, 25, 12, 0, 0);
  const bareFuture = validateNumericFormulaInput(
    {
      expression: {
        id: "future",
        type: "days",
        date: futureDate,
      },
      min: { id: "min", type: "static", value: 1 },
      max: { id: "max", type: "static", value: 600 },
    },
    futureNow,
  );
  const protectedFuture = validateNumericFormulaInput(
    {
      expression: {
        id: "outer-fallback",
        type: "fallback",
        fallback: 1,
        input: {
          id: "future",
          type: "days",
          date: futureDate,
        },
      },
      min: { id: "min", type: "static", value: 1 },
      max: { id: "max", type: "static", value: 600 },
    },
    futureNow,
  );
  assert.equal(bareFuture.valid, false);
  assert.equal(protectedFuture.valid, true);

  const bareReferenceBound = validateNumericFormulaInput({
    expression: { id: "value", type: "static", value: 10 },
    min: {
      id: "reference-bound",
      type: "reference",
      actionId: "action",
      metric: "minutes",
    },
    max: { id: "max", type: "static", value: 600 },
  });
  const protectedNestedReference = validateNumericFormulaInput({
    expression: {
      id: "nested-fallback",
      type: "fallback",
      fallback: 1,
      input: {
        id: "addition",
        type: "operator",
        operator: "+",
        left: {
          id: "reference",
          type: "reference",
          actionId: "action",
          metric: "minutes",
        },
        right: { id: "right", type: "static", value: 1 },
      },
    },
    min: { id: "min", type: "static", value: 1 },
    max: { id: "max", type: "static", value: 600 },
  });
  assert.equal(bareReferenceBound.valid, false);
  assert.equal(protectedNestedReference.valid, true);
});

test("round configurations identify supported sources and units", () => {
  const days = getFormulaRoundConfig({
    id: "fallback-days",
    type: "fallback",
    fallback: 1,
    input: { id: "days", type: "days", date: "2026-01-01" },
  });
  const division = getFormulaRoundConfig({
    id: "division",
    type: "operator",
    operator: "/",
    left: { id: "left", type: "static", value: 1 },
    right: { id: "right", type: "static", value: 2 },
  });

  assert.deepEqual(days, {
    kind: "days",
    min: 0,
    max: 23,
    defaultThreshold: 12,
    unitLabel: "h",
  });
  assert.deepEqual(division, {
    kind: "division",
    min: 0,
    max: 0,
    defaultThreshold: 30,
    unitLabel: "",
  });
  assert.equal(
    formatFormulaNode({
      id: "round-days",
      type: "round",
      input: {
        id: "days",
        type: "days",
        date: "2026-01-01",
      },
      threshold: 12,
    }),
    "Runden(Tage seit 01.01.2026; 12h)",
  );
});
