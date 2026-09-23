<script setup lang="ts">
import { ACTION_TYPES } from "../../action-model.ts";
import { useMetronomeStore } from "../../stores/metronome.ts";
import ManualExecutionView from "./ManualExecutionView.vue";
import MetronomeExecutionView from "./MetronomeExecutionView.vue";
import SecondsExecutionView from "./SecondsExecutionView.vue";
import StopwatchExecutionView from "./StopwatchExecutionView.vue";

const store = useMetronomeStore();

function requestAbort(): void {
  if (!window.confirm("Die Aktion abbrechen und den Bericht anzeigen?")) {
    return;
  }
  store.abortSession();
}
</script>

<template>
  <MetronomeExecutionView
    v-if="store.currentAction?.type === ACTION_TYPES.METRONOME"
    :action="store.currentAction"
    @abort="requestAbort"
  />
  <SecondsExecutionView
    v-else-if="store.currentAction?.type === ACTION_TYPES.SECONDS"
    :action="store.currentAction"
    @abort="requestAbort"
  />
  <StopwatchExecutionView
    v-else-if="store.currentAction?.type === ACTION_TYPES.STOPWATCH"
    :action="store.currentAction"
    @abort="requestAbort"
  />
  <ManualExecutionView
    v-else-if="store.currentAction?.type === ACTION_TYPES.MANUAL"
    :action="store.currentAction"
    @abort="requestAbort"
  />
  <section v-else class="view" aria-live="polite">
    <p class="status">Aktion wird vorbereitet …</p>
  </section>
</template>
