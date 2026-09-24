import assert from "node:assert/strict";
import { test } from "vitest";
import { createDefaultMetronomeSettings, validateMetronomeActionSettings } from "../src/models/metronome-settings.ts";
import {
  createNumericFormulaInput,
  createStaticFormulaNode,
} from "../src/formula-model.ts";

test("default metronome settings pass validation and expose formula inputs", () => {
  const defaults = createDefaultMetronomeSettings();
  const validation = validateMetronomeActionSettings(defaults, 0, []);

  assert.equal(validation.valid, true);
  if (!validation.valid) {
    throw new Error("Expected default metronome settings to be valid.");
  }
  assert.deepEqual(validation.settings, defaults);
  assert.equal(defaults.bpm.expression?.type, "static");
  assert.equal(defaults.bpm.min?.type, "static");
  assert.equal(defaults.breakCount, null);
  assert.equal(defaults.breakSeconds, null);
  assert.equal(defaults.hideLockText, false);
});

test("lock text visibility is optional and defaults to visible", () => {
  const defaults = createDefaultMetronomeSettings();
  const validation = validateMetronomeActionSettings(
    { ...defaults, hideLockText: true },
    0,
    [],
  );

  assert.equal(validation.valid, true);
  if (!validation.valid) {
    throw new Error("Expected hideLockText to be valid.");
  }
  assert.equal(validation.settings.hideLockText, true);
});

test("legacy numeric settings normalize to formula inputs", () => {
  const defaults = createDefaultMetronomeSettings();
  const validation = validateMetronomeActionSettings(
    {
      ...defaults,
      bpm: 132,
      accentRepeat: "8",
      breakCount: 3,
      breakSeconds: 12,
    },
    0,
    [],
  );

  assert.equal(validation.valid, true);
  if (!validation.valid) {
    throw new Error("Expected legacy numeric values to normalize.");
  }
  assert.equal(validation.settings.bpm.expression?.type, "static");
  if (validation.settings.bpm.expression?.type !== "static") {
    throw new Error("Expected the BPM formula to contain a static node.");
  }
  assert.equal(validation.settings.bpm.expression.value, 132);
  assert.equal(validation.settings.accentRepeat.expression?.type, "static");
  assert.equal(validation.settings.breakSeconds?.expression?.type, "static");
});

test("custom formula bounds reject an impossible static range", () => {
  const defaults = createDefaultMetronomeSettings();
  const validation = validateMetronomeActionSettings(
    {
      ...defaults,
      bpm: {
        ...createNumericFormulaInput(120, 20, 300),
        min: createStaticFormulaNode(150),
        max: createStaticFormulaNode(100),
      },
    },
    0,
    [],
  );

  assert.equal(validation.valid, false);
  if (validation.valid) {
    throw new Error("Expected contradictory formula bounds to be rejected.");
  }
  assert.ok(validation.errors.some((error) => error.field === "bpm"));
});

test("optional pause formula remains unsettable and malformed formulas fail", () => {
  const defaults = createDefaultMetronomeSettings();
  const valid = validateMetronomeActionSettings(defaults, 0, []);
  const invalid = validateMetronomeActionSettings(
    {
      ...defaults,
      breakSeconds: { expression: { type: "unknown" }, min: null, max: null },
    },
    0,
    [],
  );

  assert.equal(valid.valid, true);
  assert.equal(defaults.breakSeconds, null);
  assert.equal(invalid.valid, false);
  if (!invalid.valid) {
    assert.ok(invalid.errors.some((error) => error.field === "breakSeconds"));
  }
});
