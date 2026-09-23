import assert from "node:assert/strict";
import { test } from "vitest";
import { ACTION_TYPES } from "../src/action-model.ts";
import { createDefaultMetronomeSettings } from "../src/models/metronome-settings.ts";
import type {
  MetronomeActionResult,
  SessionReport,
  StopwatchActionResult,
} from "../src/models/session.ts";
import {
  buildLongReportText,
  buildShortReportText,
  getActionReportSections,
} from "../src/models/report-text.ts";

test("long report uses action headings and separates sections with blank lines", () => {
  const report: SessionReport = {
    aborted: false,
    actions: [
      {
        id: "seconds",
        type: ACTION_TYPES.SECONDS,
        name: "Vorbereitung",
        status: "completed",
        settings: { seconds: 5 },
        configuredSeconds: 5,
        completedBy: "auto",
        elapsedSeconds: 5,
      },
      {
        id: "manual",
        type: ACTION_TYPES.MANUAL,
        name: "Abschluss",
        status: "not-started",
        settings: { limitSeconds: null },
      },
    ],
  };

  assert.equal(
    buildLongReportText(report),
    [
      "**Sekunden - Vorbereitung**",
      "Status: Automatisch fortgesetzt",
      "Dauer: 5 Sekunden (konfiguriert: 5 Sekunden)",
      "",
      "**Manuell - Abschluss**",
      "Status: Nicht gestartet",
    ].join("\n"),
  );
});

test("short metronome report uses the requested break wording", () => {
  const action: MetronomeActionResult = {
    id: "metronome",
    type: ACTION_TYPES.METRONOME,
    name: "Warm-up",
    status: "completed",
    settings: createDefaultMetronomeSettings(),
    beatCount: 12,
    breakRecords: [
      {
        number: 1,
        beat: 6,
        bpm: 120,
        overLimit: false,
        durationSeconds: null,
        ended: "Active",
      },
    ],
    endReason: "manual",
  };
  const report: SessionReport = { actions: [action], aborted: false };

  assert.match(buildShortReportText(report), /\*\*Warm-up\*\*/);
  assert.match(
    buildShortReportText(report),
    /Pausen gebraucht bei: 6 \(aktiv, 120 BPM\)/,
  );
  assert.equal(
    buildShortReportText({
      actions: [{ ...action, breakRecords: [] }],
      aborted: false,
    }).split("\n").at(-1),
    "Keine Pausen gebraucht",
  );
});

test("metronome report prioritizes stopwatch-derived ends", () => {
  const runtimeSettings = {
    initialBpm: 120,
    accentuate: false,
    accentRepeat: 10,
    increaseTempo: false,
    increaseBy: 1,
    increaseAfter: 10,
    maximum: "none",
    maximumLimit: 180,
    decreaseBy: 1,
    decreaseAfter: 10,
    breaks: "none",
    breakCount: null,
    breakSeconds: null,
    breakSecondsRaw: "",
    lockSettings: true,
    lockBeats: 8,
    sessionEndEnabled: true,
    sessionEndBeats: 8,
    derivedEndTotal: 8,
    derivedEndSources: ["Dauer"],
  } satisfies MetronomeActionResult["settings"];
  const report: SessionReport = {
    aborted: false,
    actions: [
      {
        id: "metronome",
        type: ACTION_TYPES.METRONOME,
        name: "Metronom",
        status: "completed",
        settings: runtimeSettings,
        beatCount: 8,
        derivedEnd: { total: 8, sources: ["Dauer"] },
        endReason: "automatic",
      },
    ],
  };

  assert.match(
    buildLongReportText(report),
    /Ende: Aus Stoppuhr: Nach 8 Beats; Weiter gesperrt bis 8 Beats/,
  );
  assert.match(buildLongReportText(report), /Aus Stoppuhr: Dauer = 8 Beats/);
});

test("static stopwatch formulas report no bounds or dynamic fallback", () => {
  const action: StopwatchActionResult = {
    id: "stopwatch",
    type: ACTION_TYPES.STOPWATCH,
    name: "Feste Länge",
    status: "completed",
    settings: {
      formula: "42",
      rounding: "round",
      roundingThreshold: 30,
      min: 10,
      max: null,
    },
    elapsedSeconds: 60,
    formula: "42",
    rounding: "round",
    roundingThreshold: 30,
    resultValid: false,
    invalidReason: "Ungültiges Ergebnis",
    appliedBeats: 10,
  };
  const sections = getActionReportSections({
    actions: [action],
    aborted: false,
  });
  const text = buildLongReportText({ actions: [action], aborted: false });

  assert.ok(
    sections[0]?.details.some(
      (detail) => detail.label === "Grenzen" && detail.value === "Keine (statische Zahl)",
    ),
  );
  assert.doesNotMatch(text, /Ersatzwert|Mindestwert 10 Beats/);
});

test("short reports retain configured parameters for actions not started", () => {
  const report: SessionReport = {
    aborted: true,
    actions: [
      {
        id: "seconds",
        type: ACTION_TYPES.SECONDS,
        name: "Wartezeit",
        status: "not-started",
        settings: { seconds: 12 },
      },
    ],
  };

  assert.equal(
    buildShortReportText(report),
    "**Wartezeit**\nStatus: Nicht gestartet; Konfiguriert: 12s",
  );
  assert.equal(
    buildLongReportText(report),
    "**Sekunden - Wartezeit**\nStatus: Nicht gestartet",
  );
});
