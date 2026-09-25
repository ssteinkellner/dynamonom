<script setup lang="ts">
import { computed, ref } from "vue";
import {
  ACTION_TYPES,
  getActionTypeLabel,
} from "../../action-model.ts";
import type {
  Action,
  ActionValidationError,
  MetronomeSettings,
  StopwatchAction,
} from "../../action-model.ts";
import MetronomeActionSettings from "./MetronomeActionSettings.vue";
import StopwatchActionSettings from "./StopwatchActionSettings.vue";

const props = defineProps<{
  draft: Action;
  errors: readonly ActionValidationError[];
  previousActions: readonly Action[];
}>();

const emit = defineEmits<{
  "update:draft": [draft: Action];
  "nested-draft-state": [dirty: boolean];
  save: [];
  cancel: [];
}>();
const nestedDraftDirty = ref(false);

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

function updateStopwatchSettings(settings: StopwatchAction["settings"]): void {
  if (props.draft.type === ACTION_TYPES.STOPWATCH) {
    emit("update:draft", { ...props.draft, settings });
  }
}

function updateNestedDraftState(dirty: boolean): void {
  nestedDraftDirty.value = dirty;
  emit("nested-draft-state", dirty);
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
      @nested-draft-state="updateNestedDraftState"
    />
    <StopwatchActionSettings
      v-else-if="draft.type === ACTION_TYPES.STOPWATCH"
      :action="draft"
      :settings="draft.settings"
      :errors="settingsErrors"
      :previous-actions="previousActions"
      @update:settings="updateStopwatchSettings"
    />

    <div class="button-row action-editor-actions">
      <button class="secondary-button" type="button" @click="emit('cancel')">
        Abbrechen
      </button>
      <button
        class="primary-button"
        type="button"
        :disabled="nestedDraftDirty"
        @click="emit('save')"
      >
        Bestätigen
      </button>
    </div>
  </section>
</template>
