import {
  PRE_TIMER_TYPES,
  createDefaultPreTimer,
  normalizePreTimerDefinition,
} from "./pre-timer-model.ts";
import type {
  ManualPreTimer,
  PreTimerRounding,
  SecondsPreTimer,
  StopwatchPreTimer,
} from "./pre-timer-model.ts";

export const ACTION_TYPES = Object.freeze({
  METRONOME: "metronom",
  SECONDS: PRE_TIMER_TYPES.SECONDS,
  STOPWATCH: PRE_TIMER_TYPES.STOPWATCH,
  MANUAL: PRE_TIMER_TYPES.MANUAL,
} as const);

export type ActionType = typeof ACTION_TYPES[keyof typeof ACTION_TYPES];
export type MaximumMode = "none" | "stick" | "reset" | "reverse";
export type BreakMode = "none" | "limited" | "unlimited";
export type NumericSetting = number | string;

export const ACTION_TYPE_LABELS = Object.freeze({
  [ACTION_TYPES.METRONOME]: "Metronom",
  [ACTION_TYPES.SECONDS]: "Sekunden",
  [ACTION_TYPES.STOPWATCH]: "Stoppuhr",
  [ACTION_TYPES.MANUAL]: "Manuell",
} satisfies Record<ActionType, string>);

export const ACTIONS_VERSION = 1;

export interface MetronomeSettings {
  bpm: number;
  accentuate: boolean;
  accentRepeat: NumericSetting;
  increaseTempo: boolean;
  increaseBy: NumericSetting;
  increaseAfter: NumericSetting;
  maximum: MaximumMode;
  maximumLimitStick: NumericSetting;
  maximumLimitReset: NumericSetting;
  maximumLimitReverse: NumericSetting;
  decreaseBy: NumericSetting;
  decreaseAfter: NumericSetting;
  breaks: BreakMode;
  breakCount: NumericSetting | null;
  breakSeconds: string;
  sessionEndEnabled: boolean;
  sessionEndBeats: NumericSetting;
  lockSettings: boolean;
  lockBeats: NumericSetting;
}

export interface MetronomeAction {
  id: string;
  type: typeof ACTION_TYPES.METRONOME;
  name: string;
  settings: MetronomeSettings;
}

export interface SecondsAction {
  id: string;
  type: typeof ACTION_TYPES.SECONDS;
  name: string;
  settings: { seconds: number };
}

export interface StopwatchAction {
  id: string;
  type: typeof ACTION_TYPES.STOPWATCH;
  name: string;
  settings: {
    formula: string;
    rounding: PreTimerRounding;
    roundingThreshold: number | null;
    min: number;
    max: number | null;
  };
}

export interface ManualAction {
  id: string;
  type: typeof ACTION_TYPES.MANUAL;
  name: string;
  settings: { limitSeconds: number | null };
}

export type Action =
  | MetronomeAction
  | SecondsAction
  | StopwatchAction
  | ManualAction;

type NormalizedAction =
  | {
      id?: string;
      type: typeof ACTION_TYPES.METRONOME;
      name: string;
      settings: Record<string, unknown>;
    }
  | {
      id?: string;
      type: typeof ACTION_TYPES.SECONDS;
      name: string;
      settings: { seconds: number };
    }
  | {
      id?: string;
      type: typeof ACTION_TYPES.STOPWATCH;
      name: string;
      settings: Omit<StopwatchPreTimer, "id" | "type" | "name">;
    }
  | {
      id?: string;
      type: typeof ACTION_TYPES.MANUAL;
      name: string;
      settings: Omit<ManualPreTimer, "id" | "type" | "name">;
    };

export interface ActionValidationError {
  index: number;
  field: string;
  message: string;
}

interface MetronomeFieldError {
  field: string;
  message: string;
}

export type MetronomeSettingsValidation =
  | {
      valid: true;
      errors: MetronomeFieldError[];
      settings: MetronomeSettings;
    }
  | { valid: false; errors: MetronomeFieldError[] };

export type MetronomeSettingsValidator = (
  rawSettings: Record<string, unknown>,
  index: number,
  actions: unknown[],
) => MetronomeSettingsValidation;

export interface ActionValidationOptions {
  validateMetronomeSettings?: MetronomeSettingsValidator;
  requireMetronome?: boolean;
}

export interface ActionValidationResult {
  valid: boolean;
  errors: ActionValidationError[];
  actions: Action[];
}

export type ActionNormalizationResult =
  | { valid: true; errors: Record<string, never>; value: NormalizedAction }
  | { valid: false; errors: Record<string, string> };

export type ParsedActionsPayload =
  | { valid: true; actions: unknown[] }
  | { valid: false; error: string };

