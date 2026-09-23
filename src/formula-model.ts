export type FormulaOperator = "+" | "-" | "*" | "/";

export type FormulaMetric =
  | "minutes"
  | "sum-minutes"
  | "seconds-absolute"
  | "seconds-rest"
  | "end-bpm";

export interface FormulaStaticNode {
  id: string;
  type: "static";
  value: number;
}

export interface FormulaOperatorNode {
  id: string;
  type: "operator";
  operator: FormulaOperator;
  left: FormulaNode | null;
  right: FormulaNode | null;
}

export interface FormulaClampNode {
  id: string;
  type: "clamp";
  min: FormulaNode | null;
  input: FormulaNode | null;
  max: FormulaNode | null;
}

export interface FormulaFallbackNode {
  id: string;
  type: "fallback";
  input: FormulaNode | null;
  fallback: number;
}

export interface FormulaReferenceNode {
  id: string;
  type: "reference";
  actionId: string;
  metric: FormulaMetric;
}

export interface FormulaCurrentNode {
  id: string;
  type: "current";
  property: string;
}

export interface FormulaRoundNode {
  id: string;
  type: "round";
  input: FormulaNode | null;
  threshold: number;
}

export type FormulaNode =
  | FormulaStaticNode
  | FormulaOperatorNode
  | FormulaClampNode
  | FormulaFallbackNode
  | FormulaReferenceNode
  | FormulaCurrentNode
  | FormulaRoundNode;

export interface NumericFormulaInput {
  expression: FormulaNode | null;
  min: FormulaNode | null;
  max: FormulaNode | null;
}

export interface FormulaActionInfo {
  id: string;
  type: string;
  name: string;
}

export interface FormulaFormatContext {
  actions?: readonly FormulaActionInfo[];
  currentPropertyLabels?: Readonly<Record<string, string>>;
}

export interface FormulaNodeNormalizationResult {
  valid: boolean;
  node: FormulaNode | null;
  errors: string[];
}

export interface FormulaTreeValidationResult {
  valid: boolean;
  errors: string[];
}

let nextFormulaNodeId = 1;

const FORMULA_METRICS = new Set<FormulaMetric>([
  "minutes",
  "sum-minutes",
  "seconds-absolute",
  "seconds-rest",
  "end-bpm",
]);

const FORMULA_OPERATORS = new Set<FormulaOperator>(["+", "-", "*", "/"]);

export function createFormulaNodeId(): string {
  const id = `formula-${Date.now().toString(36)}-${nextFormulaNodeId}`;
  nextFormulaNodeId += 1;
  return id;
}

export function createStaticFormulaNode(value: number): FormulaStaticNode {
  return { id: createFormulaNodeId(), type: "static", value };
}

export function createNumericFormulaInput(
  value: number,
  min: number,
  max: number | null,
): NumericFormulaInput {
  return {
    expression: createStaticFormulaNode(value),
    min: createStaticFormulaNode(min),
    max: max === null ? null : createStaticFormulaNode(max),
  };
}

export function createPaletteFormulaNode(
  type: FormulaNode["type"],
  fallback = 1,
): FormulaNode {
  switch (type) {
    case "static":
      return createStaticFormulaNode(1);
    case "operator":
      return {
        id: createFormulaNodeId(),
        type,
        operator: "+",
        left: null,
        right: null,
      };
    case "clamp":
      return {
        id: createFormulaNodeId(),
        type,
        min: createStaticFormulaNode(1),
        input: null,
        max: null,
      };
    case "fallback":
      return {
        id: createFormulaNodeId(),
        type,
        input: null,
        fallback,
      };
    case "reference":
      return {
        id: createFormulaNodeId(),
        type,
        actionId: "",
        metric: "minutes",
      };
    case "current":
      return { id: createFormulaNodeId(), type, property: "" };
    case "round":
      return {
        id: createFormulaNodeId(),
        type,
        input: null,
        threshold: 30,
      };
  }
}

