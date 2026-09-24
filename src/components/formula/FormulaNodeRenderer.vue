<script setup lang="ts">
import { computed, type Component } from "vue";
import type { Action } from "../../action-model.ts";
import type { FormulaNode } from "../../formula-model.ts";
import FormulaClampNode from "./FormulaClampNode.vue";
import FormulaCurrentNode from "./FormulaCurrentNode.vue";
import FormulaDropZone from "./FormulaDropZone.vue";
import FormulaFallbackNode from "./FormulaFallbackNode.vue";
import FormulaOperatorNode from "./FormulaOperatorNode.vue";
import FormulaReferenceNode from "./FormulaReferenceNode.vue";
import FormulaRoundNode from "./FormulaRoundNode.vue";
import FormulaStaticNode from "./FormulaStaticNode.vue";

const props = defineProps<{
  node: FormulaNode | null;
  path: string;
  actions: readonly Action[];
  currentProperties: readonly { value: string; label: string }[];
  required?: boolean;
  root?: boolean;
}>();

const emit = defineEmits<{
  "update:node": [node: FormulaNode];
  drop: [path: string];
  "drag-node": [nodeId: string, event: DragEvent];
}>();

const nodeComponents: Record<FormulaNode["type"], Component> = {
  static: FormulaStaticNode,
  operator: FormulaOperatorNode,
  clamp: FormulaClampNode,
  fallback: FormulaFallbackNode,
  reference: FormulaReferenceNode,
  current: FormulaCurrentNode,
  round: FormulaRoundNode,
};
const componentProps = computed(() => {
  if (!props.node) {
    return {};
  }
  if (props.node.type === "reference") {
    return { node: props.node, actions: props.actions };
  }
  if (props.node.type === "current") {
    return {
      node: props.node,
      currentProperties: props.currentProperties,
    };
  }
  return { node: props.node };
});

function handleNodeUpdate(node: FormulaNode): void {
  emit("update:node", node);
}

function handleDrop(path: string): void {
  emit("drop", path);
}

function startDragging(event: DragEvent): void {
  if (!props.node) {
    return;
  }
  event.stopPropagation();
  if (event.dataTransfer) {
    event.dataTransfer.setData("text/plain", props.node.id);
    event.dataTransfer.effectAllowed = "move";
  }
  emit("drag-node", props.node.id, event);
}

function forwardDragNode(nodeId: string, event: DragEvent): void {
  emit("drag-node", nodeId, event);
}
</script>

<template>
  <FormulaDropZone
    v-if="node === null"
    :path="path"
    label="Ablegen"
    :required="required"
    :root="root"
    @drop="handleDrop"
  />
  <div
    v-else
    class="formula-node-drag-wrapper"
    :class="{ 'formula-node-drag-wrapper--root': root }"
    :key="node.id"
    draggable="true"
    @dragstart="startDragging"
  >
    <component
      :is="nodeComponents[node.type]"
      v-bind="componentProps"
      @update:node="handleNodeUpdate"
    >
      <template #left>
        <FormulaNodeRenderer
          :node="node.type === 'operator' ? node.left : null"
          :path="`${node.id}.left`"
          :actions="actions"
          :current-properties="currentProperties"
          required
          @update:node="handleNodeUpdate"
          @drop="handleDrop"
          @drag-node="forwardDragNode"
        />
      </template>
      <template #right>
        <FormulaNodeRenderer
          :node="node.type === 'operator' ? node.right : null"
          :path="`${node.id}.right`"
          :actions="actions"
          :current-properties="currentProperties"
          required
          @update:node="handleNodeUpdate"
          @drop="handleDrop"
          @drag-node="forwardDragNode"
        />
      </template>
      <template #min>
        <FormulaNodeRenderer
          :node="node.type === 'clamp' ? node.min : null"
          :path="`${node.id}.min`"
          :actions="actions"
          :current-properties="currentProperties"
          required
          @update:node="handleNodeUpdate"
          @drop="handleDrop"
          @drag-node="forwardDragNode"
        />
      </template>
      <template #input>
        <FormulaNodeRenderer
          :node="
            node.type === 'clamp' ||
            node.type === 'fallback' ||
            node.type === 'round'
              ? node.input
              : null
          "
          :path="`${node.id}.input`"
          :actions="actions"
          :current-properties="currentProperties"
          required
          @update:node="handleNodeUpdate"
          @drop="handleDrop"
          @drag-node="forwardDragNode"
        />
      </template>
      <template #max>
        <FormulaNodeRenderer
          :node="node.type === 'clamp' ? node.max : null"
          :path="`${node.id}.max`"
          :actions="actions"
          :current-properties="currentProperties"
          @update:node="handleNodeUpdate"
          @drop="handleDrop"
          @drag-node="forwardDragNode"
        />
      </template>
    </component>
  </div>
</template>
