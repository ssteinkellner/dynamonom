import {
  ACTION_TYPES,
  getActionFormulaFields,
  getEnabledCurrentFormulaProperties,
} from "../action-model.ts";
import type { Action } from "../action-model.ts";
import {
  evaluateNumericFormulaInput,
  getNumericFormulaDependencies,
} from "../formula-engine.ts";
import type {
  FormulaEvaluationContext,
  FormulaOutputBounds,
  FormulaResolution,
  FormulaRuntimeAction,
} from "../formula-engine.ts";
import {
  formatFormulaNode,
  formatNumericFormulaInput,
} from "../formula-model.ts";
import type {
  FormulaActionInfo,
  NumericFormulaInput,
} from "../formula-model.ts";
import {
  METRONOME_NUMERIC_FIELD_BOUNDS,
} from "./metronome-settings.ts";
import type {
  ActionResult,
  FormulaValueRecord,
  RuntimeMetronomeSettings,
} from "./session.ts";

export type ActionFormulaResolution =
  | {
      valid: true;
      values: Readonly<Record<string, number>>;
      formulaValues: FormulaValueRecord[];
    }
  | { valid: false; field: string; error: string };

export function resolveActionFormulaValues(
  action: Action,
  previousResults: readonly ActionResult[],
): ActionFormulaResolution {
  const formulas = new Map(
    getActionFormulaFields(action).map(({ field, input }) => [field, input]),
  );
  const enabledFields = getEnabledCurrentFormulaProperties(action).filter(
    (field) => field !== "breakSeconds",
  );
  const previousActions = getFormulaRuntimeActions(previousResults);
  const currentValues: Record<string, number> = {};
  const formulaValues: FormulaValueRecord[] = [];
  const resolved = new Set<string>();
  const visiting = new Set<string>();

  const resolveField = (field: string): ActionFormulaResolution => {
    if (resolved.has(field)) {
      return {
        valid: true,
        values: currentValues,
        formulaValues,
      };
    }
    if (visiting.has(field)) {
      return {
        valid: false,
        field,
        error: "Die Formel enthält einen Zirkelbezug.",
      };
    }
    const input = formulas.get(field);
    if (!input) {
      return {
        valid: false,
        field,
        error: "Die Formel für dieses Aktionsfeld fehlt.",
      };
    }

    visiting.add(field);
    const dependencies = getDependencies(action, field, input);
    for (const dependency of dependencies) {
      if (!enabledFields.includes(dependency)) {
        continue;
      }
      const result = resolveField(dependency);
      if (!result.valid) {
        return result;
      }
    }

    const bounds = getFieldBounds(action, field);
    if (!bounds) {
      return {
        valid: false,
        field,
        error: "Für dieses Aktionsfeld fehlen Zahlenbegrenzungen.",
      };
    }
    const relationshipBounds = getRelationshipBounds(
      action,
      field,
      currentValues,
      bounds,
    );
    const context: FormulaEvaluationContext = {
      previousActions,
      currentValues,
    };
    const evaluation = evaluateNumericFormulaInput(
      input,
      context,
      bounds,
      relationshipBounds,
    );
    if (!evaluation.valid) {
      return { valid: false, field, error: evaluation.error };
    }

    currentValues[field] = evaluation.value;
    formulaValues.push(
      createFormulaValueRecord(action, field, input, evaluation, previousActions),
    );
    visiting.delete(field);
    resolved.add(field);
    return { valid: true, values: currentValues, formulaValues };
  };

  for (const field of enabledFields) {
    const result = resolveField(field);
    if (!result.valid) {
      return result;
    }
  }

  return { valid: true, values: currentValues, formulaValues };
}

export function resolvePauseDuration(
  action: Action,
  formula: NumericFormulaInput,
  previousResults: readonly ActionResult[],
  currentValues: Readonly<Record<string, number>>,
  liveBpm: number,
): FormulaResolution | { valid: false; error: string } {
  const bounds: FormulaOutputBounds = {
    min: METRONOME_NUMERIC_FIELD_BOUNDS.breakSeconds?.min ?? 1,
    max: METRONOME_NUMERIC_FIELD_BOUNDS.breakSeconds?.max ?? null,
  };
  return evaluateNumericFormulaInput(
    formula,
    {
      previousActions: getFormulaRuntimeActions(previousResults),
      currentValues,
      liveBpm,
    },
    bounds,
  );
}

