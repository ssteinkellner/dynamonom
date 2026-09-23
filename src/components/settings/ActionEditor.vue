<script setup lang="ts">
import { computed } from "vue";
import {
  ACTION_TYPES,
  getActionTypeLabel,
} from "../../action-model.ts";
import type {
  Action,
  ActionValidationError,
  MetronomeSettings,
  ManualAction,
  SecondsAction,
} from "../../action-model.ts";
import ManualActionSettings from "./ManualActionSettings.vue";
import MetronomeActionSettings from "./MetronomeActionSettings.vue";
import SecondsActionSettings from "./SecondsActionSettings.vue";
import StopwatchActionSettings from "./StopwatchActionSettings.vue";

const props = defineProps<{
  draft: Action;
  errors: readonly ActionValidationError[];
  previousActions: readonly Action[];
}>();

const emit = defineEmits<{
  "update:draft": [draft: Action];
  save: [];
  cancel: [];
}>();

const nameError = computed(
  () => props.errors.find((error) => error.field === "name")?.message ?? "",
);
const settingsErrors = computed<Readonly<Record<string, string>>>(() =>
  Object.fromEntries(
    props.errors
      .filter((error) => error.field !== "name")
      .map((error) => [error.field, error.message]),
  ),
);

const title = computed(
  () => `${getActionTypeLabel(props.draft.type)}-Einstellungen`,
);

function updateName(event: Event): void {
  const input = event.target;
  if (!(input instanceof HTMLInputElement)) {
    return;
  }
  emit("update:draft", { ...props.draft, name: input.value });
}

function updateMetronomeSettings(settings: MetronomeSettings): void {
  if (props.draft.type === ACTION_TYPES.METRONOME) {
    emit("update:draft", { ...props.draft, settings });
  }
}

function updateSecondsSettings(settings: SecondsAction["settings"]): void {
  if (props.draft.type === ACTION_TYPES.SECONDS) {
    emit("update:draft", { ...props.draft, settings });
  }
}

function updateManualSettings(settings: ManualAction["settings"]): void {
  if (props.draft.type === ACTION_TYPES.MANUAL) {
    emit("update:draft", { ...props.draft, settings });
  }
}
</script>

<template>
  <section class="action-editor" aria-labelledby="action-editor-title">
    <h2 id="action-editor-title" tabindex="-1">{{ title }}</h2>

    <div class="field input-wrapper">
      <label for="action-name">
        Aktionsname <span class="required-marker" aria-hidden="true">*</span>
      </label>
      <input
        id="action-name"
        type="text"
        autocomplete="off"
        :value="draft.name"
        :aria-invalid="nameError ? 'true' : undefined"
        @input="updateName"
      />
      <p v-if="nameError" class="field-error">{{ nameError }}</p>
    </div>

    <MetronomeActionSettings
      v-if="draft.type === ACTION_TYPES.METRONOME"
      :action="draft"
      :settings="draft.settings"
      :errors="settingsErrors"
      :previous-actions="previousActions"
      @update:settings="updateMetronomeSettings"
    />
    <SecondsActionSettings
      v-else-if="draft.type === ACTION_TYPES.SECONDS"
      :action="draft"
      :settings="draft.settings"
      :errors="settingsErrors"
      :previous-actions="previousActions"
      @update:settings="updateSecondsSettings"
    />
    <StopwatchActionSettings
      v-else-if="draft.type === ACTION_TYPES.STOPWATCH"
      :action="draft"
    />
    <ManualActionSettings
      v-else
      :action="draft"
      :settings="draft.settings"
      :errors="settingsErrors"
      :previous-actions="previousActions"
      @update:settings="updateManualSettings"
    />

    <div class="button-row action-editor-actions">
      <button class="primary-button" type="button" @click="emit('save')">
        Bestätigen
      </button>
      <button class="secondary-button" type="button" @click="emit('cancel')">
        Abbrechen
      </button>
    </div>
  </section>
</template>
