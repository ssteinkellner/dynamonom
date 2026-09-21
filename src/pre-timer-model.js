"use strict";

export const PRE_TIMER_PAYLOAD_VERSION = 1;

export const PRE_TIMER_TYPES = Object.freeze({
  SECONDS: "sekunden",
  STOPWATCH: "stoppuhr",
  MANUAL: "manuell",
});

export const PRE_TIMER_ROUNDING = Object.freeze({
  FLOOR: "floor",
  CEIL: "ceil",
  ROUND: "round",
});

export const PRE_TIMER_TYPE_LABELS = Object.freeze({
  [PRE_TIMER_TYPES.SECONDS]: "Sekunden",
  [PRE_TIMER_TYPES.STOPWATCH]: "Stoppuhr",
  [PRE_TIMER_TYPES.MANUAL]: "Manuell",
});

export const PRE_TIMER_ROUNDING_LABELS = Object.freeze({
  [PRE_TIMER_ROUNDING.FLOOR]: "Abrunden",
  [PRE_TIMER_ROUNDING.CEIL]: "Aufrunden",
  [PRE_TIMER_ROUNDING.ROUND]: "Runden",
});

const FORMULA_PLACEHOLDERS = Object.freeze([
  "summe-minuten",
  "rest-sekunden",
  "minuten",
  "sekunden",
]);

let nextPreTimerId = 1;

export function createPreTimerId() {
  const timestamp = Date.now().toString(36);
  const id = `pre-timer-${timestamp}-${nextPreTimerId}`;
  nextPreTimerId += 1;
  return id;
}

export function getPreTimerTypeLabel(type) {
  return PRE_TIMER_TYPE_LABELS[type] || type;
}

export function getPreTimerRoundingLabel(rounding) {
  return PRE_TIMER_ROUNDING_LABELS[rounding] || rounding;
}

export function getPreTimerDefaultName(type) {
  return getPreTimerTypeLabel(type);
}

export function createDefaultPreTimer(type = PRE_TIMER_TYPES.SECONDS) {
  if (type === PRE_TIMER_TYPES.STOPWATCH) {
    return {
      id: createPreTimerId(),
      type,
      name: getPreTimerDefaultName(type),
      formula: "sekunden",
      rounding: PRE_TIMER_ROUNDING.FLOOR,
      roundingThreshold: null,
    };
  }

  if (type === PRE_TIMER_TYPES.MANUAL) {
    return {
      id: createPreTimerId(),
      type,
      name: getPreTimerDefaultName(type),
      limitSeconds: null,
    };
  }

  return {
    id: createPreTimerId(),
    type: PRE_TIMER_TYPES.SECONDS,
    name: getPreTimerDefaultName(PRE_TIMER_TYPES.SECONDS),
    seconds: 10,
  };
}

export function clonePreTimer(preTimer) {
  if (!preTimer) {
    return preTimer;
  }
  return {
    ...preTimer,
    id: preTimer.id || createPreTimerId(),
  };
}

export function clonePreTimers(preTimers) {
  return Array.isArray(preTimers) ? preTimers.map(clonePreTimer) : [];
}

export function parsePreTimerInteger(rawValue, min, max, allowBlank = false) {
  const raw = String(rawValue ?? "").trim();
  if (allowBlank && raw === "") {
    return null;
  }
  if (!/^\d+$/.test(raw)) {
    return null;
  }

  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    return null;
  }
  return value;
}

