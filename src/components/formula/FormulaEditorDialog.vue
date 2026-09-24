<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import {
  getEnabledCurrentFormulaProperties,
} from "../../action-model.ts";
import type { Action } from "../../action-model.ts";
import {
  cloneFormulaNode,
  cloneNumericFormulaInput,
  createPaletteFormulaNode,
  ensureFormulaFallback,
  formatFormulaNode,
  normalizeNumericFormulaInput,
  validateFormulaNodeTree,
  validateNumericFormulaInput,
} from "../../formula-model.ts";
import type {
  FormulaOperator,
  FormulaNode,
  NumericFormulaInput,
} from "../../formula-model.ts";
import { getFormulaFieldLabel } from "../../models/action-formulas.ts";
import FormulaDropZone from "./FormulaDropZone.vue";
import FormulaNodeRenderer from "./FormulaNodeRenderer.vue";

const props = defineProps<{
  modelValue: NumericFormulaInput;
  action: Action;
  previousActions: readonly Action[];
  field: string;
  label: string;
  defaultValue: number;
  hardMin: number;
  hardMax: number | null;
}>();

const emit = defineEmits<{
  confirm: [input: NumericFormulaInput];
  cancel: [];
}>();

const working = ref(cloneNumericFormulaInput(props.modelValue));
const fallbackSeed = ref(
  getFallbackSeed(props.modelValue.expression, props.defaultValue),
);
const mainRemembered = ref<FormulaNode[]>([]);
const boundEditor = ref<{
  kind: "min" | "max";
  node: FormulaNode | null;
  remembered: FormulaNode[];
} | null>(null);
const errors = ref<string[]>([]);
const dialogElement = ref<HTMLElement | null>(null);
const suppressPaletteClick = ref(false);
const dragSource = ref<
  | { kind: "palette"; item: FormulaPaletteItem }
  | { kind: "node"; nodeId: string }
  | null
>(null);

interface FormulaPaletteItem {
  type: FormulaNode["type"];
  label: string;
  operator?: FormulaOperator;
}

const paletteItems: readonly FormulaPaletteItem[] = [
  { type: "operator", label: "+", operator: "+" },
  { type: "operator", label: "−", operator: "-" },
  { type: "operator", label: "×", operator: "*" },
  { type: "operator", label: "÷", operator: "/" },
  { type: "static", label: "Zahl" },
  { type: "clamp", label: "Clamp" },
  { type: "fallback", label: "Ersatzwert" },
  { type: "reference", label: "Referenz" },
  { type: "round", label: "Runden" },
  { type: "current", label: "Aktuell" },
];
const operatorPaletteItems = paletteItems.filter((item) => item.operator);
const otherPaletteItems = paletteItems.filter((item) => !item.operator);

const activeRemembered = computed(() =>
  boundEditor.value ? boundEditor.value.remembered : mainRemembered.value,
);
const currentProperties = computed(() => {
  const options = getEnabledCurrentFormulaProperties(props.action)
    .filter((property) => property !== props.field)
    .map((value) => ({ value, label: getFormulaFieldLabel(value) }));
  if (props.field === "breakSeconds") {
    options.unshift({ value: "current-bpm", label: "Aktuelles BPM" });
  }
  return options;
});
const isEditingBound = computed(() => boundEditor.value !== null);
const boundTitle = computed(() =>
  boundEditor.value?.kind === "min"
    ? "Minimum bearbeiten"
    : "Maximum bearbeiten",
);

function formatNode(node: FormulaNode | null): string {
  return formatFormulaNode(node, {
    actions: props.previousActions.map(({ id, type, name }) => ({
      id,
      type,
      name,
    })),
    currentPropertyLabels: Object.fromEntries(
      currentProperties.value.map(({ value, label }) => [value, label]),
    ),
  });
}

function rootNode(path: string): FormulaNode | null {
  if (boundEditor.value) {
    return path === "bound-root" ? boundEditor.value.node : null;
  }
  if (path === "expression") {
    return working.value.expression;
  }
  return path === "min" ? working.value.min : path === "max" ? working.value.max : null;
}

function findNodeById(node: FormulaNode | null, id: string): FormulaNode | null {
  if (!node) {
    return null;
  }
  if (node.id === id) {
    return node;
  }
  for (const child of getChildren(node)) {
    const found = findNodeById(child, id);
    if (found) {
      return found;
    }
  }
  return null;
}