let nextActionId = 1;

export function createActionId(): string {
  const timestamp = Date.now().toString(36);
  const id = `action-${timestamp}-${nextActionId}`;
  nextActionId += 1;
  return id;
}

export function getActionTypeLabel(type: string): string {
  return isActionType(type) ? ACTION_TYPE_LABELS[type] : type;
}

export function cloneAction(action: Action): Action {
  return cloneValue(action);
}

export function cloneActions(actions: readonly Action[] | null | undefined): Action[] {
  return actions ? actions.map(cloneAction) : [];
}

export function createDefaultAction(
  type: typeof ACTION_TYPES.METRONOME,
  actions: readonly Action[],
  metronomeSettings: MetronomeSettings,
): MetronomeAction;
export function createDefaultAction(
  type: typeof ACTION_TYPES.SECONDS,
  actions: readonly Action[],
): SecondsAction;
export function createDefaultAction(
  type: typeof ACTION_TYPES.STOPWATCH,
  actions: readonly Action[],
): StopwatchAction;
export function createDefaultAction(
  type: typeof ACTION_TYPES.MANUAL,
  actions: readonly Action[],
): ManualAction;
export function createDefaultAction(
  type: ActionType,
  actions: readonly Action[] = [],
  metronomeSettings?: MetronomeSettings,
): Action {
  if (!isActionType(type)) {
    throw new Error(`Unknown action type: ${type}`);
  }

  const name = getNextActionName(type, actions);
  if (type === ACTION_TYPES.METRONOME) {
    if (!metronomeSettings) {
      throw new Error("Default Metronom settings are required.");
    }
    return {
      id: createActionId(),
      type,
      name,
      settings: cloneValue(metronomeSettings),
    };
  }

  const timer = createDefaultPreTimer(type);
  if (timer.type === ACTION_TYPES.SECONDS) {
    return {
      id: createActionId(),
      type: timer.type,
      name,
      settings: { seconds: timer.seconds },
    };
  }
  if (timer.type === ACTION_TYPES.STOPWATCH) {
    return {
      id: createActionId(),
      type: timer.type,
      name,
      settings: {
        formula: timer.formula,
        rounding: timer.rounding,
        roundingThreshold: timer.roundingThreshold,
        min: timer.min,
        max: timer.max,
      },
    };
  }
  return {
    id: createActionId(),
    type: timer.type,
    name,
    settings: { limitSeconds: timer.limitSeconds },
  };
}

export function normalizeActionDefinition(
  rawAction: unknown,
  { generateId = true }: { generateId?: boolean } = {},
): ActionNormalizationResult {
  if (!isRecord(rawAction)) {
    return {
      valid: false,
      errors: { action: "Eine gültige Aktion fehlt." },
    };
  }

  const type = rawAction.type;
  const errors: Record<string, string> = {};
  const name = typeof rawAction.name === "string" ? rawAction.name.trim() : "";
  if (!isActionType(type)) {
    errors.type = "Ungültigen Aktionstyp auswählen.";
  }
  if (typeof rawAction.name !== "string" || !name) {
    errors.name = "Einen Namen eingeben.";
  }

  const rawSettings = rawAction.settings;
  if (!isRecord(rawSettings)) {
    errors.settings = "Gültige Aktionseinstellungen fehlen.";
  }

  if (Object.keys(errors).length > 0 || !isActionType(type) || !isRecord(rawSettings)) {
    return { valid: false, errors };
  }

  const id = getOptionalId(rawAction.id, generateId);
  if (type === ACTION_TYPES.METRONOME) {
    return {
      valid: true,
      errors: {},
      value: {
        id,
        type,
        name,
        settings: cloneValue(rawSettings),
      },
    };
  }

  const normalized = normalizePreTimerDefinition(
    {
      ...rawSettings,
      id: rawAction.id,
      type,
      name,
    },
    { generateId: false },
  );
  if (!normalized.valid) {
    return { valid: false, errors: normalized.errors };
  }

  const value = normalized.value;
  if (value.type === ACTION_TYPES.SECONDS) {
    return {
      valid: true,
      errors: {},
      value: {
        id,
        type: value.type,
        name: value.name,
        settings: { seconds: value.seconds },
      },
    };
  }
  if (value.type === ACTION_TYPES.STOPWATCH) {
    return {
      valid: true,
      errors: {},
      value: {
        id,
        type: value.type,
        name: value.name,
        settings: {
          formula: value.formula,
          rounding: value.rounding,
          roundingThreshold: value.roundingThreshold,
          min: value.min,
          max: value.max,
        },
      },
    };
  }
  return {
    valid: true,
    errors: {},
    value: {
      id,
      type: value.type,
      name: value.name,
      settings: { limitSeconds: value.limitSeconds },
    },
  };
}

