<script setup lang="ts">
import type { FormulaRoundNode } from "../../formula-model.ts";

defineProps<{ node: FormulaRoundNode }>();
const emit = defineEmits<{
  "update:node": [node: FormulaRoundNode];
}>();

function updateThreshold(event: Event, node: FormulaRoundNode): void {
  const input = event.target;
  if (!(input instanceof HTMLInputElement)) {
    return;
  }
  const threshold = Number(input.value);
  if (Number.isSafeInteger(threshold) && threshold >= 0 && threshold <= 60) {
    emit("update:node", { ...node, threshold });
  }
}
</script>

<template>
  <div class="formula-node formula-node--round">
    <div class="formula-round-layout">
      <div class="formula-node-slot">
        <span class="formula-node-caption">Minutenreferenz</span>
        <slot name="input" />
      </div>
      <label>
        Schwelle (Sekunden)
        <input
          type="number"
          min="0"
          max="60"
          step="1"
          :value="node.threshold"
          @input="updateThreshold($event, node)"
        />
      </label>
    </div>
  </div>
</template>
