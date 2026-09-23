import {
  ACTION_TYPES,
  getActionTypeLabel,
} from "../action-model.ts";
import type {
  ActionResult,
  MetronomeActionResult,
  RuntimeMetronomeSettings,
  SecondsActionResult,
  StopwatchActionResult,
  ManualActionResult,
  SessionReport,
} from "./session.ts";
import {
  getPreTimerRoundingLabel,
  isStaticPreTimerFormula,
} from "../pre-timer-model.ts";
import type { BreakRecord } from "./session.ts";
import { getMetronomeMaximumLimit } from "./metronome-settings.ts";

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
    return [{ label: "Status", value: "Nicht gestartet" }];
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

  return details;
}

export function buildLongReportText(report: SessionReport): string {
  return report.actions
    .map((action) => {
      const title = `${getActionTypeLabel(action.type)} - ${action.name}`;
      const lines = getActionReportLines(action);
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

function getActionReportLines(action: ActionResult): string[] {
  const lines = getActionReportDetails(action).map(
    ({ label, value }) => `${label}: ${value}`,
  );
  if (action.type === ACTION_TYPES.METRONOME && action.status !== "not-started") {
    lines.push("Pausen gebraucht:");
    const records = action.breakRecords ?? [];
    if (records.length === 0) {
      lines.push("Keine Pausen gebraucht");
    } else {
      records.forEach((record) => {
        lines.push(
          `- ${record.number}. Beat ${record.beat}; ${record.bpm} BPM; ${record.ended}; Limit ${record.overLimit ? "überschritten" : "eingehalten"}`,
        );
      });
    }
  }
  return lines;
}

function getActionShortLine(action: ActionResult): string {
  const details =
    action.status === "not-started"
      ? getNotStartedShortDetails(action)
      : getActionReportDetails(action);
  return details
    .map(({ label, value }) => `${label}: ${value}`)
    .join("; ");
}

function getNotStartedShortDetails(action: ActionResult): ReportDetail[] {
  const details: ReportDetail[] = [
    { label: "Status", value: "Nicht gestartet" },
  ];
  switch (action.type) {
    case ACTION_TYPES.METRONOME:
      appendMetronomeDetails(details, action);
      break;
    case ACTION_TYPES.SECONDS:
      details.push({
        label: "Konfiguriert",
        value: `${action.settings.seconds}s`,
      });
      break;
    case ACTION_TYPES.STOPWATCH:
      details.push(
        { label: "Formel", value: action.settings.formula },
        {
          label: "Rundung",
          value: formatStopwatchRounding(
            action.settings.rounding,
            action.settings.roundingThreshold,
          ),
        },
        { label: "Grenzen", value: formatStopwatchBounds(action.settings) },
      );
      break;
    case ACTION_TYPES.MANUAL:
      details.push({
        label: "Limit",
        value:
          action.settings.limitSeconds === null
            ? "Ohne Limit"
            : `${action.settings.limitSeconds} Sekunden`,
      });
      break;
  }
  return details;
}

function appendMetronomeDetails(
  details: ReportDetail[],
  action: MetronomeActionResult,
): void {
  const settings = toDisplayMetronomeSettings(action.settings);
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
  if (action.derivedEnd) {
    details.push({
      label: "Aus Stoppuhr",
      value: `${action.derivedEnd.sources.join(", ")} = ${action.derivedEnd.total} Beats`,
    });
  }
}

function appendSecondsDetails(
  details: ReportDetail[],
  action: SecondsActionResult,
): void {
  const configuredSeconds = action.configuredSeconds ?? action.settings.seconds;
  details.push({
    label: "Dauer",
    value: `${action.elapsedSeconds ?? 0} Sekunden (konfiguriert: ${configuredSeconds} Sekunden)`,
  });
}

function appendStopwatchDetails(
  details: ReportDetail[],
  action: StopwatchActionResult,
): void {
  const settings = action.settings;
  const formula = action.formula ?? settings.formula;
  const rounding = action.rounding ?? settings.rounding;
  const roundingThreshold =
    action.roundingThreshold ?? settings.roundingThreshold;
  details.push(
    { label: "Dauer", value: `${action.elapsedSeconds ?? 0} Sekunden` },
    { label: "Formel", value: formula },
    {
      label: "Rundung",
      value: formatStopwatchRounding(rounding, roundingThreshold),
    },
    { label: "Grenzen", value: formatStopwatchBounds(settings) },
  );

  if (action.status !== "completed") {
    return;
  }
  if (action.resultValid === false) {
    details.push({
      label: "Formelergebnis",
      value: action.invalidReason
        ? `Ungültig (${action.invalidReason})`
        : "Ungültig",
    });
  } else if (typeof action.formulaResult === "number") {
    details.push({
      label: "Formelergebnis",
      value: String(action.formulaResult),
    });
  }
  if (action.appliedBeats !== undefined) {
    details.push({
      label: "Angewendet",
      value: `${action.appliedBeats} Beats${action.clamped ? " (begrenzt)" : ""}`,
    });
  }
  if (
    action.resultValid === false &&
    !isStaticPreTimerFormula(settings.formula)
  ) {
    details.push({
      label: "Ersatzwert",
      value: `Mindestwert ${settings.min} Beats`,
    });
  }
}

function appendManualDetails(
  details: ReportDetail[],
  action: ManualActionResult,
): void {
  const limitSeconds = action.limitSeconds ?? action.settings.limitSeconds;
  details.push(
    { label: "Dauer", value: formatElapsed(action.elapsedSeconds ?? 0) },
    {
      label: "Limit",
      value: limitSeconds === null ? "Ohne Limit" : `${limitSeconds} Sekunden`,
    },
  );
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

function formatSessionEnd(settings: RuntimeMetronomeSettings): string {
  if (settings.derivedEndTotal !== null) {
    return (
      `Aus Stoppuhr: Nach ${settings.derivedEndTotal} Beats; ` +
      `Weiter gesperrt bis ${settings.derivedEndTotal} Beats`
    );
  }
  const end = settings.sessionEndEnabled
    ? `Nach ${settings.sessionEndBeats} Beats`
    : "Manuelles Weiter";
  if (!settings.lockSettings) {
    return end;
  }
  return `${end}; Einstellungen gesperrt, bis ${settings.lockBeats} Beats vergangen sind`;
}

function formatStopwatchRounding(
  rounding: StopwatchActionResult["settings"]["rounding"],
  roundingThreshold: number | null,
): string {
  const label = getPreTimerRoundingLabel(rounding);
  return rounding === "round"
    ? `${label} ab ${roundingThreshold ?? 30} Sekunden`
    : label;
}

function formatStopwatchBounds(
  settings: StopwatchActionResult["settings"],
): string {
  if (isStaticPreTimerFormula(settings.formula)) {
    return "Keine (statische Zahl)";
  }
  return `Min ${settings.min}; Max ${settings.max ?? "unbegrenzt"}`;
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

function toDisplayMetronomeSettings(
  settings: MetronomeActionResult["settings"],
): RuntimeMetronomeSettings {
  if ("initialBpm" in settings) {
    return settings;
  }
  return {
    initialBpm: settings.bpm,
    accentuate: settings.accentuate,
    accentRepeat: settings.accentRepeat,
    increaseTempo: settings.increaseTempo,
    increaseBy: settings.increaseBy,
    increaseAfter: settings.increaseAfter,
    maximum: settings.maximum,
    maximumLimit: getMetronomeMaximumLimit(settings),
    decreaseBy: settings.decreaseBy,
    decreaseAfter: settings.decreaseAfter,
    breaks: settings.breaks,
    breakCount: settings.breaks === "limited" ? settings.breakCount : null,
    breakSeconds: null,
    breakSecondsRaw:
      settings.breaks === "limited" ? settings.breakSeconds : "",
    lockSettings: settings.lockSettings,
    lockBeats: settings.lockBeats,
    sessionEndEnabled: settings.sessionEndEnabled,
    sessionEndBeats: settings.sessionEndBeats,
    derivedEndTotal: null,
    derivedEndSources: [],
  };
}
