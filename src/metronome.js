import {
  ACTION_TYPES,
  ACTIONS_VERSION,
  cloneAction,
  cloneActions,
  createDefaultAction,
  getActionTypeLabel,
  normalizeActionDefinition,
  parseActionsPayload,
  serializeActionsPayload,
  validateActionDefinitions,
} from "./action-model.ts";
import {
  PRE_TIMER_ROUNDING,
  evaluatePreTimerFormula,
  formatPreTimerDuration,
  getPreTimerFormulaVariables,
  getPreTimerOptionsSummary,
  getPreTimerRoundingLabel,
  isStaticPreTimerFormula,
} from "./pre-timer-model.ts";

"use strict";

const DEFAULTS = Object.freeze({
  bpm: 120,
  accentuate: true,
  accentRepeat: 10,
  increaseTempo: true,
  increaseBy: 1,
  increaseAfter: 10,
  maximum: "none",
  maximumLimit: 180,
  decreaseBy: 1,
  decreaseAfter: 10,
  breaks: "unlimited",
  breakCount: null,
  breakSeconds: null,
  lockSettings: false,
  lockBeats: 10,
  sessionEndEnabled: false,
  sessionEndBeats: 100,
});

const TONE = Object.freeze({
  regularFrequency: 440,
  accentFrequency: 880,
  countdownFrequency: 1760,
  durationSeconds: 0.07,
  peakGain: 0.18,
});

const PRE_TIMER_FORMULA_PLACEHOLDERS = new Set([
  "minuten",
  "summe-minuten",
  "sekunden",
  "rest-sekunden",
]);

const views = {
  presets: document.getElementById("presets-view"),
  settings: document.getElementById("settings-view"),
  seconds: document.getElementById("seconds-view"),
  stopwatch: document.getElementById("stopwatch-view"),
  manual: document.getElementById("manual-view"),
  execution: document.getElementById("execution-view"),
  report: document.getElementById("report-view"),
};

const dom = {
  presetsTitle: document.getElementById("presets-title"),
  presetStatus: document.getElementById("preset-status"),
  manualButton: document.getElementById("manual-button"),
  settingsForm: document.getElementById("settings-form"),
  settingsTitle: document.getElementById("settings-title"),
  settingsStatus: document.getElementById("settings-status"),
  importErrorPanel: document.getElementById("import-error-panel"),
  importErrorSummary: document.getElementById("import-error-summary"),
  importErrorList: document.getElementById("import-error-list"),
  importErrorText: document.getElementById("import-error-text"),
  presetList: document.getElementById("preset-list"),
  settingsImport: document.getElementById("settings-import"),
  settingsImportError: document.getElementById("settings-import-error"),
  actionsFieldset: document.getElementById("actions-fieldset"),
  actionsTable: document.getElementById("actions-table"),
  actionsTableBody: document.getElementById("actions-table-body"),
  actionsEmptyMessage: document.getElementById("actions-empty-message"),
  actionsError: document.getElementById("actions-error"),
  actionAddButton: document.getElementById("action-add-button"),
  actionEditor: document.getElementById("action-editor"),
  actionEditorTitle: document.getElementById("action-editor-title"),
  actionTypeField: document.getElementById("action-type-field"),
  actionType: document.getElementById("action-type"),
  actionTypeDescription: document.getElementById("action-type-description"),
  actionNameField: document.getElementById("action-name-field"),
  actionName: document.getElementById("action-name"),
  actionSecondsFields: document.getElementById("action-seconds-fields"),
  actionSeconds: document.getElementById("action-seconds"),
  actionStopwatchFields: document.getElementById("action-stopwatch-fields"),
  actionFormula: document.getElementById("action-formula"),
  actionFormulaPlaceholders: document.getElementById("action-formula-placeholders"),
  actionRounding: document.getElementById("action-rounding"),
  actionRoundingThresholdField: document.getElementById("action-rounding-threshold-field"),
  actionRoundingThreshold: document.getElementById("action-rounding-threshold"),
  actionFormulaBounds: document.getElementById("action-formula-bounds"),
  actionMin: document.getElementById("action-min"),
  actionMax: document.getElementById("action-max"),
  actionManualFields: document.getElementById("action-manual-fields"),
  actionLimitSeconds: document.getElementById("action-limit-seconds"),
  metronomeActionFields: document.getElementById("metronome-action-fields"),
  actionEditorCancel: document.getElementById("action-editor-cancel"),
  actionEditorSave: document.getElementById("action-editor-save"),
  actionDeleteDialog: document.getElementById("action-delete-dialog"),
  actionDeleteDialogMessage: document.getElementById("action-delete-dialog-message"),
  actionDeleteCancel: document.getElementById("action-delete-cancel"),
  actionDeleteConfirm: document.getElementById("action-delete-confirm"),
  actionDiscardDialog: document.getElementById("action-discard-dialog"),
  actionDiscardStay: document.getElementById("action-discard-stay"),
  actionDiscardConfirm: document.getElementById("action-discard-confirm"),
  actionAbortDialog: document.getElementById("action-abort-dialog"),
  actionAbortDialogMessage: document.getElementById("action-abort-dialog-message"),
  actionAbortCancel: document.getElementById("action-abort-cancel"),
  actionAbortConfirm: document.getElementById("action-abort-confirm"),
  secondsEarlyDialog: document.getElementById("seconds-early-dialog"),
  secondsEarlyDialogMessage: document.getElementById("seconds-early-dialog-message"),
  secondsEarlyCancel: document.getElementById("seconds-early-cancel"),
  secondsEarlyConfirm: document.getElementById("seconds-early-confirm"),
  hideProgress: document.getElementById("hide-progress"),
  exportAutoStart: document.getElementById("export-auto-start"),
  exportSettingsButton: document.getElementById("export-settings-button"),
  exportUrlButton: document.getElementById("export-url-button"),
  settingsBackPresetsButton: document.getElementById("settings-back-presets-button"),
  bpm: document.getElementById("bpm"),
  accentuate: document.getElementById("accentuate"),
  accentOptionCard: document.getElementById("accent-option-card"),
  accentRepeat: document.getElementById("accent-repeat"),
  increaseTempo: document.getElementById("increase-tempo"),
  increaseOptionCard: document.getElementById("increase-option-card"),
  increaseBy: document.getElementById("increase-by"),
  increaseAfter: document.getElementById("increase-after"),
  maximumOptions: document.getElementById("maximum-options"),
  maximumNoneOption: document.getElementById("maximum-none-option"),
  maximumStickOption: document.getElementById("maximum-stick-option"),
  maximumResetOption: document.getElementById("maximum-reset-option"),
  maximumReverseOption: document.getElementById("maximum-reverse-option"),
  maximumLimitStick: document.getElementById("maximum-limit-stick"),
  maximumLimitReset: document.getElementById("maximum-limit-reset"),
  maximumLimitReverse: document.getElementById("maximum-limit-reverse"),
  decreaseByReverse: document.getElementById("decrease-by-reverse"),
  decreaseAfterReverse: document.getElementById("decrease-after-reverse"),
  lockSettings: document.getElementById("lock-settings"),
  lockOptionCard: document.getElementById("lock-option-card"),
  lockBeats: document.getElementById("lock-beats"),
  breaksNoneOption: document.getElementById("breaks-none-option"),
  breaksUnlimitedOption: document.getElementById("breaks-unlimited-option"),
  breaksLimitedOption: document.getElementById("breaks-limited-option"),
  breakCount: document.getElementById("break-count"),
  breakSeconds: document.getElementById("break-seconds"),
  sessionEndOptionCard: document.getElementById("session-end-option-card"),
  sessionEndEnabled: document.getElementById("session-end-enabled"),
  sessionEndBeats: document.getElementById("session-end-beats"),
  derivedEndMessage: document.getElementById("derived-end-message"),
  secondsTitle: document.getElementById("seconds-title"),
  secondsProgress: document.getElementById("seconds-progress"),
  secondsActionName: document.getElementById("seconds-action-name"),
  secondsActionOptions: document.getElementById("seconds-action-options"),
  secondsClock: document.getElementById("seconds-clock"),
  secondsStatus: document.getElementById("seconds-status"),
  secondsContinueButton: document.getElementById("seconds-continue-button"),
  stopwatchTitle: document.getElementById("stopwatch-title"),
  stopwatchProgress: document.getElementById("stopwatch-progress"),
  stopwatchActionName: document.getElementById("stopwatch-action-name"),
  stopwatchActionOptions: document.getElementById("stopwatch-action-options"),
  stopwatchClock: document.getElementById("stopwatch-clock"),
  stopwatchStatus: document.getElementById("stopwatch-status"),
  stopwatchContinueButton: document.getElementById("stopwatch-continue-button"),
  manualTitle: document.getElementById("manual-title"),
  manualProgress: document.getElementById("manual-progress"),
  manualActionName: document.getElementById("manual-action-name"),
  manualActionOptions: document.getElementById("manual-action-options"),
  manualClock: document.getElementById("manual-clock"),
  manualStatus: document.getElementById("manual-status"),
  manualContinueButton: document.getElementById("manual-continue-button"),
  executionTitle: document.getElementById("execution-title"),
  executionActionName: document.getElementById("execution-action-name"),
  executionProgress: document.getElementById("execution-progress"),
  executionPhase: document.getElementById("execution-phase"),
  currentBpmLabel: document.getElementById("current-bpm-label"),
  currentBpm: document.getElementById("current-bpm"),
  nextBpmLabel: document.getElementById("next-bpm-label"),
  nextBpmInfo: document.getElementById("next-bpm-info"),
  nextBpm: document.getElementById("next-bpm"),
  nextBpmCountdown: document.getElementById("next-bpm-countdown"),
  beatCount: document.getElementById("beat-count"),
  breakStatus: document.getElementById("break-status"),
  executionMessage: document.getElementById("execution-message"),
  executionActions: document.getElementById("execution-actions"),
  abortButton: document.getElementById("abort-button"),
  pauseButton: document.getElementById("pause-button"),
  continueMetronomeButton: document.getElementById("continue-metronome-button"),
  reportTitle: document.getElementById("report-title"),
  reportStatus: document.getElementById("report-status"),
  actionReportSections: document.getElementById("action-report-sections"),
  copyReportButton: document.getElementById("copy-report-button"),
  copyShortReportButton: document.getElementById("copy-short-report-button"),
  clipboardBuffer: document.getElementById("clipboard-buffer"),
  backPresetsButton: document.getElementById("back-presets-button"),
  backButton: document.getElementById("back-button"),
  repeatButton: document.getElementById("repeat-button"),
};

const state = {
  phase: "idle",
  token: 0,
  settings: null,
  beatCount: 0,
  currentBpm: DEFAULTS.bpm,
  direction: "up",
  tempoCounter: 0,
  stuckAtMaximum: false,
  countdownValue: 3,
  countdownTimer: null,
  resumeCountdownValue: 0,
  resumeCountdownTimer: null,
  beatTimer: null,
  breakTimer: null,
  breakDisplayTimer: null,
  nextBeatDue: 0,
  breakSessions: 0,
  breakRecords: [],
  activeBreak: null,
  actionPlan: [],
  actionResults: [],
  currentActionIndex: -1,
  activeActionStartedAt: null,
  actionTimer: null,
  actionDisplayTimer: null,
  report: null,
};

let audioContext = null;
const copyFeedbackTimers = new Map();
let autoStartImportInProgress = false;
let settingsImportPasteTimer = null;
let actionDefinitions = [];
let actionEditorDraft = null;
let actionEditorOriginal = null;
let actionEditorMode = null;
let actionEditorId = null;
let actionEditorDirty = false;
let pendingEditorCommand = null;
let actionDeleteId = null;
let actionDeleteTrigger = null;
let actionAbortDialogTrigger = null;
let secondsEarlyDialogTrigger = null;
let actionDragState = null;
let actionFormulaSelection = null;

const RADIO_SETTING_VALUES = Object.freeze({
  maximum: new Set(["none", "stick", "reset", "reverse"]),
  breaks: new Set(["none", "unlimited", "limited"]),
});

function init() {
  const missingElements = Object.entries(dom)
    .filter(([, element]) => element === null)
    .map(([name]) => name);
  if (missingElements.length > 0) {
    console.error("Metronome initialization failed because required markup is missing:", missingElements);
    return;
  }

  actionDefinitions = [
    createDefaultAction(
      ACTION_TYPES.METRONOME,
      [],
      createDefaultMetronomeSettings(),
    ),
  ];
  renderPresets();
  renderActionTable();
  const initialParameters = getInitialParameterText();
  if (initialParameters) {
    dom.settingsImport.value = initialParameters;
  }
  bindEvents();
  syncSettingsVisibility();
  syncProgressVisibility();
  showView("presets", false);
  if (initialParameters) {
    void handleSettingsImport(initialParameters);
  }
}

function bindEvents() {
  dom.settingsForm.addEventListener("submit", handleStart);
  dom.settingsForm.addEventListener("input", handleSettingsFormInput);
  dom.settingsForm.addEventListener("change", handleSettingsFormChange);
  dom.settingsImport.addEventListener("paste", () => {
    if (settingsImportPasteTimer !== null) {
      window.clearTimeout(settingsImportPasteTimer);
    }
    settingsImportPasteTimer = window.setTimeout(() => {
      settingsImportPasteTimer = null;
      void handleSettingsImport(dom.settingsImport.value);
    }, 0);
  });
  dom.settingsImport.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") {
      return;
    }
    event.preventDefault();
    if (settingsImportPasteTimer !== null) {
      window.clearTimeout(settingsImportPasteTimer);
      settingsImportPasteTimer = null;
    }
    void handleSettingsImport(dom.settingsImport.value);
  });
  dom.manualButton.addEventListener("click", () => {
    showView("settings", true);
  });
  dom.settingsBackPresetsButton.addEventListener("click", () => {
    requestCloseActionEditor(() => showView("presets", true));
  });
  dom.actionAddButton.addEventListener("click", () => {
    requestOpenActionEditor("add");
  });
  dom.actionsTableBody.addEventListener("click", handleActionTableClick);
  dom.actionsTableBody.addEventListener("keydown", handleActionTableKeydown);
  dom.actionsTableBody.addEventListener("pointerdown", handleActionPointerDown);
  dom.actionsTableBody.addEventListener("pointermove", handleActionPointerMove);
  dom.actionsTableBody.addEventListener("pointerup", handleActionPointerUp);
  dom.actionsTableBody.addEventListener("pointercancel", handleActionPointerCancel);
  dom.actionsTableBody.addEventListener("dragstart", handleActionDragStart);
  dom.actionsTableBody.addEventListener("dragover", handleActionDragOver);
  dom.actionsTableBody.addEventListener("drop", handleActionDrop);
  dom.actionsTableBody.addEventListener("dragend", handleActionDragEnd);
  dom.actionType.addEventListener("change", handleActionTypeChange);
  dom.actionFormula.addEventListener("input", syncActionEditorFields);
  dom.actionRounding.addEventListener("change", syncActionEditorFields);
  dom.actionEditorSave.addEventListener("click", saveActionEditorDraft);
  dom.actionEditorCancel.addEventListener("click", () => {
    cancelActionEditor();
  });
  dom.actionFormulaPlaceholders.addEventListener("click", handleFormulaPlaceholderClick);
  dom.actionFormulaPlaceholders.addEventListener("dragstart", handleFormulaPlaceholderDragStart);
  dom.actionFormula.addEventListener("dragover", handleFormulaDragOver);
  dom.actionFormula.addEventListener("drop", handleFormulaDrop);
  ["blur", "focus", "keyup", "mouseup", "select"].forEach((eventName) => {
    dom.actionFormula.addEventListener(eventName, rememberFormulaSelection);
  });

  dom.actionDeleteCancel.addEventListener("click", () => closeActionDeleteDialog(false));
  dom.actionDeleteConfirm.addEventListener("click", confirmActionDelete);
  dom.actionDeleteDialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeActionDeleteDialog(false);
  });
  dom.actionDiscardStay.addEventListener("click", () => resolvePendingEditorCommand(false));
  dom.actionDiscardConfirm.addEventListener("click", () => resolvePendingEditorCommand(true));
  dom.actionDiscardDialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    resolvePendingEditorCommand(false);
  });

  dom.exportSettingsButton.addEventListener("click", () => {
    void handleExportSettings("settings", dom.exportSettingsButton, "Nur Einstellungen kopieren");
  });
  dom.exportUrlButton.addEventListener("click", () => {
    void handleExportSettings("url", dom.exportUrlButton, "Ganze URL kopieren");
  });
  dom.pauseButton.addEventListener("click", handlePause);
  dom.abortButton.addEventListener("click", handleActionAbortRequest);
  document.querySelectorAll("[data-abort-sequence]").forEach((button) => {
    button.addEventListener("click", handleActionAbortRequest);
  });
  dom.continueMetronomeButton.addEventListener("click", handleMetronomeContinue);
  dom.secondsContinueButton.addEventListener("click", handleTimerActionContinue);
  dom.stopwatchContinueButton.addEventListener("click", handleTimerActionContinue);
  dom.manualContinueButton.addEventListener("click", handleTimerActionContinue);
  dom.actionAbortCancel.addEventListener("click", () => closeActionAbortDialog(false));
  dom.actionAbortConfirm.addEventListener("click", () => closeActionAbortDialog(true));
  dom.actionAbortDialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeActionAbortDialog(false);
  });
  dom.secondsEarlyCancel.addEventListener("click", () => closeSecondsEarlyDialog(false));
  dom.secondsEarlyConfirm.addEventListener("click", () => closeSecondsEarlyDialog(true));
  dom.secondsEarlyDialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeSecondsEarlyDialog(false);
  });

  dom.copyReportButton.addEventListener("click", handleCopyReport);
  dom.copyShortReportButton.addEventListener("click", handleCopyShortReport);
  dom.backButton.addEventListener("click", handleBackToSettings);
  dom.backPresetsButton.addEventListener("click", handleBackToPresets);
  dom.repeatButton.addEventListener("click", handleRepeatRun);
  document.addEventListener("wheel", handleNumberInputWheel, {
    capture: true,
    passive: true,
  });
}

