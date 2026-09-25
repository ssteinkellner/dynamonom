import {
  ACTION_TYPES,
  getActionTypeLabel,
} from "../action-model.ts";
import type {
  MetronomeSettings,
  StopwatchSettings,
} from "../action-model.ts";
import { formatNumericFormulaInput } from "../formula-model.ts";
import type { NumericFormulaInput } from "../formula-model.ts";
import type {
  ActionResult,
  BreakRecord,
  FormulaValueRecord,
  MetronomeActionResult,
  RuntimeMetronomeSettings,
  RuntimeStopwatchSettings,
  SessionReport,
  StopwatchActionResult,
} from "./session.ts";

export interface ReportDetail {
  label: string;
  value: string;
}

export interface ActionReportSection {
  id: string;
  title: string;
  details: ReportDetail[];
  breakRecords: BreakRecord[];
  showBreaks: boolean;
}

export function getActionReportSections(
  report: SessionReport,
): ActionReportSection[] {
  return report.actions.map((action) => ({
    id: action.id,
    title: `${getActionTypeLabel(action.type)} - ${action.name}`,
    details: getActionReportDetails(action),
    breakRecords:
      action.type === ACTION_TYPES.METRONOME
        ? action.breakRecords ?? []
        : [],
    showBreaks:
      action.type === ACTION_TYPES.METRONOME &&
      action.status !== "not-started",
  }));
}

export function getActionReportDetails(action: ActionResult): ReportDetail[] {
  if (action.status === "not-started") {
    const details: ReportDetail[] = [
      { label: "Status", value: "Nicht gestartet" },
    ];
    if (action.initializationError) {
      details.push({ label: "Fehler", value: action.initializationError });
    }
    appendConfiguredActionDetails(details, action);
    return details;
  }

  const details: ReportDetail[] = [
    { label: "Status", value: getActionStatusLabel(action) },
  ];
  switch (action.type) {
    case ACTION_TYPES.METRONOME:
      appendMetronomeDetails(details, action);
      break;
    case ACTION_TYPES.STOPWATCH:
      appendStopwatchDetails(details, action);
      break;
  }
  appendFormulaDetails(details, action.formulaValues ?? []);
  return details;
}

export function buildLongReportText(report: SessionReport): string {
  return report.actions
    .map((action) => {
      const title = `${getActionTypeLabel(action.type)} - ${action.name}`;
      const lines = getActionReportDetails(action).map(
        ({ label, value }) => `${label}: ${value}`,
      );
      if (
        action.type === ACTION_TYPES.METRONOME &&
        action.status !== "not-started"
      ) {
        lines.push(...formatBreakRecordsLong(action.breakRecords ?? []));
      }
      return `*${title}*\n${lines.join("\n")}`;
    })
    .join("\n\n");
}

export function buildShortReportText(report: SessionReport): string {
  return report.actions
    .map((action) => {
      if (action.status === "not-started") {
        return `*${action.name}* nicht gestartet`;
      }

      const statusSuffix =
        action.status === "active-aborted" ? " abgebrochen" : "";
      const lines = [
        `*${action.name}*${statusSuffix}`,
        getActionShortLine(action),
      ];
      if (action.type === ACTION_TYPES.METRONOME) {
        const pauseLines = getShortPauseLines(action);
        if (pauseLines.length > 0) {
          lines[1] = `${lines[1]}; ${pauseLines[0]}`;
          lines.push(...pauseLines.slice(1));
        }
      }
      return lines.join("\n");
    })
    .join("\n\n");
}

function getActionShortLine(action: ActionResult): string {
  if (action.type === ACTION_TYPES.METRONOME) {
    return formatMetronomeShortLine(action);
  }
  return formatStopwatchShortLine(action);
}

function formatMetronomeShortLine(action: MetronomeActionResult): string {
  const settings = action.settings;
  if (!("initialBpm" in settings)) {
    return `${formatNumericFormulaInput(settings.bpm)}BPM`;
  }

  const maximumBpm = Math.max(
    settings.initialBpm,
    action.maximumBpm ?? action.endBpm ?? settings.initialBpm,
  );
  const bpm =
    maximumBpm === settings.initialBpm
      ? `${settings.initialBpm}BPM`
      : `${settings.initialBpm}-${maximumBpm}BPM`;
  const parts = [
    action.beatCount === undefined ? bpm : `${action.beatCount}x ${bpm}`,
  ];

  if (settings.increaseTempo) {
    parts.push(`+${settings.increaseBy}/${settings.increaseAfter}`);
    if (settings.maximum === "reverse") {
      parts.push(`-${settings.decreaseBy}/${settings.decreaseAfter}`);
    }
  }

  return parts.join("; ");
}

function formatStopwatchShortLine(action: StopwatchActionResult): string {
  const settings = action.settings;
  const elapsed = `${action.elapsedSeconds ?? 0}s`;
  if (settings.endMode === "unlimited") {
    return `${elapsed}; manual`;
  }
  if (settings.endMode === "automatic") {
    return `${elapsed}; auto ${formatShortSeconds(settings.automaticSeconds)}s`;
  }
  return `${elapsed}; manual ${formatShortSeconds(settings.manualLimitSeconds)}s`;
}

