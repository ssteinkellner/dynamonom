<script setup lang="ts">
import type { StopwatchAction } from "../../action-model.ts";
import { useMetronomeStore } from "../../stores/metronome.ts";
import ActionExecutionFrame from "./ActionExecutionFrame.vue";

defineProps<{ action: StopwatchAction }>();
const emit = defineEmits<{ abort: [] }>();
const store = useMetronomeStore();

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function abort(): void {
  emit("abort");
}
</script>

<template>
  <ActionExecutionFrame
    :action-name="action.name"
    :progress-label="store.progressLabel"
    :hide-progress="store.hideProgress"
    :message="store.executionMessage"
  >
    <p class="metric-label">Vergangene Zeit</p>
    <strong class="action-clock">{{ formatTime(store.activeElapsedSeconds) }}</strong>
    <p class="action-options-summary">Formel: {{ action.settings.formula }}</p>
    <div class="button-row action-execution-actions">
      <button class="danger-button" type="button" @click="abort">
        Abbrechen
      </button>
      <button
        class="primary-button"
        type="button"
        @click="store.continueTimerAction()"
      >
        Weiter
      </button>
    </div>
  </ActionExecutionFrame>
</template>