function handleSettingsFormInput(event) {
  const control = event.target;
  if (control instanceof HTMLInputElement || control instanceof HTMLSelectElement) {
    clearFieldError(control.id);
    if (control.name === "maximum") {
      clearFieldError("maximum");
    } else if (control.name === "breaks") {
      clearFieldError("breaks");
    }
  }
  if (actionEditorDraft && dom.actionEditor.contains(control)) {
    actionEditorDirty = true;
  }
  dom.settingsStatus.classList.remove("error-status");
  dom.settingsStatus.textContent = "";
}

function handleSettingsFormChange(event) {
  const control = event.target;
  if (control === dom.hideProgress) {
    syncProgressVisibility();
  }
  if (control === dom.accentuate && !control.checked) {
    clearFieldError("accent-repeat");
  }
  if (control === dom.increaseTempo && !control.checked) {
    [
      "increase-by",
      "increase-after",
      "maximum",
      "maximum-limit-stick",
      "maximum-limit-reset",
      "maximum-limit-reverse",
      "decrease-by-reverse",
      "decrease-after-reverse",
    ].forEach(clearFieldError);
  }
  if (control === dom.lockSettings && !control.checked) {
    clearFieldError("lock-beats");
  }
  if (control === dom.sessionEndEnabled && !control.checked) {
    clearFieldError("session-end-beats");
  }
  if (control.name === "maximum") {
    [
      "maximum",
      "maximum-limit-stick",
      "maximum-limit-reset",
      "maximum-limit-reverse",
      "decrease-by-reverse",
      "decrease-after-reverse",
    ].forEach(clearFieldError);
  } else if (control.name === "breaks") {
    ["breaks", "break-count", "break-seconds"].forEach(clearFieldError);
  }
  if (
    control === dom.accentuate ||
    control === dom.increaseTempo ||
    control === dom.lockSettings ||
    control === dom.sessionEndEnabled ||
    control.name === "maximum" ||
    control.name === "breaks"
  ) {
    syncSettingsVisibility();
  }
  if (actionEditorDraft && dom.actionEditor.contains(control)) {
    actionEditorDirty = true;
  }
}

function syncSettingsVisibility() {
  if (actionEditorDraft?.type !== ACTION_TYPES.METRONOME) {
    return;
  }

  const increaseEnabled = dom.increaseTempo.checked;
  const accentEnabled = dom.accentuate.checked;
  const lockEnabled = dom.lockSettings.checked;
  const maximum = getSelectedValue("maximum");
  const breaks = getSelectedValue("breaks");
  const actionIndex = getActionEditorIndex();
  const stopwatchSources = getStopwatchSourcesBeforeMetronome(
    actionDefinitions,
    actionIndex,
  );
  const hasDerivedEnd = stopwatchSources.length > 0;

  setOptionCardState(dom.accentOptionCard, accentEnabled);
  setOptionCardState(dom.increaseOptionCard, increaseEnabled);
  setControlDisabled(dom.accentRepeat, !accentEnabled);
  setControlDisabled(dom.increaseBy, !increaseEnabled);
  setControlDisabled(dom.increaseAfter, !increaseEnabled);

  document.querySelectorAll('input[name="maximum"]').forEach((input) => {
    setControlDisabled(input, !increaseEnabled);
  });
  setOptionCardState(dom.maximumNoneOption, increaseEnabled && maximum === "none");
  setOptionCardState(dom.maximumStickOption, increaseEnabled && maximum === "stick");
  setOptionCardState(dom.maximumResetOption, increaseEnabled && maximum === "reset");
  setOptionCardState(dom.maximumReverseOption, increaseEnabled && maximum === "reverse");
  setControlDisabled(dom.maximumLimitStick, !increaseEnabled || maximum !== "stick");
  setControlDisabled(dom.maximumLimitReset, !increaseEnabled || maximum !== "reset");
  setControlDisabled(dom.maximumLimitReverse, !increaseEnabled || maximum !== "reverse");
  setControlDisabled(dom.decreaseByReverse, !increaseEnabled || maximum !== "reverse");
  setControlDisabled(dom.decreaseAfterReverse, !increaseEnabled || maximum !== "reverse");
  dom.maximumOptions.setAttribute("aria-disabled", String(!increaseEnabled));

  setOptionCardState(dom.lockOptionCard, lockEnabled && !hasDerivedEnd);
  setControlDisabled(dom.lockSettings, hasDerivedEnd);
  setControlDisabled(dom.lockBeats, hasDerivedEnd || !lockEnabled);

  setOptionCardState(dom.breaksNoneOption, breaks === "none");
  setOptionCardState(dom.breaksUnlimitedOption, breaks === "unlimited");
  setOptionCardState(dom.breaksLimitedOption, breaks === "limited");
  setControlDisabled(dom.breakCount, breaks !== "limited");
  setControlDisabled(dom.breakSeconds, breaks !== "limited");

  const sessionEndEnabled = dom.sessionEndEnabled.checked;
  setOptionCardState(dom.sessionEndOptionCard, sessionEndEnabled && !hasDerivedEnd);
  setControlDisabled(dom.sessionEndEnabled, hasDerivedEnd);
  setControlDisabled(dom.sessionEndBeats, hasDerivedEnd || !sessionEndEnabled);

  if (hasDerivedEnd) {
    const names = stopwatchSources.map((action) => action.name).join(", ");
    dom.sessionEndOptionCard.setAttribute("aria-disabled", "true");
    dom.lockOptionCard.setAttribute("aria-disabled", "true");
    dom.derivedEndMessage.textContent =
      "Ende und Sperre werden aus diesen Stoppuhr-Aktionen berechnet: " + names + ".";
    dom.derivedEndMessage.hidden = false;
  } else {
    dom.sessionEndOptionCard.removeAttribute("aria-disabled");
    dom.lockOptionCard.removeAttribute("aria-disabled");
    dom.derivedEndMessage.textContent = "";
    dom.derivedEndMessage.hidden = true;
  }
}

function syncActionEditorFields() {
  const isAdding = actionEditorMode === "add";
  const type = actionEditorDraft?.type || (isAdding ? dom.actionType.value : "");
  const isOpen = actionEditorMode !== null;
  const isMetronome = type === ACTION_TYPES.METRONOME;
  const isSeconds = type === ACTION_TYPES.SECONDS;
  const isStopwatch = type === ACTION_TYPES.STOPWATCH;
  const isManual = type === ACTION_TYPES.MANUAL;
  const isRound = dom.actionRounding.value === PRE_TIMER_ROUNDING.ROUND;
  const hasDynamicFormula = isStopwatch && !isStaticPreTimerFormula(dom.actionFormula.value);

  dom.actionEditor.hidden = !isOpen;
  dom.actionTypeField.hidden = !isAdding;
  dom.actionNameField.hidden = !type;
  dom.actionEditorTitle.textContent = type
    ? getActionTypeLabel(type)
    : "Aktion hinzufügen";
  dom.actionTypeDescription.textContent = getActionTypeDescription(type);
  dom.actionSecondsFields.hidden = !isSeconds;
  dom.actionStopwatchFields.hidden = !isStopwatch;
  dom.actionManualFields.hidden = !isManual;
  dom.metronomeActionFields.hidden = !isMetronome;
  dom.actionRoundingThresholdField.hidden = !isStopwatch || !isRound;
  dom.actionMin.disabled = !hasDynamicFormula;
  dom.actionMax.disabled = !hasDynamicFormula;
  dom.actionFormulaBounds.classList.toggle("is-disabled", !hasDynamicFormula);
  syncSettingsVisibility();
}

function getActionTypeDescription(type) {
  switch (type) {
    case ACTION_TYPES.METRONOME:
      return "Spielt ein Metronom mit eigenem Tempo, Pausen und Ende.";
    case ACTION_TYPES.SECONDS:
      return "Wartet die eingestellte Zeit und wechselt danach automatisch zur nächsten Aktion.";
    case ACTION_TYPES.STOPWATCH:
      return "Erfasst eine Dauer; das Formelergebnis gilt für das nächste Metronom.";
    case ACTION_TYPES.MANUAL:
      return "Wartet auf Weiter; ein optionales Limit löst keinen automatischen Wechsel aus.";
    default:
      return "";
  }
}

function createDefaultMetronomeSettings() {
  const { maximumLimit, ...settings } = DEFAULTS;
  return {
    ...settings,
    maximumLimitStick: maximumLimit,
    maximumLimitReset: maximumLimit,
    maximumLimitReverse: maximumLimit,
    breakSeconds: "",
  };
}

function getStopwatchSourcesBeforeMetronome(actions, metronomeIndex) {
  const sources = [];
  for (let index = 0; index < metronomeIndex; index += 1) {
    const action = actions[index];
    if (!action || typeof action !== "object") {
      continue;
    }
    if (action.type === ACTION_TYPES.METRONOME) {
      sources.length = 0;
    } else if (action.type === ACTION_TYPES.STOPWATCH) {
      sources.push(action);
    }
  }
  return sources;
}

function getActionEditorIndex() {
  if (actionEditorMode === "edit") {
    return actionDefinitions.findIndex((action) => action.id === actionEditorId);
  }
  return actionDefinitions.length;
}

function syncProgressVisibility() {
  const hidden = dom.hideProgress.checked;
  document.querySelectorAll(".action-progress").forEach((element) => {
    element.hidden = hidden;
  });
}

function renderActionTable() {
  dom.actionsTableBody.replaceChildren();
  const hasRows = actionDefinitions.length > 0;
  dom.actionsEmptyMessage.hidden = hasRows;
  actionDefinitions.forEach((action) => {
    const row = document.createElement("tr");
    row.className = "action-row";
    row.dataset.actionId = action.id;

    const typeCell = document.createElement("td");
    typeCell.className = "action-type-cell";
    const dragHandle = document.createElement("button");
    dragHandle.className = "action-drag-handle";
    dragHandle.type = "button";
    dragHandle.draggable = true;
    dragHandle.dataset.actionId = action.id;
    dragHandle.setAttribute(
      "aria-label",
      "\"" + action.name + "\" in der Reihenfolge verschieben",
    );
    dragHandle.title = "Aktion verschieben";
    dragHandle.textContent = "⠿";
    const typeText = document.createElement("span");
    typeText.textContent = getActionTypeLabel(action.type);
    typeCell.append(dragHandle, typeText);

    const nameCell = document.createElement("td");
    nameCell.textContent = action.name;
    const optionsCell = document.createElement("td");
    optionsCell.textContent = getActionOptionsSummary(action);
    const controlsCell = document.createElement("td");
    const editButton = createActionIconButton(
      "edit",
      action,
      "Aktion bearbeiten",
      "✎",
    );
    const deleteButton = createActionIconButton(
      "delete",
      action,
      "Aktion löschen",
      "×",
    );
    controlsCell.append(editButton, deleteButton);
    row.append(typeCell, nameCell, optionsCell, controlsCell);
    dom.actionsTableBody.append(row);
  });
  syncSettingsVisibility();
}

function getActionOptionsSummary(action) {
  if (action.type === ACTION_TYPES.METRONOME) {
    return formatMetronomeSettingsSummary(action.settings);
  }
  return getPreTimerOptionsSummary({
    ...action.settings,
    type: action.type,
  });
}

function createActionIconButton(operation, action, label, icon) {
  const button = document.createElement("button");
  button.className = "secondary-button icon-button";
  button.type = "button";
  button.dataset.actionOperation = operation;
  button.dataset.actionId = action.id;
  button.setAttribute("aria-label", label + ": " + action.name);
  button.title = label;
  button.textContent = icon;
  return button;
}

function findActionById(actionId) {
  return actionDefinitions.find((action) => action.id === actionId) || null;
}

function requestOpenActionEditor(actionId = null, trigger = dom.actionAddButton) {
  if (actionId === "add") {
    actionId = null;
  }
  const open = () => openActionEditor(actionId, trigger);
  if (actionEditorMode !== null) {
    requestCloseActionEditor(open);
    return;
  }
  open();
}

function openActionEditor(actionId, trigger) {
  if (actionId) {
    const action = findActionById(actionId);
    if (!action) {
      console.error("Cannot edit a missing action:", actionId);
      return;
    }
    actionEditorMode = "edit";
    actionEditorId = action.id;
    actionEditorDraft = cloneAction(action);
    actionEditorOriginal = cloneAction(action);
    dom.actionType.value = action.type;
    dom.actionName.value = action.name;
    applyActionSettingsToEditor(actionEditorDraft);
    actionEditorDirty = false;
  } else {
    actionEditorMode = "add";
    actionEditorId = null;
    actionEditorDraft = null;
    actionEditorOriginal = null;
    dom.actionType.value = "";
    dom.actionName.value = "";
    actionEditorDirty = false;
    clearActionTypeFields();
  }
  clearActionEditorErrors();
  dom.actionsError.textContent = "";
  syncActionEditorFields();
  dom.actionEditor.hidden = false;
  dom.actionEditor.scrollIntoView({ behavior: "smooth", block: "start" });
  if (actionEditorMode === "add") {
    dom.actionType.focus({ preventScroll: true });
  } else {
    dom.actionEditorTitle.focus({ preventScroll: true });
  }
}

function handleActionTypeChange() {
  if (actionEditorMode !== "add") {
    return;
  }
  clearActionEditorErrors();
  const type = dom.actionType.value;
  if (!type) {
    actionEditorDraft = null;
    dom.actionName.value = "";
    syncActionEditorFields();
    return;
  }
  actionEditorDraft = createDefaultAction(
    type,
    actionDefinitions,
    createDefaultMetronomeSettings(),
  );
  dom.actionName.value = actionEditorDraft.name;
  applyActionSettingsToEditor(actionEditorDraft);
  actionEditorDirty = true;
  syncActionEditorFields();
  const firstField = getActionEditorFirstField(type);
  firstField?.focus({ preventScroll: true });
}

function getActionEditorFirstField(type) {
  if (type === ACTION_TYPES.METRONOME) {
    return dom.bpm;
  }
  if (type === ACTION_TYPES.SECONDS) {
    return dom.actionSeconds;
  }
  if (type === ACTION_TYPES.STOPWATCH) {
    return dom.actionFormula;
  }
  if (type === ACTION_TYPES.MANUAL) {
    return dom.actionLimitSeconds;
  }
  return dom.actionName;
}

function applyActionSettingsToEditor(action) {
  if (action.type === ACTION_TYPES.METRONOME) {
    applyMetronomeSettingsToForm(action.settings);
  } else if (action.type === ACTION_TYPES.SECONDS) {
    dom.actionSeconds.value = String(action.settings.seconds);
  } else if (action.type === ACTION_TYPES.STOPWATCH) {
    dom.actionFormula.value = action.settings.formula;
    dom.actionRounding.value = action.settings.rounding;
    dom.actionRoundingThreshold.value =
      action.settings.roundingThreshold === null
        ? ""
        : String(action.settings.roundingThreshold);
    dom.actionMin.value = String(action.settings.min ?? 10);
    dom.actionMax.value = action.settings.max === null ? "" : String(action.settings.max);
    actionFormulaSelection = {
      start: dom.actionFormula.value.length,
      end: dom.actionFormula.value.length,
    };
  } else if (action.type === ACTION_TYPES.MANUAL) {
    dom.actionLimitSeconds.value =
      action.settings.limitSeconds === null ? "" : String(action.settings.limitSeconds);
  }
  syncActionEditorFields();
}

