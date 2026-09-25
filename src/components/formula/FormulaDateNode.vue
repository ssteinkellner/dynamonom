<script setup lang="ts">
import type { FormulaDateNode } from "../../formula-model.ts";

const props = defineProps<{ node: FormulaDateNode }>();
const emit = defineEmits<{
  "update:node": [node: FormulaDateNode];
}>();

function updateDate(event: Event): void {
  const input = event.target;
  if (!(input instanceof HTMLInputElement)) {
    return;
  }
  emit("update:node", { ...props.node, date: input.value });
}
</script>

<template>
  <div class="formula-node" :class="`formula-node--${node.type}`">
    <label :for="`formula-date-${node.id}`">
      Datum
      <input
        :id="`formula-date-${node.id}`"
        class="formula-date-input"
        type="date"
        :value="node.date"
        aria-label="Datum"
        @input="updateDate"
      />
    </label>
  </div>
</template>
