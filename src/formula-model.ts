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

export interface FormulaDaysNode {
  id: string;
  type: "days";
  date: string;
}

export interface FormulaMonthsNode {
  id: string;
  type: "months";
  date: string;
}

export type FormulaDateNode = FormulaDaysNode | FormulaMonthsNode;

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
  | FormulaDateNode
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

export interface FormulaDateParts {
  year: number;
  month: number;
  day: number;
}

export type FormulaRoundKind = "minutes" | "days" | "months" | "division";

export interface FormulaRoundConfig {
  kind: FormulaRoundKind;
  min: number;
  max: number;
  defaultThreshold: number;
  unitLabel: string;
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

const FORMULA_ROUND_CONFIGS: Readonly<
  Record<FormulaRoundKind, FormulaRoundConfig>
> = Object.freeze({
  minutes: {
    kind: "minutes",
    min: 0,
    max: 60,
    defaultThreshold: 30,
    unitLabel: "s",
  },
  days: {
    kind: "days",
    min: 0,
    max: 23,
    defaultThreshold: 12,
    unitLabel: "h",
  },
  months: {
    kind: "months",
    min: 0,
    max: 31,
    defaultThreshold: 15,
    unitLabel: "Tage",
  },
  division: {
    kind: "division",
    min: 0,
    max: 0,
    defaultThreshold: 30,
    unitLabel: "",
  },
});

export function createFormulaNodeId(): string {
  const id = `formula-${Date.now().toString(36)}-${nextFormulaNodeId}`;
  nextFormulaNodeId += 1;
  return id;
}

export function createStaticFormulaNode(value: number): FormulaStaticNode {
  return { id: createFormulaNodeId(), type: "static", value };
}

export function getDaysInFormulaMonth(year: number, month: number): number {
  if (month === 2) {
    return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
      ? 29
      : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

export function parseFormulaDate(value: unknown): FormulaDateParts | null {
  if (typeof value !== "string") {
    return null;
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (
    year < 1 ||
    year > 9999 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > getDaysInFormulaMonth(year, month)
  ) {
    return null;
  }
  return { year, month, day };
}

export function getLocalFormulaDateParts(date = new Date()): FormulaDateParts {
  const source = Number.isNaN(date.getTime()) ? new Date() : date;
  return {
    year: source.getFullYear(),
    month: source.getMonth() + 1,
    day: source.getDate(),
  };
}

export function getLocalFormulaDate(date = new Date()): string {
  const parts = getLocalFormulaDateParts(date);
  return [
    String(parts.year).padStart(4, "0"),
    String(parts.month).padStart(2, "0"),
    String(parts.day).padStart(2, "0"),
  ].join("-");
}

export function formatFormulaDate(value: string): string {
  const parts = parseFormulaDate(value);
  if (!parts) {
    return "Datum auswählen";
  }
  return `${String(parts.day).padStart(2, "0")}.${String(parts.month).padStart(2, "0")}.${parts.year}`;
}

export function isFormulaDateNodeType(
  value: unknown,
): value is FormulaDateNode["type"] {
  return value === "days" || value === "months";
}

export function isFormulaDateNode(node: FormulaNode): node is FormulaDateNode {
  return isFormulaDateNodeType(node.type);
}

function compareFormulaDateParts(
  left: FormulaDateParts,
  right: FormulaDateParts,
): number {
  return (
    left.year - right.year ||
    left.month - right.month ||
    left.day - right.day
  );
}

export function isFormulaDateInFuture(
  value: string,
  now = new Date(),
): boolean {
  const date = parseFormulaDate(value);
  return (
    date !== null &&
    compareFormulaDateParts(date, getLocalFormulaDateParts(now)) > 0
  );
}

export function formulaNodeRequiresFallback(
  node: FormulaNode,
  now = new Date(),
): boolean {
  if (node.type === "operator") {
    return node.operator === "/";
  }
  if (node.type === "reference" || node.type === "current") {
    return node.type === "current" && node.property === "abPause"
      ? false
      : true;
  }
  return isFormulaDateNode(node) && isFormulaDateInFuture(node.date, now);
}

export function getFormulaRoundSourceNode(
  node: FormulaNode | null,
): FormulaNode | null {
  return node?.type === "fallback" ? node.input : node;
}

export function getFormulaRoundConfig(
  node: FormulaNode | null,
): FormulaRoundConfig | null {
  const source = getFormulaRoundSourceNode(node);
  if (!source) {
    return null;
  }
  if (
    source.type === "reference" &&
    (source.metric === "minutes" || source.metric === "sum-minutes")
  ) {
    return FORMULA_ROUND_CONFIGS.minutes;
  }
  if (source.type === "days") {
    return FORMULA_ROUND_CONFIGS.days;
  }
  if (source.type === "months") {
    return FORMULA_ROUND_CONFIGS.months;
  }
  if (source.type === "operator" && source.operator === "/") {
    return FORMULA_ROUND_CONFIGS.division;
  }
  return null;
}

export function createFormulaDateNode(
  type: FormulaDateNode["type"],
  date = getLocalFormulaDate(),
): FormulaDateNode {
  return { id: createFormulaNodeId(), type, date };
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

export function createPauseMessageUntilFormulaInput(): NumericFormulaInput {
  return {
    expression: {
      id: createFormulaNodeId(),
      type: "clamp",
      min: createStaticFormulaNode(0),
      input: {
        id: createFormulaNodeId(),
        type: "current",
        property: "abPause",
      },
      max: null,
    },
    min: createStaticFormulaNode(0),
    max: null,
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
    case "days":
    case "months":
      return createFormulaDateNode(type);
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
    case "days":
    case "months":
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
      const min = normalizeChild(rawNode.min);
      const input = normalizeChild(rawNode.input);
      const max = normalizeChild(rawNode.max);
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
    case "days":
    case "months": {
      const date = typeof rawNode.date === "string" ? rawNode.date : "";
      if (!parseFormulaDate(date)) {
        errors.push("Ein gültiges Datum auswählen.");
      }
      return {
        valid: errors.length === 0,
        node: { id, type: rawNode.type, date },
        errors,
      };
    }
    case "round": {
      const input = normalizeChild(rawNode.input);
      const threshold = rawNode.threshold;
      const config = getFormulaRoundConfig(input);
      if (!config) {
        errors.push(
          "Runden unterstützt nur Minutenreferenzen, Tage, Monate oder Divisionen.",
        );
      } else if (
        config.kind !== "division" &&
        (typeof threshold !== "number" ||
          !Number.isSafeInteger(threshold) ||
          threshold < config.min ||
          threshold > config.max)
      ) {
        errors.push(
          `Eine ganze Rundungsschwelle von ${config.min} bis ${config.max} ${config.unitLabel} eingeben.`,
        );
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
              : config?.defaultThreshold ?? 30,
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
  const expression = expressionResult.node;

  const rawMin = rawInput.min;
  const minResult =
    rawMin === undefined || rawMin === null
      ? { valid: true, node: createStaticFormulaNode(hardMin), errors: [] }
      : normalizeBoundNode(
          rawMin,
          hardMin,
          hardMax ?? Number.MAX_SAFE_INTEGER,
        );
  errors.push(...minResult.errors);

  const rawMax = rawInput.max;
  let max: FormulaNode | null = null;
  if (rawMax === undefined || rawMax === null) {
    max = hardMax === null ? null : createStaticFormulaNode(hardMax);
  } else {
    const maxResult = normalizeBoundNode(
      rawMax,
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
  errors.push(...validateNumericFormulaInput(value, new Date()).errors);

  return {
    valid: errors.length === 0,
    value,
    errors,
  };
}

function validateFormulaNodeTreeInternal(
  node: FormulaNode | null,
  path: string,
  hasFallbackAncestor: boolean,
  now: Date,
): FormulaTreeValidationResult {
  const errors: string[] = [];
  if (!node) {
    return { valid: false, errors: [`${path}: Ein Formelbestandteil fehlt.`] };
  }

  const validateChild = (child: FormulaNode | null, label: string): void => {
    const result = validateFormulaNodeTreeInternal(
      child,
      `${path} ${label}`,
      hasFallbackAncestor || node.type === "fallback",
      now,
    );
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
      if (formulaNodeRequiresFallback(node, now) && !hasFallbackAncestor) {
        errors.push(`${path}: Dieser Formelbaustein benötigt einen Ersatzwert.`);
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
      if (formulaNodeRequiresFallback(node, now) && !hasFallbackAncestor) {
        errors.push(`${path}: Dieser Formelbaustein benötigt einen Ersatzwert.`);
      }
      break;
    case "current":
      if (!node.property) {
        errors.push(`${path}: Eine Aktuell-Eigenschaft auswählen.`);
      }
      if (formulaNodeRequiresFallback(node, now) && !hasFallbackAncestor) {
        errors.push(`${path}: Dieser Formelbaustein benötigt einen Ersatzwert.`);
      }
      break;
    case "days":
    case "months":
      if (!parseFormulaDate(node.date)) {
        errors.push(`${path}: Ein gültiges Datum auswählen.`);
      } else if (
        formulaNodeRequiresFallback(node, now) &&
        !hasFallbackAncestor
      ) {
        errors.push(`${path}: Ein zukünftiges Formel-Datum benötigt einen Ersatzwert.`);
      }
      break;
    case "round":
      {
        const config = getFormulaRoundConfig(node.input);
        if (!config) {
          errors.push(
            `${path}: Runden unterstützt nur Minutenreferenzen, Tage, Monate oder Divisionen.`,
          );
        } else if (
          config.kind !== "division" &&
          (!Number.isSafeInteger(node.threshold) ||
            node.threshold < config.min ||
            node.threshold > config.max)
        ) {
          errors.push(
            `${path}: Eine Rundungsschwelle von ${config.min} bis ${config.max} ${config.unitLabel} eingeben.`,
          );
        }
        if (node.input) {
          validateChild(node.input, "Wert");
        }
      }
      break;
  }
  return { valid: errors.length === 0, errors };
}

export function validateFormulaNodeTree(
  node: FormulaNode | null,
  path = "Formel",
  now = new Date(),
): FormulaTreeValidationResult {
  return validateFormulaNodeTreeInternal(node, path, false, now);
}

export function validateNumericFormulaInput(
  input: NumericFormulaInput,
  now = new Date(),
): FormulaTreeValidationResult {
  const errors: string[] = [];
  errors.push(...validateFormulaNodeTree(input.expression, "Formel", now).errors);
  errors.push(...validateFormulaNodeTree(input.min, "Minimum", now).errors);
  if (input.max) {
    errors.push(...validateFormulaNodeTree(input.max, "Maximum", now).errors);
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
    case "days":
    case "months":
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
    case "days":
      return `Tage seit ${formatFormulaDate(node.date)}`;
    case "months":
      return `Monate seit ${formatFormulaDate(node.date)}`;
    case "round":
      {
        const config = getFormulaRoundConfig(node.input);
        const threshold =
          config?.kind === "division"
            ? ""
            : `; ${
                config?.kind === "months"
                  ? `${node.threshold} Tage`
                  : `${node.threshold}${config?.unitLabel ?? "s"}`
              }`;
        return `Runden(${formatFormulaNode(node.input, context)}${threshold})`;
      }
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
