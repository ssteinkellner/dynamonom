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
  execution: document.getElementById("execution-view"),
  report: document.getElementById("report-view"),
};

const dom = {
  settingsForm: document.getElementById("settings-form"),
  settingsTitle: document.getElementById("settings-title"),
  settingsStatus: document.getElementById("settings-status"),
  presetList: document.getElementById("preset-list"),
  settingsImport: document.getElementById("settings-import"),
  exportButton: document.getElementById("export-button"),
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
  report: null,
};

let audioContext = null;
const copyFeedbackTimers = new Map();
let progressDialogMode = null;
let progressDialogTrigger = null;
let progressDialogSnapshot = null;

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

function init() {
  if (Object.values(dom).some((element) => element === null)) {
    console.error("Metronome initialization failed because required markup is missing.");
    return;
  }

  renderPresets();
  const initialParameters = getInitialParameterText();
  if (initialParameters) {
    dom.settingsImport.value = initialParameters;
    handleSettingsImport(initialParameters);
  }
  bindEvents();
  syncSettingsVisibility();
  showView("settings", false);
  dom.bpm.focus();
}

function bindEvents() {
  dom.settingsForm.addEventListener("submit", handleStart);
  dom.settingsImport.addEventListener("input", () => {
    handleSettingsImport(dom.settingsImport.value);
  });
  dom.exportButton.addEventListener("click", handleExportSettings);
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
    dom.settingsStatus.textContent = "";
  });
}

function syncSettingsVisibility() {
  const increaseEnabled = dom.increaseTempo.checked;
  const accentEnabled = dom.accentuate.checked;
  const lockEnabled = dom.lockSettings.checked;
  const maximum = getSelectedValue("maximum");
  const breaks = getSelectedValue("breaks");

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

  setOptionCardState(dom.lockOptionCard, lockEnabled);
  setControlDisabled(dom.lockBeats, !lockEnabled);

  setOptionCardState(dom.breaksNoneOption, breaks === "none");
  setOptionCardState(dom.breaksUnlimitedOption, breaks === "unlimited");
  setOptionCardState(dom.breaksLimitedOption, breaks === "limited");
  setControlDisabled(dom.breakCount, breaks !== "limited");
  setControlDisabled(dom.breakSeconds, breaks !== "limited");

  const sessionEndEnabled = dom.sessionEndEnabled.checked;
  setOptionCardState(dom.sessionEndOptionCard, sessionEndEnabled);
  setControlDisabled(dom.sessionEndBeats, !sessionEndEnabled);
  setControlDisabled(dom.increaseProgressButton, !increaseEnabled);
  setControlDisabled(dom.reverseProgressButton, !increaseEnabled || maximum !== "reverse");
  updateProgressButtonLabels();
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

  dom.presetList.replaceChildren(dom.settingsImport);
  let addedPreset = false;

  Object.entries(presets).forEach(([presetId, preset]) => {
    if (!preset || typeof preset.label !== "string" || !preset.values) {
      console.error(`Preset "${presetId}" has an invalid definition.`);
      return;
    }

    const button = document.createElement("button");
    button.className = "secondary-button";
    button.type = "button";
    button.textContent = preset.label;
    button.dataset.presetId = presetId;
    button.addEventListener("click", () => handlePresetStart(preset.values));
    dom.presetList.append(button);
    addedPreset = true;
  });

  if (!addedPreset) {
    console.error("No valid metronome presets are configured.");
    dom.settingsStatus.textContent = "Keine gültigen Voreinstellungen verfügbar.";
  }
}

function getInitialParameterText() {
  if (typeof window === "undefined" || !window.location?.search) {
    return "";
  }
  return window.location.search.slice(1);
}

function serializeSettings() {
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
  return parameters.toString();
}

