import {
  createDefaultStopwatchSettings,
  type StopwatchEndMode,
  type StopwatchSettings,
  type StopwatchSettingsValidation,
} from "../action-model.ts";
import {
  normalizeNumericFormulaInput,
} from "../formula-model.ts";
import type { NumericFormulaInput } from "../formula-model.ts";

export interface StopwatchNumericFieldBounds {
  min: number;
  max: number | null;
}

export const STOPWATCH_NUMERIC_FIELD_BOUNDS: Readonly<
  Record<string, StopwatchNumericFieldBounds>
> = Object.freeze({
  automaticSeconds: { min: 1, max: 600 },
  manualLimitSeconds: { min: 1, max: 600 },
  earlyContinueWarningSeconds: { min: 1, max: 600 },
});

export function validateStopwatchActionSettings(
  rawSettings: unknown,
  _index: number,
  _actions: unknown[],
): StopwatchSettingsValidation {
  const defaults = createDefaultStopwatchSettings();
  const raw = isRecord(rawSettings) ? rawSettings : {};
  const errors: { field: string; message: string }[] = [];
  const markInvalid = (field: string, message: string): void => {
    errors.push({ field, message });
  };
  const getBoolean = (name: string, fallback: boolean): boolean => {
    if (raw[name] === undefined) {
      return fallback;
    }
    if (typeof raw[name] === "boolean") {
      return raw[name];
    }
    markInvalid(name, "Einen gültigen Ja/Nein-Wert auswählen.");
    return fallback;
  };
  const getFormula = (
    field: keyof StopwatchSettings,
    fallback: NumericFormulaInput,
  ): NumericFormulaInput => {
    const bounds = STOPWATCH_NUMERIC_FIELD_BOUNDS[field];
    if (!bounds) {
      throw new Error(`Unknown Stoppuhr numeric field: ${field}`);
    }
    const defaults = getStaticFormulaValue(fallback.expression);
    const normalized = normalizeNumericFormulaInput(
      raw[field] === undefined ? fallback : raw[field],
      defaults,
      bounds.min,
      bounds.max,
    );
    if (!normalized.valid) {
      markInvalid(field, normalized.errors.join(" "));
    }
    return normalized.value;
  };

  const endMode = getEndMode(raw.endMode, defaults.endMode, markInvalid);
  const settings: StopwatchSettings = {
    endMode,
    automaticSeconds: getFormula(
      "automaticSeconds",
      defaults.automaticSeconds,
    ),
    hideDuration: getBoolean("hideDuration", defaults.hideDuration),
    manualLimitSeconds: getFormula(
      "manualLimitSeconds",
      defaults.manualLimitSeconds,
    ),
    earlyContinueWarning: getBoolean(
      "earlyContinueWarning",
      defaults.earlyContinueWarning,
    ),
    earlyContinueWarningSeconds: getFormula(
      "earlyContinueWarningSeconds",
      defaults.earlyContinueWarningSeconds,
    ),
  };

  if (errors.length > 0) {
    return { valid: false, errors };
  }
  return { valid: true, errors, settings };
}

function getEndMode(
  value: unknown,
  fallback: StopwatchEndMode,
  markInvalid: (field: string, message: string) => void,
): StopwatchEndMode {
  if (value === undefined) {
    return fallback;
  }
  if (isStopwatchEndMode(value)) {
    return value;
  }
  markInvalid("endMode", "Eine gültige Ende-Option auswählen.");
  return fallback;
}

function getStaticFormulaValue(node: NumericFormulaInput["expression"]): number {
  return node?.type === "static" ? node.value : 1;
}

function isStopwatchEndMode(value: unknown): value is StopwatchEndMode {
  return value === "unlimited" || value === "automatic" || value === "manual";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
