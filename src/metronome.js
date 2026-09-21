import {
  PRE_TIMER_ROUNDING,
  PRE_TIMER_TYPES,
  clonePreTimers,
  createDefaultPreTimer,
  deserializePreTimerPayload,
  evaluatePreTimerFormula,
  formatPreTimerDuration,
  getPreTimerDefaultName,
  getPreTimerFormulaVariables,
  getPreTimerOptionsSummary,
  getPreTimerRoundingLabel,
  getPreTimerTypeLabel,
  normalizePreTimerDefinition,
  serializePreTimerPayload,
  validatePreTimerRows,
} from "./pre-timer-model.js";

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

const REPORT_BREAKS_HEADING = "gebrauchte Pausen";

const views = {
  settings: document.getElementById("settings-view"),
  preTimers: document.getElementById("pre-timers-view"),
  execution: document.getElementById("execution-view"),
  report: document.getElementById("report-view"),
};

const dom = {
  settingsForm: document.getElementById("settings-form"),
  settingsTitle: document.getElementById("settings-title"),
  settingsStatus: document.getElementById("settings-status"),
  presetList: document.getElementById("preset-list"),
  settingsImportWrapper: document.getElementById("settings-import-wrapper"),
  settingsImport: document.getElementById("settings-import"),
  settingsImportError: document.getElementById("settings-import-error"),
  preTimersFieldset: document.getElementById("pre-timers-fieldset"),
  preTimersTable: document.getElementById("pre-timers-table"),
  preTimersTableBody: document.getElementById("pre-timers-table-body"),
  preTimersEmptyMessage: document.getElementById("pre-timers-empty-message"),
  preTimersError: document.getElementById("pre-timers-error"),
  preTimerAddButton: document.getElementById("pre-timer-add-button"),
  preTimerDialog: document.getElementById("pre-timer-dialog"),
  preTimerDialogTitle: document.getElementById("pre-timer-dialog-title"),
  preTimerForm: document.getElementById("pre-timer-form"),
  preTimerName: document.getElementById("pre-timer-name"),
  preTimerType: document.getElementById("pre-timer-type"),
  preTimerTypeError: document.getElementById("pre-timer-type-error"),
  preTimerSecondsFields: document.getElementById("pre-timer-seconds-fields"),
  preTimerSeconds: document.getElementById("pre-timer-seconds"),
  preTimerSecondsError: document.getElementById("pre-timer-seconds-error"),
  preTimerStopwatchFields: document.getElementById("pre-timer-stopwatch-fields"),
  preTimerFormula: document.getElementById("pre-timer-formula"),
  preTimerFormulaError: document.getElementById("pre-timer-formula-error"),
  preTimerRounding: document.getElementById("pre-timer-rounding"),
  preTimerRoundingError: document.getElementById("pre-timer-rounding-error"),
  preTimerRoundingThresholdField: document.getElementById(
    "pre-timer-rounding-threshold-field",
  ),
  preTimerRoundingThreshold: document.getElementById("pre-timer-rounding-threshold"),
  preTimerRoundingThresholdError: document.getElementById(
    "pre-timer-rounding-threshold-error",
  ),
  preTimerManualFields: document.getElementById("pre-timer-manual-fields"),
  preTimerLimitSeconds: document.getElementById("pre-timer-limit-seconds"),
  preTimerLimitSecondsError: document.getElementById(
    "pre-timer-limit-seconds-error",
  ),
  preTimerDialogCancel: document.getElementById("pre-timer-dialog-cancel"),
  preTimerDeleteDialog: document.getElementById("pre-timer-delete-dialog"),
  preTimerDeleteDialogMessage: document.getElementById(
    "pre-timer-delete-dialog-message",
  ),
  preTimerDeleteCancel: document.getElementById("pre-timer-delete-cancel"),
  preTimerDeleteConfirm: document.getElementById("pre-timer-delete-confirm"),
  preTimerAbortDialog: document.getElementById("pre-timer-abort-dialog"),
  preTimerAbortCancel: document.getElementById("pre-timer-abort-cancel"),
  preTimerAbortConfirm: document.getElementById("pre-timer-abort-confirm"),
  preTimerEarlyDialog: document.getElementById("pre-timer-early-dialog"),
  preTimerEarlyDialogMessage: document.getElementById(
    "pre-timer-early-dialog-message",
  ),
  preTimerEarlyCancel: document.getElementById("pre-timer-early-cancel"),
  preTimerEarlyConfirm: document.getElementById("pre-timer-early-confirm"),
  exportAutoStart: document.getElementById("export-auto-start"),
  exportSettingsButton: document.getElementById("export-settings-button"),
  exportUrlButton: document.getElementById("export-url-button"),
  bpm: document.getElementById("bpm"),
  accentuate: document.getElementById("accentuate"),
  accentOptionCard: document.getElementById("accent-option-card"),
  accentRepeat: document.getElementById("accent-repeat"),
  increaseTempo: document.getElementById("increase-tempo"),
  increaseOptionCard: document.getElementById("increase-option-card"),
  increaseBy: document.getElementById("increase-by"),
  increaseAfter: document.getElementById("increase-after"),
  increaseProgressButton: document.getElementById("increase-progress-button"),
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
  reverseProgressButton: document.getElementById("reverse-progress-button"),
  tempoProgressDialog: document.getElementById("tempo-progress-dialog"),
  tempoProgressDialogTitle: document.getElementById("tempo-progress-dialog-title"),
  increaseProgressFields: document.getElementById("increase-progress-fields"),
  reverseProgressFields: document.getElementById("reverse-progress-fields"),
  progressDialogCancel: document.getElementById("progress-dialog-cancel"),
  progressDialogSave: document.getElementById("progress-dialog-save"),
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
  preTimersTitle: document.getElementById("pre-timers-title"),
  preTimersProgress: document.getElementById("pre-timers-progress"),
  preTimerCard: document.getElementById("pre-timer-card"),
  preTimerCardType: document.getElementById("pre-timer-card-type"),
  preTimerCardName: document.getElementById("pre-timer-card-name"),
  preTimerCardOptions: document.getElementById("pre-timer-card-options"),
  preTimerClock: document.getElementById("pre-timer-clock"),
  preTimerStatus: document.getElementById("pre-timer-status"),
  preTimerAbortButton: document.getElementById("pre-timer-abort-button"),
  preTimerContinueButton: document.getElementById("pre-timer-continue-button"),
  executionTitle: document.getElementById("execution-title"),
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
  stopButton: document.getElementById("stop-button"),
  reportTitle: document.getElementById("report-title"),
  reportStatus: document.getElementById("report-status"),
  reportTotalBeats: document.getElementById("report-total-beats"),
  reportBpm: document.getElementById("report-bpm"),
  reportBreaks: document.getElementById("report-breaks"),
  reportBreaksRow: document.getElementById("report-breaks-row"),
  reportSessionEnd: document.getElementById("report-session-end"),
  reportPreTimersCard: document.getElementById("report-pre-timers-card"),
  reportPreTimersList: document.getElementById("report-pre-timers-list"),
  reportBreaksTitle: document.getElementById("report-breaks-title"),
  reportNoBreaks: document.getElementById("report-no-breaks"),
  breakTableWrapper: document.getElementById("break-table-wrapper"),
  breakTableBody: document.getElementById("break-table-body"),
  breakRowTemplate: document.getElementById("break-row-template"),
  copyReportButton: document.getElementById("copy-report-button"),
  copyShortReportButton: document.getElementById("copy-short-report-button"),
  clipboardBuffer: document.getElementById("clipboard-buffer"),
  backButton: document.getElementById("back-button"),
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
  preTimerRecords: [],
  preTimerIndex: -1,
  preTimerStartedAt: null,
  preTimerTimer: null,
  preTimerDisplayTimer: null,
  preTimerReport: null,
  preTimerEarlyDialogOpen: false,
  report: null,
};

let audioContext = null;
const copyFeedbackTimers = new Map();
let progressDialogMode = null;
let progressDialogTrigger = null;
let progressDialogSnapshot = null;
let autoStartImportInProgress = false;
let lastAutoStartImportText = null;
let preTimerDefinitions = [];
let preTimerDialogMode = null;
let preTimerDialogEditingId = null;
let preTimerDialogTrigger = null;
let preTimerDialogNameGenerated = false;
let preTimerDeleteId = null;
let preTimerDeleteTrigger = null;
let preTimerAbortDialogTrigger = null;
let preTimerEarlyDialogTrigger = null;
let preTimerDragState = null;

const TEXT_SETTING_CONTROLS = Object.freeze({
  bpm: dom.bpm,
  "accent-repeat": dom.accentRepeat,
  "increase-by": dom.increaseBy,
  "increase-after": dom.increaseAfter,
  "maximum-limit-stick": dom.maximumLimitStick,
  "maximum-limit-reset": dom.maximumLimitReset,
  "maximum-limit-reverse": dom.maximumLimitReverse,
  "decrease-by-reverse": dom.decreaseByReverse,
  "decrease-after-reverse": dom.decreaseAfterReverse,
  "break-count": dom.breakCount,
  "break-seconds": dom.breakSeconds,
  "session-end-beats": dom.sessionEndBeats,
  "lock-beats": dom.lockBeats,
});

const BOOLEAN_SETTING_NAMES = Object.freeze([
  "accentuate",
  "increase-tempo",
  "session-end-enabled",
  "lock-settings",
]);

const RADIO_SETTING_VALUES = Object.freeze({
  maximum: new Set(["none", "stick", "reset", "reverse"]),
  breaks: new Set(["none", "unlimited", "limited"]),
});
const AUTO_START_PARAMETER = "auto-start";

function init() {
  if (Object.values(dom).some((element) => element === null)) {
    console.error("Metronome initialization failed because required markup is missing.");
    return;
  }

  renderPresets();
  renderPreTimerTable();
  const initialParameters = getInitialParameterText();
  if (initialParameters) {
    dom.settingsImport.value = initialParameters;
  }
  bindEvents();
  syncSettingsVisibility();
  showView("settings", false);
  dom.bpm.focus();
  if (initialParameters) {
    void handleSettingsImport(initialParameters);
  }
}