export function normalizePreTimerDefinition(rawDefinition, { generateId = true } = {}) {
  if (!rawDefinition || typeof rawDefinition !== "object" || Array.isArray(rawDefinition)) {
    return {
      valid: false,
      errors: { row: "Eine gültige Vorlaufzeit-Definition fehlt." },
    };
  }

  const type = rawDefinition.type;
  const errors = {};
  const name = String(rawDefinition.name ?? "").trim();
  if (!Object.prototype.hasOwnProperty.call(PRE_TIMER_TYPE_LABELS, type)) {
    errors.type = "Ungültigen Vorlaufzeit-Typ auswählen.";
  }
  if (!name) {
    errors.name = "Einen Namen eingeben.";
  }

  let normalized;
  if (type === PRE_TIMER_TYPES.SECONDS) {
    const seconds = parsePreTimerInteger(rawDefinition.seconds, 1, 600);
    if (seconds === null) {
      errors.seconds = "Ganze Sekunden-Zahl von 1 bis 600 eingeben.";
    }
    normalized = {
      id: rawDefinition.id || (generateId ? createPreTimerId() : undefined),
      type,
      name,
      seconds,
    };
  } else if (type === PRE_TIMER_TYPES.STOPWATCH) {
    const formula = String(rawDefinition.formula ?? "").trim();
    const parsedFormula = parsePreTimerFormula(formula);
    if (!formula) {
      errors.formula = "Eine Formel eingeben.";
    } else if (!parsedFormula.valid) {
      errors.formula = parsedFormula.error;
    }

    const rounding = rawDefinition.rounding;
    if (!Object.prototype.hasOwnProperty.call(PRE_TIMER_ROUNDING_LABELS, rounding)) {
      errors.rounding = "Eine gültige Rundungsart auswählen.";
    }

    let roundingThreshold = null;
    const thresholdRaw = String(rawDefinition.roundingThreshold ?? "").trim();
    if (rounding === PRE_TIMER_ROUNDING.ROUND) {
      if (thresholdRaw !== "") {
        roundingThreshold = parsePreTimerInteger(thresholdRaw, 0, 60);
        if (roundingThreshold === null) {
          errors.roundingThreshold = "Ganze Zahl von 0 bis 60 eingeben oder leer lassen.";
        }
      }
    }

    normalized = {
      id: rawDefinition.id || (generateId ? createPreTimerId() : undefined),
      type,
      name,
      formula,
      rounding,
      roundingThreshold,
    };
  } else if (type === PRE_TIMER_TYPES.MANUAL) {
    const limitSeconds = parsePreTimerInteger(rawDefinition.limitSeconds, 1, 600, true);
    if (
      String(rawDefinition.limitSeconds ?? "").trim() !== "" &&
      limitSeconds === null
    ) {
      errors.limitSeconds =
        "Ganze Limit-Sekunden-Zahl von 1 bis 600 eingeben oder leer lassen.";
    }
    normalized = {
      id: rawDefinition.id || (generateId ? createPreTimerId() : undefined),
      type,
      name,
      limitSeconds,
    };
  }

  if (Object.keys(errors).length > 0) {
    return { valid: false, errors, value: normalized };
  }
  return { valid: true, errors: {}, value: normalized };
}

export function validatePreTimerRows(preTimers) {
  if (!Array.isArray(preTimers)) {
    return {
      valid: false,
      errors: [{ index: -1, field: "pre-timers", message: "Vorlaufzeiten müssen eine Liste sein." }],
      rows: [],
    };
  }

  const rows = [];
  const errors = [];
  const names = new Map();

  preTimers.forEach((preTimer, index) => {
    const normalized = normalizePreTimerDefinition(preTimer, { generateId: false });
    if (!normalized.valid) {
      Object.entries(normalized.errors).forEach(([field, message]) => {
        errors.push({ index, field, message });
      });
      return;
    }

    const normalizedName = normalized.value.name.toLocaleLowerCase();
    const previousIndex = names.get(normalizedName);
    if (previousIndex !== undefined) {
      errors.push({
        index,
        field: "name",
        message: `Der Name muss eindeutig sein; "${preTimers[previousIndex].name}" ist bereits vergeben.`,
      });
      return;
    }
    names.set(normalizedName, index);
    rows.push(normalized.value);
  });

  return { valid: errors.length === 0, errors, rows };
}

