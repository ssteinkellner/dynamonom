import assert from "node:assert/strict";
import { test } from "vitest";
import {
  ACTION_TYPES,
  createDefaultStopwatchSettings,
} from "../src/action-model.ts";
import { createNumericFormulaInput } from "../src/formula-model.ts";
import type {
  MetronomeActionResult,
  RuntimeMetronomeSettings,
  RuntimeStopwatchSettings,
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
  hideLockText: false,
  hideNextTempo: false,
  lockBeats: 8,
  sessionEndEnabled: true,
  sessionEndBeats: 8,
};

const unlimitedStopwatchSettings: RuntimeStopwatchSettings = {
  endMode: "unlimited",
  automaticSeconds: null,
  hideDuration: false,
  manualLimitSeconds: null,
  earlyContinueWarning: false,
  earlyContinueWarningSeconds: null,
};

test("long report headings identify each action and separate sections", () => {
  const report: SessionReport = {
    aborted: false,
    actions: [
      {
        id: "stopwatch",
        type: ACTION_TYPES.STOPWATCH,
        name: "Vorbereitung",
        status: "completed",
        settings: {
          ...unlimitedStopwatchSettings,
          endMode: "automatic",
          automaticSeconds: 5,
        },
        completedBy: "auto",
        elapsedSeconds: 5,
      },
      {
        id: "limited-stopwatch",
        type: ACTION_TYPES.STOPWATCH,
        name: "Abschluss",
        status: "not-started",
        settings: {
          ...createDefaultStopwatchSettings(),
          endMode: "manual",
        },
      },
    ],
  };

  assert.equal(
    buildLongReportText(report),
    [
      "**Stoppuhr - Vorbereitung**",
      "Status: Automatisch beendet",
      "Dauer: 5 Sekunden",
      "Ende: Automatisch nach 5 Sekunden",
      "",
      "**Stoppuhr - Abschluss**",
      "Status: Nicht gestartet",
      "Ende: Manuell limitieren auf 60 Sekunden",
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
        isStatic: false,
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
            isStatic: false,
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

test("static formula values use the ordinary report value without a formula row", () => {
  const report: SessionReport = {
    actions: [
      {
        id: "stopwatch",
        type: ACTION_TYPES.STOPWATCH,
        name: "Wartezeit",
        status: "completed",
        settings: {
          ...unlimitedStopwatchSettings,
          endMode: "automatic",
          automaticSeconds: 12,
        },
        completedBy: "auto",
        elapsedSeconds: 12,
        formulaValues: [
          {
            field: "automaticSeconds",
            label: "Automatisch beenden nach",
            expression: "12 [Min 1; Max 600]",
            value: 12,
            isStatic: true,
            fallbackUsed: false,
            clamped: false,
          },
        ],
      },
    ],
    aborted: false,
  };

  const text = buildLongReportText(report);

  assert.match(text, /Dauer: 12 Sekunden/);
  assert.doesNotMatch(text, /Formel ·|Min 1|Max 600/);
});

test("short reports use configured values for actions that have not started", () => {
  const report: SessionReport = {
    aborted: true,
    actions: [
      {
        id: "stopwatch",
        type: ACTION_TYPES.STOPWATCH,
        name: "Wartezeit",
        status: "not-started",
        settings: {
          ...createDefaultStopwatchSettings(),
          endMode: "automatic",
          automaticSeconds: createNumericFormulaInput(12, 1, 600),
        },
      },
    ],
  };

  assert.equal(
    buildShortReportText(report),
    "**Wartezeit**\nEnde: Automatisch nach 12 Sekunden",
  );
  assert.equal(
    buildLongReportText(report),
    "**Stoppuhr - Wartezeit**\nStatus: Nicht gestartet\nEnde: Automatisch nach 12 Sekunden",
  );
});

test("stopwatch reports omit the time-measurement hint", () => {
  const report: SessionReport = {
    actions: [
      {
        id: "stopwatch",
        type: ACTION_TYPES.STOPWATCH,
        name: "Messung",
        status: "completed",
        settings: unlimitedStopwatchSettings,
        elapsedSeconds: 42,
      },
    ],
    aborted: false,
  };

  const text = buildLongReportText(report);

  assert.match(text, /Dauer: 42 Sekunden/);
  assert.doesNotMatch(text, /Zeitmessung/);
});
