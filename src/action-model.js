import {
  PRE_TIMER_TYPES,
  createDefaultPreTimer,
  normalizePreTimerDefinition,
} from "./pre-timer-model.js";

export const ACTION_TYPES = Object.freeze({
  METRONOME: "metronom",
  SECONDS: PRE_TIMER_TYPES.SECONDS,
  STOPWATCH: PRE_TIMER_TYPES.STOPWATCH,
  MANUAL: PRE_TIMER_TYPES.MANUAL,
});

export const ACTION_TYPE_LABELS = Object.freeze({
  [ACTION_TYPES.METRONOME]: "Metronom",
  [ACTION_TYPES.SECONDS]: "Sekunden",
  [ACTION_TYPES.STOPWATCH]: "Stoppuhr",
  [ACTION_TYPES.MANUAL]: "Manuell",
});

export const ACTIONS_VERSION = 1;

let nextActionId = 1;

export function createActionId() {
  const timestamp = Date.now().toString(36);
  const id = `action-${timestamp}-${nextActionId}`;
  nextActionId += 1;
  return id;
}

export function getActionTypeLabel(type) {
  return ACTION_TYPE_LABELS[type] || type;
}

export function cloneAction(action) {
  if (!action) {
    return action;
  }
  return {
    ...action,
    settings: cloneValue(action.settings),
  };
}

export function cloneActions(actions) {
  return Array.isArray(actions) ? actions.map(cloneAction) : [];
}

export function createDefaultAction(type, actions, metronomeSettings) {
  if (!Object.prototype.hasOwnProperty.call(ACTION_TYPE_LABELS, type)) {
    throw new Error(`Unknown action type: ${type}`);
  }

  const name = getNextActionName(type, actions);
  if (type === ACTION_TYPES.METRONOME) {
    if (!metronomeSettings || typeof metronomeSettings !== "object") {
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
  const settings = {};
  if (type === ACTION_TYPES.SECONDS) {
    settings.seconds = timer.seconds;
  } else if (type === ACTION_TYPES.STOPWATCH) {
    settings.formula = timer.formula;
    settings.rounding = timer.rounding;
    settings.roundingThreshold = timer.roundingThreshold;
    settings.min = timer.min;
    settings.max = timer.max;
  } else {
    settings.limitSeconds = timer.limitSeconds;
  }

  return {
    id: createActionId(),
    type,
    name,
    settings,
  };
}

export function normalizeActionDefinition(
  rawAction,
  { generateId = true } = {},
) {
  if (!rawAction || typeof rawAction !== "object" || Array.isArray(rawAction)) {
    return {
      valid: false,
      errors: { action: "Eine gültige Aktion fehlt." },
    };
  }

  const type = rawAction.type;
  const errors = {};
  const name = typeof rawAction.name === "string" ? rawAction.name.trim() : "";
  if (!Object.prototype.hasOwnProperty.call(ACTION_TYPE_LABELS, type)) {
    errors.type = "Ungültigen Aktionstyp auswählen.";
  }
  if (typeof rawAction.name !== "string" || !name) {
    errors.name = "Einen Namen eingeben.";
  }

  const rawSettings = rawAction.settings;
  if (!rawSettings || typeof rawSettings !== "object" || Array.isArray(rawSettings)) {
    errors.settings = "Gültige Aktionseinstellungen fehlen.";
  }

  if (Object.keys(errors).length > 0) {
    return { valid: false, errors };
  }

  if (type === ACTION_TYPES.METRONOME) {
    return {
      valid: true,
      errors: {},
      value: {
        id: rawAction.id || (generateId ? createActionId() : undefined),
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

  const settings = {};
  if (type === ACTION_TYPES.SECONDS) {
    settings.seconds = normalized.value.seconds;
  } else if (type === ACTION_TYPES.STOPWATCH) {
    settings.formula = normalized.value.formula;
    settings.rounding = normalized.value.rounding;
    settings.roundingThreshold = normalized.value.roundingThreshold;
    settings.min = normalized.value.min;
    settings.max = normalized.value.max;
  } else {
    settings.limitSeconds = normalized.value.limitSeconds;
  }

  return {
    valid: true,
    errors: {},
    value: {
      id: rawAction.id || (generateId ? createActionId() : undefined),
      type,
      name,
      settings,
    },
  };
}

export function validateActionDefinitions(
  rawActions,
  { validateMetronomeSettings, requireMetronome = false } = {},
) {
  if (!Array.isArray(rawActions)) {
    return {
      valid: false,
      errors: [{ index: -1, field: "actions", message: "Aktionen müssen eine Liste sein." }],
      actions: [],
    };
  }

  const actions = [];
  const errors = [];
  const names = new Map();

  rawActions.forEach((rawAction, index) => {
    const normalized = normalizeActionDefinition(rawAction);
    if (!normalized.valid) {
      Object.entries(normalized.errors).forEach(([field, message]) => {
        errors.push({ index, field, message });
      });
      return;
    }

    const normalizedName = normalized.value.name.toLowerCase();
    const previousIndex = names.get(normalizedName);
    if (previousIndex !== undefined) {
      const previousName = rawActions[previousIndex]?.name || "unbekannt";
      errors.push({
        index,
        field: "name",
        message: `Der Name muss eindeutig sein; "${previousName}" ist bereits vergeben.`,
      });
    } else {
      names.set(normalizedName, index);
    }

    if (normalized.value.type === ACTION_TYPES.METRONOME) {
      const validation = validateMetronomeSettings?.(
        normalized.value.settings,
        index,
        rawActions,
      );
      if (validation && !validation.valid) {
        validation.errors.forEach(({ field, message }) => {
          errors.push({ index, field, message });
        });
        actions.push(normalized.value);
        return;
      }
      if (validation?.settings) {
        normalized.value.settings = validation.settings;
      }
    }

    actions.push(normalized.value);
  });

  if (requireMetronome && !actions.some((action) => action.type === ACTION_TYPES.METRONOME)) {
    errors.push({
      index: -1,
      field: "actions",
      message: "Mindestens eine Metronom-Aktion hinzufügen.",
    });
  }

  return { valid: errors.length === 0, errors, actions };
}

export function serializeActionsPayload(actions) {
  return JSON.stringify(
    actions.map(({ type, name, settings }) => ({
      type,
      name,
      settings: cloneValue(settings),
    })),
  );
}

export function parseActionsPayload(rawPayload) {
  let actions;
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
    actions: actions.map((action) => {
      if (!action || typeof action !== "object" || Array.isArray(action)) {
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

function getNextActionName(type, actions = []) {
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

function cloneValue(value) {
  if (Array.isArray(value)) {
    return value.map(cloneValue);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, cloneValue(nested)]),
    );
  }
  return value;
}
