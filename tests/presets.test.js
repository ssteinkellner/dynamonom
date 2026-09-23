import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { test } from "vitest";

test("built-in presets keep hideProgress beside autoStart", async () => {
  const source = await readFile(
    new URL("../src/presets.js", import.meta.url),
    "utf8",
  );
  const context = { window: {} };
  runInNewContext(source, context);

  for (const preset of Object.values(context.window.METRONOME_PRESETS)) {
    assert.equal(typeof preset.autoStart, "boolean");
    assert.equal(typeof preset.hideProgress, "boolean");
    assert.equal(Object.hasOwn(preset.values, "hideProgress"), false);
  }
});
