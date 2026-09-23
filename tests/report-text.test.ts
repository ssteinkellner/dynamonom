import assert from "node:assert/strict";
import { test } from "vitest";
import { ACTION_TYPES } from "../src/action-model.ts";
import { createNumericFormulaInput } from "../src/formula-model.ts";
import type {
  MetronomeActionResult,
  RuntimeMetronomeSettings,
  SessionReport,
} from "../src/models/session.ts";
import {
  buildLongReportText,
  buildShortReportText,
  getActionReportSections,
} from "../src/models/report-text.ts";

const runtimeSettings: RuntimeMetronomeSettings = {
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
  breakSecondsFormula: null,
  breakSecondsRaw: "",
  lockSettings: false,
  lockBeats: 8,
  sessionEndEnabled: true,
  sessionEndBeats: 8,
};

test("long report headings identify each action and separate sections", () => {
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
      "Limit: Ohne Limit",
    ].join("\n"),
  );
});

test("short Metronome reports use the pause wording and current break list", () => {
  const action: MetronomeActionResult = {
    id: "metronome",
    type: ACTION_TYPES.METRONOME,
    name: "Warm-up",
    status: "completed",
    settings: runtimeSettings,
    beatCount: 12,
    breakRecords: [
      {
        number: 1,
        beat: 6,
        bpm: 120,
        overLimit: false,
        durationSeconds: 15,
        scheduledDurationSeconds: 20,
        ended: "Manuell fortgesetzt nach 15 Sekunden",
      },
    ],
    endReason: "manual",
    endBpm: 120,
  };
  const report: SessionReport = { actions: [action], aborted: false };

  assert.match(buildShortReportText(report), /\*\*Warm-up\*\*/);
  assert.match(
    buildShortReportText(report),
    /Pausen gebraucht bei: 6 \(15s, 120 BPM\)/,
  );
  assert.equal(
    buildShortReportText({
      actions: [{ ...action, breakRecords: [] }],
      aborted: false,
    }).split("\n").at(-1),
    "Keine Pausen gebraucht",
  );
});

test("short Metronome reports use resolved pause-formula values", () => {
  const action: MetronomeActionResult = {
    id: "metronome",
    type: ACTION_TYPES.METRONOME,
    name: "Warm-up",
    status: "completed",
    settings: {
      ...runtimeSettings,
      breaks: "limited",
      breakCount: 2,
      breakSecondsFormula: createNumericFormulaInput(12, 1, null),
      breakSecondsRaw: "Aktuell BPM / 10",
    },
    beatCount: 8,
    breakRecords: [],
    endReason: "automatic",
    formulaValues: [
      {
        field: "breakSeconds",
        label: "Pausendauer",
        expression: "Aktuell BPM / 10",
        value: 12,
        fallbackUsed: false,
        clamped: false,
      },
    ],
  };
  const text = buildShortReportText({
    actions: [action],
    aborted: false,
  });

  assert.match(text, /Pausen: Begrenzt: 2; Dauer 12s/);
  assert.doesNotMatch(text, /Aktuell BPM/);
});

test("long reports include formula resolutions and automatic adjustments", () => {
  const report: SessionReport = {
    actions: [
      {
        id: "metronome",
        type: ACTION_TYPES.METRONOME,
        name: "Lauf",
        status: "completed",
        settings: runtimeSettings,
        beatCount: 8,
        endReason: "automatic",
        endBpm: 126,
        formulaValues: [
          {
            field: "bpm",
            label: "Starttempo",
            expression: "120 [Min 20; Max 300]",
            value: 120,
            fallbackUsed: true,
            clamped: true,
          },
        ],
      },
    ],
    aborted: false,
  };
  const text = buildLongReportText(report);
  const sections = getActionReportSections(report);

  assert.match(text, /\*\*Metronom - Lauf\*\*/);
  assert.match(text, /Formel · Starttempo: 120 \[Min 20; Max 300\] = 120/);
  assert.match(text, /Ersatzwert verwendet, begrenzt/);
  assert.match(text, /End-BPM: 126/);
  assert.ok(
    sections[0]?.details.some(
      (detail) =>
        detail.label === "Formel · Starttempo" &&
        detail.value.includes("begrenzt"),
    ),
  );
});

test("short reports use configured values for actions that have not started", () => {
  const report: SessionReport = {
    aborted: true,
    actions: [
      {
        id: "seconds",
        type: ACTION_TYPES.SECONDS,
        name: "Wartezeit",
        status: "not-started",
        settings: { seconds: createNumericFormulaInput(12, 1, 600) },
      },
    ],
  };

  assert.equal(buildShortReportText(report), "**Wartezeit**\nDauer: 12 Sekunden");
  assert.equal(
    buildLongReportText(report),
    "**Sekunden - Wartezeit**\nStatus: Nicht gestartet\nDauer: 12 Sekunden",
  );
});
