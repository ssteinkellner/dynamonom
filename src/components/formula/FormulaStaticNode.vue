<script setup lang="ts">
import type { FormulaStaticNode } from "../../formula-model.ts";

defineProps<{ node: FormulaStaticNode }>();
const emit = defineEmits<{
  "update:node": [node: FormulaStaticNode];
}>();

function updateValue(event: Event, node: FormulaStaticNode): void {
  const input = event.target;
  if (!(input instanceof HTMLInputElement)) {
    return;
  }
  const value = Number(input.value);
  if (Number.isSafeInteger(value)) {
    emit("update:node", { ...node, value });
  }
}
</script>

<template>
  <div class="formula-node formula-node--static">
    <label class="visually-hidden" :for="`formula-static-${node.id}`">
      Feste Zahl
    </label>
    <input
      :id="`formula-static-${node.id}`"
      type="number"
      step="1"
      :value="node.value"
      @input="updateValue($event, node)"
    />
  </div>
</template>
