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

export interface ReportDetailLine {
  label?: string;
  value: string;
}

export interface ReportDetail {
  label: string;
  lines: ReportDetailLine[];
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
      createReportDetail("Status", "Nicht gestartet"),
    ];
    if (action.initializationError) {
      details.push(createReportDetail("Fehler", action.initializationError));
    }
    appendConfiguredActionDetails(details, action);
    return details;
  }

  const details: ReportDetail[] = [
    createReportDetail("Status", getActionStatusLabel(action)),
  ];
  switch (action.type) {
    case ACTION_TYPES.METRONOME:
      appendMetronomeDetails(details, action);
      break;
    case ACTION_TYPES.STOPWATCH:
      appendStopwatchDetails(details, action);
      break;
  }
  return details;
}

export function buildLongReportText(report: SessionReport): string {
  return report.actions
    .map((action) => {
      const title = `${getActionTypeLabel(action.type)} - ${action.name}`;
      const lines = getActionReportDetails(action).flatMap(formatLongReportDetail);
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
  details.push(
    createReportDetailLines("Ende", getStopwatchEndLines(settings)),
  );
}

function appendConfiguredMetronomeDetails(
  details: ReportDetail[],
  settings: MetronomeSettings,
): void {
  details.push(
    createReportDetailLines("Tempo", getConfiguredTempoLines(settings)),
    createReportDetailLines("Betonung", getConfiguredAccentLines(settings)),
    createReportDetailLines("Pausen", getConfiguredBreakLines(settings)),
    createReportDetailLines("Ende", getConfiguredEndLines(settings)),
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
  const formulas = createFormulaMap(action.formulaValues ?? []);
  if (action.beatCount !== undefined) {
    details.push(
      createReportDetail("Beats", `${action.beatCount}x`),
      createReportDetail("Dauer", `${action.elapsedSeconds ?? 0} Sekunden`),
    );
  }
  details.push(
    createReportDetailLines("Tempo", getRuntimeTempoLines(settings, formulas)),
    createReportDetailLines("Betonung", getRuntimeAccentLines(settings, formulas)),
    createReportDetailLines("Pausen", getRuntimeBreakLines(settings, formulas)),
    createReportDetailLines("Ende", getRuntimeEndLines(settings, formulas)),
  );
  if (action.endBpm !== undefined) {
    details.push(createReportDetail("End-BPM", String(action.endBpm)));
  }
}

function appendStopwatchDetails(
  details: ReportDetail[],
  action: StopwatchActionResult,
): void {
  const formulas = createFormulaMap(action.formulaValues ?? []);
  details.push(
    createReportDetail("Dauer", `${action.elapsedSeconds ?? 0} Sekunden`),
    createReportDetailLines(
      "Ende",
      getStopwatchEndLines(action.settings, formulas),
    ),
  );
}

function createReportDetail(label: string, value: string): ReportDetail {
  return { label, lines: [{ value }] };
}

function createReportDetailLines(
  label: string,
  lines: ReportDetailLine[],
): ReportDetail {
  if (lines.length === 1) {
    return createReportDetail(label, lines[0]?.value ?? "");
  }
  return { label, lines };
}

function formatLongReportDetail(detail: ReportDetail): string[] {
  if (detail.lines.length === 1 && !detail.lines[0]?.label) {
    return [`${detail.label}: ${detail.lines[0]?.value ?? ""}`];
  }
  return [
    `${detail.label}:`,
    ...detail.lines.map(
      (line) => `- ${line.label ? `${line.label}: ` : ""}${line.value}`,
    ),
  ];
}

function createFormulaMap(
  formulaValues: readonly FormulaValueRecord[],
): ReadonlyMap<string, FormulaValueRecord> {
  return new Map(formulaValues.map((formula) => [formula.field, formula]));
}

function formatValueWithFormula(
  value: string,
  field: string,
  formulas: ReadonlyMap<string, FormulaValueRecord>,
): string {
  const formula = formulas.get(field);
  if (!formula || formula.isStatic) {
    return value;
  }
  const adjustments = [
    formula.fallbackUsed ? "Ersatzwert verwendet" : "",
    formula.clamped ? "begrenzt" : "",
  ].filter(Boolean);
  return `${value}; ${formula.expression}${
    adjustments.length > 0 ? ` (${adjustments.join(", ")})` : ""
  }`;
}

function getConfiguredTempoLines(
  settings: MetronomeSettings,
): ReportDetailLine[] {
  const lines: ReportDetailLine[] = [
    {
      label: "Starttempo",
      value: `${formatNumericFormulaInput(settings.bpm)} BPM`,
    },
  ];
  if (!settings.increaseTempo) {
    return lines;
  }
  lines.push(
    {
      label: "Tempo-Steigerung",
      value: `+${formatNumericFormulaInput(settings.increaseBy)} BPM`,
    },
    {
      label: "Steigerungsintervall",
      value: `alle ${formatNumericFormulaInput(settings.increaseAfter)} Beats`,
    },
  );
  if (settings.maximum === "none") {
    lines.push({ label: "Maximum", value: "unbegrenzt" });
  } else {
    const maximumLimit =
      settings.maximum === "stick"
        ? settings.maximumLimitStick
        : settings.maximum === "reset"
          ? settings.maximumLimitReset
          : settings.maximumLimitReverse;
    lines.push(
      {
        label: "BPM-Limit",
        value: `${formatNumericFormulaInput(maximumLimit)} BPM`,
      },
      { label: "Bei Limit", value: formatMaximumMode(settings.maximum) },
    );
  }
  if (settings.maximum === "reverse") {
    lines.push(
      {
        label: "Tempo-Verringerung",
        value: `-${formatNumericFormulaInput(settings.decreaseBy)} BPM`,
      },
      {
        label: "Verringerungsintervall",
        value: `alle ${formatNumericFormulaInput(settings.decreaseAfter)} Beats`,
      },
    );
  }
  return lines;
}

function getRuntimeTempoLines(
  settings: RuntimeMetronomeSettings,
  formulas: ReadonlyMap<string, FormulaValueRecord>,
): ReportDetailLine[] {
  const lines: ReportDetailLine[] = [
    {
      label: "Starttempo",
      value: formatValueWithFormula(
        `${settings.initialBpm} BPM`,
        "bpm",
        formulas,
      ),
    },
  ];
  if (!settings.increaseTempo) {
    return lines;
  }
  lines.push(
    {
      label: "Tempo-Steigerung",
      value: formatValueWithFormula(
        `+${settings.increaseBy} BPM`,
        "increaseBy",
        formulas,
      ),
    },
    {
      label: "Steigerungsintervall",
      value: formatValueWithFormula(
        `alle ${settings.increaseAfter} Beats`,
        "increaseAfter",
        formulas,
      ),
    },
  );
  if (settings.maximum === "none") {
    lines.push({ label: "Maximum", value: "unbegrenzt" });
  } else {
    const maximumField = `maximumLimit${capitalize(settings.maximum)}`;
    lines.push(
      {
        label: "BPM-Limit",
        value: formatValueWithFormula(
          `${settings.maximumLimit} BPM`,
          maximumField,
          formulas,
        ),
      },
      { label: "Bei Limit", value: formatMaximumMode(settings.maximum) },
    );
  }
  if (settings.maximum === "reverse") {
    lines.push(
      {
        label: "Tempo-Verringerung",
        value: formatValueWithFormula(
          `-${settings.decreaseBy} BPM`,
          "decreaseBy",
          formulas,
        ),
      },
      {
        label: "Verringerungsintervall",
        value: formatValueWithFormula(
          `alle ${settings.decreaseAfter} Beats`,
          "decreaseAfter",
          formulas,
        ),
      },
    );
  }
  return lines;
}

function getConfiguredAccentLines(
  settings: MetronomeSettings,
): ReportDetailLine[] {
  return settings.accentuate
    ? [
        {
          label: "Intervall",
          value: `alle ${formatNumericFormulaInput(settings.accentRepeat)} Beats`,
        },
      ]
    : [{ value: "aus" }];
}

function getRuntimeAccentLines(
  settings: RuntimeMetronomeSettings,
  formulas: ReadonlyMap<string, FormulaValueRecord>,
): ReportDetailLine[] {
  return settings.accentuate
    ? [
        {
          label: "Intervall",
          value: formatValueWithFormula(
            `alle ${settings.accentRepeat} Beats`,
            "accentRepeat",
            formulas,
          ),
        },
      ]
    : [{ value: "aus" }];
}

function getConfiguredBreakLines(
  settings: MetronomeSettings,
): ReportDetailLine[] {
  if (settings.breaks === "none") {
    return [{ value: "Keine" }];
  }
  if (settings.breaks === "unlimited") {
    return [{ value: "Unbegrenzt" }];
  }
  return [
    {
      label: "Pausenzahl",
      value:
        settings.breakCount === null
          ? "unbegrenzt"
          : `${formatNumericFormulaInput(settings.breakCount)} Pausen`,
    },
    {
      label: "Pausendauer",
      value: settings.breakSeconds
        ? `${formatNumericFormulaInput(settings.breakSeconds)} Sekunden`
        : "manuelle Dauer",
    },
  ];
}

function getRuntimeBreakLines(
  settings: RuntimeMetronomeSettings,
  formulas: ReadonlyMap<string, FormulaValueRecord>,
): ReportDetailLine[] {
  if (settings.breaks === "none") {
    return [{ value: "Keine" }];
  }
  if (settings.breaks === "unlimited") {
    return [{ value: "Unbegrenzt" }];
  }
  const lines: ReportDetailLine[] = [
    {
      label: "Pausenzahl",
      value:
        settings.breakCount === null
          ? "unbegrenzt"
          : formatValueWithFormula(
              `${settings.breakCount} Pausen`,
              "breakCount",
              formulas,
            ),
    },
  ];
  const breakFormula = formulas.get("breakSeconds");
  lines.push({
    label: "Pausendauer",
    value: breakFormula
      ? formatValueWithFormula(
          `${breakFormula.value} Sekunden`,
          "breakSeconds",
          formulas,
        )
      : settings.breakSecondsRaw
        ? `${settings.breakSecondsRaw} Sekunden`
        : "manuelle Dauer",
  });
  return lines;
}

function getConfiguredEndLines(
  settings: MetronomeSettings,
): ReportDetailLine[] {
  const lines: ReportDetailLine[] = [
    settings.sessionEndEnabled
      ? {
          label: "Session-Ende",
          value: `${formatNumericFormulaInput(settings.sessionEndBeats)} Beats`,
        }
      : { label: "Session-Ende", value: "Manuelles Weiter" },
  ];
  if (settings.lockSettings) {
    lines.push({
      label: "Weiter-Sperre",
      value: `bis ${formatNumericFormulaInput(settings.lockBeats)} Beats`,
    });
  }
  return lines;
}

function getRuntimeEndLines(
  settings: RuntimeMetronomeSettings,
  formulas: ReadonlyMap<string, FormulaValueRecord>,
): ReportDetailLine[] {
  const lines: ReportDetailLine[] = [
    settings.sessionEndEnabled
      ? {
          label: "Session-Ende",
          value: formatValueWithFormula(
            `Nach ${settings.sessionEndBeats} Beats`,
            "sessionEndBeats",
            formulas,
          ),
        }
      : { label: "Session-Ende", value: "Manuelles Weiter" },
  ];
  if (settings.lockSettings) {
    lines.push({
      label: "Weiter-Sperre",
      value: formatValueWithFormula(
        `bis ${settings.lockBeats} Beats`,
        "lockBeats",
        formulas,
      ),
    });
  }
  return lines;
}

function getStopwatchEndLines(
  settings: StopwatchSettings | RuntimeStopwatchSettings,
  formulas: ReadonlyMap<string, FormulaValueRecord> = new Map(),
): ReportDetailLine[] {
  const lines: ReportDetailLine[] = [];
  if (settings.endMode === "unlimited") {
    lines.push({ value: "Unbegrenzt" });
  } else if (settings.endMode === "automatic") {
    lines.push({
      label: "Automatisches Ende",
      value: formatValueWithFormula(
        `Automatisch nach ${formatStopwatchSeconds(settings.automaticSeconds)} Sekunden`,
        "automaticSeconds",
        formulas,
      ),
    });
  } else {
    lines.push({
      label: "Manuelles Limit",
      value: formatValueWithFormula(
        `Manuell limitieren auf ${formatStopwatchSeconds(settings.manualLimitSeconds)} Sekunden`,
        "manualLimitSeconds",
        formulas,
      ),
    });
  }
  if (settings.endMode !== "unlimited" && settings.earlyContinueWarning) {
    lines.push({
      label: "Frühwarnung",
      value: formatValueWithFormula(
        `bei mehr als ${formatStopwatchSeconds(settings.earlyContinueWarningSeconds)} Sekunden`,
        "earlyContinueWarningSeconds",
        formulas,
      ),
    });
  }
  return lines;
}

function formatMaximumMode(
  mode: RuntimeMetronomeSettings["maximum"] | MetronomeSettings["maximum"],
): string {
  if (mode === "stick") {
    return "halten";
  }
  if (mode === "reset") {
    return "zurücksetzen";
  }
  if (mode === "reverse") {
    return "umkehren";
  }
  return "unbegrenzt";
}

function capitalize(value: string): string {
  return `${value[0]?.toUpperCase() ?? ""}${value.slice(1)}`;
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
