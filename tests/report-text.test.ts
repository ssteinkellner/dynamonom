import assert from "node:assert/strict";
import { test } from "vitest";
import {
  ACTION_TYPES,
  createDefaultStopwatchSettings,
} from "../src/action-model.ts";
import { createNumericFormulaInput } from "../src/formula-model.ts";
import { createDefaultMetronomeSettings } from "../src/models/metronome-settings.ts";
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
      "*Stoppuhr - Vorbereitung*",
      "Status: Automatisch beendet",
      "Dauer: 5 Sekunden",
      "Ende: Automatisch nach 5 Sekunden",
      "",
      "*Stoppuhr - Abschluss*",
      "Status: Nicht gestartet",
      "Ende:",
      "- Manuelles Limit: Manuell limitieren auf 60 Sekunden",
      "- Frühwarnung: bei mehr als 10 Sekunden",
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

  assert.equal(
    buildShortReportText(report),
    "*Warm-up*\n12x 120BPM; Pausen:\n- 6(15s, 120BPM)",
  );
  assert.equal(
    buildShortReportText({
      actions: [{ ...action, breakRecords: [] }],
      aborted: false,
    }),
    "*Warm-up*\n12x 120BPM; Pausen: keine",
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

  assert.equal(text, "*Warm-up*\n8x 120BPM; Pausen: keine");
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
        elapsedSeconds: 42,
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

  assert.match(text, /\*Metronom - Lauf\*/);
  assert.match(text, /Beats: 8x\nDauer: 42 Sekunden/);
  assert.match(
    text,
    /Tempo: 120 BPM; 120 \[Min 20; Max 300\] \(Ersatzwert verwendet, begrenzt\)/,
  );
  assert.match(text, /Ersatzwert verwendet, begrenzt/);
  assert.match(text, /End-BPM: 126/);
  assert.ok(
    sections[0]?.details
      .find((detail) => detail.label === "Tempo")
      ?.lines.some((line) => line.value.includes("begrenzt")),
  );
});

