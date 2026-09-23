import {
  ACTION_TYPES,
  type BreakMode,
  type MaximumMode,
  type MetronomeSettings,
  type MetronomeSettingsValidation,
  type NumericSetting,
} from "../action-model.ts";

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
  lockBeats: 10,
  sessionEndEnabled: false,
  sessionEndBeats: 100,
});

const MAXIMUM_LIMIT_FIELDS = [
  "maximumLimitStick",
  "maximumLimitReset",
  "maximumLimitReverse",
] as const;

type MaximumLimitField = typeof MAXIMUM_LIMIT_FIELDS[number];

export interface StopwatchActionSource {
  id?: string;
  name: string;
}

export type BreakInput =
  | { type: "seconds"; seconds: number }
  | {
      type: "expression";
      operator: "+" | "-" | "*" | "/";
      operand: number;
    };

export type BreakInputParseResult =
  | { valid: true; value: BreakInput }
  | { valid: false; error: string };

const ACTIVE_MAXIMUM_LIMIT_FIELD: Record<MaximumMode, MaximumLimitField | null> = {
  none: null,
  stick: "maximumLimitStick",
  reset: "maximumLimitReset",
  reverse: "maximumLimitReverse",
};

export function createDefaultMetronomeSettings(): MetronomeSettings {
  return {
    bpm: DEFAULT_VALUES.bpm,
    accentuate: DEFAULT_VALUES.accentuate,
    accentRepeat: DEFAULT_VALUES.accentRepeat,
    increaseTempo: DEFAULT_VALUES.increaseTempo,
    increaseBy: DEFAULT_VALUES.increaseBy,
    increaseAfter: DEFAULT_VALUES.increaseAfter,
    maximum: DEFAULT_VALUES.maximum,
    maximumLimitStick: DEFAULT_VALUES.maximumLimit,
    maximumLimitReset: DEFAULT_VALUES.maximumLimit,
    maximumLimitReverse: DEFAULT_VALUES.maximumLimit,
    decreaseBy: DEFAULT_VALUES.decreaseBy,
    decreaseAfter: DEFAULT_VALUES.decreaseAfter,
    breaks: DEFAULT_VALUES.breaks,
    breakCount: DEFAULT_VALUES.breakCount,
    breakSeconds: "",
    sessionEndEnabled: DEFAULT_VALUES.sessionEndEnabled,
    sessionEndBeats: DEFAULT_VALUES.sessionEndBeats,
    lockSettings: DEFAULT_VALUES.lockSettings,
    lockBeats: DEFAULT_VALUES.lockBeats,
  };
}

export function getMetronomeMaximumLimit(
  settings: MetronomeSettings,
): NumericSetting {
  if (settings.maximum === "stick") {
    return settings.maximumLimitStick;
  }
  if (settings.maximum === "reset") {
    return settings.maximumLimitReset;
  }
  if (settings.maximum === "reverse") {
    return settings.maximumLimitReverse;
  }
  return DEFAULT_VALUES.maximumLimit;
}

export function parseBreakInput(rawValue: string): BreakInputParseResult {
  const raw = rawValue.trim();
  if (/^\d+$/.test(raw)) {
    const seconds = Number(raw);
    if (Number.isSafeInteger(seconds) && seconds > 0) {
      return { valid: true, value: { type: "seconds", seconds } };
    }
    return { valid: false, error: "Positive ganze Zahl für Sekunden eingeben." };
  }

  const expression = /^BPM\s*([+\-*\/])\s*(\d+(?:\.\d+)?)$/i.exec(raw);
  if (!expression) {
    return {
      valid: false,
      error: "Positive ganze Zahl oder Ausdruck wie BPM/2 verwenden.",
    };
  }

  const operator = expression[1];
  const operand = Number(expression[2]);
  if (
    (operator !== "+" && operator !== "-" && operator !== "*" && operator !== "/") ||
    !Number.isFinite(operand) ||
    operand <= 0
  ) {
    return { valid: false, error: "Die Zahl im Ausdruck muss größer als null sein." };
  }

  return {
    valid: true,
    value: {
      type: "expression",
      operator,
      operand,
    },
  };
}

