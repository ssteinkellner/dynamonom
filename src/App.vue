<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import type { SettingsImportIssue } from "./models/settings-transfer.ts";
import {
  getSettingsImportIssues,
  parseSettingsImport,
  validateImportedActions,
} from "./models/settings-transfer.ts";
import { METRONOME_PRESETS } from "./presets.ts";
import type { PresetId } from "./presets.ts";
import type { PresetViewEntry } from "./components/views/PresetsView.vue";
import PresetsView from "./components/views/PresetsView.vue";
import SettingsView from "./components/views/SettingsView.vue";
import ReportView from "./components/views/ReportView.vue";
import SessionExecutionView from "./components/execution/SessionExecutionView.vue";
import { useMetronomeStore } from "./stores/metronome.ts";

type AppView = "presets" | "settings" | "execution" | "report";

const store = useMetronomeStore();
const view = ref<AppView>("presets");
const importText = ref("");
const importRawText = ref("");
const importIssues = ref<SettingsImportIssue[]>([]);
const presetStatus = ref("");
const isImporting = ref(false);
const importFieldError = computed(() => {
  const issue = importIssues.value[0];
  return issue ? `${issue.fieldLabel}: ${issue.message}` : "";
});

const presetEntries = computed<PresetViewEntry[]>(() =>
  Object.entries(METRONOME_PRESETS).map(([id, preset]) => {
    const validation = store.validateDefinitions(preset.values.actions, true);
    return {
      id,
      label: preset.label,
      autoStart: preset.autoStart,
      valid: validation.valid,
      error: validation.errors.map((error) => error.message).join(" "),
    };
  }),
);

onMounted(() => {
  const initialParameters = window.location.search.slice(1);
  if (initialParameters) {
    importText.value = initialParameters;
    void processImport(initialParameters);
  }
});

watch(
  () => store.phase,
  (phase) => {
    if (phase === "finished" && store.report) {
      view.value = "report";
    } else if (
      phase === "idle" &&
      store.settingsError &&
      view.value === "execution"
    ) {
      view.value = "settings";
    }
  },
);

async function processImport(rawText = importText.value): Promise<void> {
  if (isImporting.value) {
    return;
  }
  isImporting.value = true;
  importText.value = rawText;
  importRawText.value = rawText;
  importIssues.value = [];
  presetStatus.value = "";
  store.resetSession();
  store.resetConfiguration();

  try {
    const parsed = parseSettingsImport(rawText, window.location.href);
    if (!parsed.valid) {
      importIssues.value = parsed.errors;
      view.value = "settings";
      return;
    }

    store.autoStart = parsed.autoStart;
    store.hideProgress = parsed.hideProgress;
    const validation = validateImportedActions(parsed.actions);
    if (validation.actionsToInstall !== null) {
      const installed = store.replaceActionDefinitions(
        validation.actionsToInstall,
      );
      if (!installed) {
        importIssues.value = [
          {
            fieldLabel: "Aktionen",
            message: store.actionError || "Die Aktionen konnten nicht übernommen werden.",
          },
        ];
        view.value = "settings";
        return;
      }
    }

    if (!validation.valid) {
      importIssues.value = getSettingsImportIssues(
        validation.errors,
        parsed.actions,
      );
      view.value = "settings";
      return;
    }

    importText.value = "";
    importRawText.value = "";
    if (parsed.autoStart) {
      view.value = (await store.startSession()) ? "execution" : "settings";
    } else {
      view.value = "settings";
    }
  } finally {
    isImporting.value = false;
  }
}

function isPresetId(value: string): value is PresetId {
  return Object.prototype.hasOwnProperty.call(METRONOME_PRESETS, value);
}

async function choosePreset(id: string): Promise<void> {
  if (!isPresetId(id)) {
    presetStatus.value = "Diese Voreinstellung ist nicht verfügbar.";
    return;
  }
  store.resetSession();
  importIssues.value = [];
  importRawText.value = "";
  importText.value = "";
  presetStatus.value = "";

  const preset = METRONOME_PRESETS[id];
  if (!store.applyPreset(preset)) {
    presetStatus.value = store.actionError;
    return;
  }
  if (preset.autoStart) {
    view.value = (await store.startSession()) ? "execution" : "settings";
  } else {
    view.value = "settings";
  }
}

function openManualSettings(): void {
  presetStatus.value = "";
  view.value = "settings";
}

async function startConfiguredSession(): Promise<void> {
  if (await store.startSession()) {
    view.value = "execution";
  }
}

function returnToPresets(): void {
  store.resetSession();
  view.value = "presets";
}

function returnToSettings(): void {
  store.resetSession();
  view.value = "settings";
}

async function repeatSession(): Promise<void> {
  if (await store.repeatSession()) {
    view.value = "execution";
  } else {
    view.value = "settings";
  }
}
</script>

<template>
  <div class="app-shell">
    <PresetsView
      v-if="view === 'presets'"
      v-model:import-text="importText"
      :presets="presetEntries"
      :status="presetStatus"
      :import-invalid="importIssues.length > 0"
      :import-error="importFieldError"
      @import="processImport()"
      @preset="choosePreset"
      @manual="openManualSettings"
    />
    <SettingsView
      v-else-if="view === 'settings'"
      :import-issues="importIssues"
      :import-raw-text="importRawText"
      @start="startConfiguredSession"
      @back="returnToPresets"
    />
    <SessionExecutionView v-else-if="view === 'execution'" />
    <ReportView
      v-else-if="view === 'report' && store.report"
      :report="store.report"
      @presets="returnToPresets"
      @settings="returnToSettings"
      @repeat="repeatSession"
    />
  </div>
</template>