function formatShortSeconds(
  value: number | NumericFormulaInput | null,
): string {
  if (value === null) {
    return "?";
  }
  return typeof value === "number"
    ? String(value)
    : formatNumericFormulaInput(value);
}

function getShortPauseLines(action: MetronomeActionResult): string[] {
  const settings = action.settings;
  if (!("initialBpm" in settings) || settings.breaks === "unlimited") {
    return [];
  }

  const records = (action.breakRecords ?? []).filter(
    (record) => record.durationSeconds !== null,
  );
  if (records.length === 0) {
    return ["Pausen: keine"];
  }
  return [
    "Pausen:",
    ...records.map(
      (record) =>
        `- ${record.beat}(${record.durationSeconds}s, ${record.bpm}BPM)`,
    ),
  ];
}

function appendConfiguredActionDetails(
  details: ReportDetail[],
  action: ActionResult,
): void {
  switch (action.type) {
    case ACTION_TYPES.METRONOME:
      if (!("initialBpm" in action.settings)) {
        appendConfiguredMetronomeDetails(details, action.settings);
      }
      break;
    case ACTION_TYPES.STOPWATCH:
      appendConfiguredStopwatchDetails(details, action.settings);
      break;
  }
}

function appendConfiguredStopwatchDetails(
  details: ReportDetail[],
  settings: StopwatchSettings | RuntimeStopwatchSettings,
): void {
  details.push({ label: "Ende", value: formatStopwatchEnd(settings) });
}

function appendConfiguredMetronomeDetails(
  details: ReportDetail[],
  settings: MetronomeSettings,
): void {
  details.push(
    {
      label: "Tempo",
      value: `${formatNumericFormulaInput(settings.bpm)} BPM`,
    },
    {
      label: "Betonung",
      value: settings.accentuate
        ? `alle ${formatNumericFormulaInput(settings.accentRepeat)} Beats`
        : "aus",
    },
    {
      label: "Tempo-Steigerung",
      value: settings.increaseTempo
        ? `${formatNumericFormulaInput(settings.increaseBy)} BPM alle ${formatNumericFormulaInput(settings.increaseAfter)} Beats`
        : "aus",
    },
    {
      label: "Pausen",
      value:
        settings.breaks === "none"
          ? "Keine"
          : settings.breaks === "unlimited"
            ? "Unbegrenzt"
            : "Begrenzt",
    },
    {
      label: "Session-Ende",
      value: settings.sessionEndEnabled
        ? `${formatNumericFormulaInput(settings.sessionEndBeats)} Beats`
        : "Manuelles Weiter",
    },
    {
      label: "Weiter-Sperre",
      value: settings.lockSettings
        ? `${formatNumericFormulaInput(settings.lockBeats)} Beats`
        : "keine",
    },
  );
}

function appendMetronomeDetails(
  details: ReportDetail[],
  action: MetronomeActionResult,
): void {
  const settings = action.settings;
  if (!("initialBpm" in settings)) {
    appendConfiguredMetronomeDetails(details, settings);
    return;
  }
  if (action.beatCount !== undefined) {
    details.push(
      { label: "Beats", value: `${action.beatCount}x` },
      { label: "Dauer", value: `${action.elapsedSeconds ?? 0} Sekunden` },
    );
  }
  details.push(
    { label: "Tempo", value: formatBpm(settings) },
    {
      label: "Betonung",
      value: settings.accentuate
        ? `alle ${settings.accentRepeat} Beats`
        : "aus",
    },
    { label: "Tempoverlauf", value: formatMetronomeTempoProgression(settings) },
    { label: "Pausen", value: formatBreaks(settings) },
    { label: "Ende", value: formatSessionEnd(settings) },
    {
      label: "Weiter-Sperre",
      value: settings.lockSettings
        ? `bis ${settings.lockBeats} Beats`
        : "keine",
    },
  );
  if (action.endBpm !== undefined) {
    details.push({ label: "End-BPM", value: String(action.endBpm) });
  }
}

function appendStopwatchDetails(
  details: ReportDetail[],
  action: StopwatchActionResult,
): void {
  details.push(
    { label: "Dauer", value: `${action.elapsedSeconds ?? 0} Sekunden` },
    { label: "Ende", value: formatStopwatchEnd(action.settings) },
  );
}

function appendFormulaDetails(
  details: ReportDetail[],
  formulaValues: readonly FormulaValueRecord[],
): void {
  formulaValues.filter((formula) => !formula.isStatic).forEach((formula) => {
    const adjustments = [
      formula.fallbackUsed ? "Ersatzwert verwendet" : "",
      formula.clamped ? "begrenzt" : "",
    ].filter(Boolean);
    details.push({
      label: `Formel · ${formula.label}`,
      value: `${formula.expression} = ${formula.value}${
        adjustments.length > 0 ? ` (${adjustments.join(", ")})` : ""
      }`,
    });
  });
}