export function validateActionDefinitions(
  rawActions: unknown,
  {
    validateMetronomeSettings,
    requireMetronome = false,
  }: ActionValidationOptions = {},
): ActionValidationResult {
  if (!Array.isArray(rawActions)) {
    return {
      valid: false,
      errors: [{ index: -1, field: "actions", message: "Aktionen müssen eine Liste sein." }],
      actions: [],
    };
  }

  const inputActions: unknown[] = rawActions;
  const actions: Action[] = [];
  const errors: ActionValidationError[] = [];
  const names = new Map<string, string>();
  let hasMetronome = false;

  inputActions.forEach((rawAction, index) => {
    const normalized = normalizeActionDefinition(rawAction);
    if (!normalized.valid) {
      Object.entries(normalized.errors).forEach(([field, message]) => {
        errors.push({ index, field, message });
      });
      return;
    }

    const { value } = normalized;
    const normalizedName = value.name.toLowerCase();
    const previousName = names.get(normalizedName);
    if (previousName !== undefined) {
      errors.push({
        index,
        field: "name",
        message: `Der Name muss eindeutig sein; "${previousName}" ist bereits vergeben.`,
      });
    } else {
      names.set(normalizedName, value.name);
    }

    const id = value.id || createActionId();
    if (value.type === ACTION_TYPES.METRONOME) {
      hasMetronome = true;
      if (!validateMetronomeSettings) {
        errors.push({
          index,
          field: "settings",
          message: "Metronom-Einstellungen müssen validiert werden.",
        });
        return;
      }
      const validation = validateMetronomeSettings(value.settings, index, inputActions);
      if (!validation.valid) {
        validation.errors.forEach(({ field, message }) => {
          errors.push({ index, field, message });
        });
        return;
      }
      actions.push({
        id,
        type: value.type,
        name: value.name,
        settings: validation.settings,
      });
      return;
    }

    if (value.type === ACTION_TYPES.SECONDS) {
      actions.push({
        id,
        type: value.type,
        name: value.name,
        settings: value.settings,
      });
    } else if (value.type === ACTION_TYPES.STOPWATCH) {
      actions.push({
        id,
        type: value.type,
        name: value.name,
        settings: value.settings,
      });
    } else {
      actions.push({
        id,
        type: value.type,
        name: value.name,
        settings: value.settings,
      });
    }
  });

  if (requireMetronome && !hasMetronome) {
    errors.push({
      index: -1,
      field: "actions",
      message: "Mindestens eine Metronom-Aktion hinzufügen.",
    });
  }

  return { valid: errors.length === 0, errors, actions };
}

export function serializeActionsPayload(actions: readonly Action[]): string {
  return JSON.stringify(
    actions.map(({ type, name, settings }) => ({
      type,
      name,
      settings: cloneValue(settings),
    })),
  );
}

export function parseActionsPayload(rawPayload: unknown): ParsedActionsPayload {
  let actions: unknown;
  try {
    actions = JSON.parse(String(rawPayload));
  } catch {
    return {
      valid: false,
      error: "Die Aktionen konnten nicht als JSON gelesen werden.",
    };
  }
  if (!Array.isArray(actions)) {
    return {
      valid: false,
      error: "Die Aktionen müssen als JSON-Liste vorliegen.",
    };
  }
  return {
    valid: true,
    actions: actions.map((action: unknown) => {
      if (!isRecord(action)) {
        return action;
      }
      return {
        type: action.type,
        name: action.name,
        settings: action.settings,
      };
    }),
  };
}

function getNextActionName(type: ActionType, actions: readonly Action[]): string {
  const baseName = getActionTypeLabel(type);
  const existingNames = new Set(
    actions.map((action) => String(action.name ?? "").trim().toLowerCase()),
  );
  if (!existingNames.has(baseName.toLowerCase())) {
    return baseName;
  }
  for (let suffix = 2; ; suffix += 1) {
    const candidate = `${baseName} ${suffix}`;
    if (!existingNames.has(candidate.toLowerCase())) {
      return candidate;
    }
  }
}

function isActionType(value: unknown): value is ActionType {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(ACTION_TYPE_LABELS, value)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function getOptionalId(rawId: unknown, generateId: boolean): string | undefined {
  if (typeof rawId === "string" && rawId !== "") {
    return rawId;
  }
  return generateId ? createActionId() : undefined;
}

function cloneValue<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((nested: unknown) => cloneValue(nested)) as T;
  }
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, cloneValue(nested)]),
    ) as T;
  }
  return value;
}
