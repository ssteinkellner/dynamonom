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
});

const TONE = Object.freeze({
  regularFrequency: 440,
  accentFrequency: 880,
  countdownFrequency: 1760,
  durationSeconds: 0.07,
  peakGain: 0.18,
});

const views = {
  settings: document.getElementById("settings-view"),
  execution: document.getElementById("execution-view"),
  report: document.getElementById("report-view"),
};

const dom = {
  settingsForm: document.getElementById("settings-form"),
  settingsTitle: document.getElementById("settings-title"),
  settingsStatus: document.getElementById("settings-status"),
  bpm: document.getElementById("bpm"),
  accentuate: document.getElementById("accentuate"),
  accentOptionCard: document.getElementById("accent-option-card"),
  accentOptions: document.getElementById("accent-options"),
  accentRepeat: document.getElementById("accent-repeat"),
  increaseTempo: document.getElementById("increase-tempo"),
  increaseOptionCard: document.getElementById("increase-option-card"),
  increaseOptions: document.getElementById("increase-options"),
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
  executionTitle: document.getElementById("execution-title"),
  executionStatus: document.getElementById("execution-status"),
  executionPhase: document.getElementById("execution-phase"),
  countdownDisplay: document.getElementById("countdown-display"),
  currentBpm: document.getElementById("current-bpm"),
  nextBpmInfo: document.getElementById("next-bpm-info"),
  nextBpm: document.getElementById("next-bpm"),
  nextBpmCountdown: document.getElementById("next-bpm-countdown"),
  beatCount: document.getElementById("beat-count"),
  breakStatus: document.getElementById("break-status"),
  executionMessage: document.getElementById("execution-message"),
  pauseButton: document.getElementById("pause-button"),
  stopButton: document.getElementById("stop-button"),
  reportTitle: document.getElementById("report-title"),
  reportStatus: document.getElementById("report-status"),
  reportTotalBeats: document.getElementById("report-total-beats"),
  reportStartBpm: document.getElementById("report-start-bpm"),
  reportAccent: document.getElementById("report-accent"),
  reportIncrease: document.getElementById("report-increase"),
  reportMaximum: document.getElementById("report-maximum"),
  reportBreaks: document.getElementById("report-breaks"),
  reportLock: document.getElementById("report-lock"),
  reportNoBreaks: document.getElementById("report-no-breaks"),
  breakTableWrapper: document.getElementById("break-table-wrapper"),
  breakTableBody: document.getElementById("break-table-body"),
  breakRowTemplate: document.getElementById("break-row-template"),
  copyReportButton: document.getElementById("copy-report-button"),
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
let copyFeedbackTimer = null;

function init() {
  if (Object.values(dom).some((element) => element === null)) {
    console.error("Metronome initialization failed because required markup is missing.");
    return;
  }

  bindEvents();
  syncSettingsVisibility();
  showView("settings", false);
  dom.bpm.focus();
}

function bindEvents() {
  dom.settingsForm.addEventListener("submit", handleStart);
  dom.accentuate.addEventListener("change", syncSettingsVisibility);
  dom.increaseTempo.addEventListener("change", syncSettingsVisibility);
  dom.lockSettings.addEventListener("change", syncSettingsVisibility);
  dom.pauseButton.addEventListener("click", handlePause);
  dom.stopButton.addEventListener("click", handleStop);
  dom.copyReportButton.addEventListener("click", handleCopyReport);
  dom.backButton.addEventListener("click", handleBackToSettings);

  document.querySelectorAll('input[name="maximum"]').forEach((input) => {
    input.addEventListener("change", syncSettingsVisibility);
  });

  document.querySelectorAll('input[name="breaks"]').forEach((input) => {
    input.addEventListener("change", syncSettingsVisibility);
  });

  dom.settingsForm.addEventListener("input", (event) => {
    const control = event.target;
    if (control instanceof HTMLInputElement) {
      clearFieldError(control.id);
    }
    dom.settingsStatus.textContent = "";
  });
}

function syncSettingsVisibility() {
  const increaseEnabled = dom.increaseTempo.checked;
  const accentEnabled = dom.accentuate.checked;
  const lockEnabled = increaseEnabled && dom.lockSettings.checked;
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

  setOptionCardState(dom.lockOptionCard, increaseEnabled);
  setControlDisabled(dom.lockSettings, !increaseEnabled);
  setControlDisabled(dom.lockBeats, !lockEnabled);

  setOptionCardState(dom.breaksNoneOption, breaks === "none");
  setOptionCardState(dom.breaksUnlimitedOption, breaks === "unlimited");
  setOptionCardState(dom.breaksLimitedOption, breaks === "limited");
  setControlDisabled(dom.breakCount, breaks !== "limited");
  setControlDisabled(dom.breakSeconds, breaks !== "limited");
}

async function handleStart(event) {
  event.preventDefault();

  const validation = validateSettings();
  if (!validation.valid) {
    dom.settingsStatus.textContent = "Please correct the highlighted settings.";
    validation.firstInvalid?.focus();
    return;
  }

  try {
    await ensureAudioReady();
  } catch (error) {
    dom.settingsStatus.textContent = getErrorMessage(
      error,
      "Audio could not be initialized. Check the browser audio permission and try again.",
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
    markInvalid("bpm", "Enter a whole-number BPM from 20 to 300.");
  }

  let accentRepeat = DEFAULTS.accentRepeat;
  if (dom.accentuate.checked) {
    accentRepeat = parsePositiveInteger(dom.accentRepeat.value, Number.POSITIVE_INFINITY);
    if (accentRepeat === null) {
      markInvalid("accent-repeat", "Enter a positive whole number.");
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
      markInvalid("increase-by", "Enter a whole number from 1 to 20.");
    }

    increaseAfter = parsePositiveInteger(dom.increaseAfter.value, Number.POSITIVE_INFINITY);
    if (increaseAfter === null) {
      markInvalid("increase-after", "Enter a positive whole number.");
    }

    if (maximum !== "none") {
      const maximumControls = getMaximumControls(maximum);
      maximumLimit = parseIntegerField(maximumControls.limit.value, 60, 400);
      if (maximumLimit === null) {
        markInvalid(
          maximumControls.limit.id,
          "Enter a whole-number limit from 60 to 400.",
        );
      } else if (bpm !== null && maximumLimit <= bpm) {
        markInvalid(
          maximumControls.limit.id,
          "The limit must be greater than the starting BPM.",
        );
      }

      if (maximum === "reverse") {
        decreaseBy = parseIntegerField(maximumControls.decreaseBy.value, 1, 50);
        if (decreaseBy === null) {
          markInvalid(
            maximumControls.decreaseBy.id,
            "Enter a whole number from 1 to 50.",
          );
        }

        decreaseAfter = parsePositiveInteger(
          maximumControls.decreaseAfter.value,
          Number.POSITIVE_INFINITY,
        );
        if (decreaseAfter === null) {
          markInvalid(
            maximumControls.decreaseAfter.id,
            "Enter a positive whole number.",
          );
        }
      }
    }

    lockSettings = dom.lockSettings.checked;
    if (lockSettings) {
      lockBeats = parsePositiveInteger(dom.lockBeats.value, Number.POSITIVE_INFINITY);
      if (lockBeats === null) {
        markInvalid("lock-beats", "Enter a positive whole number.");
      }
    }
  } else {
    maximum = "none";
  }

  const breaks = getSelectedValue("breaks") || DEFAULTS.breaks;
  let breakCount = null;
  let breakSeconds = null;

  if (breaks === "limited") {
    const breakCountRaw = dom.breakCount.value.trim();
    if (breakCountRaw !== "") {
      breakCount = parsePositiveInteger(breakCountRaw, Number.POSITIVE_INFINITY);
      if (breakCount === null) {
        markInvalid("break-count", "Enter a positive whole number or leave this blank.");
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
          "This expression can become zero or negative at a reachable BPM.",
        );
      } else {
        breakSeconds = parsedBreakSeconds;
      }
    }
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
    return { valid: false, error: "Enter a positive whole number of seconds." };
  }

  const expression = /^BPM\s*([+\-*\/])\s*(\d+(?:\.\d+)?)$/i.exec(raw);
  if (!expression) {
    return {
      valid: false,
      error: "Use a positive integer or an expression such as BPM/2.",
    };
  }

  const operand = Number(expression[2]);
  if (!Number.isFinite(operand) || operand <= 0) {
    return { valid: false, error: "The expression number must be greater than zero." };
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
    throw new Error("This browser does not support the Web Audio API.");
  }

  if (!audioContext || audioContext.state === "closed") {
    audioContext = new AudioContextConstructor();
  }

  if (audioContext.state !== "running") {
    await audioContext.resume();
  }

  if (audioContext.state !== "running") {
    throw new Error("The browser kept the audio context suspended.");
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

  if (state.phase === "paused") {
    resumeFromBreak("manual");
    return;
  }

  if (state.phase !== "running") {
    return;
  }

  startBreak();
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
        "This break expression is not positive at the current BPM, so the break was not started.",
      );
      updateExecutionUi();
      return;
    }
  }

  dom.executionMessage.textContent = "";
  clearTimer("beatTimer");
  state.phase = "paused";
  state.activeBreak = {
    record,
    durationSeconds,
    deadline: durationSeconds === null ? null : performance.now() + durationSeconds * 1000,
  };

  if (durationSeconds !== null) {
    state.breakTimer = window.setTimeout(() => {
      resumeFromBreak("timer");
    }, durationSeconds * 1000);
    state.breakDisplayTimer = window.setInterval(updateExecutionUi, 250);
  }

  updateExecutionUi();
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
  if (state.phase !== "paused" || !state.activeBreak) {
    return;
  }

  clearTimer("breakTimer");
  clearTimer("breakDisplayTimer");
  state.activeBreak.record.ended =
    reason === "timer" ? "Time limit" : reason === "stopped" ? "Run stopped" : "Manual";
  state.activeBreak = null;
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

  if (state.settings.lockSettings && state.beatCount < state.settings.lockBeats) {
    return;
  }

  if (state.phase === "paused") {
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

  const text = buildReportText(state.report);

  try {
    await copyText(text);
    dom.reportStatus.classList.remove("error-status");
    dom.reportStatus.textContent = "Report copied to clipboard.";
    dom.copyReportButton.textContent = "Copied!";

    if (copyFeedbackTimer !== null) {
      window.clearTimeout(copyFeedbackTimer);
    }
    copyFeedbackTimer = window.setTimeout(() => {
      dom.copyReportButton.textContent = "Copy to clipboard";
      copyFeedbackTimer = null;
    }, 2000);
  } catch (error) {
    dom.reportStatus.classList.add("error-status");
    dom.reportStatus.textContent = getErrorMessage(
      error,
      "The report could not be copied to the clipboard.",
    );
  }
}

