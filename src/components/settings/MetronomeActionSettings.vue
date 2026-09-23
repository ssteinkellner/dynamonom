<script setup lang="ts">
import type {
  MaximumMode,
  MetronomeSettings,
  NumericSetting,
} from "../../action-model.ts";
import type { StopwatchActionSource } from "../../models/metronome-settings.ts";

const props = defineProps<{
  settings: MetronomeSettings;
  errors: Readonly<Record<string, string>>;
  derivedSources: readonly StopwatchActionSource[];
}>();

const emit = defineEmits<{
  "update:settings": [settings: MetronomeSettings];
}>();

const maximumOptions: readonly { value: MaximumMode; label: string }[] = [
  { value: "none", label: "Unbegrenzt" },
  { value: "stick", label: "Bei Limit halten" },
  { value: "reset", label: "Bei Limit zurücksetzen" },
  { value: "reverse", label: "Bei Limit umkehren" },
];

const hasDerivedEnd = props.derivedSources.length > 0;

function updateBpm(event: Event): void {
  const input = event.target;
  if (!(input instanceof HTMLInputElement)) {
    return;
  }
  emit("update:settings", {
    ...props.settings,
    bpm: Number(input.value),
  });
}

function updateNumeric(
  field:
    | "accentRepeat"
    | "increaseBy"
    | "increaseAfter"
    | "maximumLimitStick"
    | "maximumLimitReset"
    | "maximumLimitReverse"
    | "decreaseBy"
    | "decreaseAfter"
    | "sessionEndBeats"
    | "lockBeats",
  event: Event,
): void {
  const input = event.target;
  if (!(input instanceof HTMLInputElement)) {
    return;
  }
  const value: NumericSetting = input.value === "" ? "" : Number(input.value);
  emit("update:settings", { ...props.settings, [field]: value });
}

function updateBreakCount(event: Event): void {
  const input = event.target;
  if (!(input instanceof HTMLInputElement)) {
    return;
  }
  const value = input.value === "" ? null : Number(input.value);
  emit("update:settings", { ...props.settings, breakCount: value });
}

function updateBreakSeconds(event: Event): void {
  const input = event.target;
  if (!(input instanceof HTMLInputElement)) {
    return;
  }
  emit("update:settings", {
    ...props.settings,
    breakSeconds: input.value,
  });
}

function updateBoolean(
  field: "accentuate" | "increaseTempo" | "sessionEndEnabled" | "lockSettings",
  event: Event,
): void {
  const input = event.target;
  if (!(input instanceof HTMLInputElement)) {
    return;
  }
  emit("update:settings", { ...props.settings, [field]: input.checked });
}

