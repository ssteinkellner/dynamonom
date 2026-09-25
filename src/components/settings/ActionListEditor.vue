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
  MetronomeSettings,
  StopwatchSettings,
} from "../../action-model.ts";
import { createDefaultMetronomeSettings } from "../../models/metronome-settings.ts";
import { formatNumericFormulaInput } from "../../formula-model.ts";
import { useMetronomeStore } from "../../stores/metronome.ts";
import { useDialog } from "../../services/dialog.ts";
import ActionEditor from "./ActionEditor.vue";

const store = useMetronomeStore();
const { confirm } = useDialog();

const actionsFieldset = ref<HTMLElement | null>(null);
const editorWrapper = ref<HTMLElement | null>(null);
const draft = ref<Action | null>(null);
const originalDraft = ref<Action | null>(null);
const draftMode = ref<"add" | "edit" | null>(null);
const draftIndex = ref<number | null>(null);
const editorErrors = ref<ActionValidationError[]>([]);
const newActionType = ref("");
const draggedActionId = ref<string | null>(null);
const nestedDraftDirty = ref(false);

const actionTypes: readonly { value: ActionType; label: string }[] = [
  { value: ACTION_TYPES.METRONOME, label: "Metronom" },
  { value: ACTION_TYPES.STOPWATCH, label: "Stoppuhr" },
];

const draftIsDirty = computed(() => {
  if (!draft.value) {
    return false;
  }
  return (
    draftMode.value === "add" ||
    JSON.stringify(draft.value) !== JSON.stringify(originalDraft.value) ||
    nestedDraftDirty.value
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
    case ACTION_TYPES.METRONOME: {
      return formatMetronomeSummary(action.settings, previous);
    }
    case ACTION_TYPES.STOPWATCH:
      return formatStopwatchSummary(action.settings, previous);
  }
}

function formatMetronomeSummary(
  settings: MetronomeSettings,
  previous: readonly { id: string; type: string; name: string }[],
): string {
  const format = (input: MetronomeSettings["bpm"]): string =>
    formatNumericFormulaInput(input, { actions: previous });
  const summary = [`${format(settings.bpm)} BPM`];

  if (settings.increaseTempo) {
    summary.push(
      `+${format(settings.increaseBy)}/${format(settings.increaseAfter)}`,
    );
    if (settings.maximum === "reverse") {
      summary.push(
        `-${format(settings.decreaseBy)}/${format(settings.decreaseAfter)}`,
      );
    }
  }

  if (settings.breaks === "none") {
    summary.push("Pausen: keine");
  } else if (settings.breaks === "unlimited") {
    summary.push("Pausen: unbegrenzt");
  } else if (settings.breakCount && settings.breakSeconds) {
    summary.push(
      `Pausen: ${format(settings.breakCount)} x ${format(settings.breakSeconds)} Sekunden erlaubt`,
    );
  } else if (settings.breakCount) {
    summary.push(`Pausen: ${format(settings.breakCount)}x erlaubt`);
  } else if (settings.breakSeconds) {
    summary.push(`Pausen: ${format(settings.breakSeconds)} Sekunden erlaubt`);
  } else {
    summary.push("Pausen: begrenzt");
  }
  if (settings.pauseMessages.length > 0) {
    summary.push(`Nachrichten: ${settings.pauseMessages.length}`);
  }

  return summary.join("; ");
}

function formatStopwatchSummary(
  settings: StopwatchSettings,
  previous: readonly { id: string; type: string; name: string }[],
): string {
  const format = (input: StopwatchSettings["automaticSeconds"]): string =>
    formatNumericFormulaInput(input, { actions: previous });
  if (settings.endMode === "automatic") {
    return `Ende: Automatisch nach ${format(settings.automaticSeconds)} Sekunden`;
  }
  if (settings.endMode === "manual") {
    return `Ende: Manuell limitieren auf ${format(settings.manualLimitSeconds)} Sekunden`;
  }
  return "Ende: Unbegrenzt";
}

async function confirmDiscard(): Promise<boolean> {
  if (!draftIsDirty.value) {
    return true;
  }
  return confirm({
    title: "Änderungen verwerfen?",
    message: "Nicht gespeicherte Änderungen verwerfen?",
    confirmLabel: "Verwerfen",
    cancelLabel: "Weiter bearbeiten",
    tone: "danger",
  });
}

function closeDraft(): void {
  draft.value = null;
  originalDraft.value = null;
  draftMode.value = null;
  draftIndex.value = null;
  nestedDraftDirty.value = false;
  editorErrors.value = [];
  void nextTick(() => {
    scrollTo(actionsFieldset.value);
  });
}

async function closeIfAllowed(): Promise<boolean> {
  if (!draft.value) {
    return true;
  }
  if (!(await confirmDiscard())) {
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

async function openActionEditor(action: Action, index: number): Promise<void> {
  if (!(await closeIfAllowed())) {
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

async function beginAddAction(event: Event): Promise<void> {
  const select = event.target;
  if (!(select instanceof HTMLSelectElement)) {
    return;
  }
  const type = select.value;
  newActionType.value = "";
  if (!isActionType(type) || !(await closeIfAllowed())) {
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

function updateNestedDraftState(dirty: boolean): void {
  nestedDraftDirty.value = dirty;
}

async function deleteAction(action: Action): Promise<void> {
  if (!(await closeIfAllowed())) {
    return;
  }
  if (
    await confirm({
      title: `„${action.name}“ löschen?`,
      message: "Diese Aktion wird aus der Liste entfernt.",
      confirmLabel: "Löschen",
      cancelLabel: "Abbrechen",
      tone: "danger",
    })
  ) {
    store.removeAction(action.id);
  }
}

async function moveAction(actionId: string, targetIndex: number): Promise<void> {
  if (!(await closeIfAllowed())) {
    return;
  }
  store.moveAction(actionId, targetIndex);
}

async function handleReorderKey(
  event: KeyboardEvent,
  index: number,
  actionId: string,
): Promise<void> {
  if (!event.altKey || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) {
    return;
  }
  event.preventDefault();
  const targetIndex = index + (event.key === "ArrowUp" ? -1 : 1);
  await moveAction(actionId, targetIndex);
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

async function dropOnAction(actionId: string): Promise<void> {
  const sourceId = draggedActionId.value;
  draggedActionId.value = null;
  if (!sourceId || sourceId === actionId) {
    return;
  }
  const targetIndex = store.actionDefinitions.findIndex(
    (action) => action.id === actionId,
  );
  await moveAction(sourceId, targetIndex);
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
        @nested-draft-state="updateNestedDraftState"
        @save="saveDraft"
        @cancel="closeIfAllowed"
      />
    </div>
  </fieldset>
</template>
