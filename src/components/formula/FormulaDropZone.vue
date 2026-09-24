<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  path: string;
  label?: string;
  tone?: "default" | "remember" | "delete";
  required?: boolean;
  root?: boolean;
}>();

const emit = defineEmits<{
  drop: [path: string];
}>();

const accessibleLabel = computed(() =>
  props.label
    ? props.required
      ? `${props.label}, Pflichtfeld`
      : props.label
    : props.required
      ? "Pflichtfeld"
      : undefined,
);

function allowDrop(event: DragEvent): void {
  event.preventDefault();
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect =
      event.dataTransfer.effectAllowed === "copy" ? "copy" : "move";
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
    :class="[
      `formula-drop-zone--${tone ?? 'default'}`,
      { 'formula-drop-zone--root': root },
    ]"
    :data-formula-path="path"
    role="group"
    :aria-label="accessibleLabel"
    @dragover="allowDrop"
    @drop="receiveDrop"
  >
    <span v-if="label" class="formula-drop-label">
      {{ label
      }}<span v-if="required" class="required-marker" aria-hidden="true"
        >*</span
      >
    </span>
    <slot />
  </div>
</template>
