<script setup lang="ts">
import { onUnmounted, ref } from "vue";
import type { SettingsImportIssue } from "../../models/settings-transfer.ts";
import { copyText } from "../../services/clipboard.ts";
import { serializeSettings, serializeSettingsUrl } from "../../models/settings-transfer.ts";
import { useMetronomeStore } from "../../stores/metronome.ts";
import ActionListEditor from "../settings/ActionListEditor.vue";

defineProps<{
  importIssues: readonly SettingsImportIssue[];
  importRawText: string;
}>();

const emit = defineEmits<{
  start: [];
  back: [];
}>();

const store = useMetronomeStore();
const actionListEditor = ref<InstanceType<typeof ActionListEditor> | null>(null);
const exportStatus = ref("");
const copiedFormat = ref<"settings" | "url" | null>(null);
const settingsExportButton = ref<HTMLButtonElement | null>(null);
const urlExportButton = ref<HTMLButtonElement | null>(null);
let feedbackTimer = 0;

onUnmounted(() => {
  window.clearTimeout(feedbackTimer);
});

function canChangeConfiguration(): boolean {
  return actionListEditor.value?.closeIfAllowed() === true;
}

function requestStart(): void {
  if (canChangeConfiguration()) {
    emit("start");
  }
}

function requestBack(): void {
  if (canChangeConfiguration()) {
    emit("back");
  }
}

function updateBooleanSetting(
  setting: "hideProgress" | "autoStart",
  event: Event,
): void {
  const input = event.target;
  if (!(input instanceof HTMLInputElement)) {
    return;
  }
  if (!canChangeConfiguration()) {
    input.checked = store[setting];
    return;
  }
  store[setting] = input.checked;
}

async function exportSettings(format: "settings" | "url"): Promise<void> {
  if (!canChangeConfiguration()) {
    return;
  }

  const parameters = serializeSettings(
    store.actionDefinitions,
    store.autoStart,
    store.hideProgress,
  );
  const text =
    format === "url"
      ? serializeSettingsUrl(window.location.href, parameters)
      : parameters;
  const button =
    format === "url" ? urlExportButton.value : settingsExportButton.value;

  try {
    await copyText(text, button);
    const label =
      format === "url" ? "Ganze URL" : "Einstellungen";
    exportStatus.value = `${label} in die Zwischenablage kopiert.`;
    if (format === "url" && text.length > 2000) {
      exportStatus.value += " Die URL ist länger als 2000 Zeichen.";
    }
    copiedFormat.value = format;
    window.clearTimeout(feedbackTimer);
    feedbackTimer = window.setTimeout(() => {
      copiedFormat.value = null;
    }, 2000);
  } catch (error) {
    copiedFormat.value = null;
    exportStatus.value =
      error instanceof Error
        ? error.message
        : "Die Einstellungen konnten nicht kopiert werden.";
  }
}
</script>

<template>
  <section class="view" aria-labelledby="settings-title">
    <header class="view-header">
      <h1 id="settings-title" tabindex="-1">Metronom-Einstellungen</h1>
    </header>

    <p class="field-help required-field-legend">
      <span class="required-marker" aria-hidden="true">*</span> Pflichtfeld
    </p>

    <p
      v-if="store.settingsError"
      class="status status-sticky error-status"
      role="alert"
      aria-live="polite"
    >
      {{ store.settingsError }}
    </p>

    <fieldset v-if="importIssues.length > 0" class="import-error-panel">
      <legend>Fehlerhafter Import</legend>
      <p class="error-status import-error-summary" role="alert">
        Import ist unvollständig oder ungültig. Bitte Fehler beheben und
        Einstellungen erneut importieren.
      </p>
      <ul class="import-error-list">
        <li v-for="(issue, index) in importIssues" :key="`${issue.fieldLabel}-${index}`">
          <strong>
            <template v-if="issue.actionIndex">
              Aktion {{ issue.actionIndex }}
              <template v-if="issue.actionName">
                ({{ issue.actionName }})
              </template>
              —
            </template>
            {{ issue.fieldLabel }}:
          </strong>
          {{ issue.message }}
        </li>
      </ul>
      <p class="field-help import-error-label">Importierter Text</p>
      <pre class="import-error-text">{{ importRawText }}</pre>
    </fieldset>

    <ActionListEditor
      ref="actionListEditor"
    />

    <fieldset class="global-settings">
      <legend>Globale Einstellungen</legend>
      <div class="option-card checkbox-option-card export-option">
        <label class="checkbox-label">
          <input
            type="checkbox"
            :checked="store.autoStart"
            @change="updateBooleanSetting('autoStart', $event)"
          />
          Nach dem Import automatisch starten
        </label>
      </div>
      <div class="option-card checkbox-option-card export-option">
        <label class="checkbox-label">
          <input
            type="checkbox"
            :checked="store.hideProgress"
            @change="updateBooleanSetting('hideProgress', $event)"
          />
          Fortschritt ausblenden
        </label>
      </div>
    </fieldset>

    <fieldset>
      <legend>Einstellungen exportieren</legend>
      <div class="button-row export-actions">
        <button
          ref="settingsExportButton"
          class="secondary-button"
          type="button"
          @click="exportSettings('settings')"
        >
          {{
            copiedFormat === "settings"
              ? "Kopiert!"
              : "Einstellungen kopieren"
          }}
        </button>
        <button
          ref="urlExportButton"
          class="secondary-button"
          type="button"
          @click="exportSettings('url')"
        >
          {{ copiedFormat === "url" ? "Kopiert!" : "Ganze URL kopieren" }}
        </button>
      </div>
      <p
        v-if="exportStatus"
        class="status"
        :class="{ 'error-status': exportStatus.includes('verweigert') }"
        role="status"
        aria-live="polite"
      >
        {{ exportStatus }}
      </p>
    </fieldset>

    <div class="button-row settings-actions">
      <button class="secondary-button" type="button" @click="requestBack">
        Zurück zu den Voreinstellungen
      </button>
      <button class="primary-button" type="button" @click="requestStart">
        Starten
      </button>
    </div>
  </section>
</template>