function findActiveNode(id: string): FormulaNode | null {
  const roots = boundEditor.value
    ? [boundEditor.value.node]
    : [working.value.expression, working.value.min, working.value.max];
  for (const root of roots) {
    const found = findNodeById(root, id);
    if (found) {
      return found;
    }
  }
  for (const node of activeRemembered.value) {
    const found = findNodeById(node, id);
    if (found) {
      return found;
    }
  }
  return null;
}

function getNodeAtPath(path: string): FormulaNode | null {
  const [rootName, childKey] = path.split(".");
  if (!rootName) {
    return null;
  }
  if (rootName === "remember" || rootName === "delete") {
    return null;
  }
  if (
    rootName === "expression" ||
    rootName === "min" ||
    rootName === "max" ||
    rootName === "bound-root"
  ) {
    if (childKey) {
      return null;
    }
    return rootNode(rootName);
  }
  if (!childKey) {
    return null;
  }
  const parent = findActiveNode(rootName);
  return getChild(parent, childKey);
}

function setNodeAtPath(path: string, node: FormulaNode | null): void {
  const [rootName, childKey] = path.split(".");
  if (!rootName) {
    return;
  }
  if (rootName === "bound-root" && boundEditor.value && !childKey) {
    boundEditor.value = { ...boundEditor.value, node };
    return;
  }
  if (
    !childKey &&
    (rootName === "expression" || rootName === "min" || rootName === "max")
  ) {
    if (boundEditor.value) {
      return;
    }
    if (rootName === "expression") {
      working.value = { ...working.value, expression: node };
    } else if (rootName === "min") {
      working.value = { ...working.value, min: node };
    } else {
      working.value = { ...working.value, max: node };
    }
    return;
  }
  if (!childKey || boundEditor.value && rootName !== "bound-root") {
    return;
  }
  if (boundEditor.value) {
    boundEditor.value = {
      ...boundEditor.value,
      node: replaceChildInTree(
        boundEditor.value.node,
        rootName,
        childKey,
        node,
      ),
      remembered: boundEditor.value.remembered.map(
        (root) => replaceChildInTree(root, rootName, childKey, node) ?? root,
      ),
    };
    return;
  }
  working.value = {
    ...working.value,
    expression: replaceChildInTree(
      working.value.expression,
      rootName,
      childKey,
      node,
    ),
    min: replaceChildInTree(working.value.min, rootName, childKey, node),
    max: replaceChildInTree(working.value.max, rootName, childKey, node),
  };
  mainRemembered.value = mainRemembered.value.map(
    (root) => replaceChildInTree(root, rootName, childKey, node) ?? root,
  );
}

function updateNode(updated: FormulaNode): void {
  if (working.value.expression?.id === updated.id) {
    fallbackSeed.value = getFallbackSeed(updated, fallbackSeed.value);
  }
  if (boundEditor.value) {
    boundEditor.value = {
      ...boundEditor.value,
      node: replaceNodeById(boundEditor.value.node, updated.id, updated),
      remembered: boundEditor.value.remembered.map(
        (node) => replaceNodeById(node, updated.id, updated) ?? node,
      ),
    };
    return;
  }
  working.value = {
    ...working.value,
    expression: replaceNodeById(
      working.value.expression,
      updated.id,
      updated,
    ),
    min: replaceNodeById(working.value.min, updated.id, updated),
    max: replaceNodeById(working.value.max, updated.id, updated),
  };
  mainRemembered.value = mainRemembered.value.map(
    (node) => replaceNodeById(node, updated.id, updated) ?? node,
  );
}

function startDraggingNode(nodeId: string, event: DragEvent): void {
  dragSource.value = { kind: "node", nodeId };
  if (event.dataTransfer) {
    event.dataTransfer.setData("text/plain", nodeId);
    event.dataTransfer.effectAllowed = "move";
  }
}

function endDraggingPalette(): void {
  dragSource.value = null;
  window.setTimeout(() => {
    suppressPaletteClick.value = false;
  }, 0);
}

function startDraggingPalette(
  item: FormulaPaletteItem,
  event: DragEvent,
): void {
  suppressPaletteClick.value = true;
  dragSource.value = { kind: "palette", item };
  if (event.dataTransfer) {
    event.dataTransfer.setData("text/plain", `palette:${item.type}`);
    event.dataTransfer.effectAllowed = "copy";
  }
}