function bindEvents() {
  dom.settingsForm.addEventListener("submit", handleStart);
  dom.settingsImport.addEventListener("input", () => {
    void handleSettingsImport(dom.settingsImport.value);
  });
  dom.exportSettingsButton.addEventListener("click", () => {
    void handleExportSettings(
      "settings",
      dom.exportSettingsButton,
      "Nur Einstellungen kopieren",
    );
  });
  dom.exportUrlButton.addEventListener("click", () => {
    void handleExportSettings("url", dom.exportUrlButton, "Ganze URL kopieren");
  });
  dom.preTimerAddButton.addEventListener("click", () => {
    openPreTimerDialog();
  });
  dom.preTimerForm.addEventListener("submit", handlePreTimerDialogSave);
  dom.preTimerType.addEventListener("change", handlePreTimerTypeChange);
  dom.preTimerRounding.addEventListener("change", syncPreTimerDialogFields);
  dom.preTimerForm.addEventListener("input", (event) => {
    const control = event.target;
    if (control === dom.preTimerName) {
      preTimerDialogNameGenerated = false;
    }
    if (control instanceof HTMLInputElement || control instanceof HTMLSelectElement) {
      clearFieldError(control.id);
    }
  });
  dom.preTimerDialogCancel.addEventListener("click", () => {
    closePreTimerDialog(false);
  });
  dom.preTimerDialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    closePreTimerDialog(false);
  });
  dom.preTimerDeleteCancel.addEventListener("click", () => {
    closePreTimerDeleteDialog(false);
  });
  dom.preTimerDeleteConfirm.addEventListener("click", () => {
    confirmPreTimerDelete();
  });
  dom.preTimerDeleteDialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    closePreTimerDeleteDialog(false);
  });
  dom.preTimersTableBody.addEventListener("click", handlePreTimerTableClick);
  dom.preTimersTableBody.addEventListener("keydown", handlePreTimerTableKeydown);
  dom.preTimersTableBody.addEventListener("pointerdown", handlePreTimerPointerDown);
  dom.preTimersTableBody.addEventListener("pointermove", handlePreTimerPointerMove);
  dom.preTimersTableBody.addEventListener("pointerup", handlePreTimerPointerUp);
  dom.preTimersTableBody.addEventListener("pointercancel", handlePreTimerPointerCancel);
  dom.preTimersTableBody.addEventListener("dragstart", handlePreTimerDragStart);
  dom.preTimersTableBody.addEventListener("dragover", handlePreTimerDragOver);
  dom.preTimersTableBody.addEventListener("drop", handlePreTimerDrop);
  dom.preTimersTableBody.addEventListener("dragend", handlePreTimerDragEnd);
  dom.increaseProgressButton.addEventListener("click", () => {
    openProgressDialog("increase", dom.increaseProgressButton);
  });
  dom.reverseProgressButton.addEventListener("click", () => {
    openProgressDialog("reverse", dom.reverseProgressButton);
  });
  dom.progressDialogCancel.addEventListener("click", () => {
    closeProgressDialog(false);
  });
  dom.progressDialogSave.addEventListener("click", handleProgressDialogSave);
  dom.tempoProgressDialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeProgressDialog(false);
  });
  dom.tempoProgressDialog.addEventListener("input", (event) => {
    const control = event.target;
    if (control instanceof HTMLInputElement) {
      clearFieldError(control.id);
    }
  });
  dom.accentuate.addEventListener("change", syncSettingsVisibility);
  dom.increaseTempo.addEventListener("change", syncSettingsVisibility);
  dom.lockSettings.addEventListener("change", syncSettingsVisibility);
  dom.sessionEndEnabled.addEventListener("change", syncSettingsVisibility);
  dom.pauseButton.addEventListener("click", handlePause);
  dom.abortButton.addEventListener("click", handleAbort);
  dom.stopButton.addEventListener("click", handleStop);
  dom.preTimerContinueButton.addEventListener("click", handlePreTimerContinue);
  dom.preTimerAbortButton.addEventListener("click", handlePreTimerAbortRequest);
  dom.preTimerAbortCancel.addEventListener("click", () => {
    closePreTimerAbortDialog(false);
  });
  dom.preTimerAbortConfirm.addEventListener("click", () => {
    abortPreTimerRun();
  });
  dom.preTimerAbortDialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    closePreTimerAbortDialog(false);
  });
  dom.preTimerEarlyCancel.addEventListener("click", () => {
    closePreTimerEarlyDialog(false);
  });
  dom.preTimerEarlyConfirm.addEventListener("click", () => {
    finishPreTimer("manual");
  });
  dom.preTimerEarlyDialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    closePreTimerEarlyDialog(false);
  });
  dom.copyReportButton.addEventListener("click", handleCopyReport);
  dom.copyShortReportButton.addEventListener("click", handleCopyShortReport);
  dom.backButton.addEventListener("click", handleBackToSettings);

  document.querySelectorAll('input[name="maximum"]').forEach((input) => {
    input.addEventListener("change", syncSettingsVisibility);
  });

  document.querySelectorAll('input[name="breaks"]').forEach((input) => {
    input.addEventListener("change", syncSettingsVisibility);
  });

  dom.settingsForm.addEventListener("input", (event) => {
    const control = event.target;
    if (control === dom.settingsImport) {
      return;
    }
    if (control instanceof HTMLInputElement) {
      clearFieldError(control.id);
    }
    dom.settingsStatus.classList.remove("error-status");
    dom.settingsStatus.textContent = "";
  });
}

