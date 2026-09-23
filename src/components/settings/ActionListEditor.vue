<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import {
  ACTION_TYPES,
  createDefaultAction,
  cloneAction,
  getActionTypeLabel,
} from "../../action-model.ts";
import type {
  Action,
  ActionType,
  ActionValidationError,
} from "../../action-model.ts";
import { createDefaultMetronomeSettings } from "../../models/metronome-settings.ts";
import { formatNumericFormulaInput } from "../../formula-model.ts";
import { useMetronomeStore } from "../../stores/metronome.ts";
import ActionEditor from "./ActionEditor.vue";

const store = useMetronomeStore();

const actionsFieldset = ref<HTMLElement | null>(null);
const editorWrapper = ref<HTMLElement | null>(null);
const draft = ref<Action | null>(null);
const originalDraft = ref<Action | null>(null);
const draftMode = ref<"add" | "edit" | null>(null);
const draftIndex = ref<number | null>(null);
const editorErrors = ref<ActionValidationError[]>([]);
const newActionType = ref("");
const draggedActionId = ref<string | null>(null);

const actionTypes: readonly { value: ActionType; label: string }[] = [
  { value: ACTION_TYPES.METRONOME, label: "Metronom" },
  { value: ACTION_TYPES.SECONDS, label: "Sekunden" },
  { value: ACTION_TYPES.STOPWATCH, label: "Stoppuhr" },
  { value: ACTION_TYPES.MANUAL, label: "Manuell" },
];

const draftIsDirty = computed(() => {
  if (!draft.value) {
    return false;
  }
  return (
    draftMode.value === "add" ||
    JSON.stringify(draft.value) !== JSON.stringify(originalDraft.value)
  );
});

const previousActions = computed<Action[]>(() => {
  if (!draft.value) {
    return [];
  }
  const index =
    draftMode.value === "add"
      ? store.actionDefinitions.length
      : store.actionDefinitions.findIndex(
          (action) => action.id === draft.value?.id,
        );
  return store.actionDefinitions.slice(0, Math.max(0, index));
});

function actionSummary(action: Action, index: number): string {
  const previous = store.actionDefinitions
    .slice(0, index)
    .map(({ id, type, name }) => ({ id, type, name }));
  switch (action.type) {
    case ACTION_TYPES.METRONOME:
      return `${formatNumericFormulaInput(action.settings.bpm, { actions: previous })} BPM`;
    case ACTION_TYPES.SECONDS:
      return `${formatNumericFormulaInput(action.settings.seconds, { actions: previous })} Sekunden`;
    case ACTION_TYPES.STOPWATCH:
      return "Zeit messen";
    case ACTION_TYPES.MANUAL:
      return action.settings.limitSeconds === null
        ? "Ohne Zeitlimit"
        : `Limit ${formatNumericFormulaInput(action.settings.limitSeconds, { actions: previous })} Sekunden`;
  }
}

function confirmDiscard(): boolean {
  return !draftIsDirty.value || window.confirm("Nicht gespeicherte Änderungen verwerfen?");
}

function closeDraft(): void {
  draft.value = null;
  originalDraft.value = null;
  draftMode.value = null;
  draftIndex.value = null;
  editorErrors.value = [];
  void nextTick(() => {
    scrollTo(actionsFieldset.value);
  });
}

function closeIfAllowed(): boolean {
  if (!draft.value) {
    return true;
  }
  if (!confirmDiscard()) {
    return false;
  }
  closeDraft();
  return true;
}

function openDraft(mode: "add" | "edit", action: Action, index: number): void {
  store.actionError = "";
  draftMode.value = mode;
  draft.value = cloneAction(action);
  originalDraft.value = mode === "edit" ? cloneAction(action) : null;
  draftIndex.value = index;
  editorErrors.value = [];
  void nextTick(() => {
    scrollTo(editorWrapper.value);
    document.getElementById("action-editor-title")?.focus();
  });
}

