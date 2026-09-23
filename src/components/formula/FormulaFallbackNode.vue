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
        <span class="formula-node-caption">Formel</span>
        <slot name="input" />
      </div>
      <label class="formula-fallback-value">
        Ersatzwert
        <input
          type="number"
          step="1"
          :value="node.fallback"
          @input="updateFallback($event, node)"
        />
      </label>
    </div>
  </div>
</template>
