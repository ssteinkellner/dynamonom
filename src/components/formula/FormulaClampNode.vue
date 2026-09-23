<script setup lang="ts">
import type { FormulaClampNode } from "../../formula-model.ts";

defineProps<{ node: FormulaClampNode }>();
</script>

<template>
  <div class="formula-node formula-node--clamp">
    <div class="formula-clamp-layout">
      <div class="formula-node-slot">
        <span class="formula-node-caption">Min</span>
        <slot name="min" />
      </div>
      <span class="formula-clamp-symbol" aria-hidden="true">≤</span>
      <div class="formula-node-slot">
        <span class="formula-node-caption">Wert</span>
        <slot name="input" />
      </div>
      <span class="formula-clamp-symbol" aria-hidden="true">≤</span>
      <div class="formula-node-slot">
        <span class="formula-node-caption">Max</span>
        <slot name="max" />
      </div>
    </div>
  </div>
</template>
