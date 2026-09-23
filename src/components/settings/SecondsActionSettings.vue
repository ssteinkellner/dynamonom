<script setup lang="ts">
import type { Action, SecondsAction } from "../../action-model.ts";
import type { NumericFormulaInput } from "../../formula-model.ts";
import FormulaInput from "../formula/FormulaInput.vue";

const props = defineProps<{
  action: Action;
  previousActions: readonly Action[];
  settings: SecondsAction["settings"];
  errors: Readonly<Record<string, string>>;
}>();

const emit = defineEmits<{
  "update:settings": [settings: SecondsAction["settings"]];
}>();

function updateSeconds(seconds: NumericFormulaInput): void {
  emit("update:settings", { seconds });
}
</script>

<template>
  <div class="action-type-fields">
    <fieldset>
      <legend>Dauer</legend>
      <div class="field input-wrapper">
        <label for="action-seconds">Sekunden</label>
        <FormulaInput
          id="action-seconds"
          :model-value="settings.seconds"
          :action="action"
          :previous-actions="previousActions"
          field="seconds"
          label="Dauer in Sekunden"
          :default-value="10"
          :hard-min="1"
          :hard-max="600"
          @update:model-value="updateSeconds"
        />
        <p class="field-help">
          Die Aktion wird nach Ablauf automatisch fortgesetzt.
        </p>
        <p v-if="errors.seconds" class="field-error">{{ errors.seconds }}</p>
      </div>
    </fieldset>
  </div>
</template>
