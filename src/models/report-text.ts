import {
  ACTION_TYPES,
  getActionTypeLabel,
} from "../action-model.ts";
import type { MetronomeSettings } from "../action-model.ts";
import { formatNumericFormulaInput } from "../formula-model.ts";
import type {
  ActionResult,
  BreakRecord,
  FormulaValueRecord,
  ManualActionResult,
  MetronomeActionResult,
  RuntimeMetronomeSettings,
  SecondsActionResult,
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
    case ACTION_TYPES.SECONDS:
      appendSecondsDetails(details, action);
      break;
    case ACTION_TYPES.STOPWATCH:
      appendStopwatchDetails(details, action);
      break;
    case ACTION_TYPES.MANUAL:
      appendManualDetails(details, action);
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
      return `**${title}**\n${lines.join("\n")}`;
    })
    .join("\n\n");
}

export function buildShortReportText(report: SessionReport): string {
  return report.actions
    .map((action) => {
      const lines = [`**${action.name}**`, getActionShortLine(action)];
      if (action.type === ACTION_TYPES.METRONOME) {
        lines.push(formatBreakRecordsShort(action.breakRecords ?? []));
      }
      return lines.join("\n");
    })
    .join("\n\n");
}

function getActionShortLine(action: ActionResult): string {
  const details = getActionReportDetails(action).filter(
    ({ label }) => label !== "Status" && !label.startsWith("Formel ·"),
  );
  if (action.type === ACTION_TYPES.METRONOME && "initialBpm" in action.settings) {
    const pauseIndex = details.findIndex(({ label }) => label === "Pausen");
    if (pauseIndex >= 0) {
      details[pauseIndex] = {
        label: "Pausen",
        value: formatBreaksShort(
          action.settings,
          action.formulaValues?.find((entry) => entry.field === "breakSeconds"),
        ),
      };
    }
  }
  const settings = details.map(({ label, value }) => `${label}: ${value}`);
  const formulaValues = (action.formulaValues ?? [])
    .filter(
      ({ field }) =>
        action.type !== ACTION_TYPES.METRONOME || field !== "breakSeconds",
    )
    .map(
      ({ label, value, fallbackUsed, clamped }) =>
        `${label}: ${value}${fallbackUsed ? " (Ersatzwert)" : ""}${clamped ? " (begrenzt)" : ""}`,
    );
  settings.push(...formulaValues);
  return settings.join("; ");
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
    case ACTION_TYPES.SECONDS:
      if (typeof action.settings.seconds !== "number") {
        details.push({
          label: "Dauer",
          value: `${formatNumericFormulaInput(action.settings.seconds)} Sekunden`,
        });
      }
      break;
    case ACTION_TYPES.STOPWATCH:
      details.push({ label: "Aktion", value: "Zeit messen" });
      break;
    case ACTION_TYPES.MANUAL:
      if (action.settings.limitSeconds === null) {
        details.push({ label: "Limit", value: "Ohne Limit" });
      } else if (typeof action.settings.limitSeconds !== "number") {
        details.push({
          label: "Limit",
          value: `${formatNumericFormulaInput(action.settings.limitSeconds)} Sekunden`,
        });
      }
      break;
  }
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
    details.push({ label: "Beats", value: `${action.beatCount}x` });
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

function appendSecondsDetails(
  details: ReportDetail[],
  action: SecondsActionResult,
): void {
  const settingSeconds =
    typeof action.settings.seconds === "number"
      ? action.settings.seconds
      : action.configuredSeconds;
  details.push({
    label: "Dauer",
    value:
      settingSeconds === undefined
        ? `${action.elapsedSeconds ?? 0} Sekunden`
        : `${action.elapsedSeconds ?? 0} Sekunden (konfiguriert: ${settingSeconds} Sekunden)`,
  });
}

function appendStopwatchDetails(
  details: ReportDetail[],
  action: StopwatchActionResult,
): void {
  details.push(
    { label: "Dauer", value: `${action.elapsedSeconds ?? 0} Sekunden` },
    { label: "Zeitmessung", value: "Abgeschlossen" },
  );
}

function appendManualDetails(
  details: ReportDetail[],
  action: ManualActionResult,
): void {
  const configuredLimit =
    typeof action.settings.limitSeconds === "number"
      ? action.settings.limitSeconds
      : action.limitSeconds;
  details.push(
    { label: "Dauer", value: formatElapsed(action.elapsedSeconds ?? 0) },
    {
      label: "Limit",
      value:
        configuredLimit === null || configuredLimit === undefined
          ? "Ohne Limit"
          : `${configuredLimit} Sekunden`,
    },
  );
}

function appendFormulaDetails(
  details: ReportDetail[],
  formulaValues: readonly FormulaValueRecord[],
): void {
  formulaValues.forEach((formula) => {
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
  if (action.type === ACTION_TYPES.SECONDS) {
    return action.completedBy === "auto"
      ? "Automatisch fortgesetzt"
      : "Manuell fortgesetzt";
  }
  return "Manuell fortgesetzt";
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

function formatBreaksShort(
  settings: RuntimeMetronomeSettings,
  durationFormula?: FormulaValueRecord,
): string {
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
  const duration = durationFormula
    ? `${durationFormula.value}s`
    : settings.breakSecondsFormula
      ? "Formel nicht ausgewertet"
      : "manuelle Dauer";
  return `Begrenzt: ${count}; Dauer ${duration}`;
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

function formatBreakRecordsShort(records: readonly BreakRecord[]): string {
  if (records.length === 0) {
    return "Keine Pausen gebraucht";
  }
  const breaks = records.map((record) => {
    const duration =
      record.durationSeconds === null
        ? "aktiv"
        : `${record.durationSeconds}s`;
    return `${record.beat} (${duration}, ${record.bpm} BPM)`;
  });
  return `Pausen gebraucht bei: ${breaks.join(", ")}`;
}

function formatElapsed(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
