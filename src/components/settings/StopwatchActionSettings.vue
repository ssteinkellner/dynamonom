<script setup lang="ts">
import type {
  Action,
  StopwatchAction,
  StopwatchEndMode,
} from "../../action-model.ts";
import type { NumericFormulaInput } from "../../formula-model.ts";
import FormulaInput from "../formula/FormulaInput.vue";

const props = defineProps<{
  action: Action;
  previousActions: readonly Action[];
  settings: StopwatchAction["settings"];
  errors: Readonly<Record<string, string>>;
}>();

const emit = defineEmits<{
  "update:settings": [settings: StopwatchAction["settings"]];
}>();

const endModeOptions: readonly { value: StopwatchEndMode; label: string }[] = [
  { value: "unlimited", label: "Unbegrenzt" },
  {
    value: "automatic",
    label: "Automatisch beenden nach",
  },
  {
    value: "manual",
    label: "Manuell limitieren auf",
  },
];

function updateEndMode(event: Event): void {
  const input = event.target;
  if (!(input instanceof HTMLSelectElement)) {
    return;
  }
  emit("update:settings", {
    ...props.settings,
    endMode: input.value as StopwatchEndMode,
  });
}

function updateBoolean(
  field: "hideDuration" | "earlyContinueWarning",
  event: Event,
): void {
  const input = event.target;
  if (!(input instanceof HTMLInputElement)) {
    return;
  }
  emit("update:settings", { ...props.settings, [field]: input.checked });
}

function updateFormula(
  field:
    | "automaticSeconds"
    | "manualLimitSeconds"
    | "earlyContinueWarningSeconds",
  value: NumericFormulaInput,
): void {
  emit("update:settings", { ...props.settings, [field]: value });
}
</script>

<template>
  <div class="action-type-fields">
    <fieldset>
      <legend>Ende</legend>

      <div class="field input-wrapper">
        <select
          id="action-stopwatch-end-mode"
          :value="settings.endMode"
          aria-label="Ende"
          :aria-invalid="errors.endMode ? 'true' : undefined"
          @change="updateEndMode"
        >
          <option
            v-for="option in endModeOptions"
            :key="option.value"
            :value="option.value"
          >
            {{ option.label }}
          </option>
        </select>
        <p v-if="errors.endMode" class="field-error">{{ errors.endMode }}</p>
      </div>

      <div v-if="settings.endMode === 'automatic'" class="option-details">
        <div class="field input-wrapper">
          <label for="action-stopwatch-automatic-seconds">Sekunden</label>
          <FormulaInput
            id="action-stopwatch-automatic-seconds"
            :model-value="settings.automaticSeconds"
            :action="action"
            :previous-actions="previousActions"
            field="automaticSeconds"
            label="Automatisch beenden nach Sekunden"
            :default-value="10"
            :hard-min="1"
            :hard-max="600"
            @update:model-value="updateFormula('automaticSeconds', $event)"
          />
          <p v-if="errors.automaticSeconds" class="field-error">
            {{ errors.automaticSeconds }}
          </p>
        </div>

        <label class="checkbox-label">
          <input
            type="checkbox"
            :checked="settings.hideDuration"
            @change="updateBoolean('hideDuration', $event)"
          />
          Dauer ausblenden
        </label>
      </div>

      <div v-else-if="settings.endMode === 'manual'" class="option-details">
        <div class="field input-wrapper">
          <label for="action-stopwatch-manual-limit-seconds">Sekunden</label>
          <FormulaInput
            id="action-stopwatch-manual-limit-seconds"
            :model-value="settings.manualLimitSeconds"
            :action="action"
            :previous-actions="previousActions"
            field="manualLimitSeconds"
            label="Manuelles Limit in Sekunden"
            :default-value="60"
            :hard-min="1"
            :hard-max="600"
            @update:model-value="updateFormula('manualLimitSeconds', $event)"
          />
          <p v-if="errors.manualLimitSeconds" class="field-error">
            {{ errors.manualLimitSeconds }}
          </p>
        </div>
      </div>

      <div v-if="settings.endMode !== 'unlimited'" class="option-card">
        <label class="checkbox-label">
          <input
            type="checkbox"
            :checked="settings.earlyContinueWarning"
            @change="updateBoolean('earlyContinueWarning', $event)"
          />
          Warnung bei frühzeitigem Beenden
        </label>
        <div
          v-if="settings.earlyContinueWarning"
          class="inline-option-row option-details"
        >
          <span class="inline-option-text">bei mehr als</span>
          <div class="inline-input-wrapper">
            <label
              class="visually-hidden"
              for="action-stopwatch-warning-seconds"
            >
              Warnung bei frühzeitigem Beenden in Sekunden
            </label>
            <FormulaInput
              id="action-stopwatch-warning-seconds"
              :model-value="settings.earlyContinueWarningSeconds"
              :action="action"
              :previous-actions="previousActions"
              field="earlyContinueWarningSeconds"
              label="Warnung bei frühzeitigem Beenden in Sekunden"
              :default-value="10"
              :hard-min="1"
              :hard-max="600"
              @update:model-value="
                updateFormula('earlyContinueWarningSeconds', $event)
              "
            />
            <p v-if="errors.earlyContinueWarningSeconds" class="field-error">
              {{ errors.earlyContinueWarningSeconds }}
            </p>
          </div>
          <span class="inline-option-text">Sekunden vor dem Ende</span>
        </div>
      </div>
    </fieldset>
  </div>
</template>
