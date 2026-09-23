import assert from "node:assert/strict";
import { test } from "vitest";
import {
  ACTION_TYPES,
  createDefaultAction,
} from "../src/action-model.ts";
import {
  createDefaultMetronomeSettings,
} from "../src/models/metronome-settings.ts";
import {
  getSettingsImportIssues,
  parseSettingsImport,
  serializeSettings,
  serializeSettingsUrl,
  validateImportedActions,
} from "../src/models/settings-transfer.ts";

test("settings exports preserve the versioned query contract", () => {
  const action = createDefaultAction(
    ACTION_TYPES.METRONOME,
    [],
    createDefaultMetronomeSettings(),
  );
  const parameters = new URLSearchParams(
    serializeSettings([action], true, false),
  );

  assert.equal(parameters.get("version"), "1");
  assert.equal(parameters.get("auto-start"), "true");
  assert.equal(parameters.has("hide-progress"), false);
  assert.equal(parameters.getAll("actions").length, 1);

  const withProgressHidden = new URLSearchParams(
    serializeSettings([action], false, true),
  );
  assert.equal(withProgressHidden.get("auto-start"), "false");
  assert.equal(withProgressHidden.get("hide-progress"), "true");
  assert.equal(
    serializeSettingsUrl(
      "https://example.test/metronome?old=1#report",
      withProgressHidden.toString(),
    ),
    `https://example.test/metronome?${withProgressHidden.toString()}#report`,
  );
});

test("settings imports accept raw, question-prefixed, and full URL input", () => {
  const action = createDefaultAction(
    ACTION_TYPES.METRONOME,
    [],
    createDefaultMetronomeSettings(),
  );
  const query = serializeSettings([action], false, true);

  for (const input of [
    query,
    `?${query}`,
    `https://example.test/path?${query}`,
    `metronome.html?${query}`,
  ]) {
    const parsed = parseSettingsImport(input);
    assert.equal(parsed.valid, true);
    if (!parsed.valid) {
      throw new Error("Expected import parameters to parse.");
    }
    assert.equal(parsed.autoStart, false);
    assert.equal(parsed.hideProgress, true);
    assert.equal(parsed.actions.length, 1);
  }
});

test("settings imports reject unknown, duplicate, missing, and invalid parameters", () => {
  const unknown = parseSettingsImport("version=1&auto-start=false&actions=%5B%5D&extra=1");
  const duplicate = parseSettingsImport(
    "version=1&version=1&auto-start=false&actions=%5B%5D",
  );
  const invalidBoolean = parseSettingsImport(
    "version=1&auto-start=maybe&actions=%5B%5D",
  );
  const missing = parseSettingsImport("version=1&auto-start=false");

  for (const result of [unknown, duplicate, invalidBoolean, missing]) {
    assert.equal(result.valid, false);
  }
  if (unknown.valid || duplicate.valid || invalidBoolean.valid || missing.valid) {
    throw new Error("Expected malformed import parameters to fail.");
  }
  assert.match(unknown.errors[0]?.message ?? "", /extra/);
  assert.match(duplicate.errors[0]?.message ?? "", /nur einmal/);
  assert.match(invalidBoolean.errors[0]?.message ?? "", /true, false, 1 oder 0/);
  assert.match(missing.errors[0]?.message ?? "", /actions/);
});

test("valid rows install unless an indexed action has validation errors", () => {
  const metronome = {
    type: ACTION_TYPES.METRONOME,
    name: "Metronom",
    settings: createDefaultMetronomeSettings(),
  };
  const valid = validateImportedActions([metronome]);
  assert.equal(valid.valid, true);
  assert.equal(valid.actionsToInstall?.length, 1);

  const invalid = validateImportedActions([
    metronome,
    {
      type: ACTION_TYPES.SECONDS,
      name: "Sekunden",
      settings: { seconds: "keine Zahl" },
    },
  ]);
  assert.equal(invalid.valid, false);
  assert.equal(invalid.actionsToInstall, null);
  assert.deepEqual(
    getSettingsImportIssues(invalid.errors, [
      metronome,
      {
        type: ACTION_TYPES.SECONDS,
        name: "Sekunden",
        settings: { seconds: "keine Zahl" },
      },
    ]).map((issue) => [issue.actionIndex, issue.fieldLabel]),
    [[2, "Dauer in Sekunden"]],
  );
});

test("list-level missing-metronome errors retain otherwise-valid imported rows", () => {
  const manual = {
    type: ACTION_TYPES.MANUAL,
    name: "Abschluss",
    settings: { limitSeconds: null },
  };
  const validation = validateImportedActions([manual]);

  assert.equal(validation.valid, false);
  assert.equal(validation.errors[0]?.index, -1);
  assert.equal(validation.actionsToInstall?.length, 1);
});