function syncSettingsVisibility() {
  const increaseEnabled = dom.increaseTempo.checked;
  const accentEnabled = dom.accentuate.checked;
  const lockEnabled = dom.lockSettings.checked;
  const maximum = getSelectedValue("maximum");
  const breaks = getSelectedValue("breaks");
  const hasStopwatch = preTimerDefinitions.some(
    (preTimer) => preTimer.type === PRE_TIMER_TYPES.STOPWATCH,
  );

  setOptionCardState(dom.accentOptionCard, accentEnabled);
  setOptionCardState(dom.increaseOptionCard, increaseEnabled);
  setControlDisabled(dom.accentRepeat, !accentEnabled);
  setControlDisabled(dom.increaseBy, !increaseEnabled);
  setControlDisabled(dom.increaseAfter, !increaseEnabled);

  const maximumInputs = document.querySelectorAll('input[name="maximum"]');
  maximumInputs.forEach((input) => {
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

  setOptionCardState(dom.lockOptionCard, lockEnabled && !hasStopwatch);
  setControlDisabled(dom.lockSettings, hasStopwatch);
  setControlDisabled(dom.lockBeats, hasStopwatch || !lockEnabled);

  setOptionCardState(dom.breaksNoneOption, breaks === "none");
  setOptionCardState(dom.breaksUnlimitedOption, breaks === "unlimited");
  setOptionCardState(dom.breaksLimitedOption, breaks === "limited");
  setControlDisabled(dom.breakCount, breaks !== "limited");
  setControlDisabled(dom.breakSeconds, breaks !== "limited");

  const sessionEndEnabled = dom.sessionEndEnabled.checked;
  setOptionCardState(dom.sessionEndOptionCard, sessionEndEnabled && !hasStopwatch);
  setControlDisabled(dom.sessionEndEnabled, hasStopwatch);
  setControlDisabled(dom.sessionEndBeats, hasStopwatch || !sessionEndEnabled);
  if (hasStopwatch) {
    dom.sessionEndOptionCard.setAttribute("aria-disabled", "true");
    dom.lockOptionCard.setAttribute("aria-disabled", "true");
  } else {
    dom.sessionEndOptionCard.removeAttribute("aria-disabled");
    dom.lockOptionCard.removeAttribute("aria-disabled");
  }
  setControlDisabled(dom.increaseProgressButton, !increaseEnabled);
  setControlDisabled(dom.reverseProgressButton, !increaseEnabled || maximum !== "reverse");
  updateProgressButtonLabels();
}

function renderPreTimerTable() {
  dom.preTimersTableBody.replaceChildren();
  const hasRows = preTimerDefinitions.length > 0;
  dom.preTimersEmptyMessage.hidden = hasRows;

  if (!hasRows) {
    return;
  }

  preTimerDefinitions.forEach((preTimer) => {
    const row = document.createElement("tr");
    row.className = "pre-timer-row";
    row.dataset.preTimerId = preTimer.id;

    const typeCell = document.createElement("td");
    typeCell.className = "pre-timer-type-cell";
    const dragHandle = document.createElement("button");
    dragHandle.className = "pre-timer-drag-handle";
    dragHandle.type = "button";
    dragHandle.draggable = true;
    dragHandle.dataset.action = "drag";
    dragHandle.dataset.preTimerId = preTimer.id;
    dragHandle.setAttribute(
      "aria-label",
      `"${preTimer.name}" in der Reihenfolge verschieben`,
    );
    dragHandle.title = "Vorlaufzeit verschieben";
    dragHandle.textContent = "⠿";
    const typeText = document.createElement("span");
    typeText.textContent = getPreTimerTypeLabel(preTimer.type);
    typeCell.append(dragHandle, typeText);

    const nameCell = document.createElement("td");
    nameCell.textContent = preTimer.name;

    const optionsCell = document.createElement("td");
    optionsCell.textContent = getPreTimerOptionsSummary(preTimer);

    const actionsCell = document.createElement("td");
    const editButton = createPreTimerIconButton(
      "edit",
      preTimer.id,
      "Vorlaufzeit bearbeiten",
      "✎",
    );
    const deleteButton = createPreTimerIconButton(
      "delete",
      preTimer.id,
      "Vorlaufzeit löschen",
      "×",
    );
    actionsCell.append(editButton, deleteButton);

    row.append(typeCell, nameCell, optionsCell, actionsCell);
    dom.preTimersTableBody.append(row);
  });
}

function createPreTimerIconButton(action, preTimerId, label, icon) {
  const button = document.createElement("button");
  button.className = "secondary-button icon-button";
  button.type = "button";
  button.dataset.action = action;
  button.dataset.preTimerId = preTimerId;
  button.setAttribute("aria-label", `${label}: ${getPreTimerById(preTimerId)?.name || ""}`);
  button.title = label;
  button.textContent = icon;
  return button;
}

function getPreTimerById(preTimerId) {
  return preTimerDefinitions.find((preTimer) => preTimer.id === preTimerId) || null;
}

function openPreTimerDialog(preTimerId = null, trigger = dom.preTimerAddButton) {
  if (
    dom.preTimerDialog.open ||
    typeof dom.preTimerDialog.showModal !== "function"
  ) {
    return;
  }

  const existing = preTimerId ? getPreTimerById(preTimerId) : null;
  const draft = existing ? clonePreTimers([existing])[0] : createDefaultPreTimer();
  preTimerDialogMode = existing ? "edit" : "add";
  preTimerDialogEditingId = existing?.id || null;
  preTimerDialogTrigger = trigger;
  preTimerDialogNameGenerated =
    draft.name === getPreTimerDefaultName(draft.type);
  dom.preTimerDialogTitle.textContent = existing
    ? "Vorlaufzeit bearbeiten"
    : "Vorlaufzeit hinzufügen";
  dom.preTimerName.value = draft.name;
  dom.preTimerType.value = draft.type;
  dom.preTimerSeconds.value =
    draft.type === PRE_TIMER_TYPES.SECONDS ? String(draft.seconds) : "10";
  dom.preTimerFormula.value =
    draft.type === PRE_TIMER_TYPES.STOPWATCH ? draft.formula : "sekunden";
  dom.preTimerRounding.value =
    draft.type === PRE_TIMER_TYPES.STOPWATCH
      ? draft.rounding
      : PRE_TIMER_ROUNDING.FLOOR;
  dom.preTimerRoundingThreshold.value =
    draft.type === PRE_TIMER_TYPES.STOPWATCH &&
    draft.roundingThreshold !== null
      ? String(draft.roundingThreshold)
      : "";
  dom.preTimerLimitSeconds.value =
    draft.type === PRE_TIMER_TYPES.MANUAL && draft.limitSeconds !== null
      ? String(draft.limitSeconds)
      : "";
  clearPreTimerDialogErrors();
  syncPreTimerDialogFields();
  dom.preTimerDialog.showModal();
  dom.preTimerName.focus();
}

function handlePreTimerTypeChange() {
  if (preTimerDialogNameGenerated) {
    dom.preTimerName.value = getPreTimerDefaultName(dom.preTimerType.value);
  }
  syncPreTimerDialogFields();
}

function syncPreTimerDialogFields() {
  const type = dom.preTimerType.value;
  const isSeconds = type === PRE_TIMER_TYPES.SECONDS;
  const isStopwatch = type === PRE_TIMER_TYPES.STOPWATCH;
  const isManual = type === PRE_TIMER_TYPES.MANUAL;
  const isRound = dom.preTimerRounding.value === PRE_TIMER_ROUNDING.ROUND;

  dom.preTimerSecondsFields.hidden = !isSeconds;
  dom.preTimerStopwatchFields.hidden = !isStopwatch;
  dom.preTimerManualFields.hidden = !isManual;
  dom.preTimerRoundingThresholdField.hidden = !isStopwatch || !isRound;
  dom.preTimerSeconds.disabled = !isSeconds;
  dom.preTimerFormula.disabled = !isStopwatch;
  dom.preTimerRounding.disabled = !isStopwatch;
  dom.preTimerRoundingThreshold.disabled = !isStopwatch || !isRound;
  dom.preTimerLimitSeconds.disabled = !isManual;
}

function handlePreTimerDialogSave(event) {
  event.preventDefault();
  const validation = validatePreTimerDialog();
  if (!validation.valid) {
    validation.firstInvalid?.focus();
    return;
  }

  if (preTimerDialogMode === "edit") {
    const index = preTimerDefinitions.findIndex(
      (preTimer) => preTimer.id === preTimerDialogEditingId,
    );
    if (index >= 0) {
      preTimerDefinitions[index] = validation.value;
    }
  } else {
    preTimerDefinitions.push(validation.value);
  }

  renderPreTimerTable();
  syncSettingsVisibility();
  clearFieldError("pre-timers");
  closePreTimerDialog(true);
}

function validatePreTimerDialog() {
  clearPreTimerDialogErrors();
  const type = dom.preTimerType.value;
  const rawValue = {
    id: preTimerDialogEditingId || undefined,
    type,
    name: dom.preTimerName.value,
    seconds: dom.preTimerSeconds.value,
    formula: dom.preTimerFormula.value,
    rounding: dom.preTimerRounding.value,
    roundingThreshold: dom.preTimerRoundingThreshold.value,
    limitSeconds: dom.preTimerLimitSeconds.value,
  };
  const normalized = normalizePreTimerDefinition(rawValue);
  let firstInvalid = null;

  Object.entries(normalized.errors).forEach(([field, message]) => {
    const fieldId = getPreTimerDialogFieldId(field);
    setFieldError(fieldId, message);
    if (!firstInvalid) {
      firstInvalid = document.getElementById(fieldId);
    }
  });

  if (normalized.valid) {
    const normalizedName = normalized.value.name.toLocaleLowerCase();
    const duplicate = preTimerDefinitions.find(
      (preTimer) =>
        preTimer.id !== preTimerDialogEditingId &&
        preTimer.name.toLocaleLowerCase() === normalizedName,
    );
    if (duplicate) {
      setFieldError(
        "pre-timer-name",
        `Der Name "${duplicate.name}" ist bereits vergeben.`,
      );
      firstInvalid = firstInvalid || dom.preTimerName;
      normalized.valid = false;
    }
  }

  return {
    valid: normalized.valid,
    value: normalized.value,
    firstInvalid,
  };
}

function getPreTimerDialogFieldId(field) {
  const ids = {
    type: "pre-timer-type",
    name: "pre-timer-name",
    seconds: "pre-timer-seconds",
    formula: "pre-timer-formula",
    rounding: "pre-timer-rounding",
    roundingThreshold: "pre-timer-rounding-threshold",
    limitSeconds: "pre-timer-limit-seconds",
  };
  return ids[field] || "pre-timer-name";
}

function clearPreTimerDialogErrors() {
  [
    "pre-timer-name",
    "pre-timer-type",
    "pre-timer-seconds",
    "pre-timer-formula",
    "pre-timer-rounding",
    "pre-timer-rounding-threshold",
    "pre-timer-limit-seconds",
  ].forEach((fieldId) => clearFieldError(fieldId));
}

function closePreTimerDialog(saveChanges) {
  if (!preTimerDialogMode) {
    return;
  }
  dom.preTimerDialog.close();
  const trigger = preTimerDialogTrigger;
  preTimerDialogMode = null;
  preTimerDialogEditingId = null;
  preTimerDialogTrigger = null;
  preTimerDialogNameGenerated = false;
  if (!saveChanges) {
    trigger?.focus();
  } else {
    dom.preTimerAddButton.focus();
  }
}

function handlePreTimerTableClick(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) {
    return;
  }
  const preTimerId = button.dataset.preTimerId;
  if (!preTimerId) {
    return;
  }
  if (button.dataset.action === "edit") {
    openPreTimerDialog(preTimerId, button);
  } else if (button.dataset.action === "delete") {
    openPreTimerDeleteDialog(preTimerId, button);
  }
}

function handlePreTimerTableKeydown(event) {
  const handle = event.target.closest(".pre-timer-drag-handle");
  if (!handle || !event.altKey) {
    return;
  }
  if (event.key !== "ArrowUp" && event.key !== "ArrowDown") {
    return;
  }

  const preTimerId = handle.dataset.preTimerId;
  const index = preTimerDefinitions.findIndex(
    (preTimer) => preTimer.id === preTimerId,
  );
  const targetIndex = event.key === "ArrowUp" ? index - 1 : index + 1;
  if (index < 0 || targetIndex < 0 || targetIndex >= preTimerDefinitions.length) {
    return;
  }

  event.preventDefault();
  const [moved] = preTimerDefinitions.splice(index, 1);
  preTimerDefinitions.splice(targetIndex, 0, moved);
  renderPreTimerTable();
  Array.from(
    dom.preTimersTableBody.querySelectorAll(".pre-timer-drag-handle"),
  )
    .find((candidate) => candidate.dataset.preTimerId === preTimerId)
    ?.focus();
}

function handlePreTimerPointerDown(event) {
  const handle = event.target.closest(".pre-timer-drag-handle");
  if (!handle) {
    return;
  }
  const row = handle.closest("tr[data-pre-timer-id]");
  if (!row) {
    return;
  }
  preTimerDragState = {
    id: row.dataset.preTimerId,
    pointerId: event.pointerId,
    startY: event.clientY,
    dragging: false,
  };
  handle.setPointerCapture?.(event.pointerId);
}

function handlePreTimerPointerMove(event) {
  if (
    !preTimerDragState ||
    preTimerDragState.pointerId !== event.pointerId
  ) {
    return;
  }
  if (!preTimerDragState.dragging) {
    if (Math.abs(event.clientY - preTimerDragState.startY) < 8) {
      return;
    }
    preTimerDragState.dragging = true;
    getPreTimerRowElement(preTimerDragState.id)?.classList.add("is-dragging");
  }
  event.preventDefault();
  updatePreTimerDropTarget(event.clientX, event.clientY);
}

function handlePreTimerPointerUp(event) {
  if (
    !preTimerDragState ||
    preTimerDragState.pointerId !== event.pointerId
  ) {
    return;
  }
  if (preTimerDragState.dragging) {
    const target = getPreTimerDropTarget(event.clientX, event.clientY);
    movePreTimerDefinitionByDrop(preTimerDragState.id, target);
  }
  clearPreTimerDragState();
}

function handlePreTimerPointerCancel(event) {
  if (preTimerDragState?.pointerId === event.pointerId) {
    clearPreTimerDragState();
  }
}

function handlePreTimerDragStart(event) {
  const handle = event.target.closest(".pre-timer-drag-handle");
  const row = handle?.closest("tr[data-pre-timer-id]");
  if (!row) {
    return;
  }
  preTimerDragState = {
    id: row.dataset.preTimerId,
    pointerId: null,
    startY: event.clientY,
    dragging: true,
  };
  row.classList.add("is-dragging");
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", row.dataset.preTimerId);
}

function handlePreTimerDragOver(event) {
  if (!preTimerDragState?.dragging) {
    return;
  }
  const row = event.target.closest("tr[data-pre-timer-id]");
  if (!row) {
    return;
  }
  event.preventDefault();
  updatePreTimerDropTarget(event.clientX, event.clientY);
}

function handlePreTimerDrop(event) {
  if (!preTimerDragState?.dragging) {
    return;
  }
  event.preventDefault();
  const target = getPreTimerDropTarget(event.clientX, event.clientY);
  movePreTimerDefinitionByDrop(preTimerDragState.id, target);
  clearPreTimerDragState();
}

function handlePreTimerDragEnd() {
  clearPreTimerDragState();
}

function updatePreTimerDropTarget(clientX, clientY) {
  document.querySelectorAll(".pre-timer-row.is-drop-target").forEach((row) => {
    row.classList.remove("is-drop-target");
  });
  const target = getPreTimerDropTarget(clientX, clientY);
  if (target?.row) {
    target.row.classList.add("is-drop-target");
  }
}

function getPreTimerDropTarget(clientX, clientY) {
  const element = document.elementFromPoint(clientX, clientY);
  const row = element?.closest?.("tr[data-pre-timer-id]");
  if (!row) {
    return null;
  }
  const bounds = row.getBoundingClientRect();
  return {
    row,
    id: row.dataset.preTimerId,
    before: clientY < bounds.top + bounds.height / 2,
  };
}

function movePreTimerDefinitionByDrop(preTimerId, target) {
  if (!target || preTimerId === target.id) {
    return;
  }
  const sourceIndex = preTimerDefinitions.findIndex(
    (preTimer) => preTimer.id === preTimerId,
  );
  const targetIndex = preTimerDefinitions.findIndex(
    (preTimer) => preTimer.id === target.id,
  );
  if (sourceIndex < 0 || targetIndex < 0) {
    return;
  }

  const [moved] = preTimerDefinitions.splice(sourceIndex, 1);
  let insertionIndex = targetIndex;
  if (sourceIndex < targetIndex) {
    insertionIndex -= 1;
  }
  if (!target.before) {
    insertionIndex += 1;
  }
  preTimerDefinitions.splice(Math.max(0, insertionIndex), 0, moved);
  renderPreTimerTable();
}

function clearPreTimerDragState() {
  document.querySelectorAll(".pre-timer-row.is-dragging, .pre-timer-row.is-drop-target").forEach(
    (row) => {
      row.classList.remove("is-dragging", "is-drop-target");
    },
  );
  preTimerDragState = null;
}

function openPreTimerDeleteDialog(preTimerId, trigger) {
  if (
    dom.preTimerDeleteDialog.open ||
    typeof dom.preTimerDeleteDialog.showModal !== "function"
  ) {
    return;
  }
  const preTimer = getPreTimerById(preTimerId);
  if (!preTimer) {
    return;
  }
  preTimerDeleteId = preTimerId;
  preTimerDeleteTrigger = trigger;
  dom.preTimerDeleteDialogMessage.textContent =
    `"${preTimer.name}" (${getPreTimerTypeLabel(preTimer.type)}) wirklich löschen?`;
  dom.preTimerDeleteDialog.showModal();
  dom.preTimerDeleteConfirm.focus();
}

function confirmPreTimerDelete() {
  if (!preTimerDeleteId) {
    return;
  }
  preTimerDefinitions = preTimerDefinitions.filter(
    (preTimer) => preTimer.id !== preTimerDeleteId,
  );
  renderPreTimerTable();
  syncSettingsVisibility();
  clearFieldError("pre-timers");
  closePreTimerDeleteDialog(true);
}

function closePreTimerDeleteDialog(saveChanges) {
  if (!preTimerDeleteId) {
    return;
  }
  dom.preTimerDeleteDialog.close();
  const trigger = preTimerDeleteTrigger;
  preTimerDeleteId = null;
  preTimerDeleteTrigger = null;
  if (!saveChanges) {
    trigger?.focus();
  } else {
    dom.preTimerAddButton.focus();
  }
}

function updateProgressButtonLabels() {
  dom.increaseProgressButton.textContent = formatProgressSummary(
    dom.increaseBy.value,
    dom.increaseAfter.value,
  );
  dom.reverseProgressButton.textContent = formatProgressSummary(
    dom.decreaseByReverse.value,
    dom.decreaseAfterReverse.value,
  );
}

function formatProgressSummary(amount, interval) {
  const amountText = String(amount).trim() || "?";
  const intervalText = String(interval).trim() || "?";
  return `um ${amountText} BPM alle ${intervalText} Beats`;
}

function openProgressDialog(mode, trigger) {
  if (dom.tempoProgressDialog.open || typeof dom.tempoProgressDialog.showModal !== "function") {
    return;
  }

  progressDialogMode = mode;
  progressDialogTrigger = trigger;
  progressDialogSnapshot = {
    increaseBy: dom.increaseBy.value,
    increaseAfter: dom.increaseAfter.value,
    decreaseByReverse: dom.decreaseByReverse.value,
    decreaseAfterReverse: dom.decreaseAfterReverse.value,
  };

  const isIncrease = mode === "increase";
  dom.tempoProgressDialogTitle.textContent = isIncrease
    ? "Tempodynamik erhöhen"
    : "Umkehr-Tempodynamik festlegen";
  dom.increaseProgressFields.hidden = !isIncrease;
  dom.reverseProgressFields.hidden = isIncrease;
  clearProgressDialogErrors();
  dom.tempoProgressDialog.showModal();
  (isIncrease ? dom.increaseBy : dom.decreaseByReverse).focus();
}

function handleProgressDialogSave() {
  if (!progressDialogMode) {
    return;
  }

  const validation = validateProgressDialog(progressDialogMode);
  if (!validation.valid) {
    validation.firstInvalid?.focus();
    return;
  }

  closeProgressDialog(true);
}

function validateProgressDialog(mode) {
  clearProgressDialogErrors();
  const fields =
    mode === "increase"
      ? {
          amount: dom.increaseBy,
          interval: dom.increaseAfter,
          amountMessage: "Ganze Zahl von 1 bis 20 eingeben.",
          intervalMessage: "Positive ganze Zahl eingeben.",
        }
      : {
          amount: dom.decreaseByReverse,
          interval: dom.decreaseAfterReverse,
          amountMessage: "Ganze Zahl von 1 bis 50 eingeben.",
          intervalMessage: "Positive ganze Zahl eingeben.",
        };
  let firstInvalid = null;
  let valid = true;

  const markInvalid = (control, message) => {
    valid = false;
    setFieldError(control.id, message);
    if (!firstInvalid) {
      firstInvalid = control;
    }
  };

  const amountValid =
    mode === "increase"
      ? parseIntegerField(fields.amount.value, 1, 20) !== null
      : parseIntegerField(fields.amount.value, 1, 50) !== null;
  if (!amountValid) {
    markInvalid(fields.amount, fields.amountMessage);
  }

  if (parsePositiveInteger(fields.interval.value, Number.POSITIVE_INFINITY) === null) {
    markInvalid(fields.interval, fields.intervalMessage);
  }

  return { valid, firstInvalid };
}

function clearProgressDialogErrors() {
  [
    dom.increaseBy,
    dom.increaseAfter,
    dom.decreaseByReverse,
    dom.decreaseAfterReverse,
  ].forEach((control) => clearFieldError(control.id));
}

function closeProgressDialog(saveChanges) {
  if (!progressDialogMode) {
    return;
  }

  if (!saveChanges && progressDialogSnapshot) {
    dom.increaseBy.value = progressDialogSnapshot.increaseBy;
    dom.increaseAfter.value = progressDialogSnapshot.increaseAfter;
    dom.decreaseByReverse.value = progressDialogSnapshot.decreaseByReverse;
    dom.decreaseAfterReverse.value = progressDialogSnapshot.decreaseAfterReverse;
  }

  clearProgressDialogErrors();
  dom.tempoProgressDialog.close();
  const trigger = progressDialogTrigger;
  progressDialogMode = null;
  progressDialogTrigger = null;
  progressDialogSnapshot = null;
  updateProgressButtonLabels();
  trigger?.focus();
}

function renderPresets() {
  const presets = window.METRONOME_PRESETS;
  if (!presets || typeof presets !== "object") {
    console.error("Metronome presets are unavailable.");
    dom.settingsStatus.textContent = "Voreinstellungen konnten nicht geladen werden.";
    return;
  }

  dom.presetList.replaceChildren(dom.settingsImportWrapper);
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
    dom.settingsStatus.classList.add("error-status");
    dom.settingsStatus.textContent = invalidPresetMessages.join(" ");
  }

  if (!addedPreset) {
    console.error("No valid metronome presets are configured.");
    if (invalidPresetMessages.length === 0) {
      dom.settingsStatus.textContent = "Keine gültigen Voreinstellungen verfügbar.";
    }
  }
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
  if (
    Object.prototype.hasOwnProperty.call(preset, "autoStart") &&
    typeof preset.autoStart !== "boolean"
  ) {
    return "autoStart muss ein Boolean sein.";
  }
  if (Object.prototype.hasOwnProperty.call(preset.values, "preTimers")) {
    const validation = validatePreTimerRows(preset.values.preTimers);
    if (!validation.valid) {
      return validation.errors[0]?.message || "Vorlaufzeiten sind ungültig.";
    }
  }
  return null;
}

