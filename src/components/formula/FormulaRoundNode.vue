<script setup lang="ts">
import { computed, watch } from "vue";
import {
  getFormulaRoundConfig,
  type FormulaRoundNode,
} from "../../formula-model.ts";

const props = defineProps<{ node: FormulaRoundNode }>();
const emit = defineEmits<{
  "update:node": [node: FormulaRoundNode];
}>();

const roundConfig = computed(() => getFormulaRoundConfig(props.node.input));
const thresholdLabel = computed(() => {
  if (roundConfig.value?.kind === "days") {
    return "Stunden";
  }
  if (
    roundConfig.value?.kind === "months" ||
    roundConfig.value?.kind === "division"
  ) {
    return "Tage";
  }
  return "Sekunden";
});
const thresholdMin = computed(() => roundConfig.value?.min ?? 0);
const thresholdMax = computed(() => roundConfig.value?.max ?? 60);

watch(
  () => roundConfig.value?.kind,
  (kind, previousKind) => {
    if (
      !kind ||
      kind === "division" ||
      kind === previousKind ||
      !roundConfig.value
    ) {
      return;
    }
    emit("update:node", {
      ...props.node,
      threshold: roundConfig.value.defaultThreshold,
    });
  },
);

function updateThreshold(event: Event, node: FormulaRoundNode): void {
  const input = event.target;
  if (!(input instanceof HTMLInputElement)) {
    return;
  }
  const threshold = Number(input.value);
  const config = roundConfig.value;
  if (
    config &&
    config.kind !== "division" &&
    Number.isSafeInteger(threshold) &&
    threshold >= config.min &&
    threshold <= config.max
  ) {
    emit("update:node", { ...node, threshold });
  }
}
</script>

<template>
  <div class="formula-node formula-node--round">
    <div class="formula-round-layout">
      <div class="formula-node-slot">
        <slot name="input" />
      </div>
      <label v-if="roundConfig?.kind !== 'division'">
        Schwelle ({{ thresholdLabel }})
        <input
          type="number"
          :min="thresholdMin"
          :max="thresholdMax"
          step="1"
          :value="node.threshold"
          @input="updateThreshold($event, node)"
        />
      </label>
    </div>
  </div>
</template>