export function validateMetronomeActionSettings(
  rawSettings: unknown,
  _index: number,
  actions: unknown[],
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
  const getText = (name: string, fallback: NumericSetting | null): string =>
    String(raw[name] ?? fallback ?? "").trim();

  const bpm = parseIntegerField(getText("bpm", defaults.bpm), 20, 300);
  if (bpm === null) {
    markInvalid("bpm", "Ganze BPM-Zahl von 20 bis 300 eingeben.");
  }

  const accentuate = getBoolean("accentuate", defaults.accentuate);
  const accentRepeatRaw = getText("accentRepeat", defaults.accentRepeat);
  const parsedAccentRepeat = parsePositiveInteger(
    accentRepeatRaw,
    Number.POSITIVE_INFINITY,
  );
  if (accentuate && parsedAccentRepeat === null) {
    markInvalid("accentRepeat", "Positive ganze Zahl eingeben.");
  }
  const accentRepeat = parsedAccentRepeat ?? accentRepeatRaw;

  const increaseTempo = getBoolean("increaseTempo", defaults.increaseTempo);
  const increaseByRaw = getText("increaseBy", defaults.increaseBy);
  const parsedIncreaseBy = parseIntegerField(increaseByRaw, 1, 20);
  if (increaseTempo && parsedIncreaseBy === null) {
    markInvalid("increaseBy", "Ganze Zahl von 1 bis 20 eingeben.");
  }
  const increaseBy = parsedIncreaseBy ?? increaseByRaw;
  const increaseAfterRaw = getText("increaseAfter", defaults.increaseAfter);
  const parsedIncreaseAfter = parsePositiveInteger(
    increaseAfterRaw,
    Number.POSITIVE_INFINITY,
  );
  if (increaseTempo && parsedIncreaseAfter === null) {
    markInvalid("increaseAfter", "Positive ganze Zahl eingeben.");
  }
  const increaseAfter = parsedIncreaseAfter ?? increaseAfterRaw;

  const maximumRaw = String(raw.maximum ?? defaults.maximum);
  const maximum = isMaximumMode(maximumRaw) ? maximumRaw : defaults.maximum;
  if (!isMaximumMode(maximumRaw)) {
    markInvalid("maximum", "Eine gültige Maximum-Option auswählen.");
  }
  const activeMaximumLimitField = ACTIVE_MAXIMUM_LIMIT_FIELD[maximum];
  const maximumLimits: Record<MaximumLimitField, NumericSetting | null> = {
    maximumLimitStick: parseIntegerField(
      getText("maximumLimitStick", defaults.maximumLimitStick),
      60,
      400,
    ),
    maximumLimitReset: parseIntegerField(
      getText("maximumLimitReset", defaults.maximumLimitReset),
      60,
      400,
    ),
    maximumLimitReverse: parseIntegerField(
      getText("maximumLimitReverse", defaults.maximumLimitReverse),
      60,
      400,
    ),
  };
  for (const field of MAXIMUM_LIMIT_FIELDS) {
    if (maximumLimits[field] === null) {
      maximumLimits[field] = getText(field, DEFAULT_VALUES.maximumLimit);
    }
  }

  const decreaseByRaw = getText("decreaseBy", defaults.decreaseBy);
  const parsedDecreaseBy = parseIntegerField(decreaseByRaw, 1, 50);
  const decreaseAfterRaw = getText("decreaseAfter", defaults.decreaseAfter);
  const parsedDecreaseAfter = parsePositiveInteger(
    decreaseAfterRaw,
    Number.POSITIVE_INFINITY,
  );
  const decreaseBy = parsedDecreaseBy ?? decreaseByRaw;
  const decreaseAfter = parsedDecreaseAfter ?? decreaseAfterRaw;
  if (increaseTempo && activeMaximumLimitField) {
    const selectedMaximumLimit = parseIntegerField(
      getText(activeMaximumLimitField, DEFAULT_VALUES.maximumLimit),
      60,
      400,
    );
    if (selectedMaximumLimit === null) {
      markInvalid(activeMaximumLimitField, "Ganzzahliges Limit von 60 bis 400 eingeben.");
    } else {
      maximumLimits[activeMaximumLimitField] = selectedMaximumLimit;
      if (bpm !== null && selectedMaximumLimit <= bpm) {
        markInvalid(activeMaximumLimitField, "Das Limit muss über dem Startwert liegen.");
      }
    }
    if (maximum === "reverse") {
      if (parsedDecreaseBy === null) {
        markInvalid("decreaseBy", "Ganze Zahl von 1 bis 50 eingeben.");
      }
      if (parsedDecreaseAfter === null) {
        markInvalid("decreaseAfter", "Positive ganze Zahl eingeben.");
      }
    }
  }

  const breaksRaw = String(raw.breaks ?? defaults.breaks);
  const breaks = isBreakMode(breaksRaw) ? breaksRaw : defaults.breaks;
  if (!isBreakMode(breaksRaw)) {
    markInvalid("breaks", "Eine gültige Pausen-Option auswählen.");
  }
  const breakCountRaw = getText("breakCount", "");
  const parsedBreakCount = breakCountRaw === ""
    ? null
    : parsePositiveInteger(breakCountRaw, Number.POSITIVE_INFINITY);
  if (breaks === "limited" && breakCountRaw !== "" && parsedBreakCount === null) {
    markInvalid("breakCount", "Positive ganze Zahl eingeben oder leer lassen.");
  }
  const breakCount = parsedBreakCount ?? (breakCountRaw === "" ? null : breakCountRaw);
  const breakSecondsRaw = getText("breakSeconds", "");
  if (breaks === "limited" && breakSecondsRaw !== "") {
    const parsedBreakSeconds = parseBreakInput(breakSecondsRaw);
    if (!parsedBreakSeconds.valid) {
      markInvalid("breakSeconds", parsedBreakSeconds.error);
    } else if (
      bpm !== null &&
      !isBreakInputSafe(parsedBreakSeconds.value, bpm)
    ) {
      markInvalid(
        "breakSeconds",
        "Dieser Ausdruck kann bei einem erreichbaren BPM-Wert null oder negativ werden.",
      );
    }
  }

  const stopwatchSources = getStopwatchSourcesBeforeMetronome(actions, _index);
  const hasDerivedEnd = stopwatchSources.length > 0;
  const sessionEndEnabled = getBoolean(
    "sessionEndEnabled",
    defaults.sessionEndEnabled,
  );
  const sessionEndBeatsRaw = getText("sessionEndBeats", defaults.sessionEndBeats);
  const parsedSessionEndBeats = parsePositiveInteger(
    sessionEndBeatsRaw,
    Number.POSITIVE_INFINITY,
  );
  if (sessionEndEnabled && !hasDerivedEnd && parsedSessionEndBeats === null) {
    markInvalid("sessionEndBeats", "Positive ganze Zahl eingeben.");
  }
  const sessionEndBeats = parsedSessionEndBeats ?? sessionEndBeatsRaw;
  const lockSettings = getBoolean("lockSettings", defaults.lockSettings);
  const lockBeatsRaw = getText("lockBeats", defaults.lockBeats);
  const parsedLockBeats = parsePositiveInteger(
    lockBeatsRaw,
    Number.POSITIVE_INFINITY,
  );
  if (lockSettings && !hasDerivedEnd && parsedLockBeats === null) {
    markInvalid("lockBeats", "Positive ganze Zahl eingeben.");
  }
  const lockBeats = parsedLockBeats ?? lockBeatsRaw;
  if (
    !hasDerivedEnd &&
    lockSettings &&
    sessionEndEnabled &&
    typeof lockBeats === "number" &&
    typeof sessionEndBeats === "number" &&
    lockBeats > sessionEndBeats
  ) {
    markInvalid(
      "lockBeats",
      "Die Sperre darf das automatische Session-Ende nicht überschreiten.",
    );
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }
  return {
    valid: true,
    errors,
    settings: {
      bpm: bpm ?? defaults.bpm,
      accentuate,
      accentRepeat,
      increaseTempo,
      increaseBy,
      increaseAfter,
      maximum,
      maximumLimitStick: maximumLimits.maximumLimitStick ?? DEFAULT_VALUES.maximumLimit,
      maximumLimitReset: maximumLimits.maximumLimitReset ?? DEFAULT_VALUES.maximumLimit,
      maximumLimitReverse: maximumLimits.maximumLimitReverse ?? DEFAULT_VALUES.maximumLimit,
      decreaseBy,
      decreaseAfter,
      breaks,
      breakCount,
      breakSeconds: breakSecondsRaw,
      sessionEndEnabled,
      sessionEndBeats,
      lockSettings,
      lockBeats,
    },
  };
}

