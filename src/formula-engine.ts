import { ACTION_TYPES } from "./action-model.ts";
import type {
  FormulaClampNode,
  FormulaMetric,
  FormulaNode,
  NumericFormulaInput,
} from "./formula-model.ts";

export interface FormulaRuntimeAction {
  id: string;
  type: string;
  name?: string;
  elapsedSeconds?: number;
  endBpm?: number;
}

export interface FormulaEvaluationContext {
  previousActions: readonly FormulaRuntimeAction[];
  currentValues: Readonly<Record<string, number>>;
  liveBpm?: number;
}

export interface FormulaOutputBounds {
  min: number;
  max: number | null;
}

export interface FormulaResolution {
  valid: true;
  value: number;
  expressionValue: number;
  fallbackUsed: boolean;
  clamped: boolean;
  rounded: boolean;
}

export interface FormulaResolutionError {
  valid: false;
  error: string;
}

export type FormulaNodeEvaluation =
  | { valid: true; value: number; fallbackUsed: boolean; clamped: boolean }
  | FormulaResolutionError;

export function evaluateFormulaNode(
  node: FormulaNode | null,
  context: FormulaEvaluationContext,
): FormulaNodeEvaluation {
  if (!node) {
    return { valid: false, error: "Ein Formelbestandteil fehlt." };
  }

  switch (node.type) {
    case "static":
      return { valid: true, value: node.value, fallbackUsed: false, clamped: false };
    case "reference":
      return evaluateReference(node.actionId, node.metric, context);
    case "current": {
      const value =
        node.property === "current-bpm"
          ? context.liveBpm
          : context.currentValues[node.property];
      return typeof value === "number" && Number.isFinite(value)
        ? { valid: true, value, fallbackUsed: false, clamped: false }
        : { valid: false, error: "Der aktuelle Formelwert ist nicht verfügbar." };
    }
    case "operator":
      return evaluateOperator(node, context);
    case "clamp":
      return evaluateClamp(node, context);
    case "fallback": {
      const result = evaluateFormulaNode(node.input, context);
      return result.valid
        ? result
        : {
            valid: true,
            value: node.fallback,
            fallbackUsed: true,
            clamped: false,
          };
    }
    case "round":
      return evaluateRound(node, context);
  }
}

export function evaluateNumericFormulaInput(
  input: NumericFormulaInput,
  context: FormulaEvaluationContext,
  hardBounds: FormulaOutputBounds,
  relationshipBounds: FormulaOutputBounds | null = null,
): FormulaResolution | FormulaResolutionError {
  const minResult = resolveBound(
    input.min,
    context,
    hardBounds.min,
    hardBounds,
  );
  if (!minResult.valid) {
    return minResult;
  }

  const maxResult =
    input.max === null
      ? {
          valid: true as const,
          value: hardBounds.max ?? Number.MAX_SAFE_INTEGER,
          fallbackUsed: false,
          clamped: false,
        }
      : resolveBound(
          input.max,
          context,
          hardBounds.max ?? Number.MAX_SAFE_INTEGER,
          hardBounds,
        );
  if (!maxResult.valid) {
    return maxResult;
  }

  const userMin = Math.max(hardBounds.min, minResult.value);
  const userMax = Math.min(
    hardBounds.max ?? Number.MAX_SAFE_INTEGER,
    maxResult.value,
  );
  const relationshipMin = relationshipBounds?.min ?? hardBounds.min;
  const relationshipMax =
    relationshipBounds?.max ?? hardBounds.max ?? Number.MAX_SAFE_INTEGER;
  const minimum = Math.max(userMin, relationshipMin);
  const maximum = Math.min(userMax, relationshipMax);
  if (minimum > maximum) {
    return {
      valid: false,
      error: "Die Formelbegrenzungen widersprechen einander.",
    };
  }

  const expressionResult = evaluateFormulaNode(input.expression, context);
  if (!expressionResult.valid) {
    return expressionResult;
  }
  if (!Number.isFinite(expressionResult.value)) {
    return {
      valid: false,
      error: "Das Formelergebnis ist nicht endlich.",
    };
  }

  const roundedValue = Math.round(expressionResult.value);
  const value = Math.min(maximum, Math.max(minimum, roundedValue));
  return {
    valid: true,
    value,
    expressionValue: expressionResult.value,
    fallbackUsed:
      expressionResult.fallbackUsed ||
      minResult.fallbackUsed ||
      maxResult.fallbackUsed,
    clamped:
      expressionResult.clamped ||
      minResult.clamped ||
      maxResult.clamped ||
      value !== roundedValue,
    rounded: value !== expressionResult.value && value === roundedValue,
  };
}

