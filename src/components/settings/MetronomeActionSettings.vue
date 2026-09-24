<script setup lang="ts">
import { computed } from "vue";
import type {
  Action,
  MaximumMode,
  MetronomeAction,
  MetronomeSettings,
} from "../../action-model.ts";
import {
  createNumericFormulaInput,
  type NumericFormulaInput,
} from "../../formula-model.ts";
import { METRONOME_NUMERIC_FIELD_BOUNDS } from "../../models/metronome-settings.ts";
import FormulaInput from "../formula/FormulaInput.vue";

const props = defineProps<{
  action: MetronomeAction;
  previousActions: readonly Action[];
  settings: MetronomeSettings;
  errors: Readonly<Record<string, string>>;
}>();

const emit = defineEmits<{
  "update:settings": [settings: MetronomeSettings];
}>();

type NumericField =
  | "bpm"
  | "accentRepeat"
  | "increaseBy"
  | "increaseAfter"
  | "maximumLimitStick"
  | "maximumLimitReset"
  | "maximumLimitReverse"
  | "decreaseBy"
  | "decreaseAfter"
  | "breakCount"
  | "breakSeconds"
  | "sessionEndBeats"
  | "lockBeats";

const maximumOptions: readonly { value: MaximumMode; label: string }[] = [
  { value: "none", label: "Unbegrenzt" },
  { value: "stick", label: "Bei Limit halten" },
  { value: "reset", label: "Bei Limit zurücksetzen" },
  { value: "reverse", label: "Bei Limit umkehren" },
];

const activeMaximumField = computed<
  "maximumLimitStick" | "maximumLimitReset" | "maximumLimitReverse"
>(() =>
  props.settings.maximum === "reset"
    ? "maximumLimitReset"
    : props.settings.maximum === "reverse"
      ? "maximumLimitReverse"
      : "maximumLimitStick",
);

function updateNumeric(field: NumericField, value: NumericFormulaInput): void {
  emit("update:settings", { ...props.settings, [field]: value });
}

function updateOptionalFormula(
  field: "breakCount" | "breakSeconds",
  event: Event,
): void {
  const input = event.target;
  if (!(input instanceof HTMLInputElement)) {
    return;
  }
  const initialValue = field === "breakCount" ? 1 : 10;
  const bounds = METRONOME_NUMERIC_FIELD_BOUNDS[field];
  emit("update:settings", {
    ...props.settings,
    [field]: input.checked
      ? props.settings[field] ??
        createNumericFormulaInput(initialValue, bounds.min, bounds.max)
      : null,
  });
}

function updateBoolean(
  field:
    | "accentuate"
    | "increaseTempo"
    | "sessionEndEnabled"
    | "lockSettings"
    | "hideLockText",
  event: Event,
): void {
  const input = event.target;
  if (input instanceof HTMLInputElement) {
    emit("update:settings", { ...props.settings, [field]: input.checked });
  }
}

function updateChoice(field: "maximum" | "breaks", event: Event): void {
  const input = event.target;
  if (input instanceof HTMLSelectElement) {
    emit("update:settings", { ...props.settings, [field]: input.value });
  }
}

function bounds(field: NumericField) {
  return METRONOME_NUMERIC_FIELD_BOUNDS[field] ?? { min: 1, max: null };
}
</script>