function scrollTo(element: HTMLElement | null): void {
  if (typeof element?.scrollIntoView === "function") {
    element.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function openActionEditor(action: Action, index: number): void {
  if (!closeIfAllowed()) {
    return;
  }
  openDraft("edit", action, index);
}

function isActionType(value: string): value is ActionType {
  return actionTypes.some((option) => option.value === value);
}

function createActionDraft(type: ActionType): Action {
  if (type === ACTION_TYPES.METRONOME) {
    return createDefaultAction(
      type,
      store.actionDefinitions,
      createDefaultMetronomeSettings(),
    );
  }
  return createDefaultAction(type, store.actionDefinitions);
}

function beginAddAction(event: Event): void {
  const select = event.target;
  if (!(select instanceof HTMLSelectElement)) {
    return;
  }
  const type = select.value;
  newActionType.value = "";
  if (!isActionType(type) || !closeIfAllowed()) {
    return;
  }
  openDraft(
    "add",
    createActionDraft(type),
    store.actionDefinitions.length,
  );
}

function saveDraft(): void {
  const currentDraft = draft.value;
  const index = draftIndex.value;
  const mode = draftMode.value;
  if (!currentDraft || index === null || !mode) {
    return;
  }

  const nextActions = [...store.actionDefinitions];
  if (mode === "add") {
    nextActions.push(currentDraft);
  } else {
    nextActions[index] = currentDraft;
  }

  const validation = store.validateDefinitions(nextActions);
  if (!validation.valid) {
    editorErrors.value = validation.errors.filter(
      (error) => error.index === index,
    );
    return;
  }

  const updated =
    mode === "add"
      ? store.replaceActionDefinitions(nextActions)
      : store.updateAction(currentDraft);
  if (!updated) {
    editorErrors.value = validation.errors.filter(
      (error) => error.index === index,
    );
    return;
  }
  closeDraft();
}

function updateDraft(nextDraft: Action): void {
  draft.value = nextDraft;
  editorErrors.value = [];
}

function deleteAction(action: Action): void {
  if (!closeIfAllowed()) {
    return;
  }
  if (window.confirm(`„${action.name}“ wirklich löschen?`)) {
    store.removeAction(action.id);
  }
}

function moveAction(actionId: string, targetIndex: number): void {
  if (!closeIfAllowed()) {
    return;
  }
  store.moveAction(actionId, targetIndex);
}

function handleReorderKey(event: KeyboardEvent, index: number, actionId: string): void {
  if (!event.altKey || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) {
    return;
  }
  event.preventDefault();
  const targetIndex = index + (event.key === "ArrowUp" ? -1 : 1);
  moveAction(actionId, targetIndex);
  void nextTick(() => {
    document
      .querySelector<HTMLButtonElement>(`[data-action-handle="${actionId}"]`)
      ?.focus();
  });
}

function startDragging(actionId: string, event: DragEvent): void {
  draggedActionId.value = actionId;
  event.dataTransfer?.setData("text/plain", actionId);
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
  }
}

function dropOnAction(actionId: string): void {
  const sourceId = draggedActionId.value;
  draggedActionId.value = null;
  if (!sourceId || sourceId === actionId) {
    return;
  }
  const targetIndex = store.actionDefinitions.findIndex(
    (action) => action.id === actionId,
  );
  moveAction(sourceId, targetIndex);
}

defineExpose({ closeIfAllowed });
</script>

<template>
  <fieldset id="actions-fieldset" ref="actionsFieldset">
    <legend>Aktionen</legend>
    <p class="field-help">
      Aktionen werden in Tabellenreihenfolge ausgeführt. Draggen oder Alt+Pfeil
      verschiebt eine Aktion.
    </p>

    <p v-if="store.actionError" class="status error-status" role="alert">
      {{ store.actionError }}
    </p>

    <div class="table-wrapper actions-table-wrapper">
      <table id="actions-table">
        <thead>
          <tr>
            <th class="action-type-column" scope="col">Typ</th>
            <th class="action-name-column" scope="col">Name</th>
            <th class="action-options-column" scope="col">Einstellungen</th>
            <th class="action-controls-column" scope="col">Aktionen</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(action, index) in store.actionDefinitions"
            :key="action.id"
            class="action-row"
            :class="{ 'is-dragging': draggedActionId === action.id }"
            @dragover.prevent
            @drop.prevent="dropOnAction(action.id)"
          >
            <td>
              <div class="action-type-cell">
                <button
                  :data-action-handle="action.id"
                  class="action-drag-handle"
                  type="button"
                  draggable="true"
                  :aria-label="`${action.name} verschieben`"
                  @keydown="handleReorderKey($event, index, action.id)"
                  @dragstart="startDragging(action.id, $event)"
                  @dragend="draggedActionId = null"
                >
                  ↕
                </button>
                <span>{{ getActionTypeLabel(action.type) }}</span>
              </div>
            </td>
            <td>{{ action.name }}</td>
            <td>{{ actionSummary(action, index) }}</td>
            <td>
              <button
                class="icon-button secondary-button"
                type="button"
                :aria-label="`${action.name} bearbeiten`"
                @click="openActionEditor(action, index)"
              >
                ✎
              </button>
              <button
                class="icon-button secondary-button"
                type="button"
                :aria-label="`${action.name} löschen`"
                @click="deleteAction(action)"
              >
                ×
              </button>
            </td>
          </tr>
          <tr v-if="store.actionDefinitions.length === 0">
            <td colspan="4">Noch keine Aktionen hinzugefügt.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="field input-wrapper action-add-wrapper">
      <select
        id="new-action-type"
        :value="newActionType"
        aria-label="Aktion hinzufügen"
        @change="beginAddAction"
      >
        <option value="" disabled>Aktion hinzufügen</option>
        <option
          v-for="option in actionTypes"
          :key="option.value"
          :value="option.value"
        >
          {{ option.label }}
        </option>
      </select>
    </div>

    <div v-if="draft" ref="editorWrapper">
      <ActionEditor
        :draft="draft"
        :errors="editorErrors"
        :previous-actions="previousActions"
        @update:draft="updateDraft"
        @save="saveDraft"
        @cancel="closeIfAllowed"
      />
    </div>
  </fieldset>
</template>
