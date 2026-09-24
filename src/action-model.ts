import {
  collectFormulaNodes,
  createNumericFormulaInput,
} from "./formula-model.ts";
import type {
  FormulaCurrentNode,
  FormulaNode,
  FormulaReferenceNode,
  NumericFormulaInput,
} from "./formula-model.ts";

export const ACTION_TYPES = Object.freeze({
  METRONOME: "metronom",
  STOPWATCH: "stoppuhr",
} as const);

export type ActionType = typeof ACTION_TYPES[keyof typeof ACTION_TYPES];
export type MaximumMode = "none" | "stick" | "reset" | "reverse";
export type BreakMode = "none" | "limited" | "unlimited";
export type StopwatchEndMode = "unlimited" | "automatic" | "manual";
export type NumericSetting = number | string;

export const ACTION_TYPE_LABELS = Object.freeze({
  [ACTION_TYPES.METRONOME]: "Metronom",
  [ACTION_TYPES.STOPWATCH]: "Stoppuhr",
} satisfies Record<ActionType, string>);

export const ACTIONS_VERSION = 1;

export interface MetronomeSettings {
  bpm: NumericFormulaInput;
  accentuate: boolean;
  accentRepeat: NumericFormulaInput;
  increaseTempo: boolean;
  increaseBy: NumericFormulaInput;
  increaseAfter: NumericFormulaInput;
  maximum: MaximumMode;
  maximumLimitStick: NumericFormulaInput;
  maximumLimitReset: NumericFormulaInput;
  maximumLimitReverse: NumericFormulaInput;
  decreaseBy: NumericFormulaInput;
  decreaseAfter: NumericFormulaInput;
  breaks: BreakMode;
  breakCount: NumericFormulaInput | null;
  breakSeconds: NumericFormulaInput | null;
  sessionEndEnabled: boolean;
  sessionEndBeats: NumericFormulaInput;
  lockSettings: boolean;
  hideLockText: boolean;
  hideNextTempo: boolean;
  lockBeats: NumericFormulaInput;
}

export interface MetronomeAction {
  id: string;
  type: typeof ACTION_TYPES.METRONOME;
  name: string;
  settings: MetronomeSettings;
}

export interface StopwatchSettings {
  endMode: StopwatchEndMode;
  automaticSeconds: NumericFormulaInput;
  hideDuration: boolean;
  manualLimitSeconds: NumericFormulaInput;
  earlyContinueWarning: boolean;
  earlyContinueWarningSeconds: NumericFormulaInput;
}

export interface StopwatchAction {
  id: string;
  type: typeof ACTION_TYPES.STOPWATCH;
  name: string;
  settings: StopwatchSettings;
}

export type Action = MetronomeAction | StopwatchAction;

type NormalizedAction =
  | {
      id: string;
      type: typeof ACTION_TYPES.METRONOME;
      name: string;
      settings: Record<string, unknown>;
    }
  | {
      id: string;
      type: typeof ACTION_TYPES.STOPWATCH;
      name: string;
      settings: Record<string, unknown>;
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

export type StopwatchSettingsValidation =
  | {
      valid: true;
      errors: MetronomeFieldError[];
      settings: StopwatchSettings;
    }
  | { valid: false; errors: MetronomeFieldError[] };

export type StopwatchSettingsValidator = (
  rawSettings: Record<string, unknown>,
  index: number,
  actions: unknown[],
) => StopwatchSettingsValidation;

export interface ActionValidationOptions {
  validateMetronomeSettings?: MetronomeSettingsValidator;
  validateStopwatchSettings?: StopwatchSettingsValidator;
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

export interface ActionFormulaField {
  field: string;
  input: NumericFormulaInput;
}

export function createDefaultStopwatchSettings(): StopwatchSettings {
  return {
    endMode: "unlimited",
    automaticSeconds: createNumericFormulaInput(10, 1, 600),
    hideDuration: false,
    manualLimitSeconds: createNumericFormulaInput(60, 1, 600),
    earlyContinueWarning: true,
    earlyContinueWarningSeconds: createNumericFormulaInput(10, 1, 600),
  };
}

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

export function cloneActions(
  actions: readonly Action[] | null | undefined,
): Action[] {
  return actions ? actions.map(cloneAction) : [];
}

export function createDefaultAction(
  type: typeof ACTION_TYPES.METRONOME,
  actions: readonly Action[],
  metronomeSettings: MetronomeSettings,
): MetronomeAction;
export function createDefaultAction(
  type: typeof ACTION_TYPES.STOPWATCH,
  actions: readonly Action[],
): StopwatchAction;
export function createDefaultAction(
  type: ActionType,
  actions: readonly Action[],
  metronomeSettings?: MetronomeSettings,
): Action;
export function createDefaultAction(
  type: ActionType,
  actions: readonly Action[] = [],
  metronomeSettings?: MetronomeSettings,
): Action {
  if (!isActionType(type)) {
    throw new Error(`Unknown action type: ${type}`);
  }

  const name = getNextActionName(type, actions);
  const id = createActionId();
  if (type === ACTION_TYPES.METRONOME) {
    if (!metronomeSettings) {
      throw new Error("Default Metronom settings are required.");
    }
    return {
      id,
      type,
      name,
      settings: cloneValue(metronomeSettings),
    };
  }
  if (type === ACTION_TYPES.STOPWATCH) {
    return { id, type, name, settings: createDefaultStopwatchSettings() };
  }
  throw new Error(`Unsupported action type: ${type}`);
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
  if (!isRecord(rawAction.settings)) {
    errors.settings = "Gültige Aktionseinstellungen fehlen.";
  }
  if (
    Object.keys(errors).length > 0 ||
    !isActionType(type) ||
    !isRecord(rawAction.settings)
  ) {
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
        settings: cloneValue(rawAction.settings),
      },
    };
  }

  if (type === ACTION_TYPES.STOPWATCH) {
    return {
      valid: true,
      errors: {},
      value: { id, type, name, settings: cloneValue(rawAction.settings) },
    };
  }
  return { valid: false, errors: { type: "Ungültigen Aktionstyp auswählen." } };
}