<template>
  <div class="action-type-fields">
    <fieldset>
      <legend>Tempo</legend>

      <div class="field input-wrapper">
        <label for="action-bpm">
          Starttempo (BPM) <span class="required-marker" aria-hidden="true">*</span>
        </label>
        <FormulaInput
          id="action-bpm"
          :model-value="settings.bpm"
          :action="action"
          :previous-actions="previousActions"
          field="bpm"
          label="Starttempo in BPM"
          :default-value="120"
          :hard-min="bounds('bpm').min"
          :hard-max="bounds('bpm').max"
          @update:model-value="updateNumeric('bpm', $event)"
        />
        <p v-if="errors.bpm" class="field-error">{{ errors.bpm }}</p>
      </div>

      <div class="option-card checkbox-option-card">
        <label class="checkbox-label">
          <input
            type="checkbox"
            :checked="settings.accentuate"
            @change="updateBoolean('accentuate', $event)"
          />
          Betonung aktivieren
        </label>
        <div v-if="settings.accentuate" class="option-details">
          <label for="action-accent-repeat">Betonung alle Beats</label>
          <FormulaInput
            id="action-accent-repeat"
            :model-value="settings.accentRepeat"
            :action="action"
            :previous-actions="previousActions"
            field="accentRepeat"
            label="Betonungsintervall in Beats"
            :default-value="10"
            :hard-min="bounds('accentRepeat').min"
            :hard-max="bounds('accentRepeat').max"
            @update:model-value="updateNumeric('accentRepeat', $event)"
          />
          <p v-if="errors.accentRepeat" class="field-error">
            {{ errors.accentRepeat }}
          </p>
        </div>
      </div>

      <div class="option-card checkbox-option-card">
        <label class="checkbox-label">
          <input
            type="checkbox"
            :checked="settings.increaseTempo"
            @change="updateBoolean('increaseTempo', $event)"
          />
          Tempo automatisch steigern
        </label>

        <div v-if="settings.increaseTempo" class="option-details">
          <div class="inline-option-row">
            <span class="inline-option-text">Um</span>
            <div class="inline-input-wrapper">
              <label class="visually-hidden" for="action-increase-by">
                BPM-Steigerung
              </label>
              <FormulaInput
                id="action-increase-by"
                :model-value="settings.increaseBy"
                :action="action"
                :previous-actions="previousActions"
                field="increaseBy"
                label="BPM-Steigerung"
                :default-value="1"
                :hard-min="bounds('increaseBy').min"
                :hard-max="bounds('increaseBy').max"
                @update:model-value="updateNumeric('increaseBy', $event)"
              />
              <p v-if="errors.increaseBy" class="field-error">
                {{ errors.increaseBy }}
              </p>
            </div>
            <span class="inline-option-text">BPM alle</span>
            <div class="inline-input-wrapper">
              <label class="visually-hidden" for="action-increase-after">
                Steigerungsintervall in Beats
              </label>
              <FormulaInput
                id="action-increase-after"
                :model-value="settings.increaseAfter"
                :action="action"
                :previous-actions="previousActions"
                field="increaseAfter"
                label="Steigerungsintervall in Beats"
                :default-value="10"
                :hard-min="bounds('increaseAfter').min"
                :hard-max="bounds('increaseAfter').max"
                @update:model-value="updateNumeric('increaseAfter', $event)"
              />
              <p v-if="errors.increaseAfter" class="field-error">
                {{ errors.increaseAfter }}
              </p>
            </div>
            <span class="inline-option-text">Beats</span>
          </div>

          <div class="field input-wrapper">
            <label for="action-maximum">Tempo-Obergrenze</label>
            <select
              id="action-maximum"
              :value="settings.maximum"
              :aria-invalid="errors.maximum ? 'true' : undefined"
              @change="updateChoice('maximum', $event)"
            >
              <option
                v-for="option in maximumOptions"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </select>
            <p v-if="errors.maximum" class="field-error">{{ errors.maximum }}</p>
          </div>

          <div v-if="settings.maximum !== 'none'" class="field input-wrapper">
            <label for="action-maximum-limit">BPM-Limit</label>
            <FormulaInput
              id="action-maximum-limit"
              :model-value="settings[activeMaximumField]"
              :action="action"
              :previous-actions="previousActions"
              :field="activeMaximumField"
              label="BPM-Limit"
              :default-value="150"
              :hard-min="bounds(activeMaximumField).min"
              :hard-max="bounds(activeMaximumField).max"
              @update:model-value="updateNumeric(activeMaximumField, $event)"
            />
            <p v-if="errors[activeMaximumField]" class="field-error">
              {{ errors[activeMaximumField] }}
            </p>
          </div>

          <div v-if="settings.maximum === 'reverse'" class="inline-option-row">
            <span class="inline-option-text">Um</span>
            <div class="inline-input-wrapper">
              <label class="visually-hidden" for="action-decrease-by">
                BPM-Verringerung
              </label>
              <FormulaInput
                id="action-decrease-by"
                :model-value="settings.decreaseBy"
                :action="action"
                :previous-actions="previousActions"
                field="decreaseBy"
                label="BPM-Verringerung"
                :default-value="1"
                :hard-min="bounds('decreaseBy').min"
                :hard-max="bounds('decreaseBy').max"
                @update:model-value="updateNumeric('decreaseBy', $event)"
              />
              <p v-if="errors.decreaseBy" class="field-error">
                {{ errors.decreaseBy }}
              </p>
            </div>
            <span class="inline-option-text">BPM alle</span>
            <div class="inline-input-wrapper">
              <label class="visually-hidden" for="action-decrease-after">
                Verringerungsintervall in Beats
              </label>
              <FormulaInput
                id="action-decrease-after"
                :model-value="settings.decreaseAfter"
                :action="action"
                :previous-actions="previousActions"
                field="decreaseAfter"
                label="Verringerungsintervall in Beats"
                :default-value="10"
                :hard-min="bounds('decreaseAfter').min"
                :hard-max="bounds('decreaseAfter').max"
                @update:model-value="updateNumeric('decreaseAfter', $event)"
              />
              <p v-if="errors.decreaseAfter" class="field-error">
                {{ errors.decreaseAfter }}
              </p>
            </div>
            <span class="inline-option-text">Beats</span>
          </div>
        </div>
      </div>
    </fieldset>

    <fieldset>
      <legend>Pausen</legend>
      <div class="field input-wrapper">
        <label for="action-breaks">Pausen verwenden</label>
        <select
          id="action-breaks"
          :value="settings.breaks"
          :aria-invalid="errors.breaks ? 'true' : undefined"
          @change="updateChoice('breaks', $event)"
        >
          <option value="none">Keine</option>
          <option value="limited">Begrenzt</option>
          <option value="unlimited">Unbegrenzt</option>
        </select>
        <p v-if="errors.breaks" class="field-error">{{ errors.breaks }}</p>
      </div>

      <div v-if="settings.breaks === 'limited'" class="option-card">
        <div class="option-card checkbox-option-card">
          <label class="checkbox-label">
            <input
              type="checkbox"
              :checked="settings.breakCount !== null"
              @change="updateOptionalFormula('breakCount', $event)"
            />
            Maximale Pausenzahl festlegen
          </label>
          <div v-if="settings.breakCount" class="option-details">
            <label for="action-break-count">Maximale Pausenzahl</label>
            <FormulaInput
              id="action-break-count"
              :model-value="settings.breakCount"
              :action="action"
              :previous-actions="previousActions"
              field="breakCount"
              label="Maximale Pausenzahl"
              :default-value="1"
              :hard-min="bounds('breakCount').min"
              :hard-max="bounds('breakCount').max"
              @update:model-value="updateNumeric('breakCount', $event)"
            />
            <p v-if="errors.breakCount" class="field-error">
              {{ errors.breakCount }}
            </p>
          </div>
        </div>

        <div class="option-card checkbox-option-card">
          <label class="checkbox-label">
            <input
              type="checkbox"
              :checked="settings.breakSeconds !== null"
              @change="updateOptionalFormula('breakSeconds', $event)"
            />
            Pausendauer festlegen
          </label>
          <div v-if="settings.breakSeconds" class="option-details">
            <label for="action-break-seconds">Pausendauer in Sekunden</label>
            <FormulaInput
              id="action-break-seconds"
              :model-value="settings.breakSeconds"
              :action="action"
              :previous-actions="previousActions"
              field="breakSeconds"
              label="Pausendauer in Sekunden"
              :default-value="10"
              :hard-min="bounds('breakSeconds').min"
              :hard-max="bounds('breakSeconds').max"
              @update:model-value="updateNumeric('breakSeconds', $event)"
            />
            <p class="field-help">
              Die Formel kann das aktuelle BPM als Aktuell-Wert verwenden.
            </p>
            <p v-if="errors.breakSeconds" class="field-error">
              {{ errors.breakSeconds }}
            </p>
          </div>
        </div>
        <p v-if="settings.breakSeconds === null" class="field-help">
          Ohne Pausendauer kann die Pause manuell beendet werden.
        </p>
      </div>
    </fieldset>

    <fieldset>
      <legend>Ende</legend>
      <div class="option-card checkbox-option-card">
        <label class="checkbox-label">
          <input
            type="checkbox"
            :checked="settings.sessionEndEnabled"
            @change="updateBoolean('sessionEndEnabled', $event)"
          />
          Nach einer festen Beat-Anzahl automatisch beenden
        </label>
        <div v-if="settings.sessionEndEnabled" class="option-details">
          <label for="action-session-end">Session-Ende nach Beats</label>
          <FormulaInput
            id="action-session-end"
            :model-value="settings.sessionEndBeats"
            :action="action"
            :previous-actions="previousActions"
            field="sessionEndBeats"
            label="Session-Ende nach Beats"
            :default-value="100"
            :hard-min="bounds('sessionEndBeats').min"
            :hard-max="bounds('sessionEndBeats').max"
            @update:model-value="updateNumeric('sessionEndBeats', $event)"
          />
          <p v-if="errors.sessionEndBeats" class="field-error">
            {{ errors.sessionEndBeats }}
          </p>
        </div>
      </div>

      <div class="option-card checkbox-option-card">
        <label class="checkbox-label">
          <input
            type="checkbox"
            :checked="settings.lockSettings"
            @change="updateBoolean('lockSettings', $event)"
          />
          Weiter und Einstellungen bis zu einer Beat-Anzahl sperren
        </label>
        <div v-if="settings.lockSettings" class="option-details">
          <label for="action-lock-beats">Sperre bis Beats</label>
          <FormulaInput
            id="action-lock-beats"
            :model-value="settings.lockBeats"
            :action="action"
            :previous-actions="previousActions"
            field="lockBeats"
            label="Sperre bis Beats"
            :default-value="10"
            :hard-min="bounds('lockBeats').min"
            :hard-max="bounds('lockBeats').max"
            @update:model-value="updateNumeric('lockBeats', $event)"
          />
          <p v-if="errors.lockBeats" class="field-error">
            {{ errors.lockBeats }}
          </p>
          <label class="checkbox-label">
            <input
              type="checkbox"
              :checked="settings.hideLockText"
              @change="updateBoolean('hideLockText', $event)"
            />
            Sperre ausgeblendet
          </label>
        </div>
      </div>
    </fieldset>
  </div>
</template>
