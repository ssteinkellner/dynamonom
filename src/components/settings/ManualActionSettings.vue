<script setup lang="ts">
import type { ManualAction } from "../../action-model.ts";

const props = defineProps<{
  settings: ManualAction["settings"];
  errors: Readonly<Record<string, string>>;
}>();

const emit = defineEmits<{
  "update:settings": [settings: ManualAction["settings"]];
}>();

function updateLimitEnabled(event: Event): void {
  const input = event.target;
  if (!(input instanceof HTMLInputElement)) {
    return;
  }
  emit("update:settings", {
    limitSeconds: input.checked ? props.settings.limitSeconds ?? 60 : null,
  });
}

function updateLimit(event: Event): void {
  const input = event.target;
  if (!(input instanceof HTMLInputElement)) {
    return;
  }
  emit("update:settings", {
    limitSeconds: Number(input.value),
  });
}
</script>

<template>
  <div class="action-type-fields">
    <fieldset>
      <legend>Zeitlimit</legend>
      <div class="option-card checkbox-option-card">
        <label class="checkbox-label">
          <input
            type="checkbox"
            :checked="settings.limitSeconds !== null"
            @change="updateLimitEnabled"
          />
          Zeitlimit anzeigen
        </label>
        <div v-if="settings.limitSeconds !== null" class="option-details input-wrapper">
          <label for="action-manual-limit">Zeitlimit in Sekunden</label>
          <input
            id="action-manual-limit"
            type="number"
            min="1"
            max="600"
            step="1"
            :value="settings.limitSeconds"
            :aria-invalid="errors.limitSeconds ? 'true' : undefined"
            @input="updateLimit"
          />
          <p class="field-help">
            Das Limit beendet die Aktion nicht automatisch.
          </p>
          <p v-if="errors.limitSeconds" class="field-error">
            {{ errors.limitSeconds }}
          </p>
        </div>
      </div>
    </fieldset>
  </div>
</template>
