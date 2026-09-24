<script setup lang="ts">
import type {
  FormulaOperator,
  FormulaOperatorNode,
} from "../../formula-model.ts";

defineProps<{ node: FormulaOperatorNode }>();
const emit = defineEmits<{
  "update:node": [node: FormulaOperatorNode];
}>();

const operators: readonly FormulaOperator[] = ["+", "-", "*", "/"];

function updateOperator(event: Event, node: FormulaOperatorNode): void {
  const input = event.target;
  if (!(input instanceof HTMLSelectElement)) {
    return;
  }
  if (!operators.includes(input.value as FormulaOperator)) {
    return;
  }
  emit("update:node", { ...node, operator: input.value as FormulaOperator });
}
</script>

<template>
  <div class="formula-node formula-node--operator">
    <div class="formula-operator-layout">
      <div class="formula-node-slot">
        <slot name="left" />
      </div>
      <label class="visually-hidden" :for="`formula-operator-${node.id}`">
        Rechenzeichen
      </label>
      <select
        :id="`formula-operator-${node.id}`"
        :value="node.operator"
        aria-label="Rechenzeichen"
        @change="updateOperator($event, node)"
      >
        <option v-for="operator in operators" :key="operator" :value="operator">
          {{ operator }}
        </option>
      </select>
      <div class="formula-node-slot">
        <slot name="right" />
      </div>
    </div>
  </div>
</template>