export function parseIntegerField(
  rawValue: unknown,
  min: number,
  max: number,
): number | null {
  const value = parsePositiveInteger(rawValue, max);
  if (value === null || value < min) {
    return null;
  }
  return value;
}

export function parsePositiveInteger(
  rawValue: unknown,
  max: number,
): number | null {
  const raw = String(rawValue ?? "").trim();
  if (!/^\d+$/.test(raw)) {
    return null;
  }

  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1 || value > max) {
    return null;
  }
  return value;
}

export function getStopwatchSourcesBeforeMetronome(
  actions: readonly unknown[],
  metronomeIndex: number,
): StopwatchActionSource[] {
  const sources: StopwatchActionSource[] = [];
  for (let index = 0; index < metronomeIndex; index += 1) {
    const action = actions[index];
    if (!isRecord(action)) {
      continue;
    }
    if (action.type === ACTION_TYPES.METRONOME) {
      sources.length = 0;
    } else if (action.type === ACTION_TYPES.STOPWATCH) {
      sources.push({
        id: typeof action.id === "string" ? action.id : undefined,
        name: typeof action.name === "string" ? action.name : "Stoppuhr",
      });
    }
  }
  return sources;
}

function isBreakInputSafe(parsedInput: BreakInput, initialBpm: number): boolean {
  if (parsedInput.type !== "expression") {
    return true;
  }
  return parsedInput.operator !== "-" || initialBpm - parsedInput.operand > 0;
}

function isMaximumMode(value: string): value is MaximumMode {
  return value === "none" || value === "stick" || value === "reset" || value === "reverse";
}

function isBreakMode(value: string): value is BreakMode {
  return value === "none" || value === "limited" || value === "unlimited";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