export function cloneFormulaNode(node: FormulaNode): FormulaNode {
  switch (node.type) {
    case "static":
      return { ...node };
    case "operator":
      return {
        ...node,
        left: node.left ? cloneFormulaNode(node.left) : null,
        right: node.right ? cloneFormulaNode(node.right) : null,
      };
    case "clamp":
      return {
        ...node,
        min: node.min ? cloneFormulaNode(node.min) : null,
        input: node.input ? cloneFormulaNode(node.input) : null,
        max: node.max ? cloneFormulaNode(node.max) : null,
      };
    case "fallback":
    case "round":
      return {
        ...node,
        input: node.input ? cloneFormulaNode(node.input) : null,
      };
    case "reference":
    case "current":
      return { ...node };
  }
}

export function cloneNumericFormulaInput(
  input: NumericFormulaInput,
): NumericFormulaInput {
  return {
    expression: input.expression
      ? cloneFormulaNode(input.expression)
      : null,
    min: input.min ? cloneFormulaNode(input.min) : null,
    max: input.max ? cloneFormulaNode(input.max) : null,
  };
}

export function ensureFormulaFallback(
  node: FormulaNode | null,
  fallback: number,
): FormulaNode | null {
  if (!node || node.type === "static" || node.type === "fallback") {
    return node;
  }
  return {
    id: createFormulaNodeId(),
    type: "fallback",
    input: node,
    fallback,
  };
}

export function isFormulaMetric(value: unknown): value is FormulaMetric {
  return typeof value === "string" && FORMULA_METRICS.has(value as FormulaMetric);
}

export function isFormulaOperator(value: unknown): value is FormulaOperator {
  return (
    typeof value === "string" &&
    FORMULA_OPERATORS.has(value as FormulaOperator)
  );
}

export function normalizeFormulaNode(
  rawNode: unknown,
  depth = 0,
): FormulaNodeNormalizationResult {
  if (depth > 64) {
    return {
      valid: false,
      node: null,
      errors: ["Die Formel ist zu tief verschachtelt."],
    };
  }
  if (!isRecord(rawNode)) {
    return {
      valid: false,
      node: null,
      errors: ["Ein gültiger Formelbaustein fehlt."],
    };
  }

  const id =
    typeof rawNode.id === "string" && rawNode.id !== ""
      ? rawNode.id
      : createFormulaNodeId();
  const errors: string[] = [];
  const normalizeChild = (value: unknown): FormulaNode | null => {
    if (value === null || value === undefined) {
      return null;
    }
    const child = normalizeFormulaNode(value, depth + 1);
    errors.push(...child.errors);
    return child.node;
  };

  switch (rawNode.type) {
    case "static": {
      const value = rawNode.value;
      if (typeof value !== "number" || !Number.isSafeInteger(value)) {
        errors.push("Eine sichere ganze Zahl eingeben.");
      }
      return {
        valid: errors.length === 0,
        node: {
          id,
          type: "static",
          value: typeof value === "number" ? value : 0,
        },
        errors,
      };
    }
    case "operator": {
      if (!isFormulaOperator(rawNode.operator)) {
        errors.push("Eine gültige Rechenart auswählen.");
      }
      const left = normalizeChild(rawNode.left);
      const right = normalizeChild(rawNode.right);
      return {
        valid: errors.length === 0,
        node: {
          id,
          type: "operator",
          operator: isFormulaOperator(rawNode.operator)
            ? rawNode.operator
            : "+",
          left,
          right,
        },
        errors,
      };
    }
    case "clamp": {
      let min = normalizeChild(rawNode.min);
      const input = normalizeChild(rawNode.input);
      let max = normalizeChild(rawNode.max);
      if (min && min.type !== "static" && min.type !== "fallback") {
        min = ensureFormulaFallback(min, getStaticValue(min) ?? 1);
      }
      if (max && max.type !== "static" && max.type !== "fallback") {
        max = ensureFormulaFallback(max, getStaticValue(max) ?? 1);
      }
      return {
        valid: errors.length === 0,
        node: { id, type: "clamp", min, input, max },
        errors,
      };
    }
    case "fallback": {
      const input = normalizeChild(rawNode.input);
      const fallback = rawNode.fallback;
      if (typeof fallback !== "number" || !Number.isSafeInteger(fallback)) {
        errors.push("Einen sicheren ganzzahligen Ersatzwert eingeben.");
      }
      return {
        valid: errors.length === 0,
        node: {
          id,
          type: "fallback",
          input,
          fallback: typeof fallback === "number" ? fallback : 1,
        },
        errors,
      };
    }
    case "reference": {
      const actionId =
        typeof rawNode.actionId === "string" ? rawNode.actionId : "";
      if (!actionId) {
        errors.push("Eine vorherige Aktion auswählen.");
      }
      if (!isFormulaMetric(rawNode.metric)) {
        errors.push("Einen gültigen Aktionswert auswählen.");
      }
      return {
        valid: errors.length === 0,
        node: {
          id,
          type: "reference",
          actionId,
          metric: isFormulaMetric(rawNode.metric)
            ? rawNode.metric
            : "minutes",
        },
        errors,
      };
    }
    case "current": {
      const property =
        typeof rawNode.property === "string" ? rawNode.property : "";
      if (!property) {
        errors.push("Eine aktuelle Eigenschaft auswählen.");
      }
      return {
        valid: errors.length === 0,
        node: { id, type: "current", property },
        errors,
      };
    }
    case "round": {
      const input = normalizeChild(rawNode.input);
      const threshold = rawNode.threshold;
      if (
        typeof threshold !== "number" ||
        !Number.isSafeInteger(threshold) ||
        threshold < 0 ||
        threshold > 60
      ) {
        errors.push("Eine ganze Rundungsschwelle von 0 bis 60 eingeben.");
      }
      return {
        valid: errors.length === 0,
        node: {
          id,
          type: "round",
          input,
          threshold:
            typeof threshold === "number" && Number.isSafeInteger(threshold)
              ? threshold
              : 30,
        },
        errors,
      };
    }
    default:
      return {
        valid: false,
        node: null,
        errors: ["Unbekannten Formelbaustein entfernen."],
      };
  }
}

