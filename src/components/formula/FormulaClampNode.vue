<script setup lang="ts">
import type { FormulaClampNode } from "../../formula-model.ts";

defineProps<{ node: FormulaClampNode }>();
</script>

<template>
  <div class="formula-node formula-node--clamp">
    <div class="formula-clamp-layout">
      <div class="formula-node-slot">
        <slot name="min" />
      </div>
      <span class="formula-clamp-symbol" aria-hidden="true">≤</span>
      <div class="formula-node-slot">
        <slot name="input" />
      </div>
      <span class="formula-clamp-symbol" aria-hidden="true">≤</span>
      <div class="formula-node-slot">
        <slot name="max" />
      </div>
    </div>
  </div>
</template>
