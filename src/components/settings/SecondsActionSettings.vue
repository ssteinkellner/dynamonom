<script setup lang="ts">
import type { SecondsAction } from "../../action-model.ts";

const props = defineProps<{
  settings: SecondsAction["settings"];
  errors: Readonly<Record<string, string>>;
}>();

const emit = defineEmits<{
  "update:settings": [settings: SecondsAction["settings"]];
}>();

function updateSeconds(event: Event): void {
  const input = event.target;
  if (!(input instanceof HTMLInputElement)) {
    return;
  }
  emit("update:settings", { seconds: Number(input.value) });
}
</script>

<template>
  <div class="action-type-fields">
    <fieldset>
      <legend>Dauer</legend>
      <div class="field input-wrapper">
        <label for="action-seconds">
          Sekunden <span class="required-marker" aria-hidden="true">*</span>
        </label>
        <input
          id="action-seconds"
          type="number"
          min="1"
          max="600"
          step="1"
          :value="settings.seconds"
          :aria-invalid="errors.seconds ? 'true' : undefined"
          @input="updateSeconds"
        />
        <p class="field-help">Die Aktion wird nach Ablauf automatisch fortgesetzt.</p>
        <p v-if="errors.seconds" class="field-error">{{ errors.seconds }}</p>
      </div>
    </fieldset>
  </div>
</template>
