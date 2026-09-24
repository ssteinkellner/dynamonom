<script setup lang="ts">
import { computed, watch } from "vue";
import type { StopwatchAction } from "../../action-model.ts";
import { useMetronomeStore } from "../../stores/metronome.ts";
import ActionExecutionFrame from "./ActionExecutionFrame.vue";
import {
  activeDialog,
  resolveActiveDialog,
  useDialog,
} from "../../services/dialog.ts";

defineProps<{ action: StopwatchAction }>();
const emit = defineEmits<{ abort: [] }>();
const store = useMetronomeStore();
const { confirm } = useDialog();
const earlyContinueDialogTitle = "Nächste Aktion starten?";
let earlyContinueDialogOpen = false;

const manualLimitSeconds = computed(() => {
  const settings = store.currentStopwatchSettings;
  return settings?.endMode === "manual"
    ? settings.manualLimitSeconds
    : null;
});

const continueLabel = computed(() => {
  const settings = store.currentStopwatchSettings;
  if (
    settings?.endMode === "automatic" &&
    !settings.hideDuration &&
    settings.automaticSeconds !== null
  ) {
    return `Weiter (automatisch nach ${settings.automaticSeconds} Sekunden)`;
  }
  return "Weiter";
});

watch(
  [() => store.stopwatchLimitReached, activeDialog],
  ([limitReached, dialog]) => {
    if (
      !limitReached ||
      !earlyContinueDialogOpen ||
      dialog?.kind !== "confirm" ||
      dialog.options.title !== earlyContinueDialogTitle
    ) {
      return;
    }
    resolveActiveDialog(true);
  },
);

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

async function continueAction(): Promise<void> {
  const warningRequired = store.shouldWarnBeforeContinue;
  if (warningRequired) {
    earlyContinueDialogOpen = true;
    try {
      if (
        !(await confirm({
          title: earlyContinueDialogTitle,
          message:
            "Wirklich vor dem konfigurierten Ende der Stoppuhr zur nächsten Aktion wechseln?",
          confirmLabel: "Nächste Aktion starten",
          cancelLabel: "Fortsetzen",
        }))
      ) {
        return;
      }
    } finally {
      earlyContinueDialogOpen = false;
    }
  }
  store.continueTimerAction(warningRequired);
}

function abort(): void {
  emit("abort");
}
</script>

<template>
  <ActionExecutionFrame
    :action-name="action.name"
    :progress-label="store.progressLabel"
    :message="store.executionMessage"
  >
    <div class="metric-grid stopwatch-metric-grid">
      <div class="metric">
        <span class="metric-label">Vergangene Zeit</span>
        <strong class="metric-value action-clock">
          {{ formatTime(store.activeElapsedSeconds) }}
        </strong>
      </div>
    </div>
    <p v-if="manualLimitSeconds !== null" class="action-options-summary">
      Limit: {{ manualLimitSeconds }} Sekunden
    </p>
    <div class="button-row action-execution-actions">
      <button class="danger-button" type="button" @click="abort">
        Abbrechen
      </button>
      <button
        :class="store.stopwatchLimitReached ? 'danger-button' : 'primary-button'"
        type="button"
        @click="continueAction"
      >
        {{ continueLabel }}
      </button>
    </div>
  </ActionExecutionFrame>
</template>