export function validateActionDefinitions(
  rawActions: unknown,
  {
    validateMetronomeSettings,
    validateStopwatchSettings,
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

  const actions: Action[] = [];
  const actionIndices: number[] = [];
  const errors: ActionValidationError[] = [];
  const names = new Map<string, string>();
  const ids = new Map<string, string>();
  let hasMetronome = false;

  rawActions.forEach((rawAction, index) => {
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

    const previousId = ids.get(value.id);
    if (previousId !== undefined) {
      errors.push({
        index,
        field: "id",
        message: `Die Aktionsreferenz "${value.id}" ist nicht eindeutig.`,
      });
    } else {
      ids.set(value.id, value.name);
    }

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
      const rawSettings = isRecord(rawAction) && isRecord(rawAction.settings)
        ? rawAction.settings
        : {};
      const validation = validateMetronomeSettings(
        rawSettings,
        index,
        rawActions,
      );
      if (!validation.valid) {
        validation.errors.forEach(({ field, message }) => {
          errors.push({ index, field, message });
        });
        return;
      }
      actions.push({
        id: value.id,
        type: value.type,
        name: value.name,
        settings: validation.settings,
      });
      actionIndices.push(index);
      return;
    }

    if (value.type === ACTION_TYPES.STOPWATCH) {
      if (!validateStopwatchSettings) {
        errors.push({
          index,
          field: "settings",
          message: "Stoppuhr-Einstellungen müssen validiert werden.",
        });
        return;
      }
      const rawSettings = isRecord(rawAction) && isRecord(rawAction.settings)
        ? rawAction.settings
        : {};
      const validation = validateStopwatchSettings(
        rawSettings,
        index,
        rawActions,
      );
      if (!validation.valid) {
        validation.errors.forEach(({ field, message }) => {
          errors.push({ index, field, message });
        });
        return;
      }
      actions.push({
        id: value.id,
        type: value.type,
        name: value.name,
        settings: validation.settings,
      });
      actionIndices.push(index);
      return;
    }

    actions.push(value);
    actionIndices.push(index);
  });

  if (requireMetronome && !hasMetronome) {
    errors.push({
      index: -1,
      field: "actions",
      message: "Mindestens eine Metronom-Aktion hinzufügen.",
    });
  }

  validateFormulaReferences(actions, actionIndices, errors);
  return { valid: errors.length === 0, errors, actions };
}

export function getActionFormulaFields(action: Action): ActionFormulaField[] {
  if (action.type === ACTION_TYPES.METRONOME) {
    const fields: ActionFormulaField[] = [
      { field: "bpm", input: action.settings.bpm },
      { field: "accentRepeat", input: action.settings.accentRepeat },
      { field: "increaseBy", input: action.settings.increaseBy },
      { field: "increaseAfter", input: action.settings.increaseAfter },
      { field: "maximumLimitStick", input: action.settings.maximumLimitStick },
      { field: "maximumLimitReset", input: action.settings.maximumLimitReset },
      { field: "maximumLimitReverse", input: action.settings.maximumLimitReverse },
      { field: "decreaseBy", input: action.settings.decreaseBy },
      { field: "decreaseAfter", input: action.settings.decreaseAfter },
      { field: "sessionEndBeats", input: action.settings.sessionEndBeats },
      { field: "lockBeats", input: action.settings.lockBeats },
    ];
    if (action.settings.breakCount) {
      fields.push({ field: "breakCount", input: action.settings.breakCount });
    }
    if (action.settings.breakSeconds) {
      fields.push({ field: "breakSeconds", input: action.settings.breakSeconds });
    }
    return fields;
  }
  if (action.type === ACTION_TYPES.STOPWATCH) {
    return [
      { field: "automaticSeconds", input: action.settings.automaticSeconds },
      { field: "manualLimitSeconds", input: action.settings.manualLimitSeconds },
      {
        field: "earlyContinueWarningSeconds",
        input: action.settings.earlyContinueWarningSeconds,
      },
    ];
  }
  return [];
}

