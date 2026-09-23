import {
  ACTIONS_VERSION,
  parseActionsPayload,
  serializeActionsPayload,
  validateActionDefinitions,
} from "../action-model.ts";
import type {
  Action,
  ActionValidationError,
} from "../action-model.ts";
import { validateMetronomeActionSettings } from "./metronome-settings.ts";

const REQUIRED_PARAMETERS = ["version", "auto-start", "actions"] as const;
const OPTIONAL_PARAMETERS = ["hide-progress"] as const;
const ALLOWED_PARAMETERS = new Set<string>([
  ...REQUIRED_PARAMETERS,
  ...OPTIONAL_PARAMETERS,
]);

const ACTION_FIELD_LABELS: Readonly<Record<string, string>> = Object.freeze({
  actions: "Aktionen",
  action: "Aktion",
  type: "Aktionstyp",
  name: "Name",
  settings: "Einstellungen",
  seconds: "Dauer in Sekunden",
  formula: "Formel",
  rounding: "Rundung",
  roundingThreshold: "Rundungsschwelle",
  min: "Min",
  max: "Max",
  limitSeconds: "Limit Sekunden",
  bpm: "BPM",
  accentuate: "Betonung",
  accentRepeat: "Betonungsintervall",
  increaseTempo: "Tempo steigern",
  increaseBy: "Steigerung",
  increaseAfter: "Steigerungsintervall",
  maximum: "Maximum",
  maximumLimitStick: "Maximaltempo",
  maximumLimitReset: "Maximaltempo",
  maximumLimitReverse: "Maximaltempo",
  decreaseBy: "Verringerung",
  decreaseAfter: "Verringerungsintervall",
  breaks: "Pausen",
  breakCount: "Pausenanzahl",
  breakSeconds: "Pausendauer",
  sessionEndEnabled: "Session-Ende",
  sessionEndBeats: "Session-Ende Beats",
  lockSettings: "Einstellungssperre",
  lockBeats: "Sperre Beats",
});

export interface SettingsImportIssue {
  fieldLabel: string;
  message: string;
  actionIndex?: number;
  actionName?: string;
}

export type SettingsImportParseResult =
  | {
      valid: true;
      autoStart: boolean;
      hideProgress: boolean;
      actions: unknown[];
    }
  | { valid: false; errors: SettingsImportIssue[] };

export interface ImportedActionsValidation {
  valid: boolean;
  errors: ActionValidationError[];
  actions: Action[];
  actionsToInstall: Action[] | null;
}

export function parseSettingsImport(
  rawText: string,
  baseUrl = "http://localhost/",
): SettingsImportParseResult {
  const input = rawText.trim();
  const query = extractQuery(input, baseUrl);
  if (!query.valid) {
    return createParseFailure(query.error);
  }

  const parameters = new URLSearchParams(query.value);
  const parseErrors: string[] = [];
  const unknownParameters = Array.from(
    new Set(
      Array.from(parameters.keys()).filter(
        (parameter) => !ALLOWED_PARAMETERS.has(parameter),
      ),
    ),
  );
  if (unknownParameters.length > 0) {
    parseErrors.push(`Unbekannte Parameter: ${unknownParameters.join(", ")}.`);
  }

  for (const name of REQUIRED_PARAMETERS) {
    const count = parameters.getAll(name).length;
    if (count === 0) {
      parseErrors.push(`Der Parameter "${name}" fehlt.`);
    } else if (count !== 1) {
      parseErrors.push(`Der Parameter "${name}" darf nur einmal vorkommen.`);
    }
  }
  const hideProgressValues = parameters.getAll("hide-progress");
  if (hideProgressValues.length > 1) {
    parseErrors.push('Der Parameter "hide-progress" darf nur einmal vorkommen.');
  }

  const version = parameters.getAll("version");
  if (version.length === 1 && version[0] !== String(ACTIONS_VERSION)) {
    parseErrors.push(`Die Importversion "${version[0]}" wird nicht unterstützt.`);
  }

  const autoStartValue = parameters.getAll("auto-start");
  const autoStart =
    autoStartValue.length === 1
      ? parseBoolean(autoStartValue[0])
      : null;
  if (autoStartValue.length === 1 && autoStart === null) {
    parseErrors.push('Der Parameter "auto-start" muss true, false, 1 oder 0 sein.');
  }

  const hideProgress =
    hideProgressValues.length === 0
      ? false
      : parseBoolean(hideProgressValues[0]);
  if (hideProgressValues.length === 1 && hideProgress === null) {
    parseErrors.push('Der Parameter "hide-progress" muss true, false, 1 oder 0 sein.');
  }

  let actions: unknown[] | null = null;
  const actionValues = parameters.getAll("actions");
  if (actionValues.length === 1) {
    const parsedActions = parseActionsPayload(actionValues[0]);
    if (parsedActions.valid) {
      actions = parsedActions.actions;
    } else {
      parseErrors.push(parsedActions.error);
    }
  }

  if (parseErrors.length > 0 || autoStart === null || hideProgress === null || !actions) {
    return createParseFailure(parseErrors.join(" "));
  }

  return {
    valid: true,
    autoStart,
    hideProgress,
    actions,
  };
}