function createPaletteNode(item: FormulaPaletteItem): FormulaNode {
  const node = createPaletteFormulaNode(item.type, fallbackSeed.value);
  return item.operator && node.type === "operator"
    ? { ...node, operator: item.operator }
    : node;
}

function addPaletteNode(item: FormulaPaletteItem): void {
  if (suppressPaletteClick.value) {
    suppressPaletteClick.value = false;
    return;
  }
  const node = createPaletteNode(item);
  if (!boundEditor.value && working.value.expression === null) {
    setNodeAtPath("expression", wrapExpression(node));
  } else if (boundEditor.value && boundEditor.value.node === null) {
    setNodeAtPath("bound-root", normalizeBoundNode(node));
  } else {
    activeRemembered.value.push(node);
  }
}

function handleDrop(path: string): void {
  const source = dragSource.value;
  dragSource.value = null;
  errors.value = [];
  if (!source || path === "delete") {
    if (source?.kind === "node" && path === "delete") {
      removeNode(source.nodeId);
    }
    return;
  }

  if (path === "remember") {
    if (source.kind === "palette") {
      activeRemembered.value.push(createPaletteNode(source.item));
      return;
    }
    const node = findActiveNode(source.nodeId);
    if (node) {
      removeNode(source.nodeId);
      activeRemembered.value.push(cloneFormulaNode(node));
    }
    return;
  }

  if (source.kind === "palette") {
    const node = createPaletteNode(source.item);
    if (canAccept(path, node) && getNodeAtPath(path) === null) {
      setNodeAtPath(path, normalizeForPath(path, node));
    }
    return;
  }

  const sourceNode = findActiveNode(source.nodeId);
  if (
    !sourceNode ||
    path.startsWith(`${source.nodeId}.`) ||
    getNodeAtPath(path) !== null
  ) {
    return;
  }
  if (!canAccept(path, sourceNode)) {
    errors.value = ["Dieser Formelbaustein passt nicht in das Ablagefeld."];
    return;
  }
  const movedNode = cloneFormulaNode(sourceNode);
  removeNode(source.nodeId);
  setNodeAtPath(path, normalizeForPath(path, movedNode));
}

function canAccept(path: string, node: FormulaNode): boolean {
  if (path === "delete") {
    return true;
  }
  const [rootName, childKey] = path.split(".");
  if (!rootName) {
    return false;
  }
  if (rootName === "remember") {
    return true;
  }
  if (
    rootName === "min" ||
    rootName === "max" ||
    rootName === "bound-root"
  ) {
    return true;
  }
  if (!childKey) {
    return rootName === "expression";
  }
  const parent = findActiveNode(rootName);
  if (!parent) {
    return false;
  }
  if (
    parent.type === "round" &&
    childKey === "input" &&
    (node.type !== "reference" ||
      (node.metric !== "minutes" && node.metric !== "sum-minutes"))
  ) {
    return false;
  }
  return true;
}

function normalizeForPath(path: string, node: FormulaNode): FormulaNode {
  if (path === "expression") {
    return wrapExpression(node);
  }
  const [parentId, childKey] = path.split(".");
  const parent = childKey ? findActiveNode(parentId ?? "") : null;
  if (
    (path === "min" ||
      path === "max" ||
      path === "bound-root" ||
      parent?.type === "clamp" && (childKey === "min" || childKey === "max")) &&
    node.type !== "static" &&
    node.type !== "fallback"
  ) {
    return ensureFormulaFallback(node, fallbackSeed.value) ?? node;
  }
  return node;
}

function wrapExpression(node: FormulaNode): FormulaNode {
  return ensureFormulaFallback(node, fallbackSeed.value) ?? node;
}

function normalizeBoundNode(node: FormulaNode): FormulaNode {
  return node.type === "static" || node.type === "fallback"
    ? node
    : ensureFormulaFallback(node, fallbackSeed.value) ?? node;
}

function removeNode(nodeId: string): void {
  if (boundEditor.value) {
    boundEditor.value = {
      ...boundEditor.value,
      node: removeNodeFromTree(boundEditor.value.node, nodeId),
      remembered: boundEditor.value.remembered
        .map((node) => removeNodeFromTree(node, nodeId))
        .filter((node): node is FormulaNode => node !== null),
    };
    return;
  }
  if (working.value.expression?.id === nodeId) {
    fallbackSeed.value = getFallbackSeed(
      working.value.expression,
      fallbackSeed.value,
    );
  }
  working.value = {
    ...working.value,
    expression: removeNodeFromTree(working.value.expression, nodeId),
    min: removeNodeFromTree(working.value.min, nodeId),
    max: removeNodeFromTree(working.value.max, nodeId),
  };
  mainRemembered.value = mainRemembered.value
    .map((node) => removeNodeFromTree(node, nodeId))
    .filter((node): node is FormulaNode => node !== null);
}