function clearActionTypeFields() {
  dom.actionSeconds.value = "10";
  dom.actionFormula.value = "sekunden";
  dom.actionRounding.value = PRE_TIMER_ROUNDING.FLOOR;
  dom.actionRoundingThreshold.value = "";
  dom.actionMin.value = "10";
  dom.actionMax.value = "";
  dom.actionLimitSeconds.value = "";
  applyMetronomeSettingsToForm(createDefaultMetronomeSettings());
}

function collectActionEditorSettings(type) {
  if (type === ACTION_TYPES.METRONOME) {
    return readMetronomeSettingsFromForm();
  }
  if (type === ACTION_TYPES.SECONDS) {
    return { seconds: dom.actionSeconds.value };
  }
  if (type === ACTION_TYPES.STOPWATCH) {
    return {
      formula: dom.actionFormula.value,
      rounding: dom.actionRounding.value,
      roundingThreshold: dom.actionRoundingThreshold.value,
      min: dom.actionMin.value,
      max: dom.actionMax.value,
    };
  }
  return { limitSeconds: dom.actionLimitSeconds.value };
}

function saveActionEditorDraft() {
  if (!actionEditorDraft || !actionEditorMode) {
    setFieldError("action-type", "Einen Aktionstyp auswählen.");
    dom.actionType.focus();
    return;
  }

  const candidate = {
    ...actionEditorDraft,
    name: dom.actionName.value,
    settings: collectActionEditorSettings(actionEditorDraft.type),
  };
  const normalized = normalizeActionDefinition(candidate);
  if (!normalized.valid) {
    showActionEditorErrors(
      Object.entries(normalized.errors).map(([field, message]) => ({ field, message })),
    );
    return;
  }

  const duplicate = actionDefinitions.find(
    (action) =>
      action.id !== actionEditorId &&
      action.name.trim().toLowerCase() ===
        normalized.value.name.toLowerCase(),
  );
  if (duplicate) {
    showActionEditorErrors([
      {
        field: "name",
        message: "Der Name \"" + duplicate.name + "\" ist bereits vergeben.",
      },
    ]);
    return;
  }

  const nextActions = cloneActions(actionDefinitions);
  let index = actionEditorMode === "edit"
    ? nextActions.findIndex((action) => action.id === actionEditorId)
    : nextActions.length;
  if (actionEditorMode === "edit" && index < 0) {
    console.error("Cannot save an action that no longer exists:", actionEditorId);
    closeActionEditor();
    return;
  }
  if (actionEditorMode === "edit") {
    nextActions[index] = normalized.value;
  } else {
    nextActions.push(normalized.value);
  }

  const validation = validateActionDefinitions(nextActions, {
    validateMetronomeSettings: validateMetronomeActionSettings,
  });
  if (!validation.valid) {
    const errors = validation.errors
      .filter((error) => error.index === index)
      .map(({ field, message }) => ({ field, message }));
    showActionEditorErrors(errors);
    return;
  }

  actionDefinitions = validation.actions;
  renderActionTable();
  clearActionEditorErrors();
  closeActionEditor();
}

function showActionEditorErrors(errors) {
  let firstInvalid = null;
  errors.forEach(({ field, message }) => {
    const fieldId = getActionEditorFieldId(field);
    if (fieldId === "actions-error") {
      dom.actionsError.textContent = message;
      firstInvalid = firstInvalid || dom.actionAddButton;
      return;
    }
    setFieldError(fieldId, message);
    if (!firstInvalid) {
      firstInvalid =
        document.getElementById(fieldId) ||
        (field === "maximum"
          ? document.querySelector('input[name="maximum"]:checked')
          : field === "breaks"
            ? document.querySelector('input[name="breaks"]:checked')
            : getErrorTarget(fieldId));
    }
  });
  firstInvalid?.focus();
}

function getActionEditorFieldId(field) {
  const ids = {
    action: "action-type",
    type: "action-type",
    name: "action-name",
    accentuate: "accentuate",
    increaseTempo: "increase-tempo",
    seconds: "action-seconds",
    formula: "action-formula",
    rounding: "action-rounding",
    roundingThreshold: "action-rounding-threshold",
    min: "action-min",
    max: "action-max",
    limitSeconds: "action-limit-seconds",
    bpm: "bpm",
    accentRepeat: "accent-repeat",
    increaseBy: "increase-by",
    increaseAfter: "increase-after",
    maximum: "maximum",
    maximumLimitStick: "maximum-limit-stick",
    maximumLimitReset: "maximum-limit-reset",
    maximumLimitReverse: "maximum-limit-reverse",
    decreaseBy: "decrease-by-reverse",
    decreaseAfter: "decrease-after-reverse",
    breakCount: "break-count",
    breakSeconds: "break-seconds",
    sessionEndBeats: "session-end-beats",
    sessionEndEnabled: "session-end-enabled",
    lockSettings: "lock-settings",
    lockBeats: "lock-beats",
    actions: "actions-error",
  };
  return ids[field] || field;
}

function clearActionEditorErrors() {
  [
    "action-type",
    "action-name",
    "action-seconds",
    "action-formula",
    "action-rounding",
    "action-rounding-threshold",
    "action-min",
    "action-max",
    "action-limit-seconds",
    "bpm",
    "accent-repeat",
    "increase-by",
    "increase-after",
    "maximum-limit-stick",
    "maximum-limit-reset",
    "maximum-limit-reverse",
    "decrease-by-reverse",
    "decrease-after-reverse",
    "break-count",
    "break-seconds",
    "session-end-beats",
    "lock-beats",
    "maximum",
    "breaks",
  ].forEach(clearFieldError);
  dom.actionsError.textContent = "";
}

function cancelActionEditor() {
  closeActionEditor();
}

function requestCloseActionEditor(command = null) {
  if (actionEditorMode === null) {
    command?.();
    return;
  }
  if (!actionEditorDirty) {
    closeActionEditor({ scroll: !command });
    command?.();
    return;
  }
  pendingEditorCommand = command;
  if (dom.actionDiscardDialog.open) {
    return;
  }
  if (typeof dom.actionDiscardDialog.showModal !== "function") {
    dom.settingsStatus.textContent = "Der unbestätigte Entwurf muss zuerst bestätigt oder abgebrochen werden.";
    return;
  }
  dom.actionDiscardDialog.showModal();
  dom.actionDiscardConfirm.focus();
}

function resolvePendingEditorCommand(discard) {
  if (!dom.actionDiscardDialog.open) {
    return;
  }
  dom.actionDiscardDialog.close();
  const command = pendingEditorCommand;
  pendingEditorCommand = null;
  if (!discard) {
    dom.actionEditorTitle.focus();
    return;
  }
  closeActionEditor({ scroll: !command });
  command?.();
}

function closeActionEditor({ scroll = true } = {}) {
  actionEditorMode = null;
  actionEditorId = null;
  actionEditorDraft = null;
  actionEditorOriginal = null;
  actionEditorDirty = false;
  dom.actionEditor.hidden = true;
  clearActionEditorErrors();
  renderActionTable();
  syncActionEditorFields();
  if (scroll) {
    dom.actionsFieldset.scrollIntoView({ behavior: "smooth", block: "start" });
    dom.actionAddButton.focus({ preventScroll: true });
  }
}

function handleActionTableClick(event) {
  const button = event.target.closest("button[data-action-operation]");
  if (!button) {
    return;
  }
  const actionId = button.dataset.actionId;
  if (!actionId) {
    return;
  }
  if (button.dataset.actionOperation === "edit") {
    requestOpenActionEditor(actionId, button);
  } else if (button.dataset.actionOperation === "delete") {
    requestCloseActionEditor(() => openActionDeleteDialog(actionId, button));
  }
}

function handleActionTableKeydown(event) {
  const handle = event.target.closest(".action-drag-handle");
  if (!handle || !event.altKey || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) {
    return;
  }
  const actionId = handle.dataset.actionId;
  const index = actionDefinitions.findIndex((action) => action.id === actionId);
  const targetIndex = event.key === "ArrowUp" ? index - 1 : index + 1;
  if (index < 0 || targetIndex < 0 || targetIndex >= actionDefinitions.length) {
    return;
  }
  event.preventDefault();
  const [moved] = actionDefinitions.splice(index, 1);
  actionDefinitions.splice(targetIndex, 0, moved);
  renderActionTable();
  syncActionEditorFields();
  Array.from(dom.actionsTableBody.querySelectorAll(".action-drag-handle"))
    .find((candidate) => candidate.dataset.actionId === actionId)
    ?.focus();
}

function handleActionPointerDown(event) {
  const handle = event.target.closest(".action-drag-handle");
  const row = handle?.closest("tr[data-action-id]");
  if (!row) {
    return;
  }
  actionDragState = {
    id: row.dataset.actionId,
    pointerId: event.pointerId,
    startY: event.clientY,
    dragging: false,
  };
  handle.setPointerCapture?.(event.pointerId);
}

function handleActionPointerMove(event) {
  if (!actionDragState || actionDragState.pointerId !== event.pointerId) {
    return;
  }
  if (!actionDragState.dragging) {
    if (Math.abs(event.clientY - actionDragState.startY) < 8) {
      return;
    }
    actionDragState.dragging = true;
    getActionRowElement(actionDragState.id)?.classList.add("is-dragging");
  }
  event.preventDefault();
  updateActionDropTarget(event.clientX, event.clientY);
}

function handleActionPointerUp(event) {
  if (!actionDragState || actionDragState.pointerId !== event.pointerId) {
    return;
  }
  if (actionDragState.dragging) {
    moveActionByDrop(actionDragState.id, getActionDropTarget(event.clientX, event.clientY));
  }
  clearActionDragState();
}

function handleActionPointerCancel(event) {
  if (actionDragState?.pointerId === event.pointerId) {
    clearActionDragState();
  }
}

function handleActionDragStart(event) {
  const handle = event.target.closest(".action-drag-handle");
  const row = handle?.closest("tr[data-action-id]");
  if (!row) {
    return;
  }
  actionDragState = {
    id: row.dataset.actionId,
    pointerId: null,
    startY: event.clientY,
    dragging: true,
  };
  row.classList.add("is-dragging");
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", row.dataset.actionId);
}

function handleActionDragOver(event) {
  if (!actionDragState?.dragging) {
    return;
  }
  if (!event.target.closest("tr[data-action-id]")) {
    return;
  }
  event.preventDefault();
  updateActionDropTarget(event.clientX, event.clientY);
}

function handleActionDrop(event) {
  if (!actionDragState?.dragging) {
    return;
  }
  event.preventDefault();
  moveActionByDrop(actionDragState.id, getActionDropTarget(event.clientX, event.clientY));
  clearActionDragState();
}

function handleActionDragEnd() {
  clearActionDragState();
}

function getActionRowElement(actionId) {
  return Array.from(dom.actionsTableBody.querySelectorAll("tr[data-action-id]"))
    .find((row) => row.dataset.actionId === actionId) || null;
}

function updateActionDropTarget(clientX, clientY) {
  document.querySelectorAll(".action-row.is-drop-target").forEach((row) => {
    row.classList.remove("is-drop-target");
  });
  const target = getActionDropTarget(clientX, clientY);
  target?.row?.classList.add("is-drop-target");
}

function getActionDropTarget(clientX, clientY) {
  const element = document.elementFromPoint(clientX, clientY);
  const row = element?.closest?.("tr[data-action-id]");
  if (!row) {
    return null;
  }
  const bounds = row.getBoundingClientRect();
  return {
    row,
    id: row.dataset.actionId,
    before: clientY < bounds.top + bounds.height / 2,
  };
}

function moveActionByDrop(actionId, target) {
  if (!target || actionId === target.id) {
    return;
  }
  const sourceIndex = actionDefinitions.findIndex((action) => action.id === actionId);
  const targetIndex = actionDefinitions.findIndex((action) => action.id === target.id);
  if (sourceIndex < 0 || targetIndex < 0) {
    return;
  }
  const [moved] = actionDefinitions.splice(sourceIndex, 1);
  let insertionIndex = targetIndex;
  if (sourceIndex < targetIndex) {
    insertionIndex -= 1;
  }
  if (!target.before) {
    insertionIndex += 1;
  }
  actionDefinitions.splice(Math.max(0, insertionIndex), 0, moved);
  renderActionTable();
  syncActionEditorFields();
}

function clearActionDragState() {
  document.querySelectorAll(".action-row.is-dragging, .action-row.is-drop-target").forEach((row) => {
    row.classList.remove("is-dragging", "is-drop-target");
  });
  actionDragState = null;
}

function openActionDeleteDialog(actionId, trigger) {
  if (dom.actionDeleteDialog.open) {
    return;
  }
  if (typeof dom.actionDeleteDialog.showModal !== "function") {
    dom.settingsStatus.textContent = "Aktionen können in diesem Browser nicht gelöscht werden.";
    return;
  }
  const action = findActionById(actionId);
  if (!action) {
    return;
  }
  actionDeleteId = actionId;
  actionDeleteTrigger = trigger;
  dom.actionDeleteDialogMessage.textContent =
    "\"" + action.name + "\" (" + getActionTypeLabel(action.type) + ") wirklich löschen?";
  dom.actionDeleteDialog.showModal();
  dom.actionDeleteConfirm.focus();
}

function confirmActionDelete() {
  if (!actionDeleteId) {
    return;
  }
  actionDefinitions = actionDefinitions.filter((action) => action.id !== actionDeleteId);
  renderActionTable();
  closeActionDeleteDialog(true);
}

function closeActionDeleteDialog(saveChanges) {
  if (!actionDeleteId || !dom.actionDeleteDialog.open) {
    return;
  }
  dom.actionDeleteDialog.close();
  const trigger = actionDeleteTrigger;
  actionDeleteId = null;
  actionDeleteTrigger = null;
  if (!saveChanges) {
    trigger?.focus();
  } else {
    dom.actionAddButton.focus();
  }
}

function rememberFormulaSelection() {
  if (
    typeof dom.actionFormula.selectionStart !== "number" ||
    typeof dom.actionFormula.selectionEnd !== "number"
  ) {
    return;
  }
  actionFormulaSelection = {
    start: dom.actionFormula.selectionStart,
    end: dom.actionFormula.selectionEnd,
  };
}

function handleFormulaPlaceholderClick(event) {
  const button = event.target.closest("[data-action-formula-placeholder]");
  if (!button) {
    return;
  }
  event.preventDefault();
  insertActionFormulaPlaceholder(button.dataset.actionFormulaPlaceholder);
}

function handleFormulaPlaceholderDragStart(event) {
  const button = event.target.closest("[data-action-formula-placeholder]");
  const placeholder = button?.dataset.actionFormulaPlaceholder;
  if (!placeholder) {
    return;
  }
  event.dataTransfer?.setData("text/plain", placeholder);
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "copy";
  }
}

function handleFormulaDragOver(event) {
  event.preventDefault();
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = "copy";
  }
}

function handleFormulaDrop(event) {
  const placeholder = event.dataTransfer?.getData("text/plain")?.trim();
  if (!PRE_TIMER_FORMULA_PLACEHOLDERS.has(placeholder)) {
    return;
  }
  event.preventDefault();
  insertActionFormulaPlaceholder(placeholder, {
    start: dom.actionFormula.selectionStart,
    end: dom.actionFormula.selectionEnd,
  });
}

function insertActionFormulaPlaceholder(placeholder, selection = null) {
  if (!PRE_TIMER_FORMULA_PLACEHOLDERS.has(placeholder)) {
    return;
  }
  const currentValue = dom.actionFormula.value;
  const remembered = actionFormulaSelection || {
    start: currentValue.length,
    end: currentValue.length,
  };
  const start = Math.max(0, Math.min(currentValue.length, Number.isInteger(selection?.start) ? selection.start : remembered.start));
  const end = Math.max(start, Math.min(currentValue.length, Number.isInteger(selection?.end) ? selection.end : remembered.end));
  const nextValue = currentValue.slice(0, start) + placeholder + currentValue.slice(end);
  const nextCaret = start + placeholder.length;
  dom.actionFormula.value = nextValue;
  dom.actionFormula.focus();
  dom.actionFormula.setSelectionRange(nextCaret, nextCaret);
  actionFormulaSelection = { start: nextCaret, end: nextCaret };
  dom.actionFormula.dispatchEvent(new Event("input", { bubbles: true }));
}

function handleNumberInputWheel(event) {
  const input = event.target;
  if (
    !(input instanceof HTMLInputElement) ||
    input.type !== "number" ||
    document.activeElement !== input
  ) {
    return;
  }
  input.blur();
}

