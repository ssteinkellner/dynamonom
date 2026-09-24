<script setup lang="ts">
import { computed } from "vue";
import type { MetronomeAction } from "../../action-model.ts";
import { useMetronomeStore } from "../../stores/metronome.ts";
import ActionExecutionFrame from "./ActionExecutionFrame.vue";

defineProps<{ action: MetronomeAction }>();
const emit = defineEmits<{ abort: [] }>();
const store = useMetronomeStore();

const showNextTempo = computed(() => {
  const settings = store.settings;
  return Boolean(
    settings?.increaseTempo &&
      !settings.hideNextTempo &&
      store.nextBpm !== null,
  );
});

const nextTempoLabel = computed(() => {
  const nextTempoBeat = store.nextTempoChangeBeat;
  if (nextTempoBeat === null) {
    return "";
  }
  return `Ab ${nextTempoBeat} ${nextTempoBeat === 1 ? "Beat" : "Beats"}`;
});

const isContinueLocked = computed(() => {
  const settings = store.settings;
  return Boolean(
    settings &&
      settings.lockSettings &&
      store.beatCount < Number(settings.lockBeats),
  );
});

const canContinue = computed(() => {
  const settings = store.settings;
  return Boolean(
    settings &&
      ["running", "paused", "resume-countdown"].includes(store.phase) &&
      !isContinueLocked.value,
  );
});

const continueLabel = computed(() => {
  const settings = store.settings;
  if (!settings || !isContinueLocked.value) {
    return "Weiter";
  }
  if (settings.hideLockText) {
    return "Weiter (gesperrt)";
  }
  return `Weiter (gesperrt bis ${Number(settings.lockBeats)} Beats)`;
});

const pauseLabel = computed(() =>
  store.phase === "paused" || store.phase === "resume-countdown"
    ? "Pause beenden"
    : "Pause",
);

const breakDisplay = computed(() => {
  const active = store.activeBreak;
  if (!active) {
    return "";
  }
  if (active.durationSeconds === null) {
    return "Manuelle Pause";
  }
  const remaining = Math.max(
    0,
    active.durationSeconds - store.activeBreakElapsedSeconds,
  );
  return `Fortsetzen in ${remaining} Sekunden`;
});

function countdownLabel(): string {
  if (store.phase === "countdown") {
    return `Startet in ${store.countdownValue}`;
  }
  if (store.phase === "resume-countdown") {
    return `Fortsetzen in ${store.resumeCountdownValue}`;
  }
  if (store.phase === "paused") {
    return "Pause";
  }
  return "Läuft";
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
    <p class="eyebrow">{{ countdownLabel() }}</p>
    <div
      class="metric-grid"
      :class="{ 'metric-grid--progressing': showNextTempo }"
    >
      <div class="metric">
        <span class="metric-label">Beats</span>
        <strong class="metric-value">{{ store.beatCount }}</strong>
      </div>
      <div class="metric">
        <span class="metric-label">Tempo</span>
        <strong class="metric-value">{{ store.currentBpm }}</strong>
        <span class="metric-detail">BPM</span>
      </div>
      <div v-if="showNextTempo" class="metric">
        <span class="metric-label">{{ nextTempoLabel }}</span>
        <strong class="metric-value">{{ store.nextBpm }}</strong>
        <span class="metric-detail">BPM</span>
      </div>
    </div>
    <p v-if="breakDisplay" class="action-options-summary" aria-live="polite">
      {{ breakDisplay }}
    </p>
    <div class="button-row action-execution-actions">
      <button
        class="secondary-button full-width-button"
        type="button"
        :disabled="store.phase === 'countdown' || !store.settings"
        @click="store.pauseOrResumeMetronome"
      >
        {{ pauseLabel }}
      </button>
    </div>
    <div class="button-row action-execution-actions">
      <button class="danger-button" type="button" @click="abort">
        Abbrechen
      </button>
      <button
        class="primary-button"
        type="button"
        :disabled="!canContinue"
        @click="store.continueMetronome"
      >
        {{ continueLabel }}
      </button>
    </div>
  </ActionExecutionFrame>
</template>