export function getPreTimerOptionsSummary(preTimer) {
  if (preTimer.type === PRE_TIMER_TYPES.SECONDS) {
    return `${preTimer.seconds} Sekunden`;
  }
  if (preTimer.type === PRE_TIMER_TYPES.STOPWATCH) {
    const rounding = getPreTimerRoundingLabel(preTimer.rounding);
    const threshold =
      preTimer.rounding === PRE_TIMER_ROUNDING.ROUND
        ? ` ab ${preTimer.roundingThreshold ?? 30}s`
        : "";
    return `Formel: ${preTimer.formula}; Rundung: ${rounding}${threshold}`;
  }
  return preTimer.limitSeconds === null
    ? "Ohne Limit"
    : `Limit Sekunden: ${preTimer.limitSeconds}`;
}

export function serializePreTimerPayload(preTimers) {
  const rows = preTimers.map((preTimer) => {
    const compact = {
      t: preTimer.type,
      n: preTimer.name,
    };
    if (preTimer.type === PRE_TIMER_TYPES.SECONDS) {
      compact.s = preTimer.seconds;
    } else if (preTimer.type === PRE_TIMER_TYPES.STOPWATCH) {
      compact.f = preTimer.formula;
      compact.r = preTimer.rounding;
      if (preTimer.rounding === PRE_TIMER_ROUNDING.ROUND && preTimer.roundingThreshold !== null) {
        compact.rt = preTimer.roundingThreshold;
      }
    } else if (preTimer.limitSeconds !== null) {
      compact.l = preTimer.limitSeconds;
    }
    return compact;
  });

  return JSON.stringify({
    v: PRE_TIMER_PAYLOAD_VERSION,
    r: rows,
  });
}

export function deserializePreTimerPayload(rawPayload) {
  let payload;
  try {
    payload = JSON.parse(String(rawPayload));
  } catch {
    return { valid: false, error: "Die Vorlaufzeiten konnten nicht gelesen werden." };
  }

  if (
    !payload ||
    typeof payload !== "object" ||
    Array.isArray(payload) ||
    payload.v !== PRE_TIMER_PAYLOAD_VERSION ||
    !Array.isArray(payload.r)
  ) {
    return { valid: false, error: "Die Version der Vorlaufzeiten ist ungültig." };
  }

  const rawRows = payload.r.map((row) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      return null;
    }
    if (row.t === PRE_TIMER_TYPES.SECONDS) {
      return {
        type: row.t,
        name: row.n,
        seconds: row.s,
      };
    }
    if (row.t === PRE_TIMER_TYPES.STOPWATCH) {
      return {
        type: row.t,
        name: row.n,
        formula: row.f,
        rounding: row.r,
        roundingThreshold: row.rt,
      };
    }
    if (row.t === PRE_TIMER_TYPES.MANUAL) {
      return {
        type: row.t,
        name: row.n,
        limitSeconds: row.l,
      };
    }
    return null;
  });

  if (rawRows.some((row) => row === null)) {
    return { valid: false, error: "Eine Vorlaufzeit enthält ungültige Daten." };
  }

  const validation = validatePreTimerRows(rawRows);
  if (!validation.valid) {
    return {
      valid: false,
      error: validation.errors[0]?.message || "Die Vorlaufzeiten sind ungültig.",
    };
  }

  return {
    valid: true,
    rows: validation.rows.map((row) => ({ ...row, id: createPreTimerId() })),
  };
}

export function getPreTimerFormulaVariables(elapsedSeconds, rounding, roundingThreshold) {
  const totalSeconds = Math.max(0, Math.round(Number(elapsedSeconds)));
  const baseMinutes = Math.floor(totalSeconds / 60);
  const restSeconds = totalSeconds % 60;
  let minutes = baseMinutes;

  if (rounding === PRE_TIMER_ROUNDING.CEIL && restSeconds > 0) {
    minutes += 1;
  } else if (
    rounding === PRE_TIMER_ROUNDING.ROUND &&
    restSeconds > 0 &&
    restSeconds >= (roundingThreshold ?? 30)
  ) {
    minutes += 1;
  }

  const sumMinutes = (minutes * (minutes + 1)) / 2;
  return {
    minuten: minutes,
    "summe-minuten": sumMinutes,
    sekunden: totalSeconds,
    "rest-sekunden": restSeconds,
  };
}