async function copyText(text) {
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
  dom.copyReportButton.focus();

  if (!copied) {
    throw new Error("The browser did not allow clipboard access.");
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
  dom.copyReportButton.textContent = "Copy to clipboard";
  if (copyFeedbackTimer !== null) {
    window.clearTimeout(copyFeedbackTimer);
    copyFeedbackTimer = null;
  }
  showView("settings", true);
  dom.bpm.focus();
}

function updateExecutionUi() {
  if (!state.settings) {
    return;
  }

  const isCountdown = state.phase === "countdown";
  const isPaused = state.phase === "paused";
  const isRunning = state.phase === "running";

  dom.executionPhase.textContent = isCountdown
    ? "Starting"
    : isPaused
      ? "Break active"
      : "Running";
  dom.countdownDisplay.hidden = !isCountdown;
  dom.countdownDisplay.textContent = String(state.countdownValue);
  dom.currentBpm.textContent = String(state.currentBpm);
  dom.beatCount.textContent = `Beats completed: ${state.beatCount}`;

  dom.pauseButton.hidden = state.settings.breaks === "none";
  dom.pauseButton.disabled = !isRunning && !isPaused;
  dom.pauseButton.classList.toggle(
    "over-limit",
    state.settings.breakCount !== null && state.breakSessions >= state.settings.breakCount,
  );

  if (isPaused) {
    const remaining = getBreakSecondsRemaining();
    dom.pauseButton.textContent =
      remaining === null ? "Resume" : `Resume (${remaining}s)`;
    dom.breakStatus.textContent =
      remaining === null
        ? "Break paused. Resume when you are ready."
        : `Break active. ${remaining}s remaining, or resume manually.`;
  } else {
    dom.pauseButton.textContent = getPauseLabel();
    dom.breakStatus.textContent = "";
  }

  if (state.settings.increaseTempo) {
    dom.nextBpmInfo.hidden = false;
    if (state.stuckAtMaximum) {
      dom.nextBpm.textContent = "Max";
      dom.nextBpmCountdown.textContent = "holding at limit";
    } else {
      dom.nextBpm.textContent = String(getNextBpm());
      const interval =
        state.direction === "up"
          ? state.settings.increaseAfter
          : state.settings.decreaseAfter;
      const remaining = Math.max(1, interval - state.tempoCounter);
      dom.nextBpmCountdown.textContent = `in ${remaining} beat${remaining === 1 ? "" : "s"}`;
    }
  } else {
    dom.nextBpmInfo.hidden = true;
  }

  const stopLocked =
    state.settings.lockSettings && state.beatCount < state.settings.lockBeats;
  dom.stopButton.disabled = stopLocked;
  dom.stopButton.textContent = stopLocked
    ? `Stop (${state.settings.lockBeats - state.beatCount} beats left)`
    : "Stop";

  if (isCountdown) {
    dom.executionStatus.textContent = `Starting in ${state.countdownValue}...`;
  } else if (isPaused) {
    dom.executionStatus.textContent = "Metronome paused.";
  } else if (isRunning) {
    dom.executionStatus.textContent = "Metronome running.";
  }
}

function getPauseLabel() {
  if (state.settings.breakCount === null) {
    return "Pause";
  }

  const remaining = Math.max(0, state.settings.breakCount - state.breakSessions);
  if (remaining > 0) {
    return `Pause (${remaining} left)`;
  }
  if (state.breakSessions === state.settings.breakCount) {
    return "Pause (0 left)";
  }
  return `Pause (${state.breakSessions - state.settings.breakCount} over)`;
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
  dom.copyReportButton.textContent = "Copy to clipboard";
  dom.reportTotalBeats.textContent = String(report.beatCount);
  dom.reportStartBpm.textContent = `${settings.initialBpm} BPM`;
  dom.reportAccent.textContent = settings.accentuate
    ? `Enabled every ${settings.accentRepeat} beats`
    : "Disabled";

  dom.reportIncrease.textContent = settings.increaseTempo
    ? `+${settings.increaseBy} BPM every ${settings.increaseAfter} beats`
    : "Disabled";

  dom.reportMaximum.textContent = formatMaximum(settings);
  dom.reportBreaks.textContent = formatBreaks(settings);
  dom.reportLock.textContent = settings.lockSettings
    ? `Enabled after ${settings.lockBeats} beats`
    : "Disabled";

  dom.breakTableBody.replaceChildren();
  dom.reportNoBreaks.hidden = report.breakRecords.length > 0;
  dom.breakTableWrapper.hidden = report.breakRecords.length === 0;

  report.breakRecords.forEach((record) => {
    const row = dom.breakRowTemplate.content.cloneNode(true);
    row.querySelector('[data-cell="number"]').textContent = String(record.number);
    row.querySelector('[data-cell="beat"]').textContent = String(record.beat);
    row.querySelector('[data-cell="bpm"]').textContent = String(record.bpm);
    row.querySelector('[data-cell="allowance"]').textContent = record.overLimit
      ? "Over limit"
      : "Within allowance";
    row.querySelector('[data-cell="ended"]').textContent = record.ended;
    dom.breakTableBody.append(row);
  });
}

function buildReportText(report) {
  const settings = report.settings;
  const lines = [
    "Metronome report",
    `Total beats: ${report.beatCount}`,
    `Starting BPM: ${settings.initialBpm} BPM`,
    `Accent: ${
      settings.accentuate ? `Enabled every ${settings.accentRepeat} beats` : "Disabled"
    }`,
    `Tempo progression: ${
      settings.increaseTempo
        ? `+${settings.increaseBy} BPM every ${settings.increaseAfter} beats`
        : "Disabled"
    }`,
    `Maximum: ${formatMaximum(settings)}`,
    `Breaks: ${formatBreaks(settings)}`,
    `Settings lock: ${
      settings.lockSettings ? `Enabled after ${settings.lockBeats} beats` : "Disabled"
    }`,
    "",
    "Breaks used:",
  ];

  if (report.breakRecords.length === 0) {
    lines.push("No breaks used.");
  } else {
    report.breakRecords.forEach((record) => {
      lines.push(
        `${record.number}. Beat: ${record.beat}; BPM: ${record.bpm}; ` +
          `Allowance: ${record.overLimit ? "Over limit" : "Within allowance"}; ` +
          `Ended: ${record.ended}`,
      );
    });
  }

  return lines.join("\n");
}

function formatMaximum(settings) {
  if (!settings.increaseTempo || settings.maximum === "none") {
    return "None";
  }

  const labels = {
    stick: "Stick",
    reset: "Reset",
    reverse: "Reverse",
  };
  let value = `${labels[settings.maximum]} at ${settings.maximumLimit} BPM`;
  if (settings.maximum === "reverse") {
    value += `; -${settings.decreaseBy} BPM every ${settings.decreaseAfter} beats`;
  }
  return value;
}

function formatBreaks(settings) {
  if (settings.breaks === "none") {
    return "None";
  }
  if (settings.breaks === "unlimited") {
    return "Unlimited";
  }

  const count = settings.breakCount === null ? "unlimited count" : `${settings.breakCount} sessions`;
  const duration = settings.breakSecondsRaw
    ? `duration ${settings.breakSecondsRaw}`
    : "manual duration";
  return `Limited: ${count}; ${duration}`;
}

function playTone(frequency) {
  if (!audioContext || audioContext.state !== "running") {
    handleAudioFailure(new Error("The audio context is not running."));
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
    "Audio stopped unexpectedly. Return to settings and try again.",
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
  clearTimer("beatTimer");
  clearTimer("breakTimer");
  clearTimer("breakDisplayTimer");
}

function getErrorMessage(error, fallback) {
  return error instanceof Error && error.message ? error.message : fallback;
}

init();
