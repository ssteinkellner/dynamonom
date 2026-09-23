"use strict";

export const PRE_TIMER_TYPES = Object.freeze({
  SECONDS: "sekunden",
  STOPWATCH: "stoppuhr",
  MANUAL: "manuell",
} as const);

export type PreTimerType = typeof PRE_TIMER_TYPES[keyof typeof PRE_TIMER_TYPES];

export const PRE_TIMER_ROUNDING = Object.freeze({
  FLOOR: "floor",
  CEIL: "ceil",
  ROUND: "round",
} as const);

export type PreTimerRounding =
  typeof PRE_TIMER_ROUNDING[keyof typeof PRE_TIMER_ROUNDING];

export const PRE_TIMER_TYPE_LABELS = Object.freeze({
  [PRE_TIMER_TYPES.SECONDS]: "Sekunden",
  [PRE_TIMER_TYPES.STOPWATCH]: "Stoppuhr",
  [PRE_TIMER_TYPES.MANUAL]: "Manuell",
} satisfies Record<PreTimerType, string>);

export const PRE_TIMER_ROUNDING_LABELS = Object.freeze({
  [PRE_TIMER_ROUNDING.FLOOR]: "Abrunden",
  [PRE_TIMER_ROUNDING.CEIL]: "Aufrunden",
  [PRE_TIMER_ROUNDING.ROUND]: "Runden",
} satisfies Record<PreTimerRounding, string>);

const FORMULA_PLACEHOLDERS = Object.freeze([
  "summe-minuten",
  "rest-sekunden",
  "minuten",
  "sekunden",
] as const);

export type FormulaPlaceholder = typeof FORMULA_PLACEHOLDERS[number];

export interface PreTimerFormulaVariables {
  minuten: number;
  "summe-minuten": number;
  sekunden: number;
  "rest-sekunden": number;
}

export type SecondsPreTimer = {
  id?: string;
  type: typeof PRE_TIMER_TYPES.SECONDS;
  name: string;
  seconds: number;
};

export type StopwatchPreTimer = {
  id?: string;
  type: typeof PRE_TIMER_TYPES.STOPWATCH;
  name: string;
  formula: string;
  rounding: PreTimerRounding;
  roundingThreshold: number | null;
  min: number;
  max: number | null;
};

export type ManualPreTimer = {
  id?: string;
  type: typeof PRE_TIMER_TYPES.MANUAL;
  name: string;
  limitSeconds: number | null;
};

export type PreTimerDefinition =
  | SecondsPreTimer
  | StopwatchPreTimer
  | ManualPreTimer;

export type PreTimerDefinitionDraft =
  | {
      id?: string;
      type: typeof PRE_TIMER_TYPES.SECONDS;
      name: string;
      seconds: number | null;
    }
  | {
      id?: string;
      type: typeof PRE_TIMER_TYPES.STOPWATCH;
      name: string;
      formula: string;
      rounding: string;
      roundingThreshold: number | null;
      min: number;
      max: number | null;
    }
  | {
      id?: string;
      type: typeof PRE_TIMER_TYPES.MANUAL;
      name: string;
      limitSeconds: number | null;
    };

type FormulaOperator = "+" | "-" | "*" | "/";

type FormulaToken =
  | { type: "number"; value: number }
  | { type: "placeholder"; value: FormulaPlaceholder }
  | { type: "operator"; value: FormulaOperator }
  | { type: "open"; value: "(" }
  | { type: "close"; value: ")" };

type FormulaNode =
  | { type: "number"; value: number }
  | { type: "placeholder"; value: FormulaPlaceholder }
  | { type: "unary"; operator: "+" | "-"; child: FormulaNode }
  | {
      type: "binary";
      operator: FormulaOperator;
      left: FormulaNode;
      right: FormulaNode;
    };

type FormulaNodeParseResult =
  | { valid: true; node: FormulaNode }
  | { valid: false; error: string };

type FormulaParseResult =
  | { valid: true; ast: FormulaNode }
  | { valid: false; error: string };