function renderPresets() {
  const presets = window.METRONOME_PRESETS;
  dom.presetList.replaceChildren();
  setPresetStatus("");
  if (!presets || typeof presets !== "object") {
    console.error("Metronome presets are unavailable.");
    setPresetStatus("Voreinstellungen konnten nicht geladen werden.");
    return;
  }

  let addedPreset = false;
  const invalidPresetMessages = [];

  Object.entries(presets).forEach(([presetId, preset]) => {
    const definitionError = getPresetDefinitionError(preset);
    if (definitionError) {
      const button = document.createElement("button");
      const label =
        preset && typeof preset.label === "string" ? preset.label : presetId;
      const message = `Voreinstellung "${presetId}" ist ungültig: ${definitionError}`;

      console.error(`Preset "${presetId}" has an invalid definition: ${definitionError}`);
      button.className = "secondary-button";
      button.type = "button";
      button.disabled = true;
      button.textContent = label;
      button.title = message;
      button.setAttribute("aria-label", `${label}: ${message}`);
      dom.presetList.append(button);
      invalidPresetMessages.push(message);
      return;
    }

    const autoStart = preset.autoStart === true;
    const button = document.createElement("button");
    button.className = autoStart ? "primary-button" : "secondary-button";
    button.type = "button";
    button.textContent = autoStart ? `Start ${preset.label}` : preset.label;
    button.dataset.presetId = presetId;
    button.addEventListener("click", () => {
      void handlePresetClick(preset);
    });
    dom.presetList.append(button);
    addedPreset = true;
  });

  if (invalidPresetMessages.length > 0) {
    setPresetStatus(invalidPresetMessages.join(" "));
  }

  if (!addedPreset) {
    console.error("No valid metronome presets are configured.");
    if (invalidPresetMessages.length === 0) {
      setPresetStatus("Keine gültigen Voreinstellungen verfügbar.");
    }
  }
}

function setPresetStatus(message) {
  dom.presetStatus.textContent = message;
  dom.presetStatus.hidden = !message;
  dom.presetStatus.classList.toggle("error-status", Boolean(message));
}

function getPresetDefinitionError(preset) {
  if (!preset || typeof preset !== "object" || Array.isArray(preset)) {
    return "Definition fehlt.";
  }
  if (typeof preset.label !== "string") {
    return "Ein gültiges Label fehlt.";
  }
  if (!preset.values || typeof preset.values !== "object" || Array.isArray(preset.values)) {
    return "Gültige Einstellungswerte fehlen.";
  }
  if (Object.prototype.hasOwnProperty.call(preset, "autoStart") && typeof preset.autoStart !== "boolean") {
    return "autoStart muss ein Boolean sein.";
  }
  if (Object.prototype.hasOwnProperty.call(preset, "hideProgress") && typeof preset.hideProgress !== "boolean") {
    return "hideProgress muss ein Boolean sein.";
  }
  const validation = validateActionDefinitions(preset.values.actions, {
    validateMetronomeSettings: validateMetronomeActionSettings,
    requireMetronome: true,
  });
  if (!validation.valid) {
    const firstError = validation.errors[0];
    return firstError?.message || "Aktionen sind ungültig.";
  }
  return null;
}

function getInitialParameterText() {
  if (typeof window === "undefined" || !window.location?.search) {
    return "";
  }
  return window.location.search.slice(1);
}

function serializeSettings(autoStart) {
  const parameters = new URLSearchParams();
  parameters.set("version", String(ACTIONS_VERSION));
  parameters.set("auto-start", String(Boolean(autoStart)));
  if (dom.hideProgress.checked) {
    parameters.set("hide-progress", "true");
  }
  parameters.set("actions", serializeActionsPayload(actionDefinitions));
  return parameters.toString();
}

async function handleExportSettings(format, button, defaultLabel) {
  if (actionEditorMode !== null) {
    dom.settingsStatus.classList.add("error-status");
    dom.settingsStatus.textContent = "Aktion zuerst bestätigen oder abbrechen, bevor Einstellungen exportiert werden.";
    dom.actionEditorTitle.focus();
    return;
  }

  const parameterList = serializeSettings(dom.exportAutoStart.checked);
  const text = format === "url" ? buildSettingsUrl(parameterList) : parameterList;

  try {
    await copyText(text, button);
    dom.settingsStatus.classList.remove("error-status");
    dom.settingsStatus.textContent =
      format === "url"
        ? text.length > 2000
          ? "Ganze URL kopiert. Die URL ist sehr lang und kann von manchen Browsern gekürzt werden."
          : "Ganze URL in die Zwischenablage kopiert."
        : "Einstellungen in die Zwischenablage kopiert.";
    button.textContent = "Kopiert!";
    const existingTimer = copyFeedbackTimers.get(button);
    if (existingTimer !== undefined) {
      window.clearTimeout(existingTimer);
    }
    copyFeedbackTimers.set(
      button,
      window.setTimeout(() => {
        button.textContent = defaultLabel;
        copyFeedbackTimers.delete(button);
      }, 2000),
    );
  } catch (error) {
    dom.settingsStatus.classList.add("error-status");
    dom.settingsStatus.textContent = getErrorMessage(
      error,
      "Die Einstellungen konnten nicht in die Zwischenablage kopiert werden.",
    );
  }
}

function buildSettingsUrl(parameterList) {
  const url = new URL(window.location.href);
  url.search = parameterList ? "?" + parameterList : "";
  return url.toString();
}

async function handleSettingsImport(parameterText) {
  if (autoStartImportInProgress) {
    return false;
  }

  const importedText = String(parameterText);
  clearImportError();
  clearAllFieldErrors();
  dom.settingsStatus.classList.remove("error-status");
  dom.settingsStatus.textContent = "";
  resetSettingsToDefaults();

  const parsed = parseSettingsParameters(importedText.trim());
  if (!parsed.valid) {
    showImportError(importedText, [{ fieldId: null, message: parsed.error }]);
    showView("settings", true);
    return false;
  }

  const validation = validateActionDefinitions(parsed.actions, {
    validateMetronomeSettings: validateMetronomeActionSettings,
    requireMetronome: true,
  });
  const actionErrors = validation.errors.filter((error) => error.index >= 0);
  if (actionErrors.length === 0) {
    actionDefinitions = validation.actions;
  }
  dom.hideProgress.checked = parsed.hideProgress;
  dom.exportAutoStart.checked = parsed.autoStart;
  renderActionTable();
  syncProgressVisibility();

  if (validation.errors.length > 0) {
    const issues = validation.errors.map((error) => ({
      fieldId:
        error.index >= 0
          ? "Aktion " + (error.index + 1) + " - " + getImportFieldLabel(error.field)
          : getImportFieldLabel(error.field),
      message: error.message,
    }));
    showImportError(importedText, issues);
    showView("settings", true);
    return false;
  }

  dom.settingsImport.value = "";
  if (parsed.autoStart) {
    autoStartImportInProgress = true;
    try {
      return await startConfiguredSession();
    } finally {
      autoStartImportInProgress = false;
    }
  }

  showView("settings", true);
  return true;
}

function parseSettingsParameters(rawText) {
  let parameterText = String(rawText).trim();
  if (parameterText.startsWith("?")) {
    parameterText = parameterText.slice(1);
  } else if (/^[a-z][a-z\d+.-]*:\/\//i.test(parameterText)) {
    try {
      const baseUrl = window.location?.href || "http://localhost/";
      parameterText = new URL(parameterText, baseUrl).search.slice(1);
    } catch {
      return { valid: false, error: "Die importierte URL ist ungültig." };
    }
  }

  const parameters = new URLSearchParams(parameterText);
  const allowedParameters = new Set(["version", "auto-start", "hide-progress", "actions"]);
  const unknown = Array.from(new Set(Array.from(parameters.keys()).filter((key) => !allowedParameters.has(key))));
  if (unknown.length > 0) {
    return {
      valid: false,
      error: "Unbekannte Importparameter: " + unknown.join(", ") + ".",
    };
  }

  for (const name of ["version", "auto-start", "actions"]) {
    if (parameters.getAll(name).length !== 1) {
      return { valid: false, error: "Der Import benötigt genau einen Parameter " + name + "." };
    }
  }
  if (parameters.getAll("hide-progress").length > 1) {
    return { valid: false, error: "Der Parameter hide-progress darf nur einmal vorkommen." };
  }

  const version = parameters.get("version");
  if (version !== String(ACTIONS_VERSION)) {
    return {
      valid: false,
      error: "Die Exportversion " + version + " wird nicht unterstützt.",
    };
  }
  const autoStart = parseBooleanParameter(parameters.get("auto-start"));
  if (autoStart === null) {
    return { valid: false, error: "Auto-Start muss true oder false sein." };
  }
  const hideProgress = parameters.has("hide-progress")
    ? parseBooleanParameter(parameters.get("hide-progress"))
    : false;
  if (hideProgress === null) {
    return { valid: false, error: "hide-progress muss true oder false sein." };
  }
  const parsedActions = parseActionsPayload(parameters.get("actions"));
  if (!parsedActions.valid) {
    return { valid: false, error: parsedActions.error };
  }
  return {
    valid: true,
    autoStart,
    hideProgress,
    actions: parsedActions.actions,
  };
}

function parseBooleanParameter(rawValue) {
  const value = String(rawValue).trim().toLowerCase();
  if (value === "true" || value === "1") {
    return true;
  }
  if (value === "false" || value === "0") {
    return false;
  }
  return null;
}

function getImportFieldLabel(fieldId) {
  const labels = {
    actions: "Aktionen",
    version: "Exportversion",
    "auto-start": "Auto-Start",
    "hide-progress": "Fortschritt ausblenden",
    type: "Aktionstyp",
    name: "Name",
    seconds: "Dauer in Sekunden",
    formula: "Formel",
    rounding: "Minutenrundung",
    roundingThreshold: "Rundungsschwelle",
    min: "Min",
    max: "Max",
    limitSeconds: "Limit Sekunden",
  };
  return labels[fieldId] || fieldId;
}

function showImportError(importedText, issues) {
  dom.importErrorSummary.textContent =
    "Der Import ist unvollständig oder ungültig. Prüfen Sie die Hinweise und korrigieren Sie die Einstellungen; ein manueller Start ist möglich, sobald die Werte gültig sind.";
  dom.importErrorList.replaceChildren();
  issues.forEach(({ fieldId, message }) => {
    const item = document.createElement("li");
    item.textContent = fieldId
      ? `${getImportFieldLabel(fieldId)}: ${message}`
      : message;
    dom.importErrorList.append(item);
  });
  dom.importErrorText.textContent = importedText;
  dom.importErrorPanel.hidden = false;
  setFieldError("settings-import", "Importfehler; Details in den Einstellungen.");
}

function clearImportError() {
  dom.importErrorPanel.hidden = true;
  dom.importErrorSummary.textContent = "";
  dom.importErrorList.replaceChildren();
  dom.importErrorText.textContent = "";
  clearFieldError("settings-import");
}

async function handleStart(event) {
  event.preventDefault();
  await startConfiguredSession();
}

async function handlePresetClick(preset) {
  clearAllFieldErrors();
  clearImportError();
  dom.settingsStatus.classList.remove("error-status");
  dom.settingsStatus.textContent = "";
  applyPreset(preset);
  if (preset.autoStart === true) {
    await startConfiguredSession();
    return;
  }
  showView("settings", true);
}

function applyPreset(preset) {
  const validation = validateActionDefinitions(preset.values.actions, {
    validateMetronomeSettings: validateMetronomeActionSettings,
    requireMetronome: true,
  });
  if (!validation.valid) {
    throw new Error(validation.errors[0]?.message || "Voreinstellung ist ungültig.");
  }
  actionDefinitions = validation.actions;
  dom.hideProgress.checked = preset.hideProgress === true;
  renderActionTable();
  syncProgressVisibility();
}

function resetSettingsToDefaults() {
  actionEditorMode = null;
  actionEditorId = null;
  actionEditorDraft = null;
  actionEditorOriginal = null;
  actionEditorDirty = false;
  actionDefinitions = [
    createDefaultAction(
      ACTION_TYPES.METRONOME,
      [],
      createDefaultMetronomeSettings(),
    ),
  ];
  dom.hideProgress.checked = false;
  dom.exportAutoStart.checked = false;
  dom.actionEditor.hidden = true;
  dom.actionsError.textContent = "";
  clearActionEditorErrors();
  renderActionTable();
  syncProgressVisibility();
}

function readMetronomeSettingsFromForm() {
  const maximum = getSelectedValue("maximum") || DEFAULTS.maximum;
  return {
    bpm: dom.bpm.value,
    accentuate: dom.accentuate.checked,
    accentRepeat: dom.accentRepeat.value,
    increaseTempo: dom.increaseTempo.checked,
    increaseBy: dom.increaseBy.value,
    increaseAfter: dom.increaseAfter.value,
    maximum,
    maximumLimitStick: dom.maximumLimitStick.value,
    maximumLimitReset: dom.maximumLimitReset.value,
    maximumLimitReverse: dom.maximumLimitReverse.value,
    decreaseBy: dom.decreaseByReverse.value,
    decreaseAfter: dom.decreaseAfterReverse.value,
    breaks: getSelectedValue("breaks") || DEFAULTS.breaks,
    breakCount: dom.breakCount.value,
    breakSeconds: dom.breakSeconds.value,
    sessionEndEnabled: dom.sessionEndEnabled.checked,
    sessionEndBeats: dom.sessionEndBeats.value,
    lockSettings: dom.lockSettings.checked,
    lockBeats: dom.lockBeats.value,
  };
}

function applyMetronomeSettingsToForm(settings) {
  const values = settings || createDefaultMetronomeSettings();
  const setInputValue = (control, value) => {
    control.value = value === null || value === undefined ? "" : String(value);
  };
  setInputValue(dom.bpm, values.bpm ?? DEFAULTS.bpm);
  dom.accentuate.checked = values.accentuate ?? DEFAULTS.accentuate;
  setInputValue(dom.accentRepeat, values.accentRepeat ?? DEFAULTS.accentRepeat);
  dom.increaseTempo.checked = values.increaseTempo ?? DEFAULTS.increaseTempo;
  setInputValue(dom.increaseBy, values.increaseBy ?? DEFAULTS.increaseBy);
  setInputValue(dom.increaseAfter, values.increaseAfter ?? DEFAULTS.increaseAfter);
  const maximum = values.maximum ?? DEFAULTS.maximum;
  setSelectedValue("maximum", maximum);
  setInputValue(dom.maximumLimitStick, values.maximumLimitStick ?? DEFAULTS.maximumLimit);
  setInputValue(dom.maximumLimitReset, values.maximumLimitReset ?? DEFAULTS.maximumLimit);
  setInputValue(dom.maximumLimitReverse, values.maximumLimitReverse ?? DEFAULTS.maximumLimit);
  setInputValue(dom.decreaseByReverse, values.decreaseBy ?? DEFAULTS.decreaseBy);
  setInputValue(dom.decreaseAfterReverse, values.decreaseAfter ?? DEFAULTS.decreaseAfter);
  setSelectedValue("breaks", values.breaks ?? DEFAULTS.breaks);
  setInputValue(dom.breakCount, values.breakCount ?? "");
  setInputValue(dom.breakSeconds, values.breakSeconds ?? "");
  dom.sessionEndEnabled.checked = values.sessionEndEnabled ?? DEFAULTS.sessionEndEnabled;
  setInputValue(dom.sessionEndBeats, values.sessionEndBeats ?? DEFAULTS.sessionEndBeats);
  dom.lockSettings.checked = values.lockSettings ?? DEFAULTS.lockSettings;
  setInputValue(dom.lockBeats, values.lockBeats ?? DEFAULTS.lockBeats);
}

function formatMetronomeSettingsSummary(settings) {
  const maximumLimit = getMetronomeMaximumLimit(settings);
  const bpm = settings.increaseTempo && settings.maximum !== "none"
    ? settings.bpm + "-" + maximumLimit + " BPM"
    : settings.bpm + " BPM";
  const progression = settings.increaseTempo
    ? "; +" + settings.increaseBy + "/" + settings.increaseAfter +
      (settings.maximum === "reverse"
        ? "; -" + settings.decreaseBy + "/" + settings.decreaseAfter
        : "")
    : "";
  const pauses = settings.breaks === "none"
    ? "Keine Pausen"
    : settings.breaks === "limited"
      ? "Begrenzte Pausen"
      : "Unbegrenzte Pausen";
  const end = settings.sessionEndEnabled
    ? settings.sessionEndBeats + " Beats Ende"
    : "Manuelles Ende";
  return bpm + progression + "; " + pauses + "; " + end;
}

function getMetronomeMaximumLimit(settings) {
  if (settings.maximum === "stick") {
    return settings.maximumLimitStick ?? settings.maximumLimit ?? DEFAULTS.maximumLimit;
  }
  if (settings.maximum === "reset") {
    return settings.maximumLimitReset ?? settings.maximumLimit ?? DEFAULTS.maximumLimit;
  }
  if (settings.maximum === "reverse") {
    return settings.maximumLimitReverse ?? settings.maximumLimit ?? DEFAULTS.maximumLimit;
  }
  return DEFAULTS.maximumLimit;
}