export function parsePreTimerFormula(formula) {
  const tokensResult = tokenizeFormula(String(formula ?? ""));
  if (!tokensResult.valid) {
    return tokensResult;
  }

  let position = 0;

  const parseExpression = () => {
    const leftResult = parseTerm();
    if (!leftResult.valid) {
      return leftResult;
    }

    let node = leftResult.node;
    while (
      position < tokensResult.tokens.length &&
      (tokensResult.tokens[position].type === "operator" &&
        (tokensResult.tokens[position].value === "+" ||
          tokensResult.tokens[position].value === "-"))
    ) {
      const operator = tokensResult.tokens[position].value;
      position += 1;
      const rightResult = parseTerm();
      if (!rightResult.valid) {
        return rightResult;
      }
      node = {
        type: "binary",
        operator,
        left: node,
        right: rightResult.node,
      };
    }
    return { valid: true, node };
  };

  const parseTerm = () => {
    const leftResult = parseFactor();
    if (!leftResult.valid) {
      return leftResult;
    }

    let node = leftResult.node;
    while (
      position < tokensResult.tokens.length &&
      tokensResult.tokens[position].type === "operator" &&
      (tokensResult.tokens[position].value === "*" ||
        tokensResult.tokens[position].value === "/")
    ) {
      const operator = tokensResult.tokens[position].value;
      position += 1;
      const rightResult = parseFactor();
      if (!rightResult.valid) {
        return rightResult;
      }
      node = {
        type: "binary",
        operator,
        left: node,
        right: rightResult.node,
      };
    }
    return { valid: true, node };
  };

  const parseFactor = () => {
    if (position >= tokensResult.tokens.length) {
      return { valid: false, error: "Die Formel ist unvollständig." };
    }

    const token = tokensResult.tokens[position];
    if (
      token.type === "operator" &&
      (token.value === "+" || token.value === "-")
    ) {
      position += 1;
      const result = parseFactor();
      if (!result.valid) {
        return result;
      }
      return {
        valid: true,
        node: {
          type: "unary",
          operator: token.value,
          child: result.node,
        },
      };
    }

    if (token.type === "number" || token.type === "placeholder") {
      position += 1;
      return { valid: true, node: token };
    }

    if (token.type === "open") {
      position += 1;
      const result = parseExpression();
      if (!result.valid) {
        return result;
      }
      if (
        position >= tokensResult.tokens.length ||
        tokensResult.tokens[position].type !== "close"
      ) {
        return { valid: false, error: "Eine schließende Klammer fehlt." };
      }
      position += 1;
      return result;
    }

    return { valid: false, error: "Einen gültigen Formelbestandteil eingeben." };
  };

  const parsed = parseExpression();
  if (!parsed.valid) {
    return parsed;
  }
  if (position !== tokensResult.tokens.length) {
    return { valid: false, error: "Die Formel enthält ein ungültiges Zeichen." };
  }
  return { valid: true, ast: parsed.node };
}

export function evaluatePreTimerFormula(formula, variables) {
  const parsed = parsePreTimerFormula(formula);
  if (!parsed.valid) {
    return { valid: false, error: parsed.error };
  }

  const evaluated = evaluateFormulaNode(parsed.ast, variables);
  if (!Number.isFinite(evaluated.value)) {
    return {
      valid: false,
      error: "Das Ergebnis ist nicht endlich.",
      substitution: formatFormulaNode(parsed.ast, variables),
    };
  }
  if (!Number.isSafeInteger(evaluated.value) || evaluated.value < 1) {
    return {
      valid: false,
      error: "Das Ergebnis muss eine positive ganze Zahl sein.",
      substitution: formatFormulaNode(parsed.ast, variables),
    };
  }

  return {
    valid: true,
    result: evaluated.value,
    substitution: formatFormulaNode(parsed.ast, variables),
  };
}

