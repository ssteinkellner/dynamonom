<script setup lang="ts">
import { computed } from "vue";
import {
  ACTION_TYPES,
  getActionTypeLabel,
} from "../../action-model.ts";
import type { Action } from "../../action-model.ts";
import {
  FORMULA_METRIC_LABELS,
  type FormulaMetric,
  type FormulaReferenceNode,
} from "../../formula-model.ts";

const props = defineProps<{
  node: FormulaReferenceNode;
  actions: readonly Action[];
}>();
const emit = defineEmits<{
  "update:node": [node: FormulaReferenceNode];
}>();

const sourceAction = computed(() =>
  props.actions.find((action) => action.id === props.node.actionId),
);
const metrics = computed(() => {
  const options: FormulaMetric[] = [
    "minutes",
    "sum-minutes",
    "seconds-absolute",
    "seconds-rest",
  ];
  if (sourceAction.value?.type === ACTION_TYPES.METRONOME) {
    options.push("end-bpm");
  }
  return options;
});

function updateAction(event: Event, node: FormulaReferenceNode): void {
  const select = event.target;
  if (!(select instanceof HTMLSelectElement)) {
    return;
  }
  const action = props.actions.find((candidate) => candidate.id === select.value);
  if (!action) {
    return;
  }
  const metric =
    node.metric === "end-bpm" && action.type !== ACTION_TYPES.METRONOME
      ? "minutes"
      : node.metric;
  emit("update:node", { ...node, actionId: action.id, metric });
}

function updateMetric(event: Event, node: FormulaReferenceNode): void {
  const select = event.target;
  if (!(select instanceof HTMLSelectElement)) {
    return;
  }
  if (!metrics.value.includes(select.value as FormulaMetric)) {
    return;
  }
  emit("update:node", { ...node, metric: select.value as FormulaMetric });
}
</script>

<template>
  <div class="formula-node formula-node--reference">
    <select
      :id="`formula-reference-action-${node.id}`"
      :value="node.actionId"
      aria-label="Aktion"
      @change="updateAction($event, node)"
    >
      <option value="" disabled>Vorherige Aktion auswählen</option>
      <option v-for="action in actions" :key="action.id" :value="action.id">
        {{ getActionTypeLabel(action.type) }} – {{ action.name }}
      </option>
    </select>
    <select
      :id="`formula-reference-metric-${node.id}`"
      :value="node.metric"
      aria-label="Wert"
      @change="updateMetric($event, node)"
    >
      <option v-for="metric in metrics" :key="metric" :value="metric">
        {{ FORMULA_METRIC_LABELS[metric] }}
      </option>
    </select>
  </div>
</template>