function handleExportSettings() {
  const parameterList = serializeSettings();
  dom.settingsImport.value = parameterList;

  copyText(parameterList, dom.exportButton)
    .then(() => {
      dom.settingsStatus.classList.remove("error-status");
      dom.settingsStatus.textContent =
        "Einstellungen exportiert und in die Zwischenablage kopiert.";
    })
    .catch((error) => {
      dom.settingsStatus.classList.add("error-status");
      dom.settingsStatus.textContent = getErrorMessage(
        error,
        "Die Einstellungen konnten nicht in die Zwischenablage kopiert werden.",
      );
    });
}

function handleSettingsImport(parameterText) {
  const rawText = String(parameterText).trim();
  if (!rawText) {
    return;
  }

  const parsed = parseSettingsParameters(rawText);
  if (!parsed.valid || !parsed.foundSettings || Object.keys(parsed.values).length === 0) {
    return;
  }

  applySettingsParameters(parsed.values);
  syncSettingsVisibility();
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
      return { valid: false, foundSettings: false };
    }
  }

  const parameters = new URLSearchParams(parameterText);
  const values = {};
  let foundSettings = false;

  Object.keys(TEXT_SETTING_CONTROLS).forEach((name) => {
    if (parameters.has(name)) {
      foundSettings = true;
      const importedValue = getValidTextSettingValue(name, parameters.get(name));
      if (importedValue.valid) {
        values[name] = importedValue.value;
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
    }
  });

  if (!foundSettings) {
    return { valid: false, foundSettings: false };
  }

  return { valid: true, foundSettings: true, values };
}

function getValidTextSettingValue(name, rawValue) {
  const value = String(rawValue ?? "").trim();
  let valid = false;

  switch (name) {
    case "bpm":
      valid = parseIntegerField(value, 20, 300) !== null;
      break;
    case "accent-repeat":
    case "increase-after":
    case "decrease-after-reverse":
    case "session-end-beats":
    case "lock-beats":
      valid = parsePositiveInteger(value, Number.POSITIVE_INFINITY) !== null;
      break;
    case "increase-by":
      valid = parseIntegerField(value, 1, 20) !== null;
      break;
    case "maximum-limit-stick":
    case "maximum-limit-reset":
    case "maximum-limit-reverse":
      valid = parseIntegerField(value, 60, 400) !== null;
      break;
    case "decrease-by-reverse":
      valid = parseIntegerField(value, 1, 50) !== null;
      break;
    case "break-count":
      valid = value === "" || parsePositiveInteger(value, Number.POSITIVE_INFINITY) !== null;
      break;
    case "break-seconds":
      valid = value === "" || parseBreakInput(value).valid;
      break;
    default:
      break;
  }

  return { valid, value };
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

async function handleStart(event) {
  event.preventDefault();
  await startConfiguredSession();
}

async function handlePresetStart(values) {
  applyPreset(values);
  syncSettingsVisibility();
  await startConfiguredSession();
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
  startRun(validation.settings);
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

  lockSettings = dom.lockSettings.checked;
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

  const sessionEndEnabled = dom.sessionEndEnabled.checked;
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

function startRun(settings) {
  cancelTimers();
  state.token += 1;
  state.phase = "countdown";
  state.settings = settings;
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
  dom.reportSessionEnd.textContent = formatSessionEnd(settings);
  dom.reportBreaksTitle.textContent = formatReportBreaksTitle(settings);

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
    `Session-Ende: ${formatSessionEnd(settings)}`,
    "",
    formatReportBreaksHeading(settings),
  );

  if (report.breakRecords.length === 0) {
    lines.push("Keine Pausen verwendet.");
  } else {
    report.breakRecords.forEach((record) => {
      lines.push(
        `${record.number}. Beat: ${record.beat}; BPM: ${record.bpm}; ` +
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
  return null;
}

function clearTimer(timerName) {
  const timer = state[timerName];
  if (timer === null) {
    return;
  }

  if (timerName === "breakDisplayTimer") {
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