export function formatPreTimerDuration(seconds) {
  const totalSeconds = Math.max(0, Math.round(Number(seconds) || 0));
  const minutes = Math.floor(totalSeconds / 60);
  const remainder = totalSeconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function tokenizeFormula(formula) {
  const tokens = [];
  let position = 0;
  const source = formula.trim();

  while (position < source.length) {
    const character = source[position];
    if (/\s/.test(character)) {
      position += 1;
      continue;
    }

    const remaining = source.slice(position).toLocaleLowerCase();
    const placeholder = FORMULA_PLACEHOLDERS.find(
      (candidate) =>
        remaining.startsWith(candidate) &&
        !isFormulaIdentifierCharacter(source[position + candidate.length]),
    );
    if (placeholder) {
      tokens.push({ type: "placeholder", value: placeholder });
      position += placeholder.length;
      continue;
    }

    if (/\d/.test(character)) {
      const start = position;
      while (position < source.length && /\d/.test(source[position])) {
        position += 1;
      }
      tokens.push({
        type: "number",
        value: Number(source.slice(start, position)),
      });
      continue;
    }

    if ("+-*/".includes(character)) {
      tokens.push({ type: "operator", value: character });
      position += 1;
      continue;
    }
    if (character === "(") {
      tokens.push({ type: "open", value: character });
      position += 1;
      continue;
    }
    if (character === ")") {
      tokens.push({ type: "close", value: character });
      position += 1;
      continue;
    }

    return {
      valid: false,
      error: `Ungültiges Zeichen "${character}" in der Formel.`,
    };
  }

  if (tokens.length === 0) {
    return { valid: false, error: "Eine Formel eingeben." };
  }
  return { valid: true, tokens };
}

function isFormulaIdentifierCharacter(character) {
  return Boolean(character && /[a-z\d_-]/i.test(character));
}

function evaluateFormulaNode(node, variables) {
  if (node.type === "number") {
    return { value: node.value };
  }
  if (node.type === "placeholder") {
    return { value: Number(variables[node.value]) };
  }
  if (node.type === "unary") {
    const child = evaluateFormulaNode(node.child, variables).value;
    return { value: node.operator === "-" ? -child : child };
  }

  const left = evaluateFormulaNode(node.left, variables).value;
  const right = evaluateFormulaNode(node.right, variables).value;
  if (node.operator === "+") {
    return { value: left + right };
  }
  if (node.operator === "-") {
    return { value: left - right };
  }
  if (node.operator === "*") {
    return { value: left * right };
  }
  return { value: left / right };
}

function formatFormulaNode(node, variables, parentPrecedence = 0, rightChild = false) {
  if (node.type === "number") {
    return String(node.value);
  }
  if (node.type === "placeholder") {
    if (node.value === "summe-minuten") {
      return formatMinuteSeries(variables.minuten);
    }
    return String(variables[node.value]);
  }
  if (node.type === "unary") {
    const child = formatFormulaNode(node.child, variables, 3);
    return `${node.operator}${child}`;
  }

  const precedence = node.operator === "+" || node.operator === "-" ? 1 : 2;
  const left = formatFormulaNode(node.left, variables, precedence);
  const right = formatFormulaNode(
    node.right,
    variables,
    precedence,
    true,
  );
  let formatted = `${left}${node.operator}${right}`;
  if (
    precedence < parentPrecedence ||
    (rightChild &&
      precedence === parentPrecedence &&
      (node.operator === "-" || node.operator === "/"))
  ) {
    formatted = `(${formatted})`;
  }
  return formatted;
}

function formatMinuteSeries(minutes) {
  if (!Number.isSafeInteger(minutes) || minutes <= 0) {
    return "0";
  }
  const values = [];
  for (let value = 1; value <= minutes; value += 1) {
    values.push(String(value));
  }
  return `(${values.join("+")})`;
}