export function createFormulaValueRecord(
  action: Action,
  field: string,
  input: NumericFormulaInput,
  evaluation: FormulaResolution,
  previousActions: readonly FormulaRuntimeAction[],
): FormulaValueRecord {
  const actionInfo: FormulaActionInfo[] = previousActions.map((previous) => ({
    id: previous.id,
    type: previous.type,
    name: previous.name ?? previous.id,
  }));
  const expression = formatNumericFormulaInput(input, {
    actions: actionInfo,
    currentPropertyLabels: getCurrentPropertyLabels(action),
  });
  const boundsContext = {
    actions: actionInfo,
    currentPropertyLabels: getCurrentPropertyLabels(action),
  };
  const minimum = formatFormulaNode(input.min, boundsContext);
  const maximum = input.max
    ? formatFormulaNode(input.max, boundsContext)
    : "unbegrenzt";
  return {
    field,
    label: getFormulaFieldLabel(field),
    expression: `${expression} [Min ${minimum}; Max ${maximum}]`,
    value: evaluation.value,
    fallbackUsed: evaluation.fallbackUsed,
    clamped: evaluation.clamped,
  };
}

export function formatFormulaField(
  action: Action,
  field: string,
  input: NumericFormulaInput,
  previousActions: readonly FormulaActionInfo[] = [],
): string {
  return formatFormulaNode(input.expression, {
    actions: previousActions,
    currentPropertyLabels: getCurrentPropertyLabels(action),
  });
}

export function getFormulaFieldLabel(field: string): string {
  const labels: Readonly<Record<string, string>> = {
    bpm: "Starttempo",
    accentRepeat: "Betonungsintervall",
    increaseBy: "Tempo-Steigerung",
    increaseAfter: "Steigerungsintervall",
    maximumLimitStick: "BPM-Limit",
    maximumLimitReset: "BPM-Limit",
    maximumLimitReverse: "BPM-Limit",
    decreaseBy: "Tempo-Verringerung",
    decreaseAfter: "Verringerungsintervall",
    breakCount: "Pausenzahl",
    breakSeconds: "Pausendauer",
    sessionEndBeats: "Session-Ende",
    lockBeats: "Weiter-Sperre",
    seconds: "Dauer",
    limitSeconds: "Zeitlimit",
  };
  return labels[field] ?? field;
}

export function getActionRuntimeMetronomeSettings(
  action: Extract<Action, { type: typeof ACTION_TYPES.METRONOME }>,
  resolvedValues: Readonly<Record<string, number>>,
  previousResults: readonly ActionResult[] = [],
): RuntimeMetronomeSettings {
  const settings = action.settings;
  const maximumLimitField =
    settings.maximum === "stick"
      ? "maximumLimitStick"
      : settings.maximum === "reset"
        ? "maximumLimitReset"
        : settings.maximum === "reverse"
          ? "maximumLimitReverse"
          : null;
  return {
    initialBpm: getResolvedValue(resolvedValues, "bpm", settings.bpm),
    accentuate: settings.accentuate,
    accentRepeat: getResolvedValue(
      resolvedValues,
      "accentRepeat",
      settings.accentRepeat,
    ),
    increaseTempo: settings.increaseTempo,
    increaseBy: getResolvedValue(resolvedValues, "increaseBy", settings.increaseBy),
    increaseAfter: getResolvedValue(
      resolvedValues,
      "increaseAfter",
      settings.increaseAfter,
    ),
    maximum: settings.maximum,
    maximumLimit: maximumLimitField
      ? getResolvedValue(
          resolvedValues,
          maximumLimitField,
          settings[maximumLimitField],
        )
      : getDormantValue(settings.maximumLimitStick),
    decreaseBy: getResolvedValue(
      resolvedValues,
      "decreaseBy",
      settings.decreaseBy,
    ),
    decreaseAfter: getResolvedValue(
      resolvedValues,
      "decreaseAfter",
      settings.decreaseAfter,
    ),
    breaks: settings.breaks,
    breakCount:
      settings.breaks === "limited" && settings.breakCount
        ? getResolvedValue(
            resolvedValues,
            "breakCount",
            settings.breakCount,
          )
        : null,
    breakSecondsFormula:
      settings.breaks === "limited" ? settings.breakSeconds : null,
    breakSecondsRaw: settings.breakSeconds
      ? formatNumericFormulaInput(settings.breakSeconds, {
          actions: previousResults.map(({ id, type, name }) => ({
            id,
            type,
            name,
          })),
          currentPropertyLabels: getCurrentPropertyLabels(action),
        })
      : "",
    lockSettings: settings.lockSettings,
    lockBeats: getResolvedValue(
      resolvedValues,
      "lockBeats",
      settings.lockBeats,
    ),
    sessionEndEnabled: settings.sessionEndEnabled,
    sessionEndBeats: getResolvedValue(
      resolvedValues,
      "sessionEndBeats",
      settings.sessionEndBeats,
    ),
  };
}