function updateChoice(
  field: "maximum" | "breaks",
  event: Event,
): void {
  const input = event.target;
  if (!(input instanceof HTMLSelectElement)) {
    return;
  }
  emit("update:settings", {
    ...props.settings,
    [field]: input.value,
  });
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
        <input
          id="action-bpm"
          type="number"
          min="20"
          max="300"
          step="1"
          :value="settings.bpm"
          :aria-invalid="errors.bpm ? 'true' : undefined"
          @input="updateBpm"
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
          <input
            id="action-accent-repeat"
            type="number"
            min="1"
            step="1"
            :value="settings.accentRepeat"
            :aria-invalid="errors.accentRepeat ? 'true' : undefined"
            @input="updateNumeric('accentRepeat', $event)"
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
              <input
                id="action-increase-by"
                type="number"
                min="1"
                max="20"
                step="1"
                :value="settings.increaseBy"
                :aria-invalid="errors.increaseBy ? 'true' : undefined"
                @input="updateNumeric('increaseBy', $event)"
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
              <input
                id="action-increase-after"
                type="number"
                min="1"
                step="1"
                :value="settings.increaseAfter"
                :aria-invalid="errors.increaseAfter ? 'true' : undefined"
                @input="updateNumeric('increaseAfter', $event)"
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

          <div
            v-if="settings.maximum !== 'none'"
            class="field input-wrapper"
          >
            <label for="action-maximum-limit">BPM-Limit</label>
            <input
              id="action-maximum-limit"
              type="number"
              min="60"
              max="400"
              step="1"
              :value="
                settings.maximum === 'stick'
                  ? settings.maximumLimitStick
                  : settings.maximum === 'reset'
                    ? settings.maximumLimitReset
                    : settings.maximumLimitReverse
              "
              :aria-invalid="
                errors.maximumLimitStick ||
                errors.maximumLimitReset ||
                errors.maximumLimitReverse
                  ? 'true'
                  : undefined
              "
              @input="
                updateNumeric(
                  settings.maximum === 'stick'
                    ? 'maximumLimitStick'
                    : settings.maximum === 'reset'
                      ? 'maximumLimitReset'
                      : 'maximumLimitReverse',
                  $event,
                )
              "
            />
            <p v-if="errors.maximumLimitStick" class="field-error">
              {{ errors.maximumLimitStick }}
            </p>
            <p v-else-if="errors.maximumLimitReset" class="field-error">
              {{ errors.maximumLimitReset }}
            </p>
            <p v-else-if="errors.maximumLimitReverse" class="field-error">
              {{ errors.maximumLimitReverse }}
            </p>
          </div>

          <div v-if="settings.maximum === 'reverse'" class="inline-option-row">
            <span class="inline-option-text">Um</span>
            <div class="inline-input-wrapper">
              <label class="visually-hidden" for="action-decrease-by">
                BPM-Verringerung
              </label>
              <input
                id="action-decrease-by"
                type="number"
                min="1"
                max="50"
                step="1"
                :value="settings.decreaseBy"
                :aria-invalid="errors.decreaseBy ? 'true' : undefined"
                @input="updateNumeric('decreaseBy', $event)"
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
              <input
                id="action-decrease-after"
                type="number"
                min="1"
                step="1"
                :value="settings.decreaseAfter"
                :aria-invalid="errors.decreaseAfter ? 'true' : undefined"
                @input="updateNumeric('decreaseAfter', $event)"
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
        <div class="field input-wrapper">
          <label for="action-break-count">Maximale Pausenzahl (optional)</label>
          <input
            id="action-break-count"
            type="number"
            min="1"
            step="1"
            :value="settings.breakCount ?? ''"
            :aria-invalid="errors.breakCount ? 'true' : undefined"
            @input="updateBreakCount"
          />
          <p v-if="errors.breakCount" class="field-error">
            {{ errors.breakCount }}
          </p>
        </div>
        <div class="field input-wrapper">
          <label for="action-break-seconds">Pausendauer (optional)</label>
          <input
            id="action-break-seconds"
            type="text"
            inputmode="text"
            placeholder="Sekunden oder BPM/2"
            :value="settings.breakSeconds"
            :aria-invalid="errors.breakSeconds ? 'true' : undefined"
            @input="updateBreakSeconds"
          />
          <p class="field-help">
            Leer lassen, um die Pause manuell zu beenden.
          </p>
          <p v-if="errors.breakSeconds" class="field-error">
            {{ errors.breakSeconds }}
          </p>
        </div>
      </div>
    </fieldset>

    <fieldset>
      <legend>Ende</legend>
      <div class="option-card checkbox-option-card">
        <label class="checkbox-label">
          <input
            type="checkbox"
            :checked="settings.sessionEndEnabled"
            :disabled="hasDerivedEnd"
            @change="updateBoolean('sessionEndEnabled', $event)"
          />
          Nach einer festen Beat-Anzahl automatisch beenden
        </label>
        <div v-if="settings.sessionEndEnabled && !hasDerivedEnd" class="option-details">
          <label for="action-session-end">Session-Ende nach Beats</label>
          <input
            id="action-session-end"
            type="number"
            min="1"
            step="1"
            :value="settings.sessionEndBeats"
            :aria-invalid="errors.sessionEndBeats ? 'true' : undefined"
            @input="updateNumeric('sessionEndBeats', $event)"
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
            :disabled="hasDerivedEnd"
            @change="updateBoolean('lockSettings', $event)"
          />
          Weiter und Einstellungen bis zu einer Beat-Anzahl sperren
        </label>
        <div v-if="settings.lockSettings && !hasDerivedEnd" class="option-details">
          <label for="action-lock-beats">Sperre bis Beats</label>
          <input
            id="action-lock-beats"
            type="number"
            min="1"
            step="1"
            :value="settings.lockBeats"
            :aria-invalid="errors.lockBeats ? 'true' : undefined"
            @input="updateNumeric('lockBeats', $event)"
          />
          <p v-if="errors.lockBeats" class="field-error">
            {{ errors.lockBeats }}
          </p>
        </div>
      </div>

      <p v-if="hasDerivedEnd" class="field-help">
        Ende und Weiter-Sperre werden durch
        {{ derivedSources.map((source) => source.name).join(", ") }}
        bestimmt.
      </p>
    </fieldset>
  </div>
</template>