export function getFormulaCurrentDependencies(
  node: FormulaNode | null,
): string[] {
  if (!node) {
    return [];
  }
  switch (node.type) {
    case "current":
      return node.property === "current-bpm" ? [] : [node.property];
    case "operator":
      return [
        ...getFormulaCurrentDependencies(node.left),
        ...getFormulaCurrentDependencies(node.right),
      ];
    case "clamp":
      return [
        ...getFormulaCurrentDependencies(node.min),
        ...getFormulaCurrentDependencies(node.input),
        ...getFormulaCurrentDependencies(node.max),
      ];
    case "fallback":
    case "round":
      return getFormulaCurrentDependencies(node.input);
    case "static":
    case "reference":
      return [];
  }
}

export function getNumericFormulaDependencies(
  input: NumericFormulaInput,
): string[] {
  return [
    ...getFormulaCurrentDependencies(input.expression),
    ...getFormulaCurrentDependencies(input.min),
    ...getFormulaCurrentDependencies(input.max),
  ];
}

function resolveBound(
  node: FormulaNode | null,
  context: FormulaEvaluationContext,
  fallback: number,
  hardBounds: FormulaOutputBounds,
): FormulaNodeEvaluation {
  const result = evaluateFormulaNode(node, context);
  if (!result.valid) {
    return {
      valid: true,
      value: clampInteger(fallback, hardBounds),
      fallbackUsed: true,
      clamped: true,
    };
  }
  if (!Number.isFinite(result.value)) {
    return {
      valid: true,
      value: clampInteger(fallback, hardBounds),
      fallbackUsed: true,
      clamped: true,
    };
  }
  const rounded = Math.round(result.value);
  const value = clampInteger(rounded, hardBounds);
  return {
    valid: true,
    value,
    fallbackUsed: result.fallbackUsed,
    clamped: result.clamped || value !== rounded,
  };
}

function evaluateOperator(
  node: Extract<FormulaNode, { type: "operator" }>,
  context: FormulaEvaluationContext,
): FormulaNodeEvaluation {
  const left = evaluateFormulaNode(node.left, context);
  if (!left.valid) {
    return left;
  }
  const right = evaluateFormulaNode(node.right, context);
  if (!right.valid) {
    return right;
  }
  if (node.operator === "/" && right.value === 0) {
    return { valid: false, error: "Division durch null ist nicht möglich." };
  }

  const value =
    node.operator === "+"
      ? left.value + right.value
      : node.operator === "-"
        ? left.value - right.value
        : node.operator === "*"
          ? left.value * right.value
          : left.value / right.value;
  return Number.isFinite(value)
    ? {
        valid: true,
        value,
        fallbackUsed: left.fallbackUsed || right.fallbackUsed,
        clamped: left.clamped || right.clamped,
      }
    : { valid: false, error: "Das Formelergebnis ist nicht endlich." };
}

