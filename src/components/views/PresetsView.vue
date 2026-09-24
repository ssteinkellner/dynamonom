<script setup lang="ts">
export interface PresetViewEntry {
  id: string;
  label: string;
  autoStart: boolean;
  valid: boolean;
  error: string;
}

defineProps<{
  importText: string;
  presets: readonly PresetViewEntry[];
  status: string;
  importInvalid: boolean;
  importError: string;
}>();

const emit = defineEmits<{
  "update:importText": [value: string];
  import: [];
  preset: [id: string];
  manual: [];
}>();

function updateImportText(event: Event): void {
  const input = event.target;
  if (input instanceof HTMLInputElement) {
    emit("update:importText", input.value);
  }
}

function processPaste(): void {
  window.setTimeout(() => emit("import"), 0);
}
</script>

<template>
  <section class="view">
    <div class="report-card presets-card">
      <div class="presets-card-content">
        <div class="settings-import-wrapper">
          <label class="visually-hidden" for="settings-import">
            Einstellungen importieren
          </label>
          <input
            id="settings-import"
            class="settings-import-input"
            type="text"
            inputmode="url"
            autocomplete="off"
            spellcheck="false"
            placeholder="Importieren"
            :value="importText"
            :aria-invalid="importInvalid ? 'true' : undefined"
            :aria-describedby="importError ? 'settings-import-error' : undefined"
            @input="updateImportText"
            @keydown.enter.prevent="emit('import')"
            @paste="processPaste"
          />
          <span
            v-if="importError"
            id="settings-import-error"
            class="field-error"
            role="alert"
          >{{ importError }}</span>
        </div>

        <div
          class="preset-list"
          role="group"
          aria-label="Verfügbare Voreinstellungen"
        >
          <button
            v-for="preset in presets"
            :key="preset.id"
            :class="preset.autoStart ? 'primary-button' : 'secondary-button'"
            type="button"
            :disabled="!preset.valid"
            :title="preset.valid ? undefined : preset.error"
            :aria-label="
              preset.valid
                ? undefined
                : `${preset.label}: ${preset.error}`
            "
            @click="emit('preset', preset.id)"
          >
            {{ preset.autoStart ? `Start ${preset.label}` : preset.label }}
          </button>
        </div>

        <p v-if="status" class="status preset-status" role="alert" aria-live="polite">
          {{ status }}
        </p>
        <button class="secondary-button" type="button" @click="emit('manual')">
          Manuell
        </button>
      </div>
    </div>
  </section>
</template>
