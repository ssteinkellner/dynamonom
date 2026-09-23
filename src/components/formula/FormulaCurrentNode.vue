<script setup lang="ts">
import type { FormulaCurrentNode } from "../../formula-model.ts";

defineProps<{
  node: FormulaCurrentNode;
  currentProperties: readonly { value: string; label: string }[];
}>();
const emit = defineEmits<{
  "update:node": [node: FormulaCurrentNode];
}>();

function updateProperty(event: Event, node: FormulaCurrentNode): void {
  const select = event.target;
  if (!(select instanceof HTMLSelectElement)) {
    return;
  }
  emit("update:node", { ...node, property: select.value });
}
</script>

<template>
  <div class="formula-node formula-node--current">
    <label :for="`formula-current-${node.id}`">Aktuelle Einstellung</label>
    <select
      :id="`formula-current-${node.id}`"
      :value="node.property"
      @change="updateProperty($event, node)"
    >
      <option value="" disabled>Eigenschaft auswählen</option>
      <option
        v-for="property in currentProperties"
        :key="property.value"
        :value="property.value"
      >
        {{ property.label }}
      </option>
    </select>
  </div>
</template>