function evaluateClamp(
  node: FormulaClampNode,
  context: FormulaEvaluationContext,
): FormulaNodeEvaluation {
  const minResult = evaluateFormulaNode(node.min, context);
  if (!minResult.valid) {
    return minResult;
  }
  const inputResult = evaluateFormulaNode(node.input, context);
  if (!inputResult.valid) {
    return inputResult;
  }
  const maxResult =
    node.max === null
      ? null
      : evaluateFormulaNode(node.max, context);
  if (maxResult && !maxResult.valid) {
    return maxResult;
  }
  const min = Math.round(minResult.value);
  const max = maxResult?.valid ? Math.round(maxResult.value) : null;
  if (!Number.isFinite(min) || (max !== null && !Number.isFinite(max))) {
    return { valid: false, error: "Die Formelbegrenzung ist nicht endlich." };
  }
  if (max !== null && min > max) {
    return {
      valid: false,
      error: "Der Mindestwert ist größer als der Höchstwert.",
    };
  }
  const value = Math.min(max ?? Number.MAX_SAFE_INTEGER, Math.max(min, inputResult.value));
  return {
    valid: true,
    value,
    fallbackUsed:
      minResult.fallbackUsed ||
      inputResult.fallbackUsed ||
      Boolean(maxResult?.valid && maxResult.fallbackUsed),
    clamped:
      minResult.clamped ||
      inputResult.clamped ||
      value !== inputResult.value ||
      Boolean(maxResult?.valid && maxResult.clamped),
  };
}

function evaluateRound(
  node: Extract<FormulaNode, { type: "round" }>,
  context: FormulaEvaluationContext,
): FormulaNodeEvaluation {
  const reference = node.input;
  if (reference?.type !== "reference") {
    return {
      valid: false,
      error: "Runden ist nur für Minutenwerte verfügbar.",
    };
  }
  if (
    reference.metric !== "minutes" &&
    reference.metric !== "sum-minutes"
  ) {
    return {
      valid: false,
      error: "Runden ist nur für Minutenwerte verfügbar.",
    };
  }
  const source = context.previousActions.find(
    (action) => action.id === reference.actionId,
  );
  const elapsed = getElapsedSeconds(source);
  if (elapsed === null) {
    return {
      valid: false,
      error: "Die Stoppuhrzeit für die Rundung ist nicht verfügbar.",
    };
  }
  const baseMinutes = Math.floor(elapsed / 60);
  const restSeconds = elapsed % 60;
  const roundedMinutes =
    restSeconds > 0 && restSeconds >= node.threshold
      ? baseMinutes + 1
      : baseMinutes;
  const minutes =
    reference.metric === "sum-minutes"
      ? (roundedMinutes * (roundedMinutes + 1)) / 2
      : roundedMinutes;
  return {
    valid: true,
    value: minutes,
    fallbackUsed: false,
    clamped: false,
  };
}

function evaluateReference(
  actionId: string,
  metric: FormulaMetric,
  context: FormulaEvaluationContext,
): FormulaNodeEvaluation {
  const action = context.previousActions.find(
    (candidate) => candidate.id === actionId,
  );
  if (!action) {
    return { valid: false, error: "Die referenzierte Aktion ist nicht verfügbar." };
  }
  if (metric === "end-bpm") {
    if (action.type !== ACTION_TYPES.METRONOME || action.endBpm === undefined) {
      return { valid: false, error: "Der End-BPM-Wert ist nicht verfügbar." };
    }
    return {
      valid: true,
      value: action.endBpm,
      fallbackUsed: false,
      clamped: false,
    };
  }

  const elapsed = getElapsedSeconds(action);
  if (elapsed === null) {
    return {
      valid: false,
      error: "Die Zeit der referenzierten Aktion ist nicht verfügbar.",
    };
  }
  const minutes = elapsed / 60;
  const value =
    metric === "minutes"
      ? minutes
      : metric === "sum-minutes"
        ? (minutes * (minutes + 1)) / 2
        : metric === "seconds-absolute"
          ? elapsed
          : elapsed % 60;
  return { valid: true, value, fallbackUsed: false, clamped: false };
}

function getElapsedSeconds(action: FormulaRuntimeAction | undefined): number | null {
  if (
    !action ||
    typeof action.elapsedSeconds !== "number" ||
    !Number.isFinite(action.elapsedSeconds) ||
    action.elapsedSeconds < 0
  ) {
    return null;
  }
  return Math.max(0, Math.round(action.elapsedSeconds));
}

function clampInteger(value: number, bounds: FormulaOutputBounds): number {
  const max = bounds.max ?? Number.MAX_SAFE_INTEGER;
  return Math.min(max, Math.max(bounds.min, value));
}