function validateMetronomeActionSettings(rawSettings, index, actions) {
  const defaults = createDefaultMetronomeSettings();
  const raw = rawSettings && typeof rawSettings === "object" && !Array.isArray(rawSettings)
    ? rawSettings
    : {};
  const errors = [];
  const markInvalid = (field, message) => errors.push({ field, message });
  const getBoolean = (name, fallback) => {
    if (raw[name] === undefined) {
      return fallback;
    }
    if (typeof raw[name] === "boolean") {
      return raw[name];
    }
    markInvalid(name, "Einen gültigen Ja/Nein-Wert auswählen.");
    return fallback;
  };
  const getText = (name, fallback) => String(raw[name] ?? fallback ?? "").trim();

  const bpm = parseIntegerField(getText("bpm", defaults.bpm), 20, 300);
  if (bpm === null) {
    markInvalid("bpm", "Ganze BPM-Zahl von 20 bis 300 eingeben.");
  }

  const accentuate = getBoolean("accentuate", defaults.accentuate);
  const accentRepeatRaw = getText("accentRepeat", defaults.accentRepeat);
  const parsedAccentRepeat = parsePositiveInteger(
    accentRepeatRaw,
    Number.POSITIVE_INFINITY,
  );
  if (accentuate && parsedAccentRepeat === null) {
    markInvalid("accentRepeat", "Positive ganze Zahl eingeben.");
  }
  const accentRepeat = parsedAccentRepeat ?? accentRepeatRaw;

  const increaseTempo = getBoolean("increaseTempo", defaults.increaseTempo);
  const increaseByRaw = getText("increaseBy", defaults.increaseBy);
  const parsedIncreaseBy = parseIntegerField(increaseByRaw, 1, 20);
  if (increaseTempo && parsedIncreaseBy === null) {
    markInvalid("increaseBy", "Ganze Zahl von 1 bis 20 eingeben.");
  }
  const increaseBy = parsedIncreaseBy ?? increaseByRaw;
  const increaseAfterRaw = getText("increaseAfter", defaults.increaseAfter);
  const parsedIncreaseAfter = parsePositiveInteger(
    increaseAfterRaw,
    Number.POSITIVE_INFINITY,
  );
  if (increaseTempo && parsedIncreaseAfter === null) {
    markInvalid("increaseAfter", "Positive ganze Zahl eingeben.");
  }
  const increaseAfter = parsedIncreaseAfter ?? increaseAfterRaw;

  const maximum = String(raw.maximum ?? defaults.maximum);
  if (!RADIO_SETTING_VALUES.maximum.has(maximum)) {
    markInvalid("maximum", "Eine gültige Maximum-Option auswählen.");
  }
  const activeMaximumLimitField = {
    stick: "maximumLimitStick",
    reset: "maximumLimitReset",
    reverse: "maximumLimitReverse",
  }[maximum];
  const maximumLimits = {
    maximumLimitStick: parseIntegerField(
      getText("maximumLimitStick", defaults.maximumLimitStick),
      60,
      400,
    ),
    maximumLimitReset: parseIntegerField(
      getText("maximumLimitReset", defaults.maximumLimitReset),
      60,
      400,
    ),
    maximumLimitReverse: parseIntegerField(
      getText("maximumLimitReverse", defaults.maximumLimitReverse),
      60,
      400,
    ),
  };
  Object.keys(maximumLimits).forEach((field) => {
    if (maximumLimits[field] === null) {
      maximumLimits[field] = getText(field, defaults[field]);
    }
  });
  const decreaseByRaw = getText("decreaseBy", defaults.decreaseBy);
  const parsedDecreaseBy = parseIntegerField(decreaseByRaw, 1, 50);
  const decreaseAfterRaw = getText("decreaseAfter", defaults.decreaseAfter);
  const parsedDecreaseAfter = parsePositiveInteger(
    decreaseAfterRaw,
    Number.POSITIVE_INFINITY,
  );
  let decreaseBy = parsedDecreaseBy ?? decreaseByRaw;
  let decreaseAfter = parsedDecreaseAfter ?? decreaseAfterRaw;
  if (increaseTempo && activeMaximumLimitField) {
    const selectedMaximumLimit = parseIntegerField(
      getText(activeMaximumLimitField, defaults[activeMaximumLimitField]),
      60,
      400,
    );
    if (selectedMaximumLimit === null) {
      markInvalid(activeMaximumLimitField, "Ganzzahliges Limit von 60 bis 400 eingeben.");
    } else {
      maximumLimits[activeMaximumLimitField] = selectedMaximumLimit;
      if (bpm !== null && selectedMaximumLimit <= bpm) {
        markInvalid(activeMaximumLimitField, "Das Limit muss über dem Startwert liegen.");
      }
    }
    if (maximum === "reverse") {
      if (parsedDecreaseBy === null) {
        markInvalid("decreaseBy", "Ganze Zahl von 1 bis 50 eingeben.");
      }
      if (parsedDecreaseAfter === null) {
        markInvalid("decreaseAfter", "Positive ganze Zahl eingeben.");
      }
    }
  }

  const breaks = String(raw.breaks ?? defaults.breaks);
  if (!RADIO_SETTING_VALUES.breaks.has(breaks)) {
    markInvalid("breaks", "Eine gültige Pausen-Option auswählen.");
  }
  const breakCountRaw = getText("breakCount", "");
  const parsedBreakCount = breakCountRaw === ""
    ? null
    : parsePositiveInteger(breakCountRaw, Number.POSITIVE_INFINITY);
  if (breaks === "limited" && breakCountRaw !== "" && parsedBreakCount === null) {
    markInvalid("breakCount", "Positive ganze Zahl eingeben oder leer lassen.");
  }
  const breakCount = parsedBreakCount ?? (breakCountRaw === "" ? null : breakCountRaw);
  const breakSecondsRaw = getText("breakSeconds", "");
  if (breaks === "limited" && breakSecondsRaw !== "") {
    const parsedBreakSeconds = parseBreakInput(breakSecondsRaw);
    if (!parsedBreakSeconds.valid) {
      markInvalid("breakSeconds", parsedBreakSeconds.error);
    } else if (bpm !== null && !isBreakInputSafe(parsedBreakSeconds, bpm)) {
      markInvalid(
        "breakSeconds",
        "Dieser Ausdruck kann bei einem erreichbaren BPM-Wert null oder negativ werden.",
      );
    }
  }

  const stopwatchSources = getStopwatchSourcesBeforeMetronome(actions, index);
  const hasDerivedEnd = stopwatchSources.length > 0;
  const sessionEndEnabled = getBoolean("sessionEndEnabled", defaults.sessionEndEnabled);
  const sessionEndBeatsRaw = getText("sessionEndBeats", defaults.sessionEndBeats);
  const parsedSessionEndBeats = parsePositiveInteger(
    sessionEndBeatsRaw,
    Number.POSITIVE_INFINITY,
  );
  if (sessionEndEnabled && !hasDerivedEnd && parsedSessionEndBeats === null) {
    markInvalid("sessionEndBeats", "Positive ganze Zahl eingeben.");
  }
  const sessionEndBeats = parsedSessionEndBeats ?? sessionEndBeatsRaw;
  const lockSettings = getBoolean("lockSettings", defaults.lockSettings);
  const lockBeatsRaw = getText("lockBeats", defaults.lockBeats);
  const parsedLockBeats = parsePositiveInteger(lockBeatsRaw, Number.POSITIVE_INFINITY);
  if (lockSettings && !hasDerivedEnd && parsedLockBeats === null) {
    markInvalid("lockBeats", "Positive ganze Zahl eingeben.");
  }
  const lockBeats = parsedLockBeats ?? lockBeatsRaw;
  if (
    !hasDerivedEnd &&
    lockSettings &&
    sessionEndEnabled &&
    typeof lockBeats === "number" &&
    typeof sessionEndBeats === "number" &&
    lockBeats > sessionEndBeats
  ) {
    markInvalid("lockBeats", "Die Sperre darf das automatische Session-Ende nicht überschreiten.");
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }
  return {
    valid: true,
    errors,
    settings: {
      bpm,
      accentuate,
      accentRepeat,
      increaseTempo,
      increaseBy,
      increaseAfter,
      maximum,
      ...maximumLimits,
      decreaseBy,
      decreaseAfter,
      breaks,
      breakCount,
      breakSeconds: breakSecondsRaw,
      sessionEndEnabled,
      sessionEndBeats,
      lockSettings,
      lockBeats,
    },
  };
}

async function startConfiguredSession() {
  if (actionEditorMode !== null) {
    dom.settingsStatus.classList.add("error-status");
    dom.settingsStatus.textContent = "Aktion zuerst bestätigen oder abbrechen, bevor die Ausführung startet.";
    dom.actionEditor.scrollIntoView({ behavior: "smooth", block: "start" });
    dom.actionEditorTitle.focus({ preventScroll: true });
    return false;
  }

  clearAllFieldErrors();
  dom.actionsError.textContent = "";
  const validation = validateActionDefinitions(actionDefinitions, {
    validateMetronomeSettings: validateMetronomeActionSettings,
    requireMetronome: true,
  });
  if (!validation.valid) {
    const messages = validation.errors.map((error) =>
      error.index >= 0
        ? "Aktion " + (error.index + 1) + " (" + (actionDefinitions[error.index]?.name || "ohne Namen") + "): " + error.message
        : error.message,
    );
    dom.actionsError.textContent = messages.join(" ");
    dom.settingsStatus.textContent = "Bitte Aktionen korrigieren.";
    dom.settingsStatus.classList.add("error-status");
    showView("settings", true);
    dom.actionsFieldset.scrollIntoView({ behavior: "smooth", block: "start" });
    dom.actionAddButton.focus({ preventScroll: true });
    return false;
  }

  actionDefinitions = validation.actions;
  renderActionTable();
  try {
    await ensureAudioReady();
  } catch (error) {
    dom.settingsStatus.textContent = getErrorMessage(
      error,
      "Audio konnte nicht initialisiert werden. Audio-Berechtigung des Browsers prüfen und erneut versuchen.",
    );
    dom.settingsStatus.classList.add("error-status");
    showView("settings", true);
    return false;
  }

  dom.settingsStatus.textContent = "";
  dom.settingsStatus.classList.remove("error-status");
  state.actionPlan = cloneActions(actionDefinitions);
  state.actionResults = state.actionPlan.map(createPendingActionResult);
  state.currentActionIndex = -1;
  state.report = null;
  startNextAction();
  clearImportError();
  return state.phase !== "idle";
}

function createPendingActionResult(action) {
  return {
    id: action.id,
    type: action.type,
    name: action.name,
    status: "not-started",
    settings: cloneValue(action.settings),
  };
}

function cloneValue(value) {
  if (Array.isArray(value)) {
    return value.map(cloneValue);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, cloneValue(nested)]),
    );
  }
  return value;
}

function parseIntegerField(rawValue, min, max) {
  const value = parsePositiveInteger(rawValue, max);
  if (value === null || value < min) {
    return null;
  }
  return value;
}

function parsePositiveInteger(rawValue, max) {
  const raw = String(rawValue).trim();
  if (!/^\d+$/.test(raw)) {
    return null;
  }

  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1 || value > max) {
    return null;
  }
  return value;
}

function parseBreakInput(rawValue) {
  const raw = rawValue.trim();
  if (/^\d+$/.test(raw)) {
    const seconds = Number(raw);
    if (Number.isSafeInteger(seconds) && seconds > 0) {
      return { valid: true, type: "seconds", seconds };
    }
    return { valid: false, error: "Positive ganze Zahl für Sekunden eingeben." };
  }

  const expression = /^BPM\s*([+\-*\/])\s*(\d+(?:\.\d+)?)$/i.exec(raw);
  if (!expression) {
    return {
      valid: false,
      error: "Positive ganze Zahl oder Ausdruck wie BPM/2 verwenden.",
    };
  }

  const operand = Number(expression[2]);
  if (!Number.isFinite(operand) || operand <= 0) {
    return { valid: false, error: "Die Zahl im Ausdruck muss größer als null sein." };
  }

  return {
    valid: true,
    type: "expression",
    operator: expression[1],
    operand,
  };
}

function isBreakInputSafe(parsedInput, initialBpm) {
  if (parsedInput.type !== "expression") {
    return true;
  }

  if (parsedInput.operator === "-") {
    return initialBpm - parsedInput.operand > 0;
  }
  return true;
}

async function ensureAudioReady() {
  const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextConstructor) {
    throw new Error("Dieser Browser unterstützt die Web-Audio-API nicht.");
  }

  if (!audioContext || audioContext.state === "closed") {
    audioContext = new AudioContextConstructor();
  }

  if (audioContext.state !== "running") {
    await audioContext.resume();
  }

  if (audioContext.state !== "running") {
    throw new Error("Der Browser hat den Audio-Kontext nicht aktiviert.");
  }
}

function startNextAction() {
  const nextIndex = state.currentActionIndex + 1;
  if (nextIndex >= state.actionPlan.length) {
    finalizeActionSequence(false);
    return;
  }

  cancelTimers();
  state.token += 1;
  state.currentActionIndex = nextIndex;
  const action = state.actionPlan[nextIndex];
  const result = state.actionResults[nextIndex];
  result.status = "active";
  result.startedAt = performance.now();
  state.activeActionStartedAt = result.startedAt;

  if (action.type === ACTION_TYPES.METRONOME) {
    startMetronomeAction(action, result);
    return;
  }
  startTimerAction(action);
}

function startTimerAction(action) {
  state.settings = null;
  state.activeBreak = null;
  state.phase = "action-" + action.type;
  const viewName = action.type === ACTION_TYPES.SECONDS
    ? "seconds"
    : action.type === ACTION_TYPES.STOPWATCH
      ? "stopwatch"
      : "manual";
  showView(viewName, true);
  updateTimerActionUi();
  state.actionDisplayTimer = window.setInterval(updateTimerActionUi, 250);

  if (action.type === ACTION_TYPES.SECONDS) {
    const token = state.token;
    state.actionTimer = window.setTimeout(() => {
      if (token !== state.token || state.phase !== "action-sekunden") {
        return;
      }
      finishCurrentTimerAction("auto");
    }, action.settings.seconds * 1000);
  }
}

function updateTimerActionUi() {
  const action = state.actionPlan[state.currentActionIndex];
  if (!action || state.activeActionStartedAt === null) {
    return;
  }

  const progress = getActionProgressLabel();
  const elapsed = getActiveActionElapsedSeconds();
  if (action.type === ACTION_TYPES.SECONDS) {
    const remaining = getActiveSecondsRemaining();
    dom.secondsTitle.textContent = "Sekunden - " + action.name;
    dom.secondsProgress.textContent = progress;
    dom.secondsActionName.textContent = action.name;
    dom.secondsActionOptions.textContent = action.settings.seconds + " Sekunden";
    dom.secondsClock.textContent = remaining + "s";
    dom.secondsStatus.textContent = remaining > 0
      ? "Automatischer Wechsel in " + remaining + " Sekunden möglich."
      : "Weiter auswählen.";
    dom.secondsContinueButton.textContent = "Weiter";
    return;
  }

  const isStopwatch = action.type === ACTION_TYPES.STOPWATCH;
  const title = isStopwatch ? dom.stopwatchTitle : dom.manualTitle;
  const actionName = isStopwatch ? dom.stopwatchActionName : dom.manualActionName;
  const options = isStopwatch ? dom.stopwatchActionOptions : dom.manualActionOptions;
  const clock = isStopwatch ? dom.stopwatchClock : dom.manualClock;
  const status = isStopwatch ? dom.stopwatchStatus : dom.manualStatus;
  const continueButton = isStopwatch ? dom.stopwatchContinueButton : dom.manualContinueButton;
  const progressElement = isStopwatch ? dom.stopwatchProgress : dom.manualProgress;
  title.textContent = getActionTypeLabel(action.type) + " - " + action.name;
  progressElement.textContent = progress;
  actionName.textContent = action.name;
  options.textContent = isStopwatch
    ? getPreTimerOptionsSummary({ ...action.settings, type: action.type })
    : action.settings.limitSeconds === null
      ? "Ohne Limit"
      : "Limit: " + action.settings.limitSeconds + " Sekunden";
  clock.textContent = formatPreTimerDuration(elapsed);
  if (isStopwatch) {
    status.textContent = "Weiter auswählen, sobald die Stoppuhr beendet ist.";
    continueButton.textContent = "Weiter";
    return;
  }
  if (action.settings.limitSeconds !== null) {
    const limitRemaining = Math.max(0, action.settings.limitSeconds - elapsed);
    continueButton.textContent = limitRemaining > 0
      ? "Weiter (" + limitRemaining + "s)"
      : "Weiter (Limit erreicht)";
    status.textContent = limitRemaining > 0
      ? limitRemaining + " Sekunden bis zum konfigurierten Limit."
      : "Limit erreicht; Weiter bleibt manuell.";
  } else {
    continueButton.textContent = "Weiter";
    status.textContent = "Weiter auswählen, sobald bereit.";
  }
}