export function normalizeNumericFormulaInput(
  rawInput: unknown,
  defaultValue: number,
  hardMin: number,
  hardMax: number | null,
): { valid: boolean; value: NumericFormulaInput; errors: string[] } {
  if (
    typeof rawInput === "number" ||
    (typeof rawInput === "string" && rawInput.trim() !== "")
  ) {
    const numericValue = Number(rawInput);
    if (Number.isSafeInteger(numericValue)) {
      return {
        valid: true,
        value: createNumericFormulaInput(numericValue, hardMin, hardMax),
        errors: [],
      };
    }
    return {
      valid: false,
      value: createNumericFormulaInput(defaultValue, hardMin, hardMax),
      errors: ["Eine sichere ganze Zahl eingeben."],
    };
  }
  if (!isRecord(rawInput)) {
    return {
      valid: false,
      value: createNumericFormulaInput(defaultValue, hardMin, hardMax),
      errors: ["Eine gültige Formel eingeben."],
    };
  }

  const errors: string[] = [];
  const expressionResult = normalizeFormulaNode(rawInput.expression);
  errors.push(...expressionResult.errors);
  let expression = expressionResult.node;
  if (expression && expression.type !== "static" && expression.type !== "fallback") {
    expression = ensureFormulaFallback(expression, defaultValue);
  }

  const rawMin = rawInput.min;
  const minResult =
    rawMin === undefined || rawMin === null
      ? { valid: true, node: createStaticFormulaNode(hardMin), errors: [] }
      : normalizeBoundNode(rawMin, hardMin, hardMin, hardMax ?? Number.MAX_SAFE_INTEGER);
  errors.push(...minResult.errors);

  const rawMax = rawInput.max;
  let max: FormulaNode | null = null;
  if (rawMax === undefined || rawMax === null) {
    max = hardMax === null ? null : createStaticFormulaNode(hardMax);
  } else {
    const maxResult = normalizeBoundNode(
      rawMax,
      hardMax ?? Number.MAX_SAFE_INTEGER,
      hardMin,
      hardMax ?? Number.MAX_SAFE_INTEGER,
    );
    errors.push(...maxResult.errors);
    max = maxResult.node;
  }

  const value = {
    expression,
    min: minResult.node,
    max,
  };
  errors.push(...validateNumericFormulaInput(value).errors);

  return {
    valid: errors.length === 0,
    value,
    errors,
  };
}

