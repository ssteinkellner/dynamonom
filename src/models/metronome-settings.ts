import {
  type BreakMode,
  type MaximumMode,
  type MetronomeSettings,
  type MetronomeSettingsValidation,
} from "../action-model.ts";
import {
  createNumericFormulaInput,
  normalizeNumericFormulaInput,
} from "../formula-model.ts";
import type { NumericFormulaInput } from "../formula-model.ts";

const DEFAULT_VALUES = Object.freeze({
  bpm: 120,
  accentuate: true,
  accentRepeat: 10,
  increaseTempo: true,
  increaseBy: 1,
  increaseAfter: 10,
  maximum: "none" as MaximumMode,
  maximumLimit: 180,
  decreaseBy: 1,
  decreaseAfter: 10,
  breaks: "unlimited" as BreakMode,
  breakCount: null,
  breakSeconds: null,
  lockSettings: false,
  hideLockText: false,
  hideNextTempo: false,
  lockBeats: 10,
  sessionEndEnabled: false,
  sessionEndBeats: 100,
});

export interface NumericFieldBounds {
  min: number;
  max: number | null;
}

export const METRONOME_NUMERIC_FIELD_BOUNDS: Readonly<
  Record<string, NumericFieldBounds>
> = Object.freeze({
  bpm: { min: 20, max: 300 },
  accentRepeat: { min: 1, max: null },
  increaseBy: { min: 1, max: 20 },
  increaseAfter: { min: 1, max: null },
  maximumLimitStick: { min: 60, max: 400 },
  maximumLimitReset: { min: 60, max: 400 },
  maximumLimitReverse: { min: 60, max: 400 },
  decreaseBy: { min: 1, max: 50 },
  decreaseAfter: { min: 1, max: null },
  breakCount: { min: 1, max: null },
  breakSeconds: { min: 1, max: null },
  sessionEndBeats: { min: 1, max: null },
  lockBeats: { min: 1, max: null },
});

const ACTIVE_MAXIMUM_LIMIT_FIELD: Record<MaximumMode, string | null> = {
  none: null,
  stick: "maximumLimitStick",
  reset: "maximumLimitReset",
  reverse: "maximumLimitReverse",
};

export function createDefaultMetronomeSettings(): MetronomeSettings {
  return {
    bpm: createField("bpm", DEFAULT_VALUES.bpm),
    accentuate: DEFAULT_VALUES.accentuate,
    accentRepeat: createField("accentRepeat", DEFAULT_VALUES.accentRepeat),
    increaseTempo: DEFAULT_VALUES.increaseTempo,
    increaseBy: createField("increaseBy", DEFAULT_VALUES.increaseBy),
    increaseAfter: createField("increaseAfter", DEFAULT_VALUES.increaseAfter),
    maximum: DEFAULT_VALUES.maximum,
    maximumLimitStick: createField("maximumLimitStick", DEFAULT_VALUES.maximumLimit),
    maximumLimitReset: createField("maximumLimitReset", DEFAULT_VALUES.maximumLimit),
    maximumLimitReverse: createField("maximumLimitReverse", DEFAULT_VALUES.maximumLimit),
    decreaseBy: createField("decreaseBy", DEFAULT_VALUES.decreaseBy),
    decreaseAfter: createField("decreaseAfter", DEFAULT_VALUES.decreaseAfter),
    breaks: DEFAULT_VALUES.breaks,
    breakCount: null,
    breakSeconds: null,
    sessionEndEnabled: DEFAULT_VALUES.sessionEndEnabled,
    sessionEndBeats: createField(
      "sessionEndBeats",
      DEFAULT_VALUES.sessionEndBeats,
    ),
    lockSettings: DEFAULT_VALUES.lockSettings,
    hideLockText: DEFAULT_VALUES.hideLockText,
    hideNextTempo: DEFAULT_VALUES.hideNextTempo,
    lockBeats: createField("lockBeats", DEFAULT_VALUES.lockBeats),
  };
}

export function getMetronomeMaximumLimit(
  settings: MetronomeSettings,
): NumericFormulaInput {
  const field = ACTIVE_MAXIMUM_LIMIT_FIELD[settings.maximum];
  if (field === "maximumLimitStick") {
    return settings.maximumLimitStick;
  }
  if (field === "maximumLimitReset") {
    return settings.maximumLimitReset;
  }
  if (field === "maximumLimitReverse") {
    return settings.maximumLimitReverse;
  }
  return createField("maximumLimitStick", DEFAULT_VALUES.maximumLimit);
}