export function getEnabledCurrentFormulaProperties(
  action: Action,
): string[] {
  if (action.type === ACTION_TYPES.METRONOME) {
    const fields = ["bpm"];
    if (action.settings.accentuate) {
      fields.push("accentRepeat");
    }
    if (action.settings.increaseTempo) {
      fields.push("increaseBy", "increaseAfter");
      if (action.settings.maximum !== "none") {
        fields.push(`maximumLimit${capitalize(action.settings.maximum)}`);
      }
      if (action.settings.maximum === "reverse") {
        fields.push("decreaseBy", "decreaseAfter");
      }
    }
    if (action.settings.breaks === "limited") {
      if (action.settings.breakCount) {
        fields.push("breakCount");
      }
    }
    if (action.settings.sessionEndEnabled) {
      fields.push("sessionEndBeats");
    }
    if (action.settings.lockSettings) {
      fields.push("lockBeats");
    }
    return fields;
  }
  if (action.type === ACTION_TYPES.STOPWATCH) {
    const fields: string[] = [];
    if (action.settings.endMode === "automatic") {
      fields.push("automaticSeconds");
    }
    if (action.settings.endMode === "manual") {
      fields.push("manualLimitSeconds");
    }
    if (
      action.settings.endMode !== "unlimited" &&
      action.settings.earlyContinueWarning
    ) {
      fields.push("earlyContinueWarningSeconds");
    }
    return fields;
  }
  return [];
}

export function serializeActionsPayload(actions: readonly Action[]): string {
  return JSON.stringify(
    actions.map(({ id, type, name, settings }) => ({
      id,
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
        id: action.id,
        type: action.type,
        name: action.name,
        settings: action.settings,
      };
    }),
  };
}

function validateFormulaReferences(
  actions: readonly Action[],
  actionIndices: readonly number[],
  errors: ActionValidationError[],
): void {
  const indexById = new Map<string, { index: number; action: Action }>();
  actions.forEach((action, normalizedIndex) => {
    const inputIndex = actionIndices[normalizedIndex];
    if (inputIndex !== undefined && !indexById.has(action.id)) {
      indexById.set(action.id, { index: inputIndex, action });
    }
  });
  actions.forEach((action, normalizedIndex) => {
    const index = actionIndices[normalizedIndex] ?? normalizedIndex;
    const enabledProperties = new Set(getEnabledCurrentFormulaProperties(action));
    for (const { field, input } of getActionFormulaFields(action)) {
      for (const node of getFormulaNodesFromInput(input)) {
        if (node.type === "reference") {
          validateReferenceNode(
            node,
            action,
            index,
            indexById,
            errors,
            field,
          );
        } else if (node.type === "current") {
          validateCurrentNode(
            node,
            action,
            field,
            enabledProperties,
            errors,
            index,
          );
        }
      }
    }
  });
}

function validateReferenceNode(
  node: FormulaReferenceNode,
  action: Action,
  actionIndex: number,
  indexById: ReadonlyMap<string, { index: number; action: Action }>,
  errors: ActionValidationError[],
  field: string,
): void {
  const source = indexById.get(node.actionId);
  if (source === undefined || source.index >= actionIndex) {
    errors.push({
      index: actionIndex,
      field,
      message: "Formelbezüge müssen auf eine vorherige Aktion zeigen.",
    });
    return;
  }
  if (
    node.metric === "end-bpm" &&
    source.action.type !== ACTION_TYPES.METRONOME
  ) {
    errors.push({
      index: actionIndex,
      field,
      message: "End-BPM kann nur von einer vorherigen Metronom-Aktion bezogen werden.",
    });
  }
}

function validateCurrentNode(
  node: FormulaCurrentNode,
  action: Action,
  field: string,
  enabledProperties: ReadonlySet<string>,
  errors: ActionValidationError[],
  actionIndex: number,
): void {
  if (node.property === "current-bpm") {
    if (
      action.type !== ACTION_TYPES.METRONOME ||
      field !== "breakSeconds" ||
      action.settings.breaks !== "limited"
    ) {
      errors.push({
        index: actionIndex,
        field,
        message: "Aktuelles BPM ist nur in der Pausendauer verfügbar.",
      });
    }
    return;
  }
  if (node.property === field || !enabledProperties.has(node.property)) {
    errors.push({
      index: actionIndex,
      field,
      message: "Aktuell kann nur eine andere aktive Zahleneinstellung verwenden.",
    });
  }
}

function getFormulaNodesFromInput(
  input: NumericFormulaInput,
): FormulaNode[] {
  return [input.expression, input.min, input.max].flatMap((node) =>
    node ? collectFormulaNodes(node) : [],
  );
}

function capitalize(value: string): string {
  return `${value[0]?.toUpperCase() ?? ""}${value.slice(1)}`;
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

function getOptionalId(rawId: unknown, generateId: boolean): string {
  if (typeof rawId === "string" && rawId !== "") {
    return rawId;
  }
  return generateId ? createActionId() : "";
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
