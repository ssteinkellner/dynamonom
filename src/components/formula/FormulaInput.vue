<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import { getEnabledCurrentFormulaProperties } from "../../action-model.ts";
import type { Action } from "../../action-model.ts";
import {
  formatFormulaNode,
  type NumericFormulaInput,
} from "../../formula-model.ts";
import { getFormulaFieldLabel } from "../../models/action-formulas.ts";
import FormulaEditorDialog from "./FormulaEditorDialog.vue";

const props = defineProps<{
  id?: string;
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
  "update:modelValue": [input: NumericFormulaInput];
}>();

const isOpen = ref(false);
const button = ref<HTMLButtonElement | null>(null);
const formulaContext = computed(() => ({
  actions: props.previousActions.map(({ id, type, name }) => ({
    id,
    type,
    name,
  })),
  currentPropertyLabels: Object.fromEntries(
    [
      ...getEnabledCurrentFormulaProperties(props.action),
      ...(props.field === "breakSeconds" ? ["current-bpm"] : []),
    ].map((property) => [
      property,
      property === "current-bpm"
        ? "Aktuelles BPM"
        : getFormulaFieldLabel(property),
    ]),
  ),
}));
const expressionLabel = computed(() =>
  formatFormulaNode(props.modelValue.expression, formulaContext.value),
);
const rangeLabel = computed(() => {
  const minimum = formatFormulaNode(
    props.modelValue.min,
    formulaContext.value,
  );
  const maximum = props.modelValue.max
    ? formatFormulaNode(props.modelValue.max, formulaContext.value)
    : "unbegrenzt";
  return `Min ${minimum}; Max ${maximum}`;
});

function closeDialog(): void {
  isOpen.value = false;
  void nextTick(() => button.value?.focus());
}

function confirm(input: NumericFormulaInput): void {
  emit("update:modelValue", input);
  closeDialog();
}
</script>

<template>
  <button
    ref="button"
    :id="id"
    class="formula-input-button"
    type="button"
    :aria-label="`${label}: ${expressionLabel}, ${rangeLabel}`"
    @click="isOpen = true"
  >
    <span class="formula-input-expression">{{ expressionLabel }}</span>
  </button>

  <FormulaEditorDialog
    v-if="isOpen"
    :model-value="modelValue"
    :action="action"
    :previous-actions="previousActions"
    :field="field"
    :label="label"
    :default-value="defaultValue"
    :hard-min="hardMin"
    :hard-max="hardMax"
    @confirm="confirm"
    @cancel="closeDialog"
  />
</template>