export function validateImportedActions(
  rawActions: unknown[],
): ImportedActionsValidation {
  const validation = validateActionDefinitions(rawActions, {
    validateMetronomeSettings: validateMetronomeActionSettings,
    requireMetronome: true,
  });
  const indexedErrors = validation.errors.filter((error) => error.index >= 0);

  return {
    valid: validation.valid,
    errors: validation.errors,
    actions: validation.actions,
    actionsToInstall: indexedErrors.length === 0 ? validation.actions : null,
  };
}

export function getSettingsImportIssues(
  errors: readonly ActionValidationError[],
  rawActions: unknown[],
): SettingsImportIssue[] {
  return errors.map((error) => {
    if (error.index < 0) {
      return {
        fieldLabel: ACTION_FIELD_LABELS[error.field] ?? "Aktionen",
        message: error.message,
      };
    }

    const rawAction = rawActions[error.index];
    const actionName =
      isRecord(rawAction) && typeof rawAction.name === "string"
        ? rawAction.name
        : undefined;
    return {
      fieldLabel: ACTION_FIELD_LABELS[error.field] ?? error.field,
      message: error.message,
      actionIndex: error.index + 1,
      actionName,
    };
  });
}

export function serializeSettings(
  actions: readonly Action[],
  autoStart: boolean,
  hideProgress: boolean,
): string {
  const parameters = new URLSearchParams();
  parameters.set("version", String(ACTIONS_VERSION));
  parameters.set("auto-start", String(autoStart));
  if (hideProgress) {
    parameters.set("hide-progress", "true");
  }
  parameters.set("actions", serializeActionsPayload(actions));
  return parameters.toString();
}

export function serializeSettingsUrl(
  currentUrl: string,
  serializedSettings: string,
): string {
  const url = new URL(currentUrl);
  url.search = serializedSettings;
  return url.toString();
}

function extractQuery(
  input: string,
  baseUrl: string,
): { valid: true; value: string } | { valid: false; error: string } {
  if (input.startsWith("?")) {
    return { valid: true, value: input.slice(1) };
  }

  const questionMark = input.indexOf("?");
  const firstEquals = input.indexOf("=");
  const isUrl =
    /^[a-z][a-z\d+.-]*:/i.test(input) ||
    input.startsWith("/") ||
    input.startsWith("./") ||
    input.startsWith("../") ||
    (questionMark > 0 && (firstEquals < 0 || questionMark < firstEquals));
  if (!isUrl) {
    return { valid: true, value: input };
  }

  try {
    const url = new URL(input, baseUrl);
    return { valid: true, value: url.search.slice(1) };
  } catch {
    return { valid: false, error: "Die URL konnte nicht gelesen werden." };
  }
}

function parseBoolean(value: string | undefined): boolean | null {
  if (value === undefined) {
    return null;
  }
  const normalized = value.toLowerCase();
  if (normalized === "true" || normalized === "1") {
    return true;
  }
  if (normalized === "false" || normalized === "0") {
    return false;
  }
  return null;
}

function createParseFailure(message: string): SettingsImportParseResult {
  return {
    valid: false,
    errors: [{ fieldLabel: "Import", message: message || "Importdaten fehlen." }],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
