<script setup lang="ts">
import { ACTION_TYPES, getActionTypeLabel } from "../../action-model.ts";
import type { SecondsAction } from "../../action-model.ts";
import { useMetronomeStore } from "../../stores/metronome.ts";
import ActionExecutionFrame from "./ActionExecutionFrame.vue";

defineProps<{ action: SecondsAction }>();
const emit = defineEmits<{ abort: [] }>();
const store = useMetronomeStore();

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function continueAction(): void {
  if (
    store.secondsRemaining > 10 &&
    !window.confirm("Die Sekunden-Aktion vorzeitig beenden?")
  ) {
    return;
  }
  store.continueTimerAction(store.secondsRemaining > 10);
}

function abort(): void {
  emit("abort");
}
</script>

<template>
  <ActionExecutionFrame
    :action-name="action.name"
    :action-type-label="getActionTypeLabel(ACTION_TYPES.SECONDS)"
    :progress-label="store.progressLabel"
    :hide-progress="store.hideProgress"
    :message="store.executionMessage"
  >
    <p class="metric-label">Verbleibend</p>
    <strong class="action-clock">{{ formatTime(store.secondsRemaining) }}</strong>
    <p class="beat-count">
      {{ formatTime(store.activeElapsedSeconds) }} von
      {{ formatTime(action.settings.seconds) }}
    </p>
    <div class="button-row action-execution-actions">
      <button class="primary-button" type="button" @click="continueAction">
        Weiter
      </button>
      <button class="danger-button" type="button" @click="abort">
        Abbrechen
      </button>
    </div>
  </ActionExecutionFrame>
</template>