export function validateFormulaNodeTree(
  node: FormulaNode | null,
  path = "Formel",
): FormulaTreeValidationResult {
  const errors: string[] = [];
  if (!node) {
    return { valid: false, errors: [`${path}: Ein Formelbestandteil fehlt.`] };
  }

  const validateChild = (child: FormulaNode | null, label: string): void => {
    const result = validateFormulaNodeTree(child, `${path} ${label}`);
    errors.push(...result.errors);
  };

  switch (node.type) {
    case "static":
      if (!Number.isSafeInteger(node.value)) {
        errors.push(`${path}: Eine sichere ganze Zahl eingeben.`);
      }
      break;
    case "operator":
      if (!isFormulaOperator(node.operator)) {
        errors.push(`${path}: Eine gültige Rechenart auswählen.`);
      }
      validateChild(node.left, "links");
      validateChild(node.right, "rechts");
      break;
    case "clamp":
      validateChild(node.min, "Minimum");
      validateChild(node.input, "Ausdruck");
      if (node.max) {
        validateChild(node.max, "Maximum");
      }
      if (
        node.min &&
        node.min.type !== "static" &&
        node.min.type !== "fallback"
      ) {
        errors.push(`${path}: Das dynamische Minimum benötigt einen Ersatzwert.`);
      }
      if (
        node.max &&
        node.max.type !== "static" &&
        node.max.type !== "fallback"
      ) {
        errors.push(`${path}: Das dynamische Maximum benötigt einen Ersatzwert.`);
      }
      if (
        node.min?.type === "static" &&
        node.max?.type === "static" &&
        node.min.value > node.max.value
      ) {
        errors.push(`${path}: Min darf nicht größer als Max sein.`);
      }
      break;
    case "fallback":
      if (!Number.isSafeInteger(node.fallback)) {
        errors.push(`${path}: Einen sicheren ganzzahligen Ersatzwert eingeben.`);
      }
      validateChild(node.input, "Ausdruck");
      break;
    case "reference":
      if (!node.actionId || !isFormulaMetric(node.metric)) {
        errors.push(`${path}: Eine gültige vorherige Aktion und einen Wert auswählen.`);
      }
      break;
    case "current":
      if (!node.property) {
        errors.push(`${path}: Eine Aktuell-Eigenschaft auswählen.`);
      }
      break;
    case "round":
      if (
        !Number.isSafeInteger(node.threshold) ||
        node.threshold < 0 ||
        node.threshold > 60
      ) {
        errors.push(`${path}: Eine Rundungsschwelle von 0 bis 60 eingeben.`);
      }
      if (
        node.input?.type !== "reference" ||
        (node.input.metric !== "minutes" &&
          node.input.metric !== "sum-minutes")
      ) {
        errors.push(`${path}: Runden ist nur für Minutenwerte verfügbar.`);
      } else {
        validateChild(node.input, "Minutenwert");
      }
      break;
  }
  return { valid: errors.length === 0, errors };
}

export function validateNumericFormulaInput(
  input: NumericFormulaInput,
): FormulaTreeValidationResult {
  const errors: string[] = [];
  errors.push(...validateFormulaNodeTree(input.expression, "Formel").errors);
  errors.push(...validateFormulaNodeTree(input.min, "Minimum").errors);
  if (
    input.expression &&
    input.expression.type !== "static" &&
    input.expression.type !== "fallback"
  ) {
    errors.push("Eine dynamische Formel benötigt einen Ersatzwert.");
  }
  if (input.min && input.min.type !== "static" && input.min.type !== "fallback") {
    errors.push("Ein dynamisches Clamp-Minimum benötigt einen Ersatzwert.");
  }
  if (input.max) {
    errors.push(...validateFormulaNodeTree(input.max, "Maximum").errors);
    if (input.max.type !== "static" && input.max.type !== "fallback") {
      errors.push("Ein dynamisches Clamp-Maximum benötigt einen Ersatzwert.");
    }
    if (
      input.min?.type === "static" &&
      input.max.type === "static" &&
      input.min.value > input.max.value
    ) {
      errors.push("Das Clamp-Minimum darf nicht größer als das Clamp-Maximum sein.");
    }
  }
  return { valid: errors.length === 0, errors };
}