test("compound report properties use labeled export lines", () => {
  const action: MetronomeActionResult = {
    id: "metronome",
    type: ACTION_TYPES.METRONOME,
    name: "Steigerung",
    status: "completed",
    settings: {
      ...runtimeSettings,
      increaseTempo: true,
      increaseBy: 2,
      increaseAfter: 10,
      maximum: "stick",
      maximumLimit: 180,
    },
    beatCount: 8,
    elapsedSeconds: 42,
    endReason: "automatic",
    formulaValues: [
      {
        field: "bpm",
        label: "Starttempo",
        expression: "120 [Min 20; Max 300]",
        value: 120,
        isStatic: false,
        fallbackUsed: false,
        clamped: false,
      },
      {
        field: "increaseBy",
        label: "Tempo-Steigerung",
        expression: "2 [Min 1; Max 20]",
        value: 2,
        isStatic: false,
        fallbackUsed: false,
        clamped: false,
      },
      {
        field: "increaseAfter",
        label: "Steigerungsintervall",
        expression: "10 [Min 1; Max unbegrenzt]",
        value: 10,
        isStatic: false,
        fallbackUsed: false,
        clamped: false,
      },
    ],
  };

  assert.equal(
    buildLongReportText({ actions: [action], aborted: false }),
    [
      "*Metronom - Steigerung*",
      "Status: Automatisch beendet",
      "Beats: 8x",
      "Dauer: 42 Sekunden",
      "Tempo:",
      "- Starttempo: 120 BPM; 120 [Min 20; Max 300]",
      "- Tempo-Steigerung: +2 BPM; 2 [Min 1; Max 20]",
      "- Steigerungsintervall: alle 10 Beats; 10 [Min 1; Max unbegrenzt]",
      "- BPM-Limit: 180 BPM",
      "- Bei Limit: halten",
      "Betonung: aus",
      "Pausen: Keine",
      "Ende: Nach 8 Beats",
      "Pausen: Keine Pausen gebraucht",
    ].join("\n"),
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

test("short reports mark actions that have not started", () => {
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
    "*Wartezeit* nicht gestartet",
  );
  assert.equal(
    buildLongReportText(report),
    [
      "*Stoppuhr - Wartezeit*",
      "Status: Nicht gestartet",
      "Ende:",
      "- Automatisches Ende: Automatisch nach 12 Sekunden",
      "- Frühwarnung: bei mehr als 10 Sekunden",
    ].join("\n"),
  );
});

test("short reports mark not-started actions without values and omit unlimited pauses", () => {
  const notStartedMetronome: MetronomeActionResult = {
    id: "not-started-metronome",
    type: ACTION_TYPES.METRONOME,
    name: "Schritt 4",
    status: "not-started",
    settings: createDefaultMetronomeSettings(),
  };
  const unlimitedMetronome: MetronomeActionResult = {
    id: "unlimited-metronome",
    type: ACTION_TYPES.METRONOME,
    name: "Pause",
    status: "completed",
    settings: {
      ...runtimeSettings,
      breaks: "unlimited",
    },
    beatCount: 4,
    maximumBpm: 120,
    endBpm: 120,
    breakRecords: [
      {
        number: 1,
        beat: 2,
        bpm: 120,
        overLimit: false,
        durationSeconds: 3,
        scheduledDurationSeconds: null,
        ended: "Manuell fortgesetzt nach 3 Sekunden",
      },
    ],
    endReason: "manual",
  };

  assert.equal(
    buildShortReportText({
      actions: [notStartedMetronome, unlimitedMetronome],
      aborted: false,
    }),
    [
      "*Schritt 4* nicht gestartet",
      "",
      "*Pause*",
      "4x 120BPM",
    ].join("\n"),
  );
});

test("short reports use the highest actually played BPM and compact progression values", () => {
  const action: MetronomeActionResult = {
    id: "metronome",
    type: ACTION_TYPES.METRONOME,
    name: "Schritt 1",
    status: "completed",
    settings: {
      ...runtimeSettings,
      initialBpm: 140,
      increaseTempo: true,
      increaseBy: 1,
      increaseAfter: 10,
      maximum: "reverse",
      maximumLimit: 200,
      decreaseBy: 1,
      decreaseAfter: 15,
    },
    beatCount: 120,
    maximumBpm: 170,
    endBpm: 160,
    breakRecords: [],
    endReason: "manual",
  };

  assert.equal(
    buildShortReportText({ actions: [action], aborted: false }),
    "*Schritt 1*\n120x 140-170BPM; +1/10; -1/15; Pausen: keine",
  );
  assert.equal(
    buildShortReportText({
      actions: [{ ...action, maximumBpm: 140, endBpm: 140 }],
      aborted: false,
    }),
    "*Schritt 1*\n120x 140BPM; +1/10; -1/15; Pausen: keine",
  );
});

test("short reports compact stopwatch values and action statuses", () => {
  const actions = [
    {
      id: "automatic",
      type: ACTION_TYPES.STOPWATCH,
      name: "Auto",
      status: "completed" as const,
      settings: {
        ...unlimitedStopwatchSettings,
        endMode: "automatic" as const,
        automaticSeconds: 12,
      },
      elapsedSeconds: 5,
      completedBy: "auto" as const,
    },
    {
      id: "manual",
      type: ACTION_TYPES.STOPWATCH,
      name: "Manual",
      status: "completed" as const,
      settings: unlimitedStopwatchSettings,
      elapsedSeconds: 5,
      completedBy: "manual" as const,
    },
    {
      id: "limited",
      type: ACTION_TYPES.STOPWATCH,
      name: "Limit",
      status: "completed" as const,
      settings: {
        ...unlimitedStopwatchSettings,
        endMode: "manual" as const,
        manualLimitSeconds: 15,
      },
      elapsedSeconds: 5,
      completedBy: "manual" as const,
    },
  ];

  assert.equal(
    buildShortReportText({ actions, aborted: false }),
    [
      "*Auto*",
      "5s; auto 12s",
      "",
      "*Manual*",
      "5s; manual",
      "",
      "*Limit*",
      "5s; manual 15s",
    ].join("\n"),
  );
});

test("short reports mark aborted actions and omit incomplete pauses", () => {
  const action: MetronomeActionResult = {
    id: "metronome",
    type: ACTION_TYPES.METRONOME,
    name: "Schritt 2",
    status: "active-aborted",
    settings: runtimeSettings,
    beatCount: 74,
    maximumBpm: 160,
    endBpm: 160,
    breakRecords: [
      {
        number: 1,
        beat: 74,
        bpm: 160,
        overLimit: false,
        durationSeconds: null,
        scheduledDurationSeconds: 3,
        ended: "Active",
      },
      {
        number: 2,
        beat: 60,
        bpm: 150,
        overLimit: false,
        durationSeconds: 3,
        scheduledDurationSeconds: 3,
        ended: "Manuell fortgesetzt nach 3 Sekunden",
      },
    ],
    endReason: "aborted",
  };

  assert.equal(
    buildShortReportText({ actions: [action], aborted: true }),
    "*Schritt 2* abgebrochen\n74x 120-160BPM; Pausen:\n- 60(3s, 150BPM)",
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