function editBound(kind: "min" | "max"): void {
  const node = working.value[kind];
  boundEditor.value = {
    kind,
    node: node ? cloneFormulaNode(node) : null,
    remembered: [],
  };
  errors.value = [];
}

function cancelBoundEdit(): void {
  boundEditor.value = null;
  errors.value = [];
}

function confirmBoundEdit(): void {
  const editor = boundEditor.value;
  if (!editor) {
    return;
  }
  if (editor.remembered.length > 0) {
    errors.value = ["Alle gemerkten Formelbausteine zuerst ablegen oder löschen."];
    return;
  }
  if (editor.kind === "min" && editor.node === null) {
    errors.value = ["Das Minimum kann nicht leer sein."];
    return;
  }
  if (editor.node) {
    const validation = validateFormulaNodeTree(editor.node);
    if (!validation.valid) {
      errors.value = validation.errors;
      return;
    }
    const boundValue = getStaticBoundValue(editor.node);
    if (
      boundValue !== null &&
      (boundValue < props.hardMin ||
        props.hardMax !== null && boundValue > props.hardMax)
    ) {
      errors.value = [
        `Der Wert muss zwischen ${props.hardMin} und ${props.hardMax ?? "unbegrenzt"} liegen.`,
      ];
      return;
    }
    working.value = {
      ...working.value,
      ...(editor.kind === "min"
        ? { min: normalizeBoundNode(editor.node) }
        : { max: normalizeBoundNode(editor.node) }),
    };
  } else {
    if (editor.kind === "max") {
      working.value = { ...working.value, max: null };
    }
  }
  boundEditor.value = null;
  errors.value = [];
}

function confirmFormula(): void {
  if (boundEditor.value) {
    return;
  }
  if (mainRemembered.value.length > 0) {
    errors.value = ["Alle gemerkten Formelbausteine zuerst ablegen oder löschen."];
    return;
  }
  const expression = working.value.expression
    ? wrapExpression(working.value.expression)
    : null;
  const candidate: NumericFormulaInput = {
    ...working.value,
    expression,
  };
  const validation = validateNumericFormulaInput(candidate);
  if (!validation.valid) {
    errors.value = validation.errors;
    return;
  }
  const normalized = normalizeNumericFormulaInput(
    candidate,
    props.defaultValue,
    props.hardMin,
    props.hardMax,
  );
  if (!normalized.valid) {
    errors.value = normalized.errors;
    return;
  }
  emit("confirm", normalized.value);
}

function cancelFormula(): void {
  emit("cancel");
}

function handleDialogKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape") {
    event.preventDefault();
    cancelFormula();
    return;
  }
  if (event.key !== "Tab") {
    return;
  }
  const focusable = dialogElement.value?.querySelectorAll<HTMLElement>(
    'button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])',
  );
  if (!focusable || focusable.length === 0) {
    return;
  }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last?.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first?.focus();
  }
}

onMounted(() => {
  window.addEventListener("keydown", handleDialogKeydown);
  dialogElement.value
    ?.querySelector<HTMLElement>("button, input, select")
    ?.focus();
});
onUnmounted(() => window.removeEventListener("keydown", handleDialogKeydown));

function getChildren(node: FormulaNode): (FormulaNode | null)[] {
  switch (node.type) {
    case "operator":
      return [node.left, node.right];
    case "clamp":
      return [node.min, node.input, node.max];
    case "fallback":
    case "round":
      return [node.input];
    case "static":
    case "reference":
    case "current":
      return [];
  }
}

function getChild(node: FormulaNode | null, key: string): FormulaNode | null {
  if (!node) {
    return null;
  }
  if (node.type === "operator" && (key === "left" || key === "right")) {
    return node[key];
  }
  if (node.type === "clamp" && (key === "min" || key === "input" || key === "max")) {
    return node[key];
  }
  if ((node.type === "fallback" || node.type === "round") && key === "input") {
    return node.input;
  }
  return null;
}