function getDependencies(
  action: Action,
  field: string,
  input: NumericFormulaInput,
): string[] {
  const dependencies = getNumericFormulaDependencies(input);
  if (
    action.type === ACTION_TYPES.METRONOME &&
    action.settings.increaseTempo &&
    action.settings.maximum !== "none" &&
    field === `maximumLimit${capitalize(action.settings.maximum)}`
  ) {
    dependencies.push("bpm");
  }
  if (
    action.type === ACTION_TYPES.METRONOME &&
    action.settings.lockSettings &&
    action.settings.sessionEndEnabled &&
    field === "lockBeats"
  ) {
    dependencies.push("sessionEndBeats");
  }
  return [...new Set(dependencies)];
}

function getRelationshipBounds(
  action: Action,
  field: string,
  currentValues: Readonly<Record<string, number>>,
  hardBounds: FormulaOutputBounds,
): FormulaOutputBounds | null {
  if (
    action.type === ACTION_TYPES.METRONOME &&
    action.settings.increaseTempo &&
    action.settings.maximum !== "none" &&
    field === `maximumLimit${capitalize(action.settings.maximum)}`
  ) {
    const bpm = currentValues.bpm;
    if (typeof bpm !== "number") {
      return null;
    }
    return { min: bpm + 1, max: hardBounds.max };
  }
  if (
    action.type === ACTION_TYPES.METRONOME &&
    action.settings.lockSettings &&
    action.settings.sessionEndEnabled &&
    field === "lockBeats"
  ) {
    const sessionEnd = currentValues.sessionEndBeats;
    if (typeof sessionEnd !== "number") {
      return null;
    }
    return { min: hardBounds.min, max: sessionEnd };
  }
  return null;
}

function getFieldBounds(
  action: Action,
  field: string,
): FormulaOutputBounds | null {
  if (action.type === ACTION_TYPES.METRONOME) {
    return METRONOME_NUMERIC_FIELD_BOUNDS[field] ?? null;
  }
  if (action.type === ACTION_TYPES.SECONDS && field === "seconds") {
    return { min: 1, max: 600 };
  }
  if (action.type === ACTION_TYPES.MANUAL && field === "limitSeconds") {
    return { min: 1, max: 600 };
  }
  return null;
}

function getResolvedValue(
  values: Readonly<Record<string, number>>,
  field: string,
  input: NumericFormulaInput,
): number {
  const value = values[field];
  if (typeof value === "number") {
    return value;
  }
  return getDormantValue(input);
}

function getDormantValue(input: NumericFormulaInput): number {
  const expression = input.expression;
  if (expression?.type === "static" && Number.isSafeInteger(expression.value)) {
    return expression.value;
  }
  if (
    expression?.type === "fallback" &&
    Number.isSafeInteger(expression.fallback)
  ) {
    return expression.fallback;
  }
  return 1;
}

function getFormulaRuntimeActions(
  results: readonly ActionResult[],
): FormulaRuntimeAction[] {
  return results
    .filter((result) => result.status === "completed")
    .map((result) => ({
      id: result.id,
      type: result.type,
      name: result.name,
      elapsedSeconds: result.elapsedSeconds,
      endBpm:
        result.type === ACTION_TYPES.METRONOME ? result.endBpm : undefined,
    }));
}

function getCurrentPropertyLabels(
  action: Action,
): Readonly<Record<string, string>> {
  const labels: Record<string, string> = {
    "current-bpm": "Aktuelles BPM",
  };
  if (action.type === ACTION_TYPES.METRONOME) {
    Object.assign(labels, {
      bpm: "Starttempo",
      accentRepeat: "Betonungsintervall",
      increaseBy: "Tempo-Steigerung",
      increaseAfter: "Steigerungsintervall",
      maximumLimitStick: "BPM-Limit",
      maximumLimitReset: "BPM-Limit",
      maximumLimitReverse: "BPM-Limit",
      decreaseBy: "Tempo-Verringerung",
      decreaseAfter: "Verringerungsintervall",
      breakCount: "Pausenzahl",
      sessionEndBeats: "Session-Ende",
      lockBeats: "Weiter-Sperre",
    });
  } else if (action.type === ACTION_TYPES.SECONDS) {
    labels.seconds = "Dauer";
  } else if (action.type === ACTION_TYPES.MANUAL) {
    labels.limitSeconds = "Zeitlimit";
  }
  return labels;
}

function capitalize(value: string): string {
  return `${value[0]?.toUpperCase() ?? ""}${value.slice(1)}`;
}
