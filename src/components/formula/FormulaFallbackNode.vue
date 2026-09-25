<script setup lang="ts">
import type { FormulaFallbackNode } from "../../formula-model.ts";

defineProps<{ node: FormulaFallbackNode }>();
const emit = defineEmits<{
  "update:node": [node: FormulaFallbackNode];
}>();

function updateFallback(event: Event, node: FormulaFallbackNode): void {
  const input = event.target;
  if (!(input instanceof HTMLInputElement)) {
    return;
  }
  const fallback = Number(input.value);
  if (Number.isSafeInteger(fallback)) {
    emit("update:node", { ...node, fallback });
  }
}
</script>

<template>
  <div class="formula-node formula-node--fallback">
    <div class="formula-fallback-layout">
      <div class="formula-node-slot">
        <slot name="input" />
      </div>
      <div class="formula-fallback-value">
        <input
          type="number"
          step="1"
          :value="node.fallback"
          aria-label="Ersatzwert"
          @input="updateFallback($event, node)"
        />
      </div>
    </div>
  </div>
</template>
