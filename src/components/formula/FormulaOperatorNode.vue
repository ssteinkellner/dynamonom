<script setup lang="ts">
import type { FormulaOperatorNode } from "../../formula-model.ts";

defineProps<{ node: FormulaOperatorNode }>();

const operatorGlyphs: Readonly<
  Record<FormulaOperatorNode["operator"], string>
> = {
  "+": "+",
  "-": "−",
  "*": "×",
  "/": "÷",
};
</script>

<template>
  <div class="formula-node formula-node--operator">
    <div class="formula-operator-layout">
      <div class="formula-node-slot">
        <slot name="left" />
      </div>
      <span class="formula-operator-symbol" :aria-label="`Rechenzeichen ${operatorGlyphs[node.operator]}`">
        {{ operatorGlyphs[node.operator] }}
      </span>
      <div class="formula-node-slot">
        <slot name="right" />
      </div>
    </div>
  </div>
</template>