function getInitialParameterText() {
  if (typeof window === "undefined" || !window.location?.search) {
    return "";
  }
  return window.location.search.slice(1);
}

function serializeSettings(includeAutoStart) {
  const parameters = new URLSearchParams();
  parameters.set("bpm", dom.bpm.value.trim());
  parameters.set("accentuate", String(dom.accentuate.checked));
  parameters.set("accent-repeat", dom.accentRepeat.value.trim());
  parameters.set("increase-tempo", String(dom.increaseTempo.checked));
  parameters.set("increase-by", dom.increaseBy.value.trim());
  parameters.set("increase-after", dom.increaseAfter.value.trim());
  parameters.set("maximum", getSelectedValue("maximum") || "");
  parameters.set("maximum-limit-stick", dom.maximumLimitStick.value.trim());
  parameters.set("maximum-limit-reset", dom.maximumLimitReset.value.trim());
  parameters.set("maximum-limit-reverse", dom.maximumLimitReverse.value.trim());
  parameters.set("decrease-by-reverse", dom.decreaseByReverse.value.trim());
  parameters.set("decrease-after-reverse", dom.decreaseAfterReverse.value.trim());
  parameters.set("breaks", getSelectedValue("breaks") || "");
  parameters.set("break-count", dom.breakCount.value.trim());
  parameters.set("break-seconds", dom.breakSeconds.value.trim());
  parameters.set("session-end-enabled", String(dom.sessionEndEnabled.checked));
  parameters.set("session-end-beats", dom.sessionEndBeats.value.trim());
  parameters.set("lock-settings", String(dom.lockSettings.checked));
  parameters.set("lock-beats", dom.lockBeats.value.trim());
  if (preTimerDefinitions.length > 0) {
    parameters.set("pre-timers", serializePreTimerPayload(preTimerDefinitions));
  }
  if (includeAutoStart) {
    parameters.set(AUTO_START_PARAMETER, "true");
  }
  return parameters.toString();
}

async function handleExportSettings(format, button, defaultLabel) {
  const parameterList = serializeSettings(dom.exportAutoStart.checked);
  const text =
    format === "url" ? buildSettingsUrl(parameterList) : parameterList;

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
  url.search = parameterList ? `?${parameterList}` : "";
  return url.toString();
}

async function handleSettingsImport(parameterText) {
  const rawText = String(parameterText).trim();
  clearFieldError("settings-import");
  dom.settingsStatus.classList.remove("error-status");
  dom.settingsStatus.textContent = "";

  if (!rawText) {
    lastAutoStartImportText = null;
    return;
  }

  const parsed = parseSettingsParameters(rawText);
  if (!parsed.valid) {
    lastAutoStartImportText = null;
    if (parsed.autoStartProvided) {
      showAutoStartImportError(
        parsed.parseError || "Die Auto-Start-URL konnte nicht gelesen werden.",
      );
    }
    return;
  }

  if (parsed.preTimersError) {
    lastAutoStartImportText = null;
    showPreTimerImportError(parsed.preTimersError);
    return;
  }

  parsed.values.preTimers = parsed.preTimersProvided ? parsed.values.preTimers : [];
  applySettingsParameters(parsed.values);
  syncSettingsVisibility();

  if (!parsed.autoStartProvided || parsed.autoStart === false) {
    lastAutoStartImportText = null;
    return;
  }

  if (parsed.autoStart === null) {
    lastAutoStartImportText = null;
    if (parsed.invalidSettings.length > 0) {
      showAutoStartImportErrors(
        parsed.invalidSettings,
        `Auto-Start wurde nicht ausgeführt. ${parsed.autoStartError}`,
      );
    } else {
      showAutoStartImportError(parsed.autoStartError);
      dom.settingsImport.focus();
    }
    return;
  }

  if (!parsed.foundSettings) {
    lastAutoStartImportText = null;
    showAutoStartImportError(
      "Für Auto-Start müssen gültige Einstellungen angegeben werden.",
    );
    dom.settingsImport.focus();
    return;
  }

  if (!parsed.foundBpm) {
    lastAutoStartImportText = null;
    showAutoStartImportError(
      "Für Auto-Start muss ein gültiger BPM-Wert angegeben werden.",
    );
    dom.settingsImport.focus();
    return;
  }

  if (parsed.invalidSettings.length > 0) {
    lastAutoStartImportText = null;
    showAutoStartImportErrors(parsed.invalidSettings);
    return;
  }

  if (lastAutoStartImportText === rawText || autoStartImportInProgress) {
    return;
  }

  lastAutoStartImportText = rawText;
  autoStartImportInProgress = true;
  try {
    await startConfiguredSession();
  } finally {
    autoStartImportInProgress = false;
  }
}

