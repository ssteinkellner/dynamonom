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
    <div class="formula-date-control">
      <span class="formula-date-marker" aria-hidden="true">
        {{ node.type === "days" ? "D:" : "M:" }}
      </span>
      <input
        :id="`formula-date-${node.id}`"
        class="formula-date-input"
        type="date"
        :value="node.date"
        :aria-label="node.type === 'days' ? 'Tage-Datum' : 'Monate-Datum'"
        @input="updateDate"
      />
    </div>
  </div>
</template>
