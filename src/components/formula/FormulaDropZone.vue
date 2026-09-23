<script setup lang="ts">
const props = defineProps<{
  path: string;
  label?: string;
  tone?: "default" | "remember" | "delete";
}>();

const emit = defineEmits<{
  drop: [path: string];
}>();

function allowDrop(event: DragEvent): void {
  event.preventDefault();
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = "move";
  }
}

function receiveDrop(event: DragEvent): void {
  event.preventDefault();
  event.stopPropagation();
  emit("drop", props.path);
}
</script>

<template>
  <div
    class="formula-drop-zone"
    :class="`formula-drop-zone--${tone ?? 'default'}`"
    :data-formula-path="path"
    @dragover="allowDrop"
    @drop="receiveDrop"
  >
    <span v-if="label" class="formula-drop-label">{{ label }}</span>
    <slot />
  </div>
</template>