function parseSettingsParameters(rawText) {
  let parameterText = rawText.trim();
  if (parameterText.startsWith("?")) {
    parameterText = parameterText.slice(1);
  } else if (/^[a-z][a-z\d+.-]*:\/\//i.test(parameterText)) {
    try {
      const baseUrl =
        typeof window !== "undefined" && window.location?.href
          ? window.location.href
          : "http://localhost/";
      parameterText = new URL(parameterText, baseUrl).search.slice(1);
    } catch {
      return {
        valid: false,
        foundSettings: false,
        autoStartProvided: rawText.includes(`${AUTO_START_PARAMETER}=`),
        parseError: "Die importierte URL ist ungültig.",
      };
    }
  }

  let parameters;
  try {
    parameters = new URLSearchParams(parameterText);
  } catch {
    return {
      valid: false,
      foundSettings: false,
      autoStartProvided: parameterText.includes(`${AUTO_START_PARAMETER}=`),
      parseError: "Die importierten Einstellungen konnten nicht gelesen werden.",
    };
  }

  const values = {};
  const invalidSettings = [];
  let foundSettings = false;
  const foundBpm = parameters.has("bpm");

  Object.keys(TEXT_SETTING_CONTROLS).forEach((name) => {
    if (parameters.has(name)) {
      foundSettings = true;
      const importedValue = getValidTextSettingValue(name, parameters.get(name));
      if (importedValue.valid) {
        values[name] = importedValue.value;
      } else {
        invalidSettings.push({
          name,
          message: importedValue.message,
        });
      }
    }
  });

  BOOLEAN_SETTING_NAMES.forEach((name) => {
    if (!parameters.has(name)) {
      return;
    }
    foundSettings = true;
    const parsed = parseBooleanParameter(parameters.get(name));
    if (parsed !== null) {
      values[name] = parsed;
    } else {
      invalidSettings.push({
        name,
        message: "true, false, 1 oder 0 eingeben.",
      });
    }
  });

  Object.entries(RADIO_SETTING_VALUES).forEach(([name, allowedValues]) => {
    if (!parameters.has(name)) {
      return;
    }
    foundSettings = true;
    const value = parameters.get(name);
    if (allowedValues.has(value)) {
      values[name] = value;
    } else {
      invalidSettings.push({
        name,
        message: "Ungültige Auswahl importiert.",
      });
    }
  });

  const preTimersProvided = parameters.has("pre-timers");
  let preTimersError = null;
  if (preTimersProvided) {
    foundSettings = true;
    const parsedPreTimers = deserializePreTimerPayload(parameters.get("pre-timers"));
    if (parsedPreTimers.valid) {
      values.preTimers = parsedPreTimers.rows;
    } else {
      preTimersError = parsedPreTimers.error;
    }
  }

  const autoStartProvided = parameters.has(AUTO_START_PARAMETER);
  const parsedAutoStart = autoStartProvided
    ? parseBooleanParameter(parameters.get(AUTO_START_PARAMETER))
    : false;

  if (autoStartProvided && parsedAutoStart === null) {
    return {
      valid: true,
      foundSettings,
      values,
      invalidSettings,
      foundBpm,
      preTimersProvided,
      preTimersError,
      autoStartProvided: true,
      autoStart: null,
      autoStartError: "Auto-Start muss true, false, 1 oder 0 sein.",
    };
  }

  return {
    valid: true,
    foundSettings,
    values,
    invalidSettings,
    foundBpm,
    preTimersProvided,
    preTimersError,
    autoStartProvided,
    autoStart: parsedAutoStart,
  };
}