export function collectFormulaNodes(node: FormulaNode): FormulaNode[] {
  const nodes = [node];
  switch (node.type) {
    case "operator":
      if (node.left) {
        nodes.push(...collectFormulaNodes(node.left));
      }
      if (node.right) {
        nodes.push(...collectFormulaNodes(node.right));
      }
      break;
    case "clamp":
      if (node.min) {
        nodes.push(...collectFormulaNodes(node.min));
      }
      if (node.input) {
        nodes.push(...collectFormulaNodes(node.input));
      }
      if (node.max) {
        nodes.push(...collectFormulaNodes(node.max));
      }
      break;
    case "fallback":
    case "round":
      if (node.input) {
        nodes.push(...collectFormulaNodes(node.input));
      }
      break;
    case "static":
    case "reference":
    case "current":
      break;
  }
  return nodes;
}

export function collectFormulaReferences(
  input: NumericFormulaInput,
): FormulaReferenceNode[] {
  const nodes = [
    input.expression,
    input.min,
    input.max,
  ].flatMap((node) => (node ? collectFormulaNodes(node) : []));
  return nodes.filter(
    (node): node is FormulaReferenceNode => node.type === "reference",
  );
}

export function collectCurrentFormulaProperties(
  input: NumericFormulaInput,
): string[] {
  const nodes = [
    input.expression,
    input.min,
    input.max,
  ].flatMap((node) => (node ? collectFormulaNodes(node) : []));
  return nodes
    .filter((node): node is FormulaCurrentNode => node.type === "current")
    .map((node) => node.property);
}

export function formatFormulaNode(
  node: FormulaNode | null,
  context: FormulaFormatContext = {},
): string {
  if (!node) {
    return "…";
  }
  switch (node.type) {
    case "static":
      return String(node.value);
    case "operator":
      return `(${formatFormulaNode(node.left, context)} ${node.operator} ${formatFormulaNode(node.right, context)})`;
    case "clamp":
      return `Begrenzen(${formatFormulaNode(node.min, context)}; ${formatFormulaNode(node.input, context)}; ${node.max ? formatFormulaNode(node.max, context) : "∞"})`;
    case "fallback":
      return `Ersatzwert(${formatFormulaNode(node.input, context)}; ${node.fallback})`;
    case "reference": {
      const action =
        context.actions?.find((candidate) => candidate.id === node.actionId)?.name ??
        node.actionId;
      return `${action}: ${FORMULA_METRIC_LABELS[node.metric]}`;
    }
    case "current":
      return `Aktuell: ${context.currentPropertyLabels?.[node.property] ?? node.property}`;
    case "round":
      return `Runden(${formatFormulaNode(node.input, context)}; ${node.threshold}s)`;
  }
}

export function formatNumericFormulaInput(
  input: NumericFormulaInput,
  context: FormulaFormatContext = {},
): string {
  return formatFormulaNode(input.expression, context);
}

export const FORMULA_METRIC_LABELS: Readonly<Record<FormulaMetric, string>> =
  Object.freeze({
    minutes: "Minuten",
    "sum-minutes": "Summe Minuten",
    "seconds-absolute": "Sekunden Absolut",
    "seconds-rest": "Sekunden Rest",
    "end-bpm": "End-BPM",
  });

function normalizeBoundNode(
  rawNode: unknown,
  fallback: number,
  hardMin: number,
  hardMax: number,
): FormulaNodeNormalizationResult {
  const result =
    typeof rawNode === "number" || typeof rawNode === "string"
      ? normalizeFormulaNode({
          id: createFormulaNodeId(),
          type: "static",
          value: Number(rawNode),
        })
      : normalizeFormulaNode(rawNode);
  if (
    result.node &&
    result.node.type !== "static" &&
    result.node.type !== "fallback"
  ) {
    result.node = ensureFormulaFallback(result.node, fallback);
  }
  if (
    result.node?.type === "static" &&
    (!Number.isSafeInteger(result.node.value) ||
      result.node.value < hardMin ||
      result.node.value > hardMax)
  ) {
    result.errors.push("Der Wert liegt außerhalb des zulässigen Bereichs.");
    result.valid = false;
  }
  return result;
}

function getStaticValue(node: FormulaNode): number | null {
  return node.type === "static" ? node.value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