function getActionProgressLabel() {
  return "Aktion " + (state.currentActionIndex + 1) + " von " + state.actionPlan.length;
}

function getActiveActionElapsedSeconds() {
  if (state.activeActionStartedAt === null) {
    return 0;
  }
  return Math.max(
    0,
    Math.round((performance.now() - state.activeActionStartedAt) / 1000),
  );
}

function getActiveSecondsRemaining() {
  const action = state.actionPlan[state.currentActionIndex];
  if (
    action?.type !== ACTION_TYPES.SECONDS ||
    state.activeActionStartedAt === null
  ) {
    return 0;
  }
  return Math.max(
    0,
    Math.ceil(
      (state.activeActionStartedAt + action.settings.seconds * 1000 - performance.now()) / 1000,
    ),
  );
}

function handleTimerActionContinue() {
  const action = state.actionPlan[state.currentActionIndex];
  if (!action || action.type === ACTION_TYPES.METRONOME || state.phase === "finished") {
    return;
  }
  if (action.type === ACTION_TYPES.SECONDS && getActiveSecondsRemaining() > 10) {
    openSecondsEarlyDialog(getActiveSecondsRemaining());
    return;
  }
  finishCurrentTimerAction("manual");
}

function openSecondsEarlyDialog(remainingSeconds) {
  if (dom.secondsEarlyDialog.open || typeof dom.secondsEarlyDialog.showModal !== "function") {
    return;
  }
  secondsEarlyDialogTrigger = document.activeElement;
  dom.secondsEarlyDialogMessage.textContent =
    "Es sind noch " + remainingSeconds + " Sekunden übrig. Wirklich vorzeitig fortsetzen?";
  dom.secondsEarlyDialog.showModal();
  dom.secondsEarlyConfirm.focus();
}

function closeSecondsEarlyDialog(continueAction) {
  if (!dom.secondsEarlyDialog.open) {
    return;
  }
  dom.secondsEarlyDialog.close();
  const trigger = secondsEarlyDialogTrigger;
  secondsEarlyDialogTrigger = null;
  if (continueAction) {
    finishCurrentTimerAction("manual");
  } else {
    trigger?.focus();
  }
}

function finishCurrentTimerAction(completedBy) {
  const action = state.actionPlan[state.currentActionIndex];
  const result = state.actionResults[state.currentActionIndex];
  if (!action || !result || result.status !== "active" || action.type === ACTION_TYPES.METRONOME) {
    return;
  }

  clearTimer("actionTimer");
  clearTimer("actionDisplayTimer");
  state.token += 1;
  const elapsedSeconds = getActiveActionElapsedSeconds();
  result.status = "completed";
  result.elapsedSeconds = elapsedSeconds;
  result.completedBy = completedBy;
  if (action.type === ACTION_TYPES.SECONDS) {
    result.configuredSeconds = action.settings.seconds;
  } else if (action.type === ACTION_TYPES.MANUAL) {
    result.limitSeconds = action.settings.limitSeconds;
  } else {
    completeStopwatchResult(action, result, elapsedSeconds);
  }
  state.activeActionStartedAt = null;
  startNextAction();
}

function completeStopwatchResult(action, result, elapsedSeconds) {
  const settings = action.settings;
  const variables = getPreTimerFormulaVariables(
    elapsedSeconds,
    settings.rounding,
    settings.roundingThreshold,
  );
  const evaluation = evaluatePreTimerFormula(settings.formula, variables);
  result.formula = settings.formula;
  result.rounding = settings.rounding;
  result.roundingThreshold = settings.roundingThreshold;
  result.variables = variables;
  result.substitution = evaluation.substitution || null;
  result.resultValid = evaluation.valid;
  result.formulaResult = evaluation.valid ? evaluation.result : null;
  result.invalidReason = evaluation.valid ? null : evaluation.error;

  if (isStaticPreTimerFormula(settings.formula)) {
    result.appliedBeats = evaluation.valid ? evaluation.result : settings.min;
    return;
  }
  if (!evaluation.valid) {
    result.appliedBeats = settings.min;
    return;
  }
  result.appliedBeats = Math.max(
    settings.min,
    settings.max === null ? evaluation.result : Math.min(settings.max, evaluation.result),
  );
  result.clamped = result.appliedBeats !== evaluation.result;
}

function startMetronomeAction(action, result) {
  const derived = getDerivedStopwatchEnd(state.currentActionIndex);
  const settings = createRuntimeMetronomeSettings(action.settings, derived);
  result.settings = cloneValue(settings);
  result.derivedEnd = derived
    ? { total: derived.total, sources: derived.sources.map((source) => source.name) }
    : null;
  state.settings = settings;
  state.phase = "countdown";
  state.beatCount = 0;
  state.currentBpm = settings.initialBpm;
  state.direction = "up";
  state.tempoCounter = 0;
  state.stuckAtMaximum = false;
  state.countdownValue = 3;
  state.resumeCountdownValue = 0;
  state.breakSessions = 0;
  state.breakRecords = [];
  state.activeBreak = null;
  dom.executionTitle.textContent = "Metronom - " + action.name;
  dom.executionActionName.textContent = action.name;
  dom.executionProgress.textContent = getActionProgressLabel();
  dom.executionMessage.textContent = "";
  showView("execution", true);
  if (!playTone(TONE.countdownFrequency) || state.phase !== "countdown") {
    return;
  }
  updateExecutionUi();
  scheduleCountdownStep();
}

function createRuntimeMetronomeSettings(settings, derived) {
  const breakSeconds = settings.breaks === "limited" && settings.breakSeconds
    ? parseBreakInput(settings.breakSeconds)
    : null;
  const total = derived?.total ?? null;
  return {
    initialBpm: settings.bpm,
    accentuate: settings.accentuate,
    accentRepeat: settings.accentRepeat,
    increaseTempo: settings.increaseTempo,
    increaseBy: settings.increaseBy,
    increaseAfter: settings.increaseAfter,
    maximum: settings.maximum,
    maximumLimit: getMetronomeMaximumLimit(settings),
    decreaseBy: settings.decreaseBy,
    decreaseAfter: settings.decreaseAfter,
    breaks: settings.breaks,
    breakCount: settings.breaks === "limited" ? settings.breakCount : null,
    breakSeconds,
    breakSecondsRaw: settings.breaks === "limited" ? settings.breakSeconds : "",
    lockSettings: derived ? true : settings.lockSettings,
    lockBeats: derived ? total : settings.lockBeats,
    sessionEndEnabled: derived ? true : settings.sessionEndEnabled,
    sessionEndBeats: derived ? total : settings.sessionEndBeats,
    derivedEndTotal: total,
    derivedEndSources: derived?.sources.map((source) => source.name) || [],
  };
}

function getDerivedStopwatchEnd(metronomeIndex) {
  const sources = getStopwatchSourcesBeforeMetronome(state.actionPlan, metronomeIndex);
  if (sources.length === 0) {
    return null;
  }
  const completedSources = sources.map((source) => {
    const result = state.actionResults.find((entry) => entry.id === source.id);
    if (!result || !Number.isSafeInteger(result.appliedBeats) || result.appliedBeats < 1) {
      throw new Error("A preceding Stoppuhr action has no valid applied beat result.");
    }
    return { ...source, appliedBeats: result.appliedBeats };
  });
  return {
    total: completedSources.reduce((total, source) => total + source.appliedBeats, 0),
    sources: completedSources,
  };
}

function scheduleCountdownStep() {
  const token = state.token;
  state.countdownTimer = window.setTimeout(() => {
    if (token !== state.token || state.phase !== "countdown") {
      return;
    }
    state.countdownValue -= 1;
    if (state.countdownValue <= 0) {
      beginBeatRun();
      return;
    }
    playTone(TONE.countdownFrequency);
    if (state.phase !== "countdown") {
      return;
    }
    updateExecutionUi();
    scheduleCountdownStep();
  }, 1000);
}

function beginBeatRun() {
  if (state.phase !== "countdown") {
    return;
  }

  state.phase = "running";
  state.countdownTimer = null;
  executeBeat();
}

function executeBeat() {
  if (state.phase !== "running") {
    return;
  }

  const isAccent =
    state.settings.accentuate && state.beatCount % state.settings.accentRepeat === 0;
  state.currentBpm = Math.max(1, state.currentBpm);
  const tonePlayed = playTone(
    isAccent ? TONE.accentFrequency : TONE.regularFrequency,
  );
  if (!tonePlayed || state.phase !== "running" || !state.settings) {
    return;
  }
  state.beatCount += 1;
  if (
    state.settings.sessionEndEnabled &&
    state.beatCount >= state.settings.sessionEndBeats
  ) {
    updateExecutionUi();
    finalizeMetronomeAction("automatic");
    return;
  }
  applyTempoProgression();
  updateExecutionUi();
  scheduleNextBeat();
}

function applyTempoProgression() {
  if (!state.settings.increaseTempo || state.stuckAtMaximum) {
    return;
  }

  const interval =
    state.direction === "up" ? state.settings.increaseAfter : state.settings.decreaseAfter;
  state.tempoCounter += 1;
  if (state.tempoCounter < interval) {
    return;
  }

  state.tempoCounter = 0;

  if (state.direction === "down") {
    const nextBpm = state.currentBpm - state.settings.decreaseBy;
    if (nextBpm <= state.settings.initialBpm) {
      state.currentBpm = state.settings.initialBpm;
      state.direction = "up";
    } else {
      state.currentBpm = nextBpm;
    }
    return;
  }

  let nextBpm = state.currentBpm + state.settings.increaseBy;
  if (state.settings.maximum === "none") {
    state.currentBpm = nextBpm;
    return;
  }

  if (nextBpm < state.settings.maximumLimit) {
    state.currentBpm = nextBpm;
    return;
  }

  nextBpm = state.settings.maximumLimit;
  state.currentBpm = nextBpm;

  if (state.settings.maximum === "stick") {
    state.stuckAtMaximum = true;
    return;
  }

  if (state.settings.maximum === "reset") {
    state.currentBpm = state.settings.initialBpm;
    return;
  }

  state.direction = "down";
}

function scheduleNextBeat() {
  if (state.phase !== "running") {
    return;
  }

  const interval = 60000 / state.currentBpm;
  state.nextBeatDue = performance.now() + interval;
  const token = state.token;
  state.beatTimer = window.setTimeout(() => {
    if (token !== state.token || state.phase !== "running") {
      return;
    }
    executeBeat();
  }, Math.max(0, state.nextBeatDue - performance.now()));
}

function handlePause() {
  if (!state.settings || state.phase === "countdown") {
    return;
  }

  if (state.phase === "paused" || state.phase === "resume-countdown") {
    resumeFromBreak("manual");
    return;
  }

  if (state.phase !== "running") {
    return;
  }

  startBreak();
}

function handleActionAbortRequest(event) {
  if (
    state.currentActionIndex < 0 ||
    state.currentActionIndex >= state.actionPlan.length ||
    state.phase === "idle" ||
    state.phase === "finished" ||
    dom.actionAbortDialog.open ||
    typeof dom.actionAbortDialog.showModal !== "function"
  ) {
    return;
  }

  const action = state.actionPlan[state.currentActionIndex];
  actionAbortDialogTrigger = event?.currentTarget || document.activeElement;
  dom.actionAbortDialogMessage.textContent =
    `„${action.name}“ und alle folgenden Aktionen werden beendet. Ein Teilbericht wird erstellt.`;
  dom.actionAbortDialog.showModal();
  dom.actionAbortConfirm.focus();
}

function closeActionAbortDialog(confirmAbort) {
  if (!dom.actionAbortDialog.open) {
    return;
  }
  dom.actionAbortDialog.close();
  const trigger = actionAbortDialogTrigger;
  actionAbortDialogTrigger = null;
  if (confirmAbort) {
    abortActionSequence();
  } else {
    trigger?.focus();
  }
}

function abortActionSequence() {
  const action = state.actionPlan[state.currentActionIndex];
  const result = state.actionResults[state.currentActionIndex];
  if (!action || !result || result.status !== "active") {
    return;
  }

  if (dom.actionAbortDialog.open) {
    dom.actionAbortDialog.close();
  }
  actionAbortDialogTrigger = null;
  if (
    action.type === ACTION_TYPES.METRONOME &&
    (state.phase === "paused" || state.phase === "resume-countdown")
  ) {
    resumeFromBreak("aborted");
  }
  result.status = "active-aborted";
  result.elapsedSeconds = getActiveActionElapsedSeconds();
  result.settings = cloneValue(
    action.type === ACTION_TYPES.METRONOME ? state.settings : action.settings,
  );
  if (action.type === ACTION_TYPES.METRONOME) {
    result.beatCount = state.beatCount;
    result.breakRecords = state.breakRecords.map((record) => ({ ...record }));
    result.endReason = "aborted";
  } else if (action.type === ACTION_TYPES.STOPWATCH) {
    result.formula = action.settings.formula;
    result.rounding = action.settings.rounding;
    result.roundingThreshold = action.settings.roundingThreshold;
  } else if (action.type === ACTION_TYPES.SECONDS) {
    result.configuredSeconds = action.settings.seconds;
  } else {
    result.limitSeconds = action.settings.limitSeconds;
  }

  cancelTimers();
  state.token += 1;
  state.phase = "finished";
  state.settings = null;
  state.activeBreak = null;
  state.activeActionStartedAt = null;
  finalizeActionSequence(true);
}

function startBreak() {
  const sessionNumber = state.breakSessions + 1;
  state.breakSessions = sessionNumber;

  const breakCount = state.settings.breakCount;
  const overLimit = breakCount !== null && sessionNumber > breakCount;
  const record = {
    number: sessionNumber,
    beat: state.beatCount,
    bpm: state.currentBpm,
    overLimit,
    durationSeconds: null,
    ended: "Active",
  };
  state.breakRecords.push(record);

  let durationSeconds = null;
  if (state.settings.breakSeconds) {
    durationSeconds = evaluateBreakDuration(state.settings.breakSeconds, state.currentBpm);
    if (durationSeconds === null) {
      state.breakRecords.pop();
      state.breakSessions -= 1;
      showExecutionError(
        "Dieser Pausenausdruck ist beim aktuellen BPM nicht positiv; die Pause wurde nicht gestartet.",
      );
      updateExecutionUi();
      return;
    }
  }
  dom.executionMessage.textContent = "";
  clearTimer("beatTimer");
  state.phase = "paused";
  const startedAt = performance.now();
  state.activeBreak = {
    record,
    durationSeconds,
    startedAt,
    deadline: durationSeconds === null ? null : startedAt + durationSeconds * 1000,
  };

  if (durationSeconds !== null) {
    state.breakTimer = window.setTimeout(() => {
      beginAutoResumeCountdown();
    }, Math.max(0, durationSeconds - Math.min(3, durationSeconds)) * 1000);
    state.breakDisplayTimer = window.setInterval(updateExecutionUi, 250);
  }

  updateExecutionUi();
}

function beginAutoResumeCountdown() {
  if (state.phase !== "paused" || !state.activeBreak) {
    return;
  }

  state.breakTimer = null;
  if (
    state.activeBreak.deadline === null ||
    performance.now() >= state.activeBreak.deadline
  ) {
    resumeFromBreak("timer");
    return;
  }

  state.phase = "resume-countdown";
  state.resumeCountdownValue = Math.min(3, state.activeBreak.durationSeconds);
  playTone(TONE.countdownFrequency);
  if (state.phase !== "resume-countdown" || !state.settings) {
    return;
  }
  updateExecutionUi();
  scheduleAutoResumeCountdownStep();
}

function scheduleAutoResumeCountdownStep() {
  const token = state.token;
  state.resumeCountdownTimer = window.setTimeout(() => {
    if (token !== state.token || state.phase !== "resume-countdown") {
      return;
    }

    state.resumeCountdownTimer = null;
    if (
      !state.activeBreak ||
      state.activeBreak.deadline === null ||
      performance.now() >= state.activeBreak.deadline
    ) {
      resumeFromBreak("timer");
      return;
    }

    if (state.resumeCountdownValue > 1) {
      state.resumeCountdownValue -= 1;
      playTone(TONE.countdownFrequency);
      if (state.phase !== "resume-countdown" || !state.settings) {
        return;
      }
      updateExecutionUi();
      scheduleAutoResumeCountdownStep();
      return;
    }

    resumeFromBreak("timer");
  }, 1000);
}

