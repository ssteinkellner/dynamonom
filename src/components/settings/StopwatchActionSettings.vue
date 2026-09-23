<script setup lang="ts">
import { nextTick, ref } from "vue";
import type { StopwatchAction } from "../../action-model.ts";
import { isStaticPreTimerFormula } from "../../pre-timer-model.ts";

const props = defineProps<{
  settings: StopwatchAction["settings"];
  errors: Readonly<Record<string, string>>;
}>();

const emit = defineEmits<{
  "update:settings": [settings: StopwatchAction["settings"]];
}>();

const formulaInput = ref<HTMLTextAreaElement | null>(null);
const lastSelection = ref({ start: 0, end: 0 });
const placeholders = [
  "minuten",
  "summe-minuten",
  "sekunden",
  "rest-sekunden",
] as const;

function updateFormula(event: Event): void {
  const input = event.target;
  if (!(input instanceof HTMLTextAreaElement)) {
    return;
  }
  emit("update:settings", { ...props.settings, formula: input.value });
  rememberSelection();
}

function updateChoice(
  field: "rounding",
  event: Event,
): void {
  const select = event.target;
  if (!(select instanceof HTMLSelectElement)) {
    return;
  }
  if (
    select.value !== "floor" &&
    select.value !== "ceil" &&
    select.value !== "round"
  ) {
    return;
  }
  emit("update:settings", {
    ...props.settings,
    [field]: select.value,
  });
}

function updateNumber(
  field: "roundingThreshold" | "min" | "max",
  event: Event,
): void {
  const input = event.target;
  if (!(input instanceof HTMLInputElement)) {
    return;
  }
  const value =
    input.value === ""
      ? field === "roundingThreshold" || field === "max"
        ? null
        : 0
      : Number(input.value);
  emit("update:settings", { ...props.settings, [field]: value });
}

function rememberSelection(): void {
  const input = formulaInput.value;
  if (!input) {
    return;
  }
  lastSelection.value = {
    start: input.selectionStart,
    end: input.selectionEnd,
  };
}

function insertPlaceholder(value: string): void {
  const input = formulaInput.value;
  const start = input?.selectionStart ?? lastSelection.value.start;
  const end = input?.selectionEnd ?? lastSelection.value.end;
  const formula = props.settings.formula;
  const nextFormula = `${formula.slice(0, start)}${value}${formula.slice(end)}`;
  emit("update:settings", { ...props.settings, formula: nextFormula });

  void nextTick(() => {
    if (!input) {
      return;
    }
    input.focus();
    const nextCaret = start + value.length;
    input.setSelectionRange(nextCaret, nextCaret);
    rememberSelection();
  });
}

function startPlaceholderDrag(event: DragEvent, value: string): void {
  event.dataTransfer?.setData("text/plain", value);
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "copy";
  }
}

function dropPlaceholder(event: DragEvent): void {
  const value = event.dataTransfer?.getData("text/plain");
  if (value && placeholders.some((placeholder) => placeholder === value)) {
    event.preventDefault();
    insertPlaceholder(value);
  }
}
</script>

<template>
  <div class="action-type-fields">
    <fieldset>
      <legend>Formel</legend>
      <div class="field input-wrapper">
        <label for="action-stopwatch-formula">
          Stoppuhr-Formel
          <span class="required-marker" aria-hidden="true">*</span>
        </label>
        <textarea
          id="action-stopwatch-formula"
          ref="formulaInput"
          rows="3"
          :value="settings.formula"
          :aria-invalid="errors.formula ? 'true' : undefined"
          @input="updateFormula"
          @click="rememberSelection"
          @keyup="rememberSelection"
          @select="rememberSelection"
          @drop="dropPlaceholder"
          @dragover.prevent
        ></textarea>
        <p v-if="errors.formula" class="field-error">{{ errors.formula }}</p>
        <p class="field-help">
          Zeitwerte: minuten, summe-minuten, sekunden und rest-sekunden.
        </p>
        <div class="formula-placeholder-list" aria-label="Formelbausteine">
          <button
            v-for="placeholder in placeholders"
            :key="placeholder"
            class="formula-placeholder"
            type="button"
            draggable="true"
            @pointerdown.prevent
            @click="insertPlaceholder(placeholder)"
            @dragstart="startPlaceholderDrag($event, placeholder)"
          >
            {{ placeholder }}
          </button>
        </div>
      </div>
    </fieldset>

    <fieldset>
      <legend>Rundung</legend>
      <div class="field input-wrapper">
        <label for="action-stopwatch-rounding">
          Minutenrundung <span class="required-marker" aria-hidden="true">*</span>
        </label>
        <select
          id="action-stopwatch-rounding"
          :value="settings.rounding"
          :aria-invalid="errors.rounding ? 'true' : undefined"
          @change="updateChoice('rounding', $event)"
        >
          <option value="floor">Abrunden</option>
          <option value="ceil">Aufrunden</option>
          <option value="round">Kaufmännisch runden</option>
        </select>
        <p v-if="errors.rounding" class="field-error">{{ errors.rounding }}</p>
      </div>
      <div v-if="settings.rounding === 'round'" class="field input-wrapper">
        <label for="action-stopwatch-threshold">
          Rundungsschwelle in Sekunden (optional)
        </label>
        <input
          id="action-stopwatch-threshold"
          type="number"
          min="0"
          max="60"
          step="1"
          :value="settings.roundingThreshold ?? ''"
          :aria-invalid="errors.roundingThreshold ? 'true' : undefined"
          @input="updateNumber('roundingThreshold', $event)"
        />
        <p v-if="errors.roundingThreshold" class="field-error">
          {{ errors.roundingThreshold }}
        </p>
      </div>
    </fieldset>

    <fieldset v-if="!isStaticPreTimerFormula(settings.formula)" class="formula-bounds">
      <legend>Grenzen</legend>
      <div class="formula-bounds-fields">
        <div class="field input-wrapper">
          <label for="action-stopwatch-min">
            Minimum Beats <span class="required-marker" aria-hidden="true">*</span>
          </label>
          <input
            id="action-stopwatch-min"
            type="number"
            min="1"
            step="1"
            :value="settings.min"
            :aria-invalid="errors.min ? 'true' : undefined"
            @input="updateNumber('min', $event)"
          />
          <p v-if="errors.min" class="field-error">{{ errors.min }}</p>
        </div>
        <div class="field input-wrapper">
          <label for="action-stopwatch-max">Maximum Beats (optional)</label>
          <input
            id="action-stopwatch-max"
            type="number"
            min="1"
            step="1"
            :value="settings.max ?? ''"
            :aria-invalid="errors.max ? 'true' : undefined"
            @input="updateNumber('max', $event)"
          />
          <p v-if="errors.max" class="field-error">{{ errors.max }}</p>
        </div>
      </div>
    </fieldset>
  </div>
</template>