function replaceNodeById(
  node: FormulaNode | null,
  id: string,
  replacement: FormulaNode,
): FormulaNode | null {
  if (!node) {
    return null;
  }
  if (node.id === id) {
    return replacement;
  }
  switch (node.type) {
    case "operator":
      return {
        ...node,
        left: replaceNodeById(node.left, id, replacement),
        right: replaceNodeById(node.right, id, replacement),
      };
    case "clamp":
      return {
        ...node,
        min: replaceNodeById(node.min, id, replacement),
        input: replaceNodeById(node.input, id, replacement),
        max: replaceNodeById(node.max, id, replacement),
      };
    case "fallback":
    case "round":
      return { ...node, input: replaceNodeById(node.input, id, replacement) };
    case "static":
    case "reference":
    case "current":
      return node;
  }
}

function replaceChildInTree(
  node: FormulaNode | null,
  parentId: string,
  childKey: string,
  child: FormulaNode | null,
): FormulaNode | null {
  if (!node) {
    return null;
  }
  if (node.id === parentId) {
    if (node.type === "operator" && (childKey === "left" || childKey === "right")) {
      return { ...node, [childKey]: child };
    }
    if (node.type === "clamp" && (childKey === "min" || childKey === "input" || childKey === "max")) {
      return { ...node, [childKey]: child };
    }
    if ((node.type === "fallback" || node.type === "round") && childKey === "input") {
      return { ...node, input: child };
    }
    return node;
  }
  switch (node.type) {
    case "operator":
      return {
        ...node,
        left: replaceChildInTree(node.left, parentId, childKey, child),
        right: replaceChildInTree(node.right, parentId, childKey, child),
      };
    case "clamp":
      return {
        ...node,
        min: replaceChildInTree(node.min, parentId, childKey, child),
        input: replaceChildInTree(node.input, parentId, childKey, child),
        max: replaceChildInTree(node.max, parentId, childKey, child),
      };
    case "fallback":
    case "round":
      return {
        ...node,
        input: replaceChildInTree(node.input, parentId, childKey, child),
      };
    case "static":
    case "reference":
    case "current":
      return node;
  }
}

function removeNodeFromTree(
  node: FormulaNode | null,
  id: string,
): FormulaNode | null {
  if (!node || node.id === id) {
    return null;
  }
  switch (node.type) {
    case "operator":
      return {
        ...node,
        left: removeNodeFromTree(node.left, id),
        right: removeNodeFromTree(node.right, id),
      };
    case "clamp":
      return {
        ...node,
        min: removeNodeFromTree(node.min, id),
        input: removeNodeFromTree(node.input, id),
        max: removeNodeFromTree(node.max, id),
      };
    case "fallback":
    case "round":
      return { ...node, input: removeNodeFromTree(node.input, id) };
    case "static":
    case "reference":
    case "current":
      return node;
  }
}

function getStaticBoundValue(node: FormulaNode): number | null {
  if (node.type === "static") {
    return node.value;
  }
  if (node.type === "fallback") {
    return node.fallback;
  }
  return null;
}

function getFallbackSeed(
  node: FormulaNode | null,
  fallback: number,
): number {
  if (node?.type === "static") {
    return node.value;
  }
  if (node?.type === "fallback") {
    return node.fallback;
  }
  return fallback;
}
</script>