type TokenizeFormulaResult =
  | { valid: true; tokens: FormulaToken[] }
  | { valid: false; error: string };

export type PreTimerNormalizationResult =
  | { valid: true; errors: Record<string, never>; value: PreTimerDefinition }
  | {
      valid: false;
      errors: Record<string, string>;
      value?: PreTimerDefinitionDraft;
    };

export type FormulaEvaluationResult =
  | { valid: true; result: number; substitution: string }
  | { valid: false; error: string; substitution?: string };

let nextPreTimerId = 1;

export function createPreTimerId(): string {
  const timestamp = Date.now().toString(36);
  const id = `pre-timer-${timestamp}-${nextPreTimerId}`;
  nextPreTimerId += 1;
  return id;
}

export function getPreTimerTypeLabel(type: string): string {
  return isPreTimerType(type) ? PRE_TIMER_TYPE_LABELS[type] : type;
}

export function getPreTimerRoundingLabel(rounding: string): string {
  return isPreTimerRounding(rounding)
    ? PRE_TIMER_ROUNDING_LABELS[rounding]
    : rounding;
}

export function getPreTimerDefaultName(type: PreTimerType): string {
  return getPreTimerTypeLabel(type);
}

export function createDefaultPreTimer(
  type: PreTimerType = PRE_TIMER_TYPES.SECONDS,
): PreTimerDefinition {
  if (type === PRE_TIMER_TYPES.STOPWATCH) {
    return {
      id: createPreTimerId(),
      type,
      name: getPreTimerDefaultName(type),
      formula: "sekunden",
      rounding: PRE_TIMER_ROUNDING.FLOOR,
      roundingThreshold: null,
      min: 10,
      max: null,
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

export function parsePreTimerInteger(
  rawValue: unknown,
  min: number,
  max: number,
  allowBlank = false,
): number | null {
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

export function normalizePreTimerDefinition(
  rawDefinition: unknown,
  { generateId = true }: { generateId?: boolean } = {},
): PreTimerNormalizationResult {
  if (!isRecord(rawDefinition)) {
    return {
      valid: false,
      errors: { row: "Eine gültige Aktionsdefinition fehlt." },
    };
  }

  const type = rawDefinition.type;
  const errors: Record<string, string> = {};
  const name = String(rawDefinition.name ?? "").trim();
  if (!isPreTimerType(type)) {
    errors.type = "Ungültigen Aktionstyp auswählen.";
  }
  if (!name) {
    errors.name = "Einen Namen eingeben.";
  }

  if (type === PRE_TIMER_TYPES.SECONDS) {
    const seconds = parsePreTimerInteger(rawDefinition.seconds, 1, 600);
    if (seconds === null) {
      errors.seconds = "Ganze Sekunden-Zahl von 1 bis 600 eingeben.";
    }
    const value: PreTimerDefinitionDraft = {
      id: getDefinitionId(rawDefinition.id, generateId),
      type,
      name,
      seconds,
    };
    if (seconds === null || Object.keys(errors).length > 0) {
      return { valid: false, errors, value };
    }
    return {
      valid: true,
      errors: {},
      value: {
        id: value.id,
        type: PRE_TIMER_TYPES.SECONDS,
        name,
        seconds,
      },
    };
  } else if (type === PRE_TIMER_TYPES.STOPWATCH) {
    const formula = String(rawDefinition.formula ?? "").trim();
    const parsedFormula = parsePreTimerFormula(formula);
    if (!formula) {
      errors.formula = "Eine Formel eingeben.";
    } else if (!parsedFormula.valid) {
      errors.formula = parsedFormula.error;
    }
    if (
      isStaticPreTimerFormula(formula) &&
      (!Number.isSafeInteger(Number(formula)) || Number(formula) < 1)
    ) {
      errors.formula = "Eine positive sichere ganze Zahl eingeben.";
    }

    const roundingValue = rawDefinition.rounding;
    const validRounding = isPreTimerRounding(roundingValue);
    if (!validRounding) {
      errors.rounding = "Eine gültige Rundungsart auswählen.";
    }
    const rounding = validRounding ? roundingValue : String(roundingValue ?? "");

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

    const staticFormula = isStaticPreTimerFormula(formula);
    const minimumRaw = String(rawDefinition.min ?? "10").trim();
    const minimum = parsePreTimerInteger(
      minimumRaw,
      1,
      Number.MAX_SAFE_INTEGER,
    );
    const maximumRaw = String(rawDefinition.max ?? "").trim();
    const maximum =
      maximumRaw === ""
        ? null
        : parsePreTimerInteger(maximumRaw, 1, Number.MAX_SAFE_INTEGER);
    if (!staticFormula) {
      if (minimum === null) {
        errors.min = "Eine positive ganze Mindestzahl eingeben.";
      }
      if (maximumRaw !== "" && maximum === null) {
        errors.max = "Eine positive ganze Höchstzahl eingeben oder leer lassen.";
      } else if (
        maximum !== null &&
        minimum !== null &&
        maximum < minimum
      ) {
        errors.max = "Die Höchstzahl darf nicht kleiner als die Mindestzahl sein.";
      }
    }

    const value: PreTimerDefinitionDraft = {
      id: getDefinitionId(rawDefinition.id, generateId),
      type,
      name,
      formula,
      rounding,
      roundingThreshold,
      min: minimum ?? 10,
      max: maximum,
    };
    if (
      Object.keys(errors).length > 0 ||
      !validRounding ||
      (maximumRaw !== "" && maximum === null)
    ) {
      return { valid: false, errors, value };
    }
    return {
      valid: true,
      errors: {},
      value: {
        id: value.id,
        type: PRE_TIMER_TYPES.STOPWATCH,
        name,
        formula,
        rounding: roundingValue,
        roundingThreshold,
        min: minimum ?? 10,
        max: maximum,
      },
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
    const value: PreTimerDefinitionDraft = {
      id: getDefinitionId(rawDefinition.id, generateId),
      type,
      name,
      limitSeconds,
    };
    if (Object.keys(errors).length > 0) {
      return { valid: false, errors, value };
    }
    return {
      valid: true,
      errors: {},
      value: {
        id: value.id,
        type: PRE_TIMER_TYPES.MANUAL,
        name,
        limitSeconds,
      },
    };
  }

  return {
    valid: false,
    errors: { ...errors, type: errors.type || "Ungültigen Aktionstyp auswählen." },
  };
}

export function getPreTimerOptionsSummary(
  preTimer: PreTimerDefinitionDraft | PreTimerDefinition,
): string {
  if (preTimer.type === PRE_TIMER_TYPES.SECONDS) {
    return `${preTimer.seconds} Sekunden`;
  }
  if (preTimer.type === PRE_TIMER_TYPES.STOPWATCH) {
    const rounding = getPreTimerRoundingLabel(preTimer.rounding);
    const threshold =
      preTimer.rounding === PRE_TIMER_ROUNDING.ROUND
        ? ` ab ${preTimer.roundingThreshold ?? 30}s`
        : "";
    const bounds = isStaticPreTimerFormula(preTimer.formula)
      ? ""
      : `; Min: ${preTimer.min}; Max: ${preTimer.max ?? "unbegrenzt"}`;
    return `Formel: ${preTimer.formula}; Rundung: ${rounding}${threshold}${bounds}`;
  }
  return preTimer.limitSeconds === null
    ? "Ohne Limit"
    : `Limit Sekunden: ${preTimer.limitSeconds}`;
}

export function getPreTimerFormulaVariables(
  elapsedSeconds: number,
  rounding: PreTimerRounding,
  roundingThreshold: number | null,
): PreTimerFormulaVariables {
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

export function parsePreTimerFormula(formula: string): FormulaParseResult {
  const tokensResult = tokenizeFormula(String(formula ?? ""));
  if (!tokensResult.valid) {
    return tokensResult;
  }

  let position = 0;

  const parseExpression = (): FormulaNodeParseResult => {
    const leftResult = parseTerm();
    if (!leftResult.valid) {
      return leftResult;
    }

    let node = leftResult.node;
    while (true) {
      const token = tokensResult.tokens[position];
      if (
        token?.type !== "operator" ||
        (token.value !== "+" && token.value !== "-")
      ) {
        break;
      }
      const operator = token.value;
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

  const parseTerm = (): FormulaNodeParseResult => {
    const leftResult = parseFactor();
    if (!leftResult.valid) {
      return leftResult;
    }

    let node = leftResult.node;
    while (true) {
      const token = tokensResult.tokens[position];
      if (
        token?.type !== "operator" ||
        (token.value !== "*" && token.value !== "/")
      ) {
        break;
      }
      const operator = token.value;
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

  const parseFactor = (): FormulaNodeParseResult => {
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

export function isStaticPreTimerFormula(formula: unknown): boolean {
  return /^\d+$/.test(String(formula ?? "").trim());
}

export function evaluatePreTimerFormula(
  formula: string,
  variables: PreTimerFormulaVariables,
): FormulaEvaluationResult {
  const parsed = parsePreTimerFormula(formula);
  if (!parsed.valid) {
    return { valid: false, error: parsed.error };
  }

  const evaluated = evaluateFormulaNode(parsed.ast, variables);
  if (!Number.isFinite(evaluated)) {
    return {
      valid: false,
      error: "Das Ergebnis ist nicht endlich.",
      substitution: formatFormulaNode(parsed.ast, variables),
    };
  }
  if (!Number.isSafeInteger(evaluated) || evaluated < 1) {
    return {
      valid: false,
      error: "Das Ergebnis muss eine positive ganze Zahl sein.",
      substitution: formatFormulaNode(parsed.ast, variables),
    };
  }

  return {
    valid: true,
    result: evaluated,
    substitution: formatFormulaNode(parsed.ast, variables),
  };
}

export function formatPreTimerDuration(seconds: number): string {
  const totalSeconds = Math.max(0, Math.round(Number(seconds) || 0));
  const minutes = Math.floor(totalSeconds / 60);
  const remainder = totalSeconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function tokenizeFormula(formula: string): TokenizeFormulaResult {
  const tokens: FormulaToken[] = [];
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

    if (isFormulaOperator(character)) {
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

function isFormulaIdentifierCharacter(character: string | undefined): boolean {
  return Boolean(character && /[a-z\d_-]/i.test(character));
}

function evaluateFormulaNode(
  node: FormulaNode,
  variables: PreTimerFormulaVariables,
): number {
  if (node.type === "number") {
    return node.value;
  }
  if (node.type === "placeholder") {
    return variables[node.value];
  }
  if (node.type === "unary") {
    const child = evaluateFormulaNode(node.child, variables);
    return node.operator === "-" ? -child : child;
  }

  const left = evaluateFormulaNode(node.left, variables);
  const right = evaluateFormulaNode(node.right, variables);
  if (node.operator === "+") {
    return left + right;
  }
  if (node.operator === "-") {
    return left - right;
  }
  if (node.operator === "*") {
    return left * right;
  }
  return left / right;
}

function formatFormulaNode(
  node: FormulaNode,
  variables: PreTimerFormulaVariables,
  parentPrecedence = 0,
  rightChild = false,
): string {
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

function formatMinuteSeries(minutes: number): string {
  if (!Number.isSafeInteger(minutes) || minutes <= 0) {
    return "0";
  }
  const values = [];
  for (let value = 1; value <= minutes; value += 1) {
    values.push(String(value));
  }
  return `(${values.join("+")})`;
}

function isPreTimerType(value: unknown): value is PreTimerType {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(PRE_TIMER_TYPE_LABELS, value)
  );
}

function isPreTimerRounding(value: unknown): value is PreTimerRounding {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(PRE_TIMER_ROUNDING_LABELS, value)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function getDefinitionId(rawId: unknown, generateId: boolean): string | undefined {
  if (typeof rawId === "string" && rawId !== "") {
    return rawId;
  }
  return generateId ? createPreTimerId() : undefined;
}

function isFormulaOperator(value: string): value is FormulaOperator {
  return value === "+" || value === "-" || value === "*" || value === "/";
}