function evaluateBreakDuration(parsedInput, bpm) {
  let seconds;
  if (parsedInput.type === "seconds") {
    seconds = parsedInput.seconds;
  } else if (parsedInput.operator === "+") {
    seconds = bpm + parsedInput.operand;
  } else if (parsedInput.operator === "-") {
    seconds = bpm - parsedInput.operand;
  } else if (parsedInput.operator === "*") {
    seconds = bpm * parsedInput.operand;
  } else {
    seconds = bpm / parsedInput.operand;
  }

  if (!Number.isFinite(seconds) || seconds <= 0) {
    return null;
  }

  const roundedSeconds = Math.round(seconds);
  return roundedSeconds > 0 ? roundedSeconds : null;
}

function resumeFromBreak(reason) {
  if (
    (state.phase !== "paused" && state.phase !== "resume-countdown") ||
    !state.activeBreak
  ) {
    return;
  }

  clearTimer("breakTimer");
  clearTimer("resumeCountdownTimer");
  clearTimer("breakDisplayTimer");
  const elapsedSeconds = Math.max(
    0,
    Math.round((performance.now() - state.activeBreak.startedAt) / 1000),
  );
  state.activeBreak.record.durationSeconds = elapsedSeconds;
  state.activeBreak.record.ended =
    reason === "timer"
      ? `Automatisch fortgesetzt nach ${elapsedSeconds} Sekunden`
      : reason === "ended"
        ? `Weiter nach ${elapsedSeconds} Sekunden`
        : reason === "aborted"
          ? `Abgebrochen nach ${elapsedSeconds} Sekunden`
        : `Manuell fortgesetzt nach ${elapsedSeconds} Sekunden`;
  state.activeBreak = null;
  state.resumeCountdownValue = 0;
  dom.executionMessage.textContent = "";

  if (reason === "ended" || reason === "aborted") {
    return;
  }

  state.phase = "running";
  updateExecutionUi();
  scheduleNextBeat();
}

function handleMetronomeContinue() {
  if (
    !state.settings ||
    (state.phase !== "running" &&
      state.phase !== "paused" &&
      state.phase !== "resume-countdown")
  ) {
    return;
  }

  if (state.settings.lockSettings && state.beatCount < state.settings.lockBeats) {
    return;
  }

  if (state.phase === "paused" || state.phase === "resume-countdown") {
    resumeFromBreak("ended");
  }

  finalizeMetronomeAction("manual");
}

function finalizeMetronomeAction(endReason) {
  const result = state.actionResults[state.currentActionIndex];
  if (!result || result.status !== "active") {
    return;
  }
  result.status = "completed";
  result.settings = cloneValue(state.settings);
  result.beatCount = state.beatCount;
  result.breakRecords = state.breakRecords.map((record) => ({ ...record }));
  result.endReason = endReason;

  cancelTimers();
  state.token += 1;
  state.phase = "transition";
  state.settings = null;
  state.activeBreak = null;
  state.activeActionStartedAt = null;
  startNextAction();
}

function finalizeActionSequence(aborted) {
  cancelTimers();
  state.token += 1;
  state.phase = "finished";
  state.settings = null;
  state.activeBreak = null;
  state.activeActionStartedAt = null;
  state.report = {
    actions: cloneValue(state.actionResults),
    aborted,
  };
  renderReport();
  showView("report", true);
}

async function handleCopyReport() {
  if (!state.report) {
    return;
  }

  await handleCopyReportText(
    buildReportText(state.report),
    dom.copyReportButton,
    "In Zwischenablage kopieren",
    "Bericht in die Zwischenablage kopiert.",
  );
}

async function handleCopyShortReport() {
  if (!state.report) {
    return;
  }

  await handleCopyReportText(
    buildShortReportText(state.report),
    dom.copyShortReportButton,
    "Kurzbericht in Zwischenablage kopieren",
    "Kurzbericht in die Zwischenablage kopiert.",
  );
}

async function handleCopyReportText(text, button, defaultLabel, successMessage) {
  try {
    await copyText(text, button);
    dom.reportStatus.classList.remove("error-status");
    dom.reportStatus.textContent = successMessage;
    button.textContent = "Kopiert!";

    const existingTimer = copyFeedbackTimers.get(button);
    if (existingTimer !== undefined) {
      window.clearTimeout(existingTimer);
    }
    copyFeedbackTimers.set(
      button,
      window.setTimeout(() => {
        button.textContent = defaultLabel;
        copyFeedbackTimers.delete(button);
      }, 2000),
    );
  } catch (error) {
    dom.reportStatus.classList.add("error-status");
    dom.reportStatus.textContent = getErrorMessage(
      error,
      "Der Bericht konnte nicht in die Zwischenablage kopiert werden.",
    );
  }
}

function resetReportCopyFeedback() {
  [
    [dom.copyReportButton, "In Zwischenablage kopieren"],
    [dom.copyShortReportButton, "Kurzbericht in Zwischenablage kopieren"],
  ].forEach(([button, defaultLabel]) => {
    const timer = copyFeedbackTimers.get(button);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      copyFeedbackTimers.delete(button);
    }
    button.textContent = defaultLabel;
  });
}

async function copyText(text, focusTarget = dom.copyReportButton) {
  const clipboard = typeof navigator !== "undefined" ? navigator.clipboard : null;
  if (clipboard && typeof clipboard.writeText === "function") {
    try {
      await clipboard.writeText(text);
      return;
    } catch {
      // Continue with the local fallback when the Clipboard API is unavailable or denied.
    }
  }

  const buffer = dom.clipboardBuffer;
  buffer.value = text;
  buffer.focus();
  buffer.select();
  const copied =
    typeof document.execCommand === "function" && document.execCommand("copy");
  buffer.setSelectionRange(0, 0);
  focusTarget?.focus();

  if (!copied) {
    throw new Error("Der Browser hat den Zugriff auf die Zwischenablage nicht erlaubt.");
  }
}

function handleBackToSettings() {
  resetFinishedRun();
  showView("settings", true);
  dom.actionAddButton.focus();
}

function handleBackToPresets() {
  resetFinishedRun();
  showView("presets", true);
}

async function handleRepeatRun() {
  if (!state.report) {
    return;
  }
  await startConfiguredSession();
}

function resetFinishedRun() {
  cancelTimers();
  state.token += 1;
  state.phase = "idle";
  state.settings = null;
  state.activeBreak = null;
  state.actionPlan = [];
  state.actionResults = [];
  state.currentActionIndex = -1;
  state.activeActionStartedAt = null;
  state.report = null;
  dom.settingsStatus.textContent = "";
  dom.executionMessage.textContent = "";
  dom.reportStatus.textContent = "";
  dom.reportStatus.classList.remove("error-status");
  resetReportCopyFeedback();
}

function updateExecutionUi() {
  const action = state.actionPlan[state.currentActionIndex];
  if (!state.settings || action?.type !== ACTION_TYPES.METRONOME) {
    return;
  }

  const isCountdown = state.phase === "countdown";
  const isResumeCountdown = state.phase === "resume-countdown";
  const isPaused = state.phase === "paused";
  const isRunning = state.phase === "running";
  const isBreakActive = isPaused || isResumeCountdown;

  dom.executionTitle.textContent = "Metronom - " + action.name;
  dom.executionActionName.textContent = action.name;
  dom.executionProgress.textContent = getActionProgressLabel();
  dom.executionPhase.textContent = isCountdown
    ? "Start"
    : isResumeCountdown
      ? "Fortsetzen"
      : isPaused
      ? "Pause aktiv"
      : "Läuft";
  dom.currentBpmLabel.textContent = isCountdown ? "Start in" : "Aktuelle BPM";
  dom.currentBpm.textContent = isCountdown
    ? String(state.countdownValue)
    : String(state.currentBpm);
  dom.beatCount.textContent = `Abgeschlossene Beats: ${state.beatCount}`;

  dom.executionActions.classList.toggle(
    "single-action",
    isCountdown || state.settings.breaks === "none",
  );
  dom.abortButton.hidden = false;
  dom.pauseButton.hidden = state.settings.breaks === "none" || isCountdown;
  dom.pauseButton.disabled = !isRunning && !isBreakActive;
  dom.pauseButton.classList.toggle(
    "over-limit",
    isBreakLimitReached(
      state.settings.breakCount,
      state.breakSessions,
      isBreakActive,
    ),
  );

  if (isBreakActive) {
    const remaining = getBreakSecondsRemaining();
    dom.pauseButton.textContent =
      remaining === null ? "Fortsetzen" : `Fortsetzen (${remaining}s)`;
    dom.breakStatus.textContent = isResumeCountdown
      ? "Jetzt fortsetzen."
      : remaining === null
        ? "Fortsetzen, sobald bereit."
        : `${remaining}s verbleibend oder manuell fortsetzen.`;
  } else {
    dom.pauseButton.textContent = getPauseLabel();
    dom.breakStatus.textContent = "";
  }

  if (isCountdown) {
    dom.nextBpmLabel.textContent = "Anfangs-BPM";
    dom.nextBpmInfo.hidden = false;
    dom.nextBpm.textContent = String(state.settings.initialBpm);
    dom.nextBpmCountdown.textContent = "zu Beginn";
  } else if (state.settings.increaseTempo) {
    dom.nextBpmLabel.textContent = "Nächstes BPM";
    dom.nextBpmInfo.hidden = false;
    if (state.stuckAtMaximum) {
      dom.nextBpm.textContent = "Max";
      dom.nextBpmCountdown.textContent = "am Limit";
    } else {
      dom.nextBpm.textContent = String(getNextBpm());
      const interval =
        state.direction === "up"
          ? state.settings.increaseAfter
          : state.settings.decreaseAfter;
      const remaining = Math.max(1, interval - state.tempoCounter);
      dom.nextBpmCountdown.textContent =
        `in ${remaining} ${remaining === 1 ? "Beat" : "Beats"}`;
    }
  } else {
    dom.nextBpmInfo.hidden = true;
  }

  const stopLocked =
    state.settings.lockSettings && state.beatCount < state.settings.lockBeats;
  dom.continueMetronomeButton.disabled = isCountdown || stopLocked;
  dom.continueMetronomeButton.textContent = isCountdown
    ? "Weiter (Start)"
    : stopLocked
      ? `Weiter (für ${state.settings.lockBeats - state.beatCount} Beats gesperrt)`
      : "Weiter";
}

function getPauseLabel() {
  if (state.settings.breakCount === null) {
    return "Pause";
  }

  const remaining = Math.max(0, state.settings.breakCount - state.breakSessions);
  if (remaining > 0) {
    return `Pause (${remaining} übrig)`;
  }
  if (state.breakSessions === state.settings.breakCount) {
    return "Pause (0 übrig)";
  }
  return `Pause (${state.breakSessions - state.settings.breakCount} über dem Limit)`;
}

function isBreakLimitReached(breakCount, breakSessions, isBreakActive) {
  if (breakCount === null) {
    return false;
  }
  return (
    breakSessions > breakCount ||
    (breakSessions === breakCount && !isBreakActive)
  );
}

function getBreakSecondsRemaining() {
  if (!state.activeBreak || state.activeBreak.deadline === null) {
    return null;
  }
  return Math.max(0, Math.ceil((state.activeBreak.deadline - performance.now()) / 1000));
}

function getNextBpm() {
  if (state.direction === "down") {
    return Math.max(
      state.settings.initialBpm,
      state.currentBpm - state.settings.decreaseBy,
    );
  }

  const proposed = state.currentBpm + state.settings.increaseBy;
  if (state.settings.maximum === "none") {
    return proposed;
  }
  if (proposed < state.settings.maximumLimit) {
    return proposed;
  }
  if (state.settings.maximum === "reset") {
    return state.settings.initialBpm;
  }
  return state.settings.maximumLimit;
}

function renderReport() {
  dom.reportStatus.textContent = "";
  dom.reportStatus.classList.remove("error-status");
  resetReportCopyFeedback();
  dom.actionReportSections.replaceChildren();
  state.report.actions.forEach((actionResult) => {
    dom.actionReportSections.append(renderActionReportSection(actionResult));
  });
}

function renderActionReportSection(actionResult) {
  const section = document.createElement("section");
  section.className = "report-card action-report-section";
  const heading = document.createElement("h3");
  heading.textContent = getActionTypeLabel(actionResult.type) + " - " + actionResult.name;
  section.append(heading);

  if (actionResult.status === "not-started") {
    appendReportDetail(section, "Status", "Nicht gestartet");
    return section;
  }
  if (actionResult.status === "active-aborted") {
    appendReportDetail(section, "Status", "Aktiv abgebrochen");
  } else {
    appendReportDetail(section, "Status", getActionCompletionLabel(actionResult));
  }

  if (actionResult.type === ACTION_TYPES.METRONOME) {
    renderMetronomeActionReport(section, actionResult);
  } else if (actionResult.type === ACTION_TYPES.SECONDS) {
    appendReportDetail(section, "Dauer", actionResult.elapsedSeconds + " Sekunden");
    appendReportDetail(section, "Konfiguriert", actionResult.configuredSeconds + " Sekunden");
  } else if (actionResult.type === ACTION_TYPES.STOPWATCH) {
    renderStopwatchActionReport(section, actionResult);
  } else {
    appendReportDetail(section, "Dauer", formatPreTimerDuration(actionResult.elapsedSeconds) + " (mm:ss)");
    appendReportDetail(
      section,
      "Limit",
      actionResult.limitSeconds === null ? "Ohne Limit" : actionResult.limitSeconds + " Sekunden",
    );
  }
  return section;
}

function appendReportDetail(section, label, value) {
  let details = section.querySelector(".report-details");
  if (!details) {
    details = document.createElement("dl");
    details.className = "report-details";
    section.append(details);
  }
  const row = document.createElement("div");
  const term = document.createElement("dt");
  const description = document.createElement("dd");
  term.textContent = label;
  description.textContent = String(value);
  row.append(term, description);
  details.append(row);
}

function renderMetronomeActionReport(section, actionResult) {
  const settings = getMetronomeDisplaySettings(actionResult.settings);
  appendReportDetail(section, "Beats", actionResult.beatCount + "x");
  appendReportDetail(section, "Tempo", formatBpm(settings));
  appendReportDetail(
    section,
    "Betonung",
    settings.accentuate ? "Alle " + settings.accentRepeat + " Beats" : "Aus",
  );
  appendReportDetail(section, "Tempoverlauf", formatMetronomeTempoProgression(settings));
  appendReportDetail(section, "Pausen", formatBreaks(settings));
  appendReportDetail(section, "Ende", formatSessionEnd(settings));
  appendReportDetail(
    section,
    "Weiter-Sperre",
    settings.lockSettings ? "Bis " + settings.lockBeats + " Beats" : "Keine",
  );
  if (actionResult.derivedEnd) {
    appendReportDetail(
      section,
      "Stoppuhr-Aktionen",
      actionResult.derivedEnd.sources.join(", ") + " = " + actionResult.derivedEnd.total + " Beats",
    );
  }
  renderMetronomeBreaks(section, actionResult.breakRecords || []);
}

function renderMetronomeBreaks(section, breakRecords) {
  const breaks = document.createElement("div");
  breaks.className = "report-breaks";
  const heading = document.createElement("h4");
  heading.textContent = "Pausen gebraucht";
  breaks.append(heading);
  if (breakRecords.length === 0) {
    const empty = document.createElement("p");
    empty.textContent = "Keine Pausen gebraucht";
    breaks.append(empty);
    section.append(breaks);
    return;
  }

  const wrapper = document.createElement("div");
  wrapper.className = "table-wrapper";
  const table = document.createElement("table");
  table.className = "report-table";
  const header = document.createElement("thead");
  const headerRow = document.createElement("tr");
  ["Nr.", "Beat", "BPM", "Limit", "Beendet"].forEach((label) => {
    const cell = document.createElement("th");
    cell.scope = "col";
    cell.textContent = label;
    headerRow.append(cell);
  });
  header.append(headerRow);
  const body = document.createElement("tbody");
  breakRecords.forEach((record) => {
    const row = document.createElement("tr");
    appendReportCell(row, String(record.number));
    appendReportCell(row, String(record.beat));
    appendReportCell(row, String(record.bpm));
    appendReportCell(row, record.overLimit ? "Überschritten" : "Eingehalten");
    appendReportCell(row, record.ended);
    body.append(row);
  });
  table.append(header, body);
  wrapper.append(table);
  breaks.append(wrapper);
  section.append(breaks);
}