<template>
  <div class="formula-dialog-backdrop" role="presentation" @click.self="cancelFormula">
    <section
      ref="dialogElement"
      class="formula-dialog"
      role="dialog"
      aria-modal="true"
      :aria-label="`${label} bearbeiten`"
    >
      <header class="formula-dialog-header">
        <h2>{{ isEditingBound ? boundTitle : `${label} bearbeiten` }}</h2>
        <button
          class="icon-button secondary-button"
          type="button"
          aria-label="Formeleditor schließen"
          @click="cancelFormula"
        >
          ×
        </button>
      </header>

      <template v-if="!isEditingBound">
        <fieldset class="formula-editor-fieldset">
          <legend>Formel</legend>
          <div class="formula-field-scroll">
            <FormulaNodeRenderer
              :node="working.expression"
              path="expression"
              :actions="previousActions"
              :current-properties="currentProperties"
              required
              root
              @update:node="updateNode"
              @drop="handleDrop"
              @drag-node="startDraggingNode"
            />
          </div>
        </fieldset>
      </template>

      <template v-else-if="boundEditor">
        <p class="field-help">
          Die Änderung wird zunächst nur im Formeldialog übernommen. Erst
          „Bestätigen“ speichert die gesamte Formel.
        </p>
        <fieldset class="formula-editor-fieldset">
          <legend>Formel</legend>
          <div class="formula-field-scroll">
            <FormulaNodeRenderer
              :node="boundEditor.node"
              path="bound-root"
              :actions="previousActions"
              :current-properties="currentProperties"
              :required="boundEditor.kind === 'min'"
              root
              @update:node="updateNode"
              @drop="handleDrop"
              @drag-node="startDraggingNode"
            />
          </div>
        </fieldset>
      </template>

      <div class="formula-editor-tools">
        <fieldset class="formula-tool-fieldset">
          <legend>Merken</legend>
          <FormulaDropZone
            path="remember"
            label="Ablegen"
            tone="remember"
            @drop="handleDrop"
          />
          <div v-if="activeRemembered.length > 0" class="formula-remembered-list">
            <FormulaNodeRenderer
              v-for="node in activeRemembered"
              :key="node.id"
              :node="node"
              :path="`remembered.${node.id}`"
              :actions="previousActions"
              :current-properties="currentProperties"
              @update:node="updateNode"
              @drop="handleDrop"
              @drag-node="startDraggingNode"
            />
          </div>
        </fieldset>

        <fieldset class="formula-tool-fieldset formula-tool-fieldset--delete">
          <legend>Löschen</legend>
          <FormulaDropZone
            path="delete"
            label="Ablegen"
            tone="delete"
            @drop="handleDrop"
          />
        </fieldset>

        <fieldset class="formula-tool-fieldset">
          <legend>Hinzufügen</legend>
          <div class="formula-palette-operators">
            <button
              v-for="item in operatorPaletteItems"
              :key="item.label"
              class="formula-palette-item"
              :class="`formula-node--${item.type}`"
              type="button"
              draggable="true"
              @click="addPaletteNode(item)"
              @dragstart="startDraggingPalette(item, $event)"
              @dragend="endDraggingPalette"
            >
              {{ item.label }}
            </button>
          </div>
          <div class="formula-palette formula-palette-items">
            <button
              v-for="item in otherPaletteItems"
              :key="item.type"
              class="formula-palette-item"
              :class="`formula-node--${item.type}`"
              type="button"
              draggable="true"
              @click="addPaletteNode(item)"
              @dragstart="startDraggingPalette(item, $event)"
              @dragend="endDraggingPalette"
            >
              {{ item.label }}
            </button>
          </div>
        </fieldset>
      </div>

      <fieldset v-if="!isEditingBound" class="formula-editor-fieldset">
        <legend>Ergebnisbegrenzung</legend>
        <p class="field-help">
          Zulässiger Bereich: {{ hardMin }} bis
          {{ hardMax ?? "unbegrenzt" }}.
        </p>
        <div class="formula-bound-list">
          <div class="formula-bound-card">
            <strong>Minimum</strong>
            <span>{{ formatNode(working.min) }}</span>
            <button
              class="secondary-button"
              type="button"
              @click="editBound('min')"
            >
              Minimum einschränken
            </button>
          </div>
          <div class="formula-bound-card">
            <strong>Maximum</strong>
            <span>{{ formatNode(working.max) }}</span>
            <button
              class="secondary-button"
              type="button"
              @click="editBound('max')"
            >
              Maximum einschränken
            </button>
          </div>
        </div>
      </fieldset>

      <ul v-if="errors.length > 0" class="formula-validation-errors" role="alert">
        <li v-for="error in errors" :key="error">{{ error }}</li>
      </ul>

      <div class="button-row formula-dialog-actions">
        <template v-if="isEditingBound">
          <button
            class="secondary-button"
            type="button"
            @click="cancelBoundEdit"
          >
            Zur Formel zurück
          </button>
          <button
            class="primary-button"
            type="button"
            @click="confirmBoundEdit"
          >
            Grenze übernehmen
          </button>
        </template>
        <template v-else>
          <button
            class="secondary-button"
            type="button"
            @click="cancelFormula"
          >
            Abbrechen
          </button>
          <button
            class="primary-button"
            type="button"
            @click="confirmFormula"
          >
            Bestätigen
          </button>
        </template>
      </div>
    </section>
  </div>
</template>