export function validateMetronomeActionSettings(
  rawSettings: unknown,
  _index: number,
  _actions: unknown[],
): MetronomeSettingsValidation {
  const defaults = createDefaultMetronomeSettings();
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
  const getChoice = <T extends string>(
    name: string,
    fallback: T,
    isValid: (value: unknown) => value is T,
  ): T => {
    if (raw[name] === undefined) {
      return fallback;
    }
    if (isValid(raw[name])) {
      return raw[name];
    }
    markInvalid(name, "Eine gültige Option auswählen.");
    return fallback;
  };
  const getFormula = (
    field: string,
    fallback: NumericFormulaInput,
    optional = false,
  ): NumericFormulaInput | null => {
    const rawValue = raw[field];
    if (optional && (rawValue === null || rawValue === undefined || rawValue === "")) {
      return null;
    }
    const defaults = getStaticFormulaValue(fallback.expression);
    const bounds = METRONOME_NUMERIC_FIELD_BOUNDS[field];
    const normalized = normalizeNumericFormulaInput(
      rawValue === undefined ? fallback : rawValue,
      defaults,
      bounds.min,
      bounds.max,
    );
    if (!normalized.valid) {
      markInvalid(field, normalized.errors.join(" "));
    }
    return normalized.value;
  };

  const accentuate = getBoolean("accentuate", defaults.accentuate);
  const increaseTempo = getBoolean("increaseTempo", defaults.increaseTempo);
  const maximum = getChoice(
    "maximum",
    defaults.maximum,
    isMaximumMode,
  );
  const breaks = getChoice("breaks", defaults.breaks, isBreakMode);
  const sessionEndEnabled = getBoolean(
    "sessionEndEnabled",
    defaults.sessionEndEnabled,
  );
  const lockSettings = getBoolean("lockSettings", defaults.lockSettings);
  const hideLockText = getBoolean("hideLockText", defaults.hideLockText);
  const hideNextTempo = getBoolean("hideNextTempo", defaults.hideNextTempo);

  const settings: MetronomeSettings = {
    bpm: getFormula("bpm", defaults.bpm) ?? defaults.bpm,
    accentuate,
    accentRepeat:
      getFormula("accentRepeat", defaults.accentRepeat) ?? defaults.accentRepeat,
    increaseTempo,
    increaseBy: getFormula("increaseBy", defaults.increaseBy) ?? defaults.increaseBy,
    increaseAfter:
      getFormula("increaseAfter", defaults.increaseAfter) ??
      defaults.increaseAfter,
    maximum,
    maximumLimitStick:
      getFormula("maximumLimitStick", defaults.maximumLimitStick) ??
      defaults.maximumLimitStick,
    maximumLimitReset:
      getFormula("maximumLimitReset", defaults.maximumLimitReset) ??
      defaults.maximumLimitReset,
    maximumLimitReverse:
      getFormula("maximumLimitReverse", defaults.maximumLimitReverse) ??
      defaults.maximumLimitReverse,
    decreaseBy: getFormula("decreaseBy", defaults.decreaseBy) ?? defaults.decreaseBy,
    decreaseAfter:
      getFormula("decreaseAfter", defaults.decreaseAfter) ??
      defaults.decreaseAfter,
    breaks,
    breakCount: getFormula(
      "breakCount",
      createField("breakCount", 1),
      true,
    ),
    breakSeconds: getFormula(
      "breakSeconds",
      createField("breakSeconds", 1),
      true,
    ),
    sessionEndEnabled,
    sessionEndBeats:
      getFormula("sessionEndBeats", defaults.sessionEndBeats) ??
      defaults.sessionEndBeats,
    lockSettings,
    hideLockText,
    hideNextTempo,
    lockBeats: getFormula("lockBeats", defaults.lockBeats) ?? defaults.lockBeats,
  };

  if (errors.length > 0) {
    return { valid: false, errors };
  }
  return { valid: true, errors, settings };
}

function createField(field: string, value: number): NumericFormulaInput {
  const bounds = METRONOME_NUMERIC_FIELD_BOUNDS[field];
  if (!bounds) {
    throw new Error(`Unknown Metronome numeric field: ${field}`);
  }
  return createNumericFormulaInput(value, bounds.min, bounds.max);
}

function getStaticFormulaValue(node: NumericFormulaInput["expression"]): number {
  return node?.type === "static" ? node.value : 1;
}

function isMaximumMode(value: unknown): value is MaximumMode {
  return (
    value === "none" ||
    value === "stick" ||
    value === "reset" ||
    value === "reverse"
  );
}

function isBreakMode(value: unknown): value is BreakMode {
  return value === "none" || value === "limited" || value === "unlimited";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