function renderStopwatchActionReport(section, actionResult) {
  const settings = actionResult.settings;
  appendReportDetail(section, "Dauer", formatPreTimerDuration(actionResult.elapsedSeconds) + " (mm:ss)");
  appendReportDetail(section, "Formel", actionResult.formula || settings.formula);
  appendReportDetail(section, "Rundung", formatStopwatchRounding(settings));
  appendReportDetail(section, "Begrenzung", formatStopwatchBounds(settings));
  if (actionResult.status === "completed") {
    const formulaText = actionResult.resultValid
      ? (actionResult.substitution || actionResult.formula) +
        " = " + actionResult.formulaResult + " Beats"
      : "Ungültig: " + (actionResult.invalidReason || "Ergebnis nicht berechenbar");
    appendReportDetail(section, "Formelergebnis", formulaText);
    appendReportDetail(section, "Für nächstes Metronom angewendet", actionResult.appliedBeats + " Beats");
    if (actionResult.clamped) {
      appendReportDetail(section, "Anpassung", "Ergebnis auf den konfigurierten Bereich begrenzt.");
    } else if (!actionResult.resultValid && !isStaticPreTimerFormula(actionResult.formula)) {
      appendReportDetail(section, "Fallback", "Mindestwert " + actionResult.appliedBeats + " Beats verwendet.");
    }
  }
}

function getActionCompletionLabel(actionResult) {
  if (actionResult.type === ACTION_TYPES.METRONOME) {
    return actionResult.endReason === "automatic" ? "Automatisch beendet" : "Manuell beendet";
  }
  if (actionResult.type === ACTION_TYPES.SECONDS) {
    return actionResult.completedBy === "auto" ? "Automatisch fortgesetzt" : "Manuell fortgesetzt";
  }
  return "Manuell fortgesetzt";
}

function buildReportText(report) {
  return report.actions.map((actionResult) => {
    const heading = "**" + getActionTypeLabel(actionResult.type) + " - " + actionResult.name + "**";
    return [heading, ...getActionReportLines(actionResult)].join("\n");
  }).join("\n\n");
}

function buildShortReportText(report) {
  return report.actions.map((actionResult) => {
    const heading = "**" + actionResult.name + "**";
    const lines = [heading, getActionShortLine(actionResult)];
    if (actionResult.type === ACTION_TYPES.METRONOME) {
      lines.push(formatShortBreakList(actionResult.breakRecords || []));
    }
    return lines.join("\n");
  }).join("\n\n");
}

function getActionReportLines(actionResult) {
  if (actionResult.status === "not-started") {
    return ["Status: Nicht gestartet"];
  }
  const status = actionResult.status === "active-aborted"
    ? "Aktiv abgebrochen"
    : getActionCompletionLabel(actionResult);
  if (actionResult.type === ACTION_TYPES.METRONOME) {
    const settings = getMetronomeDisplaySettings(actionResult.settings);
    const lines = [
      "Status: " + status,
      "Beats: " + (actionResult.beatCount ?? 0) + "x",
      "Tempo: " + formatBpm(settings),
      "Betonung: " + (settings.accentuate ? "alle " + settings.accentRepeat + " Beats" : "aus"),
      "Tempoverlauf: " + formatMetronomeTempoProgression(settings),
      "Pausen: " + formatBreaks(settings),
      "Ende: " + formatSessionEnd(settings),
      "Weiter-Sperre: " + (settings.lockSettings ? "bis " + settings.lockBeats + " Beats" : "keine"),
    ];
    if (actionResult.derivedEnd) {
      lines.push(
        "Aus Stoppuhr: " + actionResult.derivedEnd.sources.join(", ") +
          " = " + actionResult.derivedEnd.total + " Beats",
      );
    }
    lines.push("Pausen gebraucht:");
    const records = actionResult.breakRecords || [];
    if (records.length === 0) {
      lines.push("Keine Pausen gebraucht");
    } else {
      records.forEach((record) => {
        lines.push(
          "- " + record.number + ". Beat " + record.beat + "; " + record.bpm +
            " BPM; " + record.ended +
            (record.overLimit ? "; Limit überschritten" : "; Limit eingehalten"),
        );
      });
    }
    return lines;
  }
  if (actionResult.type === ACTION_TYPES.SECONDS) {
    return [
      "Status: " + status,
      "Dauer: " + actionResult.elapsedSeconds + " Sekunden (konfiguriert: " + actionResult.configuredSeconds + " Sekunden)",
    ];
  }
  if (actionResult.type === ACTION_TYPES.STOPWATCH) {
    const settings = actionResult.settings;
    const lines = [
      "Status: " + status,
      "Dauer: " + formatPreTimerDuration(actionResult.elapsedSeconds) + " (mm:ss)",
      "Formel: " + (actionResult.formula || settings.formula),
      "Rundung: " + getPreTimerRoundingLabel(actionResult.rounding) +
        (actionResult.rounding === PRE_TIMER_ROUNDING.ROUND
          ? " ab " + (actionResult.roundingThreshold ?? 30) + " Sekunden"
          : ""),
      "Begrenzung: " + formatStopwatchBounds(settings),
    ];
    if (actionResult.status === "completed") {
      lines.push(
        actionResult.resultValid
          ? "Formelergebnis: " + (actionResult.substitution || actionResult.formula) +
            " = " + actionResult.formulaResult + " Beats"
          : "Formelergebnis ungültig: " + (actionResult.invalidReason || "nicht berechenbar"),
        "Angewendet: " + actionResult.appliedBeats + " Beats" +
          (actionResult.clamped ? " (begrenzt)" : ""),
      );
      if (!actionResult.resultValid && !isStaticPreTimerFormula(actionResult.formula)) {
        lines.push("Fallback: Mindestwert " + actionResult.appliedBeats + " Beats verwendet.");
      }
    }
    return lines;
  }
  return [
    "Status: " + status,
    "Dauer: " + formatPreTimerDuration(actionResult.elapsedSeconds) + " (mm:ss)",
    "Limit: " + (actionResult.limitSeconds === null ? "Ohne Limit" : actionResult.limitSeconds + " Sekunden"),
  ];
}

function getActionShortLine(actionResult) {
  const status = actionResult.status === "not-started"
    ? "Nicht gestartet"
    : actionResult.status === "active-aborted"
      ? "Aktiv abgebrochen"
      : getActionCompletionLabel(actionResult);
  if (actionResult.type === ACTION_TYPES.METRONOME) {
    const settings = getMetronomeDisplaySettings(actionResult.settings);
    const parameters = [
      "Status: " + status,
      actionResult.beatCount === undefined ? "" : "Beats: " + actionResult.beatCount + "x",
      "Starttempo: " + settings.initialBpm + " BPM",
      "Betonung: " + (settings.accentuate ? "alle " + settings.accentRepeat + " Beats" : "aus"),
      "Tempoverlauf: " + formatMetronomeTempoProgression(settings),
      "Pausen: " + formatBreaks(settings),
      "Ende: " + formatSessionEnd(settings),
      "Weiter-Sperre: " + (settings.lockSettings ? "bis " + settings.lockBeats + " Beats" : "keine"),
    ].filter(Boolean);
    return parameters.join("; ");
  }
  if (actionResult.type === ACTION_TYPES.SECONDS) {
    const settings = actionResult.settings;
    const elapsed = actionResult.elapsedSeconds === undefined
      ? ""
      : "Dauer: " + actionResult.elapsedSeconds + "s; ";
    return elapsed + "Konfiguriert: " +
      (actionResult.configuredSeconds ?? settings.seconds) + "s; " + status;
  }
  if (actionResult.type === ACTION_TYPES.STOPWATCH) {
    const settings = actionResult.settings;
    const outcome = actionResult.status === "completed"
      ? actionResult.resultValid
        ? "Ergebnis " + actionResult.formulaResult + ", angewendet " + actionResult.appliedBeats + " Beats"
        : "Ungültig, Fallback " + actionResult.appliedBeats + " Beats"
      : "";
    const elapsed = actionResult.elapsedSeconds === undefined
      ? ""
      : "Dauer: " + formatPreTimerDuration(actionResult.elapsedSeconds) + "; ";
    return elapsed + "Formel: " + (actionResult.formula || settings.formula) +
      "; Rundung: " + formatStopwatchRounding(settings) +
      "; Begrenzung: " + formatStopwatchBounds(settings) +
      (outcome ? "; " + outcome : "") + "; " + status;
  }
  const settings = actionResult.settings;
  const elapsed = actionResult.elapsedSeconds === undefined
    ? ""
    : "Dauer: " + formatPreTimerDuration(actionResult.elapsedSeconds) + "; ";
  return elapsed + "Limit: " +
    ((actionResult.limitSeconds ?? settings.limitSeconds) === null
      ? "ohne"
      : (actionResult.limitSeconds ?? settings.limitSeconds) + "s") +
    "; " + status;
}

function formatShortBreakList(breakRecords) {
  if (breakRecords.length === 0) {
    return "Keine Pausen gebraucht";
  }
  return "Pausen gebraucht bei: " + breakRecords.map((record) => {
    const duration = record.durationSeconds === null ? "aktiv" : record.durationSeconds + "s";
    return record.beat + " (" + duration + ", " + record.bpm + " BPM)";
  }).join(", ");
}

function formatMetronomeTempoProgression(settings) {
  settings = getMetronomeDisplaySettings(settings);
  if (!settings.increaseTempo) {
    return "Aus";
  }
  const increase = "+" + settings.increaseBy + " BPM alle " + settings.increaseAfter + " Beats";
  if (settings.maximum === "none") {
    return increase + "; unbegrenzt";
  }
  if (settings.maximum === "stick") {
    return increase + "; bei " + settings.maximumLimit + " BPM halten";
  }
  if (settings.maximum === "reset") {
    return increase + "; bei " + settings.maximumLimit + " BPM zurücksetzen";
  }
  return increase + "; bei " + settings.maximumLimit + " BPM umkehren; -" +
    settings.decreaseBy + " BPM alle " + settings.decreaseAfter + " Beats";
}

function formatStopwatchRounding(settings) {
  return getPreTimerRoundingLabel(settings.rounding) +
    (settings.rounding === PRE_TIMER_ROUNDING.ROUND
      ? " ab " + (settings.roundingThreshold ?? 30) + " Sekunden"
      : "");
}

function formatStopwatchBounds(settings) {
  if (isStaticPreTimerFormula(settings.formula)) {
    return "Keine (statische Zahl)";
  }
  return "Min " + settings.min + "; Max " +
    (settings.max === null ? "unbegrenzt" : settings.max);
}

function formatBpm(settings) {
  settings = getMetronomeDisplaySettings(settings);
  if (!settings.increaseTempo) {
    return `${settings.initialBpm} BPM`;
  }

  const value =
    settings.maximum === "none"
      ? `${settings.initialBpm} BPM`
      : `${settings.initialBpm} - ${settings.maximumLimit} BPM`;
  let formatted = value;
  formatted += `; +${settings.increaseBy} BPM alle ${settings.increaseAfter} Beats`;
  if (settings.maximum === "reverse") {
    formatted += `; -${settings.decreaseBy} BPM alle ${settings.decreaseAfter} Beats`;
  }

  return formatted;
}

function formatBreaks(settings) {
  settings = getMetronomeDisplaySettings(settings);
  if (settings.breaks === "none") {
    return "Keine";
  }
  if (settings.breaks === "unlimited") {
    return "Unbegrenzt";
  }

  const count =
    settings.breakCount === null ? "unbegrenzte Anzahl" : settings.breakCount;
  const duration = settings.breakSecondsRaw
    ? `Dauer ${settings.breakSecondsRaw}s`
    : "manuelle Dauer";
  return `Begrenzt: ${count}; ${duration}`;
}

function formatSessionEnd(settings) {
  settings = getMetronomeDisplaySettings(settings);
  if (settings.derivedEndTotal !== null && settings.derivedEndTotal !== undefined) {
    return `Aus Stoppuhr: Nach ${settings.derivedEndTotal} Beats; Weiter gesperrt bis ${settings.derivedEndTotal} Beats`;
  }
  const sessionEnd = settings.sessionEndEnabled
    ? `Nach ${settings.sessionEndBeats} Beats`
    : "Manuelles Weiter";
  if (!settings.lockSettings) {
    return sessionEnd;
  }
  return `${sessionEnd}; Einstellungen gesperrt, bis ${settings.lockBeats} Beats vergangen sind`;
}

function getMetronomeDisplaySettings(settings) {
  if (settings && Object.prototype.hasOwnProperty.call(settings, "initialBpm")) {
    return settings;
  }
  return createRuntimeMetronomeSettings(settings || createDefaultMetronomeSettings(), null);
}

function playTone(frequency) {
  if (!audioContext || audioContext.state !== "running") {
    handleAudioFailure(new Error("Der Audio-Kontext läuft nicht."));
    return false;
  }

  try {
    const now = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const endTime = now + TONE.durationSeconds;

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(TONE.peakGain, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, endTime);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(endTime);
    return true;
  } catch (error) {
    handleAudioFailure(error);
    return false;
  }
}

function handleAudioFailure(error) {
  cancelTimers();
  state.token += 1;
  state.phase = "idle";
  state.settings = null;
  state.activeBreak = null;
  state.actionPlan = [];
  state.actionResults = [];
  state.currentActionIndex = -1;
  state.activeActionStartedAt = null;
  dom.executionMessage.textContent = getErrorMessage(
    error,
    "Audio wurde unerwartet beendet. Zu den Einstellungen zurückkehren und erneut versuchen.",
  );
  dom.settingsStatus.textContent = dom.executionMessage.textContent;
  dom.settingsStatus.classList.add("error-status");
  showView("settings", true);
  dom.actionAddButton.focus();
}

function showExecutionError(message) {
  dom.executionMessage.textContent = message;
}

function showView(name, moveFocus) {
  Object.entries(views).forEach(([viewName, view]) => {
    const active = viewName === name;
    view.hidden = !active;
    view.setAttribute("aria-hidden", String(!active));
  });

  if (!moveFocus) {
    return;
  }

  const headings = {
    presets: dom.presetsTitle,
    settings: dom.settingsTitle,
    seconds: dom.secondsTitle,
    stopwatch: dom.stopwatchTitle,
    manual: dom.manualTitle,
    execution: dom.executionTitle,
    report: dom.reportTitle,
  };
  headings[name]?.focus();
}

function setOptionCardState(card, active) {
  card.classList.toggle("is-disabled", !active);
}

function setControlDisabled(control, disabled) {
  control.disabled = disabled;
}

function getSelectedValue(name) {
  return document.querySelector(`input[name="${name}"]:checked`)?.value || null;
}

function setSelectedValue(name, value) {
  document.querySelectorAll(`input[name="${name}"]`).forEach((input) => {
    input.checked = input.value === value;
  });
}

function getMaximumControls(maximum) {
  if (maximum === "stick") {
    return {
      limit: dom.maximumLimitStick,
    };
  }
  if (maximum === "reset") {
    return {
      limit: dom.maximumLimitReset,
    };
  }
  return {
    limit: dom.maximumLimitReverse,
    decreaseBy: dom.decreaseByReverse,
    decreaseAfter: dom.decreaseAfterReverse,
  };
}

function setFieldError(fieldId, message) {
  const error = document.getElementById(`${fieldId}-error`);
  const target = getErrorTarget(fieldId);
  if (error) {
    error.textContent = message;
  }
  target?.setAttribute("aria-invalid", "true");
}

function clearFieldError(fieldId) {
  if (!fieldId) {
    return;
  }
  const error = document.getElementById(`${fieldId}-error`);
  const target = getErrorTarget(fieldId);
  if (error) {
    error.textContent = "";
  }
  target?.removeAttribute("aria-invalid");
}

function clearAllFieldErrors() {
  document.querySelectorAll(".field-error").forEach((error) => {
    error.textContent = "";
  });
  document.querySelectorAll('[aria-invalid="true"]').forEach((target) => {
    target.removeAttribute("aria-invalid");
  });
}

function getErrorTarget(fieldId) {
  const directTarget = document.getElementById(fieldId);
  if (directTarget) {
    return directTarget;
  }
  if (fieldId === "maximum") {
    return dom.maximumOptions;
  }
  if (fieldId === "breaks") {
    return document.getElementById("breaks-none")?.closest("fieldset");
  }
  return null;
}

function clearTimer(timerName) {
  const timer = state[timerName];
  if (timer === null || timer === undefined) {
    return;
  }

  if (timerName === "breakDisplayTimer" || timerName === "actionDisplayTimer") {
    window.clearInterval(timer);
  } else {
    window.clearTimeout(timer);
  }
  state[timerName] = null;
}

function cancelTimers() {
  clearTimer("countdownTimer");
  clearTimer("resumeCountdownTimer");
  clearTimer("beatTimer");
  clearTimer("breakTimer");
  clearTimer("breakDisplayTimer");
  clearTimer("actionTimer");
  clearTimer("actionDisplayTimer");
}

function getErrorMessage(error, fallback) {
  return error instanceof Error && error.message ? error.message : fallback;
}

init();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch((error) => {
    console.error("Metronome service worker registration failed.", error);
  });
}