function getActionStatusLabel(action: ActionResult): string {
  if (action.status === "active-aborted") {
    return "Aktiv abgebrochen";
  }
  if (action.status === "active") {
    return "Aktiv";
  }
  if (action.type === ACTION_TYPES.METRONOME) {
    return action.endReason === "automatic"
      ? "Automatisch beendet"
      : "Manuell beendet";
  }
  if (action.type === ACTION_TYPES.STOPWATCH) {
    return action.completedBy === "auto"
      ? "Automatisch beendet"
      : "Manuell beendet";
  }
  return "Manuell beendet";
}

function formatStopwatchEnd(
  settings: StopwatchSettings | RuntimeStopwatchSettings,
): string {
  if (settings.endMode === "unlimited") {
    return "Unbegrenzt";
  }
  if (settings.endMode === "automatic") {
    return `Automatisch nach ${formatStopwatchSeconds(settings.automaticSeconds)} Sekunden`;
  }
  return `Manuell limitieren auf ${formatStopwatchSeconds(settings.manualLimitSeconds)} Sekunden`;
}

function formatStopwatchSeconds(
  value: NumericFormulaInput | number | null,
): string {
  if (typeof value === "number") {
    return String(value);
  }
  if (value === null) {
    return "unbekannt";
  }
  return formatNumericFormulaInput(value);
}

function formatBpm(settings: RuntimeMetronomeSettings): string {
  if (!settings.increaseTempo) {
    return `${settings.initialBpm} BPM`;
  }
  const range =
    settings.maximum === "none"
      ? `${settings.initialBpm} BPM`
      : `${settings.initialBpm} - ${settings.maximumLimit} BPM`;
  const progression =
    `${range}; +${settings.increaseBy} BPM alle ${settings.increaseAfter} Beats`;
  return settings.maximum === "reverse"
    ? `${progression}; -${settings.decreaseBy} BPM alle ${settings.decreaseAfter} Beats`
    : progression;
}

function formatMetronomeTempoProgression(
  settings: RuntimeMetronomeSettings,
): string {
  if (!settings.increaseTempo) {
    return "Aus";
  }
  const progression =
    `+${settings.increaseBy} BPM alle ${settings.increaseAfter} Beats`;
  if (settings.maximum === "none") {
    return `${progression}; unbegrenzt`;
  }
  if (settings.maximum === "stick") {
    return `${progression}; bei ${settings.maximumLimit} BPM halten`;
  }
  if (settings.maximum === "reset") {
    return `${progression}; bei ${settings.maximumLimit} BPM zurücksetzen`;
  }
  return `${progression}; bei ${settings.maximumLimit} BPM umkehren; -${settings.decreaseBy} BPM alle ${settings.decreaseAfter} Beats`;
}

function formatBreaks(settings: RuntimeMetronomeSettings): string {
  if (settings.breaks === "none") {
    return "Keine";
  }
  if (settings.breaks === "unlimited") {
    return "Unbegrenzt";
  }
  const count =
    settings.breakCount === null
      ? "unbegrenzte Anzahl"
      : String(settings.breakCount);
  const duration = settings.breakSecondsRaw
    ? `Dauer ${settings.breakSecondsRaw}s`
    : "manuelle Dauer";
  return `Begrenzt: ${count}; ${duration}`;
}

function formatSessionEnd(settings: RuntimeMetronomeSettings): string {
  const end = settings.sessionEndEnabled
    ? `Nach ${settings.sessionEndBeats} Beats`
    : "Manuelles Weiter";
  if (!settings.lockSettings) {
    return end;
  }
  return `${end}; Einstellungen gesperrt, bis ${settings.lockBeats} Beats vergangen sind`;
}

function formatBreakRecordsLong(records: readonly BreakRecord[]): string[] {
  if (records.length === 0) {
    return ["Pausen: Keine Pausen gebraucht"];
  }
  return [
    "Pausen gebraucht:",
    ...records.map((record) => {
      const duration =
        record.durationSeconds === null
          ? "Dauer nicht erfasst"
          : `${record.durationSeconds}s`;
      const planned =
        record.scheduledDurationSeconds === null
          ? ""
          : `; geplant ${record.scheduledDurationSeconds}s`;
      const adjustments = [
        record.formulaFallbackUsed ? "Ersatzwert verwendet" : "",
        record.formulaClamped ? "begrenzt" : "",
      ].filter(Boolean);
      const adjustmentText =
        adjustments.length > 0 ? `; ${adjustments.join(", ")}` : "";
      return `- ${record.number}. Beat ${record.beat}; ${record.bpm} BPM; ${record.ended}; Dauer ${duration}${planned}${adjustmentText}; Limit ${record.overLimit ? "überschritten" : "eingehalten"}`;
    }),
  ];
}