function getValidTextSettingValue(name, rawValue) {
  const value = String(rawValue ?? "").trim();
  let valid = false;
  let message = "Ungültigen Wert eingeben.";

  switch (name) {
    case "bpm":
      valid = parseIntegerField(value, 20, 300) !== null;
      message = "Ganze BPM-Zahl von 20 bis 300 eingeben.";
      break;
    case "accent-repeat":
    case "increase-after":
    case "decrease-after-reverse":
    case "session-end-beats":
    case "lock-beats":
      valid = parsePositiveInteger(value, Number.POSITIVE_INFINITY) !== null;
      message = "Positive ganze Zahl eingeben.";
      break;
    case "increase-by":
      valid = parseIntegerField(value, 1, 20) !== null;
      message = "Ganze Zahl von 1 bis 20 eingeben.";
      break;
    case "maximum-limit-stick":
    case "maximum-limit-reset":
    case "maximum-limit-reverse":
      valid = parseIntegerField(value, 60, 400) !== null;
      message = "Ganzzahliges Limit von 60 bis 400 eingeben.";
      break;
    case "decrease-by-reverse":
      valid = parseIntegerField(value, 1, 50) !== null;
      message = "Ganze Zahl von 1 bis 50 eingeben.";
      break;
    case "break-count":
      valid = value === "" || parsePositiveInteger(value, Number.POSITIVE_INFINITY) !== null;
      message = "Positive ganze Zahl eingeben oder leer lassen.";
      break;
    case "break-seconds":
      if (value === "") {
        valid = true;
      } else {
        const parsedBreakInput = parseBreakInput(value);
        valid = parsedBreakInput.valid;
        message = parsedBreakInput.error;
      }
      break;
    default:
      break;
  }

  return { valid, value, message };
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

function applySettingsParameters(values) {
  if (Object.prototype.hasOwnProperty.call(values, "preTimers")) {
    preTimerDefinitions = clonePreTimers(values.preTimers);
    renderPreTimerTable();
  }

  Object.entries(TEXT_SETTING_CONTROLS).forEach(([name, control]) => {
    if (Object.prototype.hasOwnProperty.call(values, name)) {
      control.value = values[name] ?? "";
    }
  });

  BOOLEAN_SETTING_NAMES.forEach((name) => {
    if (!Object.prototype.hasOwnProperty.call(values, name)) {
      return;
    }
    const control = document.querySelector(`input[name="${name}"]`);
    if (control) {
      control.checked = values[name];
    }
  });

  if (Object.prototype.hasOwnProperty.call(values, "maximum")) {
    setSelectedValue("maximum", values.maximum);
  }
  if (Object.prototype.hasOwnProperty.call(values, "breaks")) {
    setSelectedValue("breaks", values.breaks);
  }
}

function showAutoStartImportErrors(
  invalidSettings,
  message = "Auto-Start wurde nicht ausgeführt. Bitte markierte Einstellungen korrigieren.",
) {
  clearAllFieldErrors();
  invalidSettings.forEach(({ name, message }) => {
    setFieldError(name, message);
  });
  showAutoStartImportError(message);
  getErrorTarget(invalidSettings[0].name)?.focus();
}

function showAutoStartImportError(message) {
  setFieldError("settings-import", message);
  dom.settingsStatus.classList.add("error-status");
  dom.settingsStatus.textContent = message;
}

function showPreTimerImportError(message) {
  setFieldError("pre-timers", message);
  dom.settingsStatus.classList.add("error-status");
  dom.settingsStatus.textContent = message;
}

async function handleStart(event) {
  event.preventDefault();
  await startConfiguredSession();
}

async function handlePresetClick(preset) {
  clearAllFieldErrors();
  dom.settingsStatus.classList.remove("error-status");
  dom.settingsStatus.textContent = "";
  lastAutoStartImportText = null;
  applyPreset(preset.values);
  syncSettingsVisibility();
  if (preset.autoStart === true) {
    await startConfiguredSession();
  }
}

function applyPreset(values) {
  const setInputValue = (control, value) => {
    control.value = value === null || value === undefined ? "" : String(value);
  };

  setInputValue(dom.bpm, values.bpm);
  dom.accentuate.checked = Boolean(values.accentuate);
  setInputValue(dom.accentRepeat, values.accentRepeat);
  dom.increaseTempo.checked = Boolean(values.increaseTempo);
  setInputValue(dom.increaseBy, values.increaseBy);
  setInputValue(dom.increaseAfter, values.increaseAfter);
  setSelectedValue("maximum", values.maximum);
  setInputValue(dom.maximumLimitStick, values.maximumLimit);
  setInputValue(dom.maximumLimitReset, values.maximumLimit);
  setInputValue(dom.maximumLimitReverse, values.maximumLimit);
  setInputValue(dom.decreaseByReverse, values.decreaseBy);
  setInputValue(dom.decreaseAfterReverse, values.decreaseAfter);
  setSelectedValue("breaks", values.breaks);
  setInputValue(dom.breakCount, values.breakCount);
  setInputValue(dom.breakSeconds, values.breakSeconds);
  preTimerDefinitions = clonePreTimers(values.preTimers);
  renderPreTimerTable();
  dom.sessionEndEnabled.checked = Boolean(values.sessionEndEnabled);
  setInputValue(dom.sessionEndBeats, values.sessionEndBeats);
  dom.lockSettings.checked = Boolean(values.lockSettings);
  setInputValue(dom.lockBeats, values.lockBeats);
}

async function startConfiguredSession() {
  const validation = validateSettings();
  if (!validation.valid) {
    dom.settingsStatus.textContent = "Bitte markierte Einstellungen korrigieren.";
    validation.firstInvalid?.focus();
    return;
  }

  try {
    await ensureAudioReady();
  } catch (error) {
    dom.settingsStatus.textContent = getErrorMessage(
      error,
      "Audio konnte nicht initialisiert werden. Audio-Berechtigung des Browsers prüfen und erneut versuchen.",
    );
    return;
  }

  dom.settingsStatus.textContent = "";
  if (validation.settings.preTimers.length > 0) {
    startPreTimerRun(validation.settings);
  } else {
    startRun(validation.settings);
  }
}

function validateSettings() {
  clearAllFieldErrors();
  let firstInvalid = null;
  let valid = true;

  const markInvalid = (fieldId, message) => {
    valid = false;
    setFieldError(fieldId, message);
    if (!firstInvalid) {
      firstInvalid = getErrorTarget(fieldId);
    }
  };

  const preTimerValidation = validatePreTimerRows(preTimerDefinitions);
  if (!preTimerValidation.valid) {
    markInvalid(
      "pre-timers",
      preTimerValidation.errors[0]?.message || "Vorlaufzeiten korrigieren.",
    );
  }
  const hasStopwatch = preTimerDefinitions.some(
    (preTimer) => preTimer.type === PRE_TIMER_TYPES.STOPWATCH,
  );

  const bpm = parseIntegerField(dom.bpm.value, 20, 300);
  if (bpm === null) {
    markInvalid("bpm", "Ganze BPM-Zahl von 20 bis 300 eingeben.");
  }

  let accentRepeat = DEFAULTS.accentRepeat;
  if (dom.accentuate.checked) {
    accentRepeat = parsePositiveInteger(dom.accentRepeat.value, Number.POSITIVE_INFINITY);
    if (accentRepeat === null) {
      markInvalid("accent-repeat", "Positive ganze Zahl eingeben.");
    }
  }

  const increaseTempo = dom.increaseTempo.checked;
  let increaseBy = DEFAULTS.increaseBy;
  let increaseAfter = DEFAULTS.increaseAfter;
  let maximum = getSelectedValue("maximum") || DEFAULTS.maximum;
  let maximumLimit = DEFAULTS.maximumLimit;
  let decreaseBy = DEFAULTS.decreaseBy;
  let decreaseAfter = DEFAULTS.decreaseAfter;
  let lockSettings = false;
  let lockBeats = DEFAULTS.lockBeats;

  if (increaseTempo) {
    increaseBy = parseIntegerField(dom.increaseBy.value, 1, 20);
    if (increaseBy === null) {
      markInvalid("increase-by", "Ganze Zahl von 1 bis 20 eingeben.");
    }

    increaseAfter = parsePositiveInteger(dom.increaseAfter.value, Number.POSITIVE_INFINITY);
    if (increaseAfter === null) {
      markInvalid("increase-after", "Positive ganze Zahl eingeben.");
    }

    if (maximum !== "none") {
      const maximumControls = getMaximumControls(maximum);
      maximumLimit = parseIntegerField(maximumControls.limit.value, 60, 400);
      if (maximumLimit === null) {
        markInvalid(
          maximumControls.limit.id,
          "Ganzzahliges Limit von 60 bis 400 eingeben.",
        );
      } else if (bpm !== null && maximumLimit <= bpm) {
        markInvalid(
          maximumControls.limit.id,
          "Das Limit muss über dem Startwert liegen.",
        );
      }

      if (maximum === "reverse") {
        decreaseBy = parseIntegerField(maximumControls.decreaseBy.value, 1, 50);
        if (decreaseBy === null) {
          markInvalid(
            maximumControls.decreaseBy.id,
            "Ganze Zahl von 1 bis 50 eingeben.",
          );
        }

        decreaseAfter = parsePositiveInteger(
          maximumControls.decreaseAfter.value,
          Number.POSITIVE_INFINITY,
        );
        if (decreaseAfter === null) {
          markInvalid(
            maximumControls.decreaseAfter.id,
            "Positive ganze Zahl eingeben.",
          );
        }
      }
    }
  } else {
    maximum = "none";
  }

  lockSettings = hasStopwatch ? false : dom.lockSettings.checked;
  if (lockSettings) {
    lockBeats = parsePositiveInteger(dom.lockBeats.value, Number.POSITIVE_INFINITY);
    if (lockBeats === null) {
      markInvalid("lock-beats", "Positive ganze Zahl eingeben.");
    }
  }

  const breaks = getSelectedValue("breaks") || DEFAULTS.breaks;
  let breakCount = null;
  let breakSeconds = null;

  if (breaks === "limited") {
    const breakCountRaw = dom.breakCount.value.trim();
    if (breakCountRaw !== "") {
      breakCount = parsePositiveInteger(breakCountRaw, Number.POSITIVE_INFINITY);
      if (breakCount === null) {
        markInvalid("break-count", "Positive ganze Zahl eingeben oder leer lassen.");
      }
    }

    const breakSecondsRaw = dom.breakSeconds.value.trim();
    if (breakSecondsRaw !== "") {
      const parsedBreakSeconds = parseBreakInput(breakSecondsRaw);
      if (!parsedBreakSeconds.valid) {
        markInvalid("break-seconds", parsedBreakSeconds.error);
      } else if (bpm !== null && !isBreakInputSafe(parsedBreakSeconds, bpm)) {
        markInvalid(
          "break-seconds",
          "Dieser Ausdruck kann bei einem erreichbaren BPM-Wert null oder negativ werden.",
        );
      } else {
        breakSeconds = parsedBreakSeconds;
      }
    }
  }

  const sessionEndEnabled = hasStopwatch ? false : dom.sessionEndEnabled.checked;
  let sessionEndBeats = DEFAULTS.sessionEndBeats;
  if (sessionEndEnabled) {
    sessionEndBeats = parsePositiveInteger(
      dom.sessionEndBeats.value,
      Number.POSITIVE_INFINITY,
    );
    if (sessionEndBeats === null) {
      markInvalid("session-end-beats", "Positive ganze Zahl eingeben.");
    }
  }

  if (
    !hasStopwatch &&
    lockSettings &&
    sessionEndEnabled &&
    lockBeats !== null &&
    sessionEndBeats !== null &&
    lockBeats > sessionEndBeats
  ) {
    markInvalid(
      "lock-beats",
      "Die Sperre darf den automatischen Session-Ende-Schwellenwert nicht überschreiten.",
    );
  }

  if (!valid) {
    return { valid: false, firstInvalid };
  }

  return {
    valid: true,
    settings: {
      initialBpm: bpm,
      accentuate: dom.accentuate.checked,
      accentRepeat,
      increaseTempo,
      increaseBy,
      increaseAfter,
      maximum,
      maximumLimit,
      decreaseBy,
      decreaseAfter,
      breaks,
      breakCount,
      breakSeconds,
      breakSecondsRaw: dom.breakSeconds.value.trim(),
      lockSettings,
      lockBeats,
      sessionEndEnabled,
      sessionEndBeats,
      preTimers: clonePreTimers(preTimerDefinitions),
      hasStopwatch,
    },
  };
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

function startPreTimerRun(settings) {
  cancelTimers();
  state.token += 1;
  state.phase = "pre-timers";
  state.settings = settings;
  state.preTimerRecords = settings.preTimers.map((preTimer) => ({
    id: preTimer.id,
    type: preTimer.type,
    name: preTimer.name,
    status: "not-started",
    configuredSeconds:
      preTimer.type === PRE_TIMER_TYPES.SECONDS ? preTimer.seconds : null,
    limitSeconds:
      preTimer.type === PRE_TIMER_TYPES.MANUAL ? preTimer.limitSeconds : null,
    formula:
      preTimer.type === PRE_TIMER_TYPES.STOPWATCH ? preTimer.formula : null,
    rounding:
      preTimer.type === PRE_TIMER_TYPES.STOPWATCH ? preTimer.rounding : null,
    roundingThreshold:
      preTimer.type === PRE_TIMER_TYPES.STOPWATCH
        ? preTimer.roundingThreshold
        : null,
    elapsedSeconds: null,
    completedBy: null,
    variables: null,
    substitution: null,
    result: null,
    resultValid: null,
    invalidReason: null,
  }));
  state.preTimerIndex = 0;
  state.preTimerStartedAt = null;
  state.preTimerReport = null;
  state.preTimerEarlyDialogOpen = false;
  state.report = null;
  dom.executionMessage.textContent = "";
  showView("preTimers", true);
  startNextPreTimer();
}

function startNextPreTimer() {
  if (state.phase !== "pre-timers" || !state.settings) {
    return;
  }
  if (state.preTimerIndex >= state.settings.preTimers.length) {
    completePreTimerRun();
    return;
  }

  clearTimer("preTimerTimer");
  clearTimer("preTimerDisplayTimer");
  const preTimer = state.settings.preTimers[state.preTimerIndex];
  const record = state.preTimerRecords[state.preTimerIndex];
  record.status = "active";
  state.preTimerStartedAt = performance.now();
  const token = state.token;

  updatePreTimerUi();
  state.preTimerDisplayTimer = window.setInterval(updatePreTimerUi, 250);
  if (preTimer.type === PRE_TIMER_TYPES.SECONDS) {
    state.preTimerTimer = window.setTimeout(() => {
      if (token !== state.token || state.phase !== "pre-timers") {
        return;
      }
      finishPreTimer("auto");
    }, preTimer.seconds * 1000);
  }
}

function handlePreTimerContinue() {
  if (
    state.phase !== "pre-timers" ||
    state.preTimerIndex < 0 ||
    !state.settings
  ) {
    return;
  }

  const preTimer = state.settings.preTimers[state.preTimerIndex];
  if (preTimer.type === PRE_TIMER_TYPES.SECONDS) {
    const remaining = getActivePreTimerRemainingSeconds();
    if (remaining > 10) {
      openPreTimerEarlyDialog(remaining);
      return;
    }
  }
  finishPreTimer("manual");
}

function openPreTimerEarlyDialog(remainingSeconds) {
  if (
    dom.preTimerEarlyDialog.open ||
    typeof dom.preTimerEarlyDialog.showModal !== "function"
  ) {
    return;
  }
  preTimerEarlyDialogTrigger = dom.preTimerContinueButton;
  state.preTimerEarlyDialogOpen = true;
  dom.preTimerEarlyDialogMessage.textContent =
    `Es sind noch ${remainingSeconds} Sekunden übrig. Wirklich vorzeitig fortsetzen?`;
  dom.preTimerEarlyDialog.showModal();
  dom.preTimerEarlyConfirm.focus();
}

function closePreTimerEarlyDialog(saveChanges) {
  if (!state.preTimerEarlyDialogOpen) {
    return;
  }
  dom.preTimerEarlyDialog.close();
  const trigger = preTimerEarlyDialogTrigger;
  preTimerEarlyDialogTrigger = null;
  state.preTimerEarlyDialogOpen = false;
  if (!saveChanges) {
    trigger?.focus();
  }
}

function handlePreTimerAbortRequest() {
  if (
    state.phase !== "pre-timers" ||
    dom.preTimerAbortDialog.open ||
    typeof dom.preTimerAbortDialog.showModal !== "function"
  ) {
    return;
  }
  preTimerAbortDialogTrigger = dom.preTimerAbortButton;
  dom.preTimerAbortDialog.showModal();
  dom.preTimerAbortConfirm.focus();
}

function closePreTimerAbortDialog(saveChanges) {
  if (!dom.preTimerAbortDialog.open) {
    return;
  }
  dom.preTimerAbortDialog.close();
  const trigger = preTimerAbortDialogTrigger;
  preTimerAbortDialogTrigger = null;
  if (!saveChanges) {
    trigger?.focus();
  }
}

function abortPreTimerRun() {
  if (state.phase !== "pre-timers" || !state.settings) {
    return;
  }

  finalizeActivePreTimer("aborted");
  clearTimer("preTimerTimer");
  clearTimer("preTimerDisplayTimer");
  closePreTimerAbortDialog(true);
  closePreTimerEarlyDialog(true);
  state.token += 1;
  state.phase = "finished";
  state.preTimerReport = buildPreTimerReport();
  state.report = {
    settings: state.settings,
    beatCount: 0,
    breakRecords: [],
    preTimerReport: state.preTimerReport,
    abortedBeforeExecution: true,
  };
  renderReport();
  showView("report", true);
}

function finishPreTimer(reason) {
  if (
    state.phase !== "pre-timers" ||
    state.preTimerIndex < 0 ||
    !state.preTimerRecords[state.preTimerIndex]
  ) {
    return;
  }

  closePreTimerAbortDialog(true);
  finalizeActivePreTimer(reason);
  clearTimer("preTimerTimer");
  clearTimer("preTimerDisplayTimer");
  closePreTimerEarlyDialog(true);
  state.preTimerStartedAt = null;
  state.preTimerIndex += 1;
  startNextPreTimer();
}

function finalizeActivePreTimer(status) {
  const record = state.preTimerRecords[state.preTimerIndex];
  if (!record || !state.preTimerStartedAt) {
    return;
  }
  record.status = status === "aborted" ? "active-aborted" : "completed";
  record.completedBy = status;
  record.elapsedSeconds = Math.max(
    0,
    Math.round((performance.now() - state.preTimerStartedAt) / 1000),
  );
}

function completePreTimerRun() {
  clearTimer("preTimerTimer");
  clearTimer("preTimerDisplayTimer");
  closePreTimerAbortDialog(true);
  state.preTimerReport = buildPreTimerReport();
  const derivedSettings = {
    ...state.settings,
    sessionEndEnabled: state.settings.sessionEndEnabled,
    sessionEndBeats: state.settings.sessionEndBeats,
    lockSettings: state.settings.lockSettings,
    lockBeats: state.settings.lockBeats,
    preTimerDerivedTotal: null,
    preTimerNoValidResults: false,
  };

  if (state.settings.hasStopwatch) {
    if (state.preTimerReport.validFormulaCount > 0) {
      derivedSettings.sessionEndEnabled = true;
      derivedSettings.sessionEndBeats = state.preTimerReport.validFormulaTotal;
      derivedSettings.lockSettings = true;
      derivedSettings.lockBeats = state.preTimerReport.validFormulaTotal;
      derivedSettings.preTimerDerivedTotal = state.preTimerReport.validFormulaTotal;
    } else {
      derivedSettings.sessionEndEnabled = false;
      derivedSettings.lockSettings = false;
      derivedSettings.preTimerNoValidResults = true;
    }
  }

  startRun(derivedSettings, state.preTimerReport);
}

function buildPreTimerReport() {
  const records = state.preTimerRecords.map((record) => ({ ...record }));
  let validFormulaTotal = 0;
  let validFormulaCount = 0;
  let invalidFormulaCount = 0;

  records.forEach((record, index) => {
    if (
      record.type !== PRE_TIMER_TYPES.STOPWATCH ||
      record.status !== "completed"
    ) {
      return;
    }

    const variables = getPreTimerFormulaVariables(
      record.elapsedSeconds,
      record.rounding,
      record.roundingThreshold,
    );
    const evaluation = evaluatePreTimerFormula(record.formula, variables);
    record.variables = variables;
    record.substitution = evaluation.substitution || null;
    record.resultValid = evaluation.valid;
    if (evaluation.valid) {
      record.result = evaluation.result;
      validFormulaTotal += evaluation.result;
      validFormulaCount += 1;
    } else {
      record.invalidReason = evaluation.error;
      invalidFormulaCount += 1;
    }
    records[index] = record;
  });

  return {
    records,
    validFormulaTotal,
    validFormulaCount,
    invalidFormulaCount,
  };
}

function getPreTimerExecutionWarning(settings, preTimerReport) {
  if (!preTimerReport || !settings.hasStopwatch) {
    return "";
  }
  if (preTimerReport.invalidFormulaCount > 0 && preTimerReport.validFormulaCount > 0) {
    return `Aus Vorlauf: ${preTimerReport.invalidFormulaCount} Formel(n) wurden ignoriert; gültige Ergebnisse ergeben ${preTimerReport.validFormulaTotal} Beats.`;
  }
  if (preTimerReport.validFormulaCount === 0) {
    return "Aus Vorlauf: Kein gültiges Formelergebnis; Session-Ende nicht automatisch und Stopp nicht gesperrt.";
  }
  return "";
}

function updatePreTimerUi() {
  if (
    state.phase !== "pre-timers" ||
    !state.settings ||
    state.preTimerIndex < 0 ||
    state.preTimerIndex >= state.settings.preTimers.length
  ) {
    return;
  }

  const preTimer = state.settings.preTimers[state.preTimerIndex];
  const elapsedSeconds = getActivePreTimerElapsedSeconds();
  const remainingSeconds = getActivePreTimerRemainingSeconds();
  dom.preTimersProgress.textContent =
    `Vorlaufzeit ${state.preTimerIndex + 1} von ${state.settings.preTimers.length}`;
  dom.preTimerCardType.textContent = getPreTimerTypeLabel(preTimer.type);
  dom.preTimerCardName.textContent = preTimer.name;
  dom.preTimerCardOptions.textContent = getPreTimerOptionsSummary(preTimer);

  if (preTimer.type === PRE_TIMER_TYPES.SECONDS) {
    dom.preTimerClock.textContent = `${remainingSeconds}s`;
    dom.preTimerStatus.textContent =
      remainingSeconds > 0
        ? `Automatischer Wechsel in ${remainingSeconds} Sekunden möglich.`
        : "Weiter auswählen.";
    dom.preTimerContinueButton.textContent = "Weiter";
    return;
  }

  dom.preTimerClock.textContent = formatPreTimerDuration(elapsedSeconds);
  if (preTimer.type === PRE_TIMER_TYPES.MANUAL && preTimer.limitSeconds !== null) {
    const limitRemaining = Math.max(0, preTimer.limitSeconds - elapsedSeconds);
    dom.preTimerContinueButton.textContent =
      limitRemaining > 0
        ? `Weiter (${limitRemaining}s)`
        : "Weiter (Limit erreicht)";
    dom.preTimerStatus.textContent =
      limitRemaining > 0
        ? `${limitRemaining} Sekunden bis zum konfigurierten Limit.`
        : "Limit erreicht; Weiter bleibt manuell.";
  } else {
    dom.preTimerContinueButton.textContent = "Weiter";
    dom.preTimerStatus.textContent =
      preTimer.type === PRE_TIMER_TYPES.STOPWATCH
        ? "Weiter auswählen, sobald die Stoppuhr beendet ist."
        : "Weiter auswählen, sobald bereit.";
  }
}

function getActivePreTimerElapsedSeconds() {
  if (!state.preTimerStartedAt) {
    return 0;
  }
  return Math.max(
    0,
    Math.round((performance.now() - state.preTimerStartedAt) / 1000),
  );
}

function getActivePreTimerRemainingSeconds() {
  if (
    !state.settings ||
    state.preTimerIndex < 0 ||
    state.preTimerIndex >= state.settings.preTimers.length
  ) {
    return 0;
  }
  const preTimer = state.settings.preTimers[state.preTimerIndex];
  if (preTimer.type !== PRE_TIMER_TYPES.SECONDS || !state.preTimerStartedAt) {
    return 0;
  }
  return Math.max(
    0,
    Math.ceil(
      (state.preTimerStartedAt + preTimer.seconds * 1000 - performance.now()) /
        1000,
    ),
  );
}

function startRun(settings, preTimerReport = null) {
  cancelTimers();
  state.token += 1;
  state.phase = "countdown";
  state.settings = settings;
  state.preTimerReport = preTimerReport;
  state.preTimerIndex = -1;
  state.preTimerStartedAt = null;
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
  state.report = null;
  dom.executionMessage.textContent = getPreTimerExecutionWarning(
    settings,
    preTimerReport,
  );

  showView("execution", true);
  playTone(TONE.countdownFrequency);
  updateExecutionUi();

  const token = state.token;
  state.countdownTimer = window.setTimeout(() => {
    if (token !== state.token || state.phase !== "countdown") {
      return;
    }

    state.countdownValue -= 1;
    if (state.countdownValue > 0) {
      playTone(TONE.countdownFrequency);
      updateExecutionUi();
      state.countdownTimer = window.setTimeout(() => {
        if (token !== state.token || state.phase !== "countdown") {
          return;
        }
        state.countdownValue -= 1;
        if (state.countdownValue > 0) {
          playTone(TONE.countdownFrequency);
          updateExecutionUi();
          state.countdownTimer = window.setTimeout(() => {
            if (token !== state.token || state.phase !== "countdown") {
              return;
            }
            beginBeatRun();
          }, 1000);
        } else {
          beginBeatRun();
        }
      }, 1000);
    } else {
      beginBeatRun();
    }
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
    finalizeRun();
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

function handleAbort() {
  if (state.phase !== "countdown") {
    return;
  }

  cancelTimers();
  state.token += 1;
  state.phase = "idle";
  state.settings = null;
  state.activeBreak = null;
  state.preTimerRecords = [];
  state.preTimerIndex = -1;
  state.preTimerStartedAt = null;
  state.preTimerReport = null;
  state.report = null;
  dom.settingsStatus.textContent = "";
  dom.executionMessage.textContent = "";
  showView("settings", true);
  dom.bpm.focus();
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
      : reason === "stopped"
        ? `Gestoppt nach ${elapsedSeconds} Sekunden`
        : `Manuell fortgesetzt nach ${elapsedSeconds} Sekunden`;
  state.activeBreak = null;
  state.resumeCountdownValue = 0;
  dom.executionMessage.textContent = "";

  if (reason === "stopped") {
    return;
  }

  state.phase = "running";
  updateExecutionUi();
  scheduleNextBeat();
}

function handleStop() {
  if (!state.settings || state.phase === "idle" || state.phase === "finished") {
    return;
  }

  if (state.phase === "countdown") {
    return;
  }

  if (state.settings.lockSettings && state.beatCount < state.settings.lockBeats) {
    return;
  }

  if (state.phase === "paused" || state.phase === "resume-countdown") {
    resumeFromBreak("stopped");
  }

  finalizeRun();
}

function finalizeRun() {
  cancelTimers();
  state.phase = "finished";
  state.report = {
    settings: state.settings,
    beatCount: state.beatCount,
    breakRecords: state.breakRecords.map((record) => ({ ...record })),
    preTimerReport: state.preTimerReport,
    abortedBeforeExecution: false,
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
  cancelTimers();
  state.token += 1;
  state.phase = "idle";
  state.settings = null;
  state.activeBreak = null;
  state.preTimerRecords = [];
  state.preTimerIndex = -1;
  state.preTimerStartedAt = null;
  state.preTimerReport = null;
  state.report = null;
  dom.settingsStatus.textContent = "";
  dom.executionMessage.textContent = "";
  dom.reportStatus.textContent = "";
  dom.reportStatus.classList.remove("error-status");
  resetReportCopyFeedback();
  showView("settings", true);
  dom.bpm.focus();
}

function updateExecutionUi() {
  if (!state.settings) {
    return;
  }

  const isCountdown = state.phase === "countdown";
  const isResumeCountdown = state.phase === "resume-countdown";
  const isPaused = state.phase === "paused";
  const isRunning = state.phase === "running";
  const isBreakActive = isPaused || isResumeCountdown;

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
  dom.abortButton.hidden = !isCountdown;
  dom.pauseButton.hidden = state.settings.breaks === "none" || isCountdown;
  dom.stopButton.hidden = isCountdown;
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
  dom.stopButton.disabled = stopLocked;
  dom.stopButton.textContent = stopLocked
    ? `Stopp (für ${state.settings.lockBeats - state.beatCount} Beats gesperrt)`
    : "Stopp";
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
  const report = state.report;
  const settings = report.settings;

  dom.reportStatus.textContent = "";
  dom.reportStatus.classList.remove("error-status");
  resetReportCopyFeedback();
  dom.reportTotalBeats.textContent = String(report.beatCount);
  dom.reportBpm.textContent = formatBpm(settings);

  dom.reportBreaks.textContent = formatBreaks(settings);
  dom.reportBreaksRow.hidden = settings.breaks === "none";
  dom.reportSessionEnd.textContent = report.abortedBeforeExecution
    ? "Abgebrochen vor Ausführung"
    : formatSessionEnd(settings);
  dom.reportBreaksTitle.textContent = formatReportBreaksTitle(settings);
  dom.reportPreTimersCard.hidden = !report.preTimerReport;
  dom.reportPreTimersList.replaceChildren();
  if (report.preTimerReport) {
    report.preTimerReport.records.forEach((record) => {
      const item = document.createElement("li");
      item.textContent = formatPreTimerLongLine(record);
      dom.reportPreTimersList.append(item);
    });
    if (report.preTimerReport.invalidFormulaCount > 0) {
      dom.reportStatus.classList.add("error-status");
      dom.reportStatus.textContent = getPreTimerExecutionWarning(
        settings,
        report.preTimerReport,
      );
    }
  }
  if (report.abortedBeforeExecution) {
    dom.reportStatus.textContent = "Vorlaufzeiten abgebrochen; Ausführung nicht gestartet.";
  }

  dom.breakTableBody.replaceChildren();
  dom.reportNoBreaks.hidden = report.breakRecords.length > 0;
  dom.breakTableWrapper.hidden = report.breakRecords.length === 0;

  report.breakRecords.forEach((record) => {
    const row = dom.breakRowTemplate.content.cloneNode(true);
    row.querySelector('[data-cell="number"]').textContent = String(record.number);
    row.querySelector('[data-cell="beat"]').textContent = String(record.beat);
    row.querySelector('[data-cell="bpm"]').textContent = String(record.bpm);
    row.querySelector('[data-cell="allowance"]').textContent = record.overLimit
      ? "Überschritten"
      : "Eingehalten";
    row.querySelector('[data-cell="ended"]').textContent = record.ended;
    dom.breakTableBody.append(row);
  });
}

function buildReportText(report) {
  const settings = report.settings;
  const lines = [
    "Metronom-Bericht",
    `Gesamtzahl Beats: ${report.beatCount}`,
    `BPM: ${formatBpm(settings)}`,
  ];

  if (settings.breaks !== "none") {
    lines.push(`Pausen: ${formatBreaks(settings)}`);
  }
  lines.push(
    `Session-Ende: ${
      report.abortedBeforeExecution
        ? "Abgebrochen vor Ausführung"
        : formatSessionEnd(settings)
    }`,
  );

  if (report.preTimerReport) {
    lines.push(
      "",
      "Vorlaufzeiten:",
      ...report.preTimerReport.records.map(
        (record) => `- ${formatPreTimerLongLine(record)}`,
      ),
    );
  }

  lines.push("", formatReportBreaksHeading(settings));

  if (report.breakRecords.length === 0) {
    lines.push("Keine Pausen verwendet.");
  } else {
    report.breakRecords.forEach((record) => {
      lines.push(
        `- ${record.number}. Beat: ${record.beat}; BPM: ${record.bpm}; ` +
          `Limit: ${record.overLimit ? "Überschritten" : "Eingehalten"}; ` +
          `Beendet: ${record.ended}`,
      );
    });
  }

  return lines.join("\n");
}

function buildShortReportText(report) {
  const settings = report.settings;
  const parts = [`${report.beatCount}x`, formatShortBpm(settings)];
  const progression = formatShortProgression(settings);
  const lines = [parts.join("; ")];

  if (progression) {
    lines[0] += `; ${progression}`;
  }
  if (report.preTimerReport) {
    lines.push(
      "Vorlaufzeiten:",
      ...report.preTimerReport.records.map(
        (record) => `- ${formatPreTimerShortLine(record)}`,
      ),
    );
  }
  if (report.breakRecords.length === 0) {
    lines[0] += "; Keine Pausen verwendet";
  } else {
    lines[0] += "; Pausen bei:";
    lines.push(
      ...report.breakRecords.map((record) => {
        const bpm = settings.increaseTempo ? `, ${record.bpm} BPM` : "";
        return `- ${record.beat} (${record.durationSeconds}s${bpm})`;
      }),
    );
  }

  return lines.join("\n");
}

function formatPreTimerLongLine(record) {
  const prefix = `${record.name} (${getPreTimerTypeLabel(record.type)})`;
  if (record.status === "not-started") {
    return `${prefix}: Nicht gestartet`;
  }
  if (record.status === "active-aborted") {
    if (record.type === PRE_TIMER_TYPES.STOPWATCH) {
      return `${prefix}: ${formatPreTimerDuration(
        record.elapsedSeconds,
      )}; Aktiv abgebrochen; Formel nicht berechnet`;
    }
    return `${prefix}: ${formatPreTimerDuration(
      record.elapsedSeconds,
    )}; Aktiv abgebrochen`;
  }

  const elapsed = formatPreTimerDuration(record.elapsedSeconds);
  if (record.type === PRE_TIMER_TYPES.SECONDS) {
    if (record.completedBy === "auto") {
      return `${prefix}: ${elapsed}; automatisch fortgesetzt`;
    }
    return `${prefix}: ${elapsed}; konfiguriertes Minimum ${formatPreTimerDuration(
      record.configuredSeconds,
    )}; manuell fortgesetzt`;
  }
  if (record.type === PRE_TIMER_TYPES.MANUAL) {
    const limit =
      record.limitSeconds === null
        ? ""
        : `; Limit ${formatPreTimerDuration(record.limitSeconds)}`;
    return `${prefix}: ${elapsed}${limit}; manuell fortgesetzt`;
  }

  const rounding = getPreTimerRoundingLabel(record.rounding);
  const threshold =
    record.rounding === PRE_TIMER_ROUNDING.ROUND
      ? ` ab ${record.roundingThreshold ?? 30}s`
      : "";
  if (record.resultValid) {
    return `${prefix}: ${elapsed}; ${record.formula} -> ${
      record.substitution
    }=${record.result}; Rundung: ${rounding}${threshold}`;
  }
  return `${prefix}: ${elapsed}; ${record.formula} -> ${
    record.substitution || "nicht berechnet"
  }; ignoriert: ${record.invalidReason}`;
}

function formatPreTimerShortLine(record) {
  if (record.status === "not-started") {
    return `${record.name}: Nicht gestartet`;
  }
  if (record.status === "active-aborted") {
    return `${record.name}: Aktiv abgebrochen`;
  }

  const elapsed = formatPreTimerDuration(record.elapsedSeconds);
  if (record.type === PRE_TIMER_TYPES.SECONDS) {
    return record.completedBy === "auto"
      ? `${record.name}: ${elapsed}`
      : `${record.name}: ${elapsed} (konfiguriert ${formatPreTimerDuration(
          record.configuredSeconds,
        )})`;
  }
  if (record.type === PRE_TIMER_TYPES.MANUAL) {
    const limit =
      record.limitSeconds === null
        ? ""
        : ` (Limit ${formatPreTimerDuration(record.limitSeconds)})`;
    return `${record.name}: ${elapsed}${limit}`;
  }
  if (record.resultValid) {
    return `${record.name}: ${elapsed}; ${record.formula}=${record.result}`;
  }
  return `${record.name}: ${elapsed}; ${record.formula}=ungültig (ignoriert)`;
}

function formatShortBpm(settings) {
  if (settings.maximum === "none") {
    return `${settings.initialBpm} BPM`;
  }
  return `${settings.initialBpm} - ${settings.maximumLimit} BPM`;
}

function formatShortProgression(settings) {
  if (!settings.increaseTempo) {
    return "";
  }

  let progression = `+${settings.increaseBy}/${settings.increaseAfter}`;
  if (settings.maximum === "reverse") {
    progression += ` -${settings.decreaseBy}/${settings.decreaseAfter}`;
  }
  return progression;
}

function formatReportBreaksHeading(settings) {
  if (settings.breaks !== "limited" || !settings.breakSecondsRaw) {
    return `${REPORT_BREAKS_HEADING}:`;
  }
  return `${REPORT_BREAKS_HEADING} (max ${settings.breakSecondsRaw}s):`;
}

function formatReportBreaksTitle(settings) {
  if (settings.breaks !== "limited" || !settings.breakSecondsRaw) {
    return REPORT_BREAKS_HEADING;
  }
  return `${REPORT_BREAKS_HEADING} (max ${settings.breakSecondsRaw}s)`;
}

function formatBpm(settings) {
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
  if (settings.preTimerDerivedTotal !== null && settings.preTimerDerivedTotal !== undefined) {
    return `Aus Vorlauf: Nach ${settings.preTimerDerivedTotal} Beats; Aus Vorlauf: Stopp gesperrt bis ${settings.preTimerDerivedTotal} Beats`;
  }
  if (settings.preTimerNoValidResults) {
    return "Aus Vorlauf: Kein automatisches Session-Ende; Stopp nicht gesperrt";
  }
  const sessionEnd = settings.sessionEndEnabled
    ? `Nach ${settings.sessionEndBeats} Beats`
    : "Manueller Stopp";
  if (!settings.lockSettings) {
    return sessionEnd;
  }
  return `${sessionEnd}; Einstellungen gesperrt, bis ${settings.lockBeats} Beats vergangen sind`;
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
  state.preTimerRecords = [];
  state.preTimerIndex = -1;
  state.preTimerStartedAt = null;
  state.preTimerReport = null;
  dom.executionMessage.textContent = getErrorMessage(
    error,
    "Audio wurde unerwartet beendet. Zu den Einstellungen zurückkehren und erneut versuchen.",
  );
  dom.settingsStatus.textContent = dom.executionMessage.textContent;
  showView("settings", true);
  dom.bpm.focus();
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

  const heading =
    name === "settings"
      ? dom.settingsTitle
      : name === "preTimers"
        ? dom.preTimersTitle
      : name === "execution"
        ? dom.executionTitle
        : dom.reportTitle;
  heading.focus();
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
  if (fieldId === "pre-timers") {
    return dom.preTimersFieldset;
  }
  return null;
}

function clearTimer(timerName) {
  const timer = state[timerName];
  if (timer === null) {
    return;
  }

  if (timerName === "breakDisplayTimer" || timerName === "preTimerDisplayTimer") {
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
  clearTimer("preTimerTimer");
  clearTimer("preTimerDisplayTimer");
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
