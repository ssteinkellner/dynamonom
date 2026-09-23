<script setup lang="ts">
import type { Action, ManualAction } from "../../action-model.ts";
import { createNumericFormulaInput } from "../../formula-model.ts";
import type { NumericFormulaInput } from "../../formula-model.ts";
import FormulaInput from "../formula/FormulaInput.vue";

const props = defineProps<{
  action: Action;
  previousActions: readonly Action[];
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
    limitSeconds: input.checked
      ? props.settings.limitSeconds ?? createNumericFormulaInput(60, 1, 600)
      : null,
  });
}

function updateLimit(limitSeconds: NumericFormulaInput): void {
  emit("update:settings", { limitSeconds });
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
        <div
          v-if="settings.limitSeconds !== null"
          class="option-details input-wrapper"
        >
          <label for="action-manual-limit">Zeitlimit in Sekunden</label>
          <FormulaInput
            id="action-manual-limit"
            :model-value="settings.limitSeconds"
            :action="action"
            :previous-actions="previousActions"
            field="limitSeconds"
            label="Zeitlimit in Sekunden"
            :default-value="60"
            :hard-min="1"
            :hard-max="600"
            @update:model-value="updateLimit"
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
