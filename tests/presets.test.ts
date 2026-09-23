import assert from "node:assert/strict";
import { test } from "vitest";
import { METRONOME_PRESETS } from "../src/presets.ts";

test("built-in presets keep hideProgress beside autoStart", () => {
  for (const preset of Object.values(METRONOME_PRESETS)) {
    assert.equal(typeof preset.autoStart, "boolean");
    assert.equal(typeof preset.hideProgress, "boolean");
    assert.equal(Object.hasOwn(preset.values, "hideProgress"), false);
  }
});
