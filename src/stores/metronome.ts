import { defineStore } from "pinia";
import { computed, onScopeDispose, ref, shallowRef } from "vue";
import {
  ACTION_TYPES,
  createDefaultAction,
  cloneActions,
  cloneAction,
  validateActionDefinitions,
} from "../action-model.ts";
import type {
  Action,
  ActionType,
  MetronomeAction,
  NumericSetting,
  StopwatchSettings,
} from "../action-model.ts";
import type { MetronomePreset } from "../presets.ts";
import {
  createDefaultMetronomeSettings,
  validateMetronomeActionSettings,
} from "../models/metronome-settings.ts";
import { validateStopwatchActionSettings } from "../models/stopwatch-settings.ts";
import {
  createFormulaValueRecord,
  getFormulaFieldLabel,
  getActionRuntimeMetronomeSettings,
  resolveActionFormulaValues,
  resolvePauseDuration,
} from "../models/action-formulas.ts";
import type { FormulaRuntimeAction } from "../formula-engine.ts";
import { findFormulaDependencyCycles } from "../models/formula-dependencies.ts";
import type {
  ActionResult,
  ActiveBreak,
  BreakRecord,
  FormulaValueRecord,
  MetronomeActionResult,
  RuntimeMetronomeSettings,
  RuntimeStopwatchSettings,
  SessionPhase,
  SessionReport,
  TempoDirection,
} from "../models/session.ts";
import {
  SessionEngine,
  type SessionEngineEvent,
  type SessionTimerName,
} from "../services/session-engine.ts";

const TONE = Object.freeze({
  regularFrequency: 440,
  accentFrequency: 880,
  countdownFrequency: 1760,
});

const SESSION_TIMERS: readonly SessionTimerName[] = [
  "action-deadline",
  "action-display",
  "countdown",
  "beat",
  "break-deadline",
  "break-display",
  "resume-countdown",
];

export const useMetronomeStore = defineStore("metronome", () => {
  const actionDefinitions = ref<Action[]>([
    createDefaultAction(
      ACTION_TYPES.METRONOME,
      [],
      createDefaultMetronomeSettings(),
    ),
  ]);
  const hideProgress = ref(false);
  const autoStart = ref(false);
  const actionError = ref("");
  const settingsError = ref("");

  const phase = ref<SessionPhase>("idle");
  const sessionToken = ref(0);
  const actionPlan = ref<Action[]>([]);
  const actionResults = ref<ActionResult[]>([]);
  const currentActionIndex = ref(-1);
  const activeActionStartedAt = ref<number | null>(null);
  const activeElapsedSeconds = ref(0);
  const settings = shallowRef<RuntimeMetronomeSettings | null>(null);
  const beatCount = ref(0);
  const currentBpm = ref<number>(120);
  const direction = ref<TempoDirection>("up");
  const tempoCounter = ref(0);
  const stuckAtMaximum = ref(false);
  const countdownValue = ref(3);
  const resumeCountdownValue = ref(0);
  const breakSessions = ref(0);
  const breakRecords = ref<BreakRecord[]>([]);
  const activeBreak = ref<ActiveBreak | null>(null);
  const activeBreakElapsedSeconds = ref(0);
  const executionMessage = ref("");
  const report = shallowRef<SessionReport | null>(null);

  const currentAction = computed(
    () => actionPlan.value[currentActionIndex.value] ?? null,
  );
  const currentActionResult = computed(
    () => actionResults.value[currentActionIndex.value] ?? null,
  );
  const currentStopwatchSettings = computed<RuntimeStopwatchSettings | null>(() => {
    const result = currentActionResult.value;
    if (
      result?.type !== ACTION_TYPES.STOPWATCH ||
      !isRuntimeStopwatchSettings(result.settings)
    ) {
      return null;
    }
    return result.settings;
  });
  const stopwatchLimitReached = computed(() => {
    const stopwatch = currentStopwatchSettings.value;
    return (
      stopwatch?.endMode === "manual" &&
      stopwatch.manualLimitSeconds !== null &&
      activeElapsedSeconds.value >= stopwatch.manualLimitSeconds
    );
  });
  const shouldWarnBeforeContinue = computed(() => {
    const stopwatch = currentStopwatchSettings.value;
    if (
      !stopwatch ||
      stopwatch.endMode === "unlimited" ||
      !stopwatch.earlyContinueWarning ||
      stopwatch.earlyContinueWarningSeconds === null
    ) {
      return false;
    }
    const endSeconds =
      stopwatch.endMode === "automatic"
        ? stopwatch.automaticSeconds
        : stopwatch.manualLimitSeconds;
    if (endSeconds === null) {
      return false;
    }
    return (
      endSeconds - activeElapsedSeconds.value >
      stopwatch.earlyContinueWarningSeconds
    );
  });
  const progressLabel = computed(() =>
    actionPlan.value.length === 0 || currentActionIndex.value < 0
      ? ""
      : hideProgress.value
        ? `Aktion ${currentActionIndex.value + 1}`
        : `Aktion ${currentActionIndex.value + 1} von ${actionPlan.value.length}`,
  );
  const isFinished = computed(() => phase.value === "finished");

  const engine = new SessionEngine();
  const unsubscribeEngine = engine.subscribe(handleEngineEvent);
  onScopeDispose(() => {
    unsubscribeEngine();
    engine.dispose();
  });

  function validateDefinitions(
    rawActions: unknown,
    requireMetronome = false,
  ) {
    return validateActionDefinitions(rawActions, {
      validateMetronomeSettings: validateMetronomeActionSettings,
      validateStopwatchSettings: validateStopwatchActionSettings,
      requireMetronome,
    });
  }

  function replaceActionDefinitions(
    rawActions: unknown,
    requireMetronome = false,
  ): boolean {
    const validation = validateDefinitions(rawActions, requireMetronome);
    if (!validation.valid) {
      actionError.value = formatActionErrors(validation.errors, rawActions);
      return false;
    }

    actionDefinitions.value = validation.actions;
    actionError.value = "";
    return true;
  }

  function applyPreset(preset: MetronomePreset): boolean {
    const validation = validateDefinitions(preset.values.actions, true);
    if (!validation.valid) {
      actionError.value = formatActionErrors(validation.errors, preset.values.actions);
      return false;
    }

    actionDefinitions.value = validation.actions;
    autoStart.value = preset.autoStart;
    hideProgress.value = preset.hideProgress;
    actionError.value = "";
    settingsError.value = "";
    return true;
  }

  function resetConfiguration(): void {
    actionDefinitions.value = [
      createDefaultAction(
        ACTION_TYPES.METRONOME,
        [],
        createDefaultMetronomeSettings(),
      ),
    ];
    autoStart.value = false;
    hideProgress.value = false;
    actionError.value = "";
    settingsError.value = "";
  }

  function addAction(type: ActionType): Action {
    const action = createDefaultAction(
      type,
      actionDefinitions.value,
      createDefaultMetronomeSettings(),
    );
    actionDefinitions.value = [...actionDefinitions.value, action];
    actionError.value = "";
    return action;
  }

  function updateAction(updatedAction: Action): boolean {
    const index = actionDefinitions.value.findIndex(
      (action) => action.id === updatedAction.id,
    );
    if (index < 0) {
      return false;
    }

    const nextActions = [...actionDefinitions.value];
    nextActions[index] = cloneAction(updatedAction);
    return replaceActionDefinitions(nextActions);
  }

  function removeAction(actionId: string): boolean {
    const nextActions = actionDefinitions.value.filter(
      (action) => action.id !== actionId,
    );
    if (nextActions.length === actionDefinitions.value.length) {
      return false;
    }
    const validation = validateDefinitions(nextActions);
    if (!validation.valid) {
      actionError.value = formatActionErrors(
        validation.errors,
        nextActions,
      );
      return false;
    }
    actionDefinitions.value = nextActions;
    actionError.value = "";
    return true;
  }

  function moveAction(actionId: string, targetIndex: number): boolean {
    const sourceIndex = actionDefinitions.value.findIndex(
      (action) => action.id === actionId,
    );
    if (
      sourceIndex < 0 ||
      targetIndex < 0 ||
      targetIndex >= actionDefinitions.value.length ||
      sourceIndex === targetIndex
    ) {
      return false;
    }

    const nextActions = [...actionDefinitions.value];
    const [action] = nextActions.splice(sourceIndex, 1);
    if (!action) {
      return false;
    }
    nextActions.splice(targetIndex, 0, action);
    const validation = validateDefinitions(nextActions);
    if (!validation.valid) {
      actionError.value = formatActionErrors(
        validation.errors,
        nextActions,
      );
      return false;
    }
    actionDefinitions.value = nextActions;
    actionError.value = "";
    return true;
  }

  async function startSession(): Promise<boolean> {
    actionError.value = "";
    settingsError.value = "";
    executionMessage.value = "";

    const validation = validateDefinitions(actionDefinitions.value, true);
    if (!validation.valid) {
      actionError.value = formatActionErrors(
        validation.errors,
        actionDefinitions.value,
      );
      return false;
    }
    actionDefinitions.value = validation.actions;
    const cycles = findFormulaDependencyCycles(validation.actions);
    if (cycles.length > 0) {
      actionError.value = cycles
        .map(
          (cycle) =>
            `${cycle.actionName}: Zirkelbezug zwischen ${cycle.fields.join(" → ")}.`,
        )
        .join(" ");
      return false;
    }
    const firstAction = validation.actions[0];
    if (firstAction) {
      const initialResolution = resolveActionFormulaValues(firstAction, []);
      if (!initialResolution.valid) {
        actionError.value = `${firstAction.name} — ${getFormulaFieldLabel(initialResolution.field)}: ${initialResolution.error}`;
        return false;
      }
    }

    try {
      await engine.ensureAudioReady();
    } catch (error) {
      settingsError.value = getErrorMessage(
        error,
        "Audio konnte nicht initialisiert werden. Audio-Berechtigung des Browsers prüfen und erneut versuchen.",
      );
      return false;
    }

    actionPlan.value = cloneActions(actionDefinitions.value);
    actionResults.value = actionPlan.value.map(createPendingActionResult);
    currentActionIndex.value = -1;
    report.value = null;
    sessionToken.value += 1;
    startNextAction();
    return phase.value !== "idle";
  }

  function continueTimerAction(confirmEarly = false): boolean {
    const action = currentAction.value;
    if (
      !action ||
      action.type === ACTION_TYPES.METRONOME ||
      phase.value === "finished"
    ) {
      return false;
    }
    if (shouldWarnBeforeContinue.value && !confirmEarly) {
      return false;
    }
    finishCurrentTimerAction("manual");
    return true;
  }

  function pauseOrResumeMetronome(): void {
    if (!settings.value || phase.value === "countdown") {
      return;
    }
    if (phase.value === "paused" || phase.value === "resume-countdown") {
      resumeFromBreak("manual", engine.now());
      return;
    }
    if (phase.value === "running") {
      startBreak();
    }
  }

  function continueMetronome(): boolean {
    if (
      !settings.value ||
      (phase.value !== "running" &&
        phase.value !== "paused" &&
        phase.value !== "resume-countdown")
    ) {
      return false;
    }
    if (
      settings.value.lockSettings &&
      beatCount.value < toNumber(settings.value.lockBeats, "lockBeats")
    ) {
      return false;
    }

    if (phase.value === "paused" || phase.value === "resume-countdown") {
      resumeFromBreak("ended", engine.now());
    }
    finalizeMetronomeAction("manual");
    return true;
  }

  function abortSession(): boolean {
    const action = currentAction.value;
    const result = currentActionResult.value;
    if (
      !action ||
      !result ||
      result.status !== "active" ||
      action.type !== result.type
    ) {
      return false;
    }

    switch (result.type) {
      case ACTION_TYPES.METRONOME:
        if (action.type !== ACTION_TYPES.METRONOME || !settings.value) {
          return false;
        }
        if (phase.value === "paused" || phase.value === "resume-countdown") {
          resumeFromBreak("aborted", engine.now());
        }
        result.settings = cloneValue(settings.value);
        result.beatCount = beatCount.value;
        result.breakRecords = cloneBreakRecords(breakRecords.value);
        result.endReason = "aborted";
        result.endBpm = currentBpm.value;
        break;
      case ACTION_TYPES.STOPWATCH:
        if (action.type !== ACTION_TYPES.STOPWATCH) {
          return false;
        }
        break;
    }
    result.status = "active-aborted";
    result.elapsedSeconds = getActiveActionElapsedSeconds();

    engine.cancelAll();
    sessionToken.value += 1;
    phase.value = "finished";
    settings.value = null;
    activeBreak.value = null;
    activeActionStartedAt.value = null;
    finalizeActionSequence(true);
    return true;
  }

  function repeatSession(): Promise<boolean> {
    return startSession();
  }

  function resetSession(): void {
    engine.cancelAll();
    sessionToken.value += 1;
    phase.value = "idle";
    settings.value = null;
    actionPlan.value = [];
    actionResults.value = [];
    currentActionIndex.value = -1;
    activeActionStartedAt.value = null;
    activeElapsedSeconds.value = 0;
    beatCount.value = 0;
    breakRecords.value = [];
    activeBreak.value = null;
    activeBreakElapsedSeconds.value = 0;
    report.value = null;
    executionMessage.value = "";
  }

  function handleEngineEvent(event: SessionEngineEvent): void {
    if (event.type === "audio-error") {
      handleAudioFailure(event.error);
      return;
    }
    if (event.token !== sessionToken.value) {
      return;
    }

    if (event.timer === "action-deadline" && event.kind === "timeout") {
      if (phase.value === "action-stoppuhr") {
        finishCurrentTimerAction("auto", event.now);
      }
      return;
    }
    if (event.timer === "action-display" && event.kind === "interval") {
      updateTimerDisplay(event.now);
      return;
    }
    if (event.timer === "countdown" && event.kind === "timeout") {
      handleCountdownStep(event.now);
      return;
    }
    if (event.timer === "beat" && event.kind === "timeout") {
      executeBeat(event.now);
      return;
    }
    if (event.timer === "break-deadline" && event.kind === "timeout") {
      beginAutoResumeCountdown(event.now);
      return;
    }
    if (event.timer === "break-display" && event.kind === "interval") {
      updateBreakDisplay(event.now);
      return;
    }
    if (event.timer === "resume-countdown" && event.kind === "timeout") {
      handleResumeCountdownStep(event.now);
    }
  }

  function startNextAction(): void {
    const nextIndex = currentActionIndex.value + 1;
    if (nextIndex >= actionPlan.value.length) {
      finalizeActionSequence(false);
      return;
    }

    cancelSessionTimers();
    sessionToken.value += 1;
    currentActionIndex.value = nextIndex;
    const action = actionPlan.value[nextIndex];
    const result = actionResults.value[nextIndex];
    if (!action || !result || action.type !== result.type) {
      throw new Error("The active action sequence is incomplete.");
    }

    const resolved = resolveActionFormulaValues(
      action,
      actionResults.value.slice(0, nextIndex),
    );
    if (!resolved.valid) {
      handleActionInitializationError(action, result, resolved.field, resolved.error);
      return;
    }

    result.status = "active";
    result.startedAt = engine.now();
    result.formulaValues = [...resolved.formulaValues];
    activeActionStartedAt.value = result.startedAt;
    activeElapsedSeconds.value = 0;

    switch (action.type) {
      case ACTION_TYPES.METRONOME:
        if (result.type !== ACTION_TYPES.METRONOME) {
          throw new Error("Metronome action results must match their action.");
        }
        startMetronomeAction(
          action,
          result,
          resolved.values,
          actionResults.value.slice(0, nextIndex),
        );
        break;
      case ACTION_TYPES.STOPWATCH:
        startTimerAction(action, result, resolved.values);
        break;
    }
  }

  function handleActionInitializationError(
    action: Action,
    result: ActionResult,
    field: string,
    error: string,
  ): void {
    const message = `${action.name} — ${getFormulaFieldLabel(field)}: ${error}`;
    result.initializationError = message;
    settingsError.value = message;
    executionMessage.value = message;

    if (currentActionIndex.value === 0) {
      cancelSessionTimers();
      sessionToken.value += 1;
      phase.value = "idle";
      actionPlan.value = [];
      actionResults.value = [];
      currentActionIndex.value = -1;
      activeActionStartedAt.value = null;
      settings.value = null;
      return;
    }
    finalizeActionSequence(false);
  }

  function startTimerAction(
    action: Action,
    result: ActionResult,
    resolvedValues: Readonly<Record<string, number>>,
  ): void {
    if (
      action.type !== ACTION_TYPES.STOPWATCH ||
      result.type !== ACTION_TYPES.STOPWATCH
    ) {
      throw new Error("Only Stopwatch actions can use the timer execution view.");
    }
    settings.value = null;
    activeBreak.value = null;
    executionMessage.value = "";
    phase.value = "action-stoppuhr";

    const automaticSeconds =
      action.settings.endMode === "automatic"
        ? getResolvedTimerValue(
            resolvedValues,
            "automaticSeconds",
            "Automatisches Ende",
          )
        : null;
    const manualLimitSeconds =
      action.settings.endMode === "manual"
        ? getResolvedTimerValue(
            resolvedValues,
            "manualLimitSeconds",
            "Manuelles Limit",
          )
        : null;
    const earlyContinueWarningSeconds =
      action.settings.endMode !== "unlimited" &&
      action.settings.earlyContinueWarning
        ? getResolvedTimerValue(
            resolvedValues,
            "earlyContinueWarningSeconds",
            "Frühwarnung",
          )
        : null;

    const runtimeSettings: RuntimeStopwatchSettings = {
      endMode: action.settings.endMode,
      automaticSeconds,
      hideDuration: action.settings.hideDuration,
      manualLimitSeconds,
      earlyContinueWarning: action.settings.earlyContinueWarning,
      earlyContinueWarningSeconds,
    };
    result.settings = runtimeSettings;
    updateTimerDisplay(engine.now());
    engine.scheduleInterval("action-display", sessionToken.value, 250);
    if (automaticSeconds !== null) {
      engine.scheduleTimeout(
        "action-deadline",
        sessionToken.value,
        automaticSeconds * 1000,
      );
    }
  }

  function updateTimerDisplay(now: number): void {
    const action = currentAction.value;
    if (!action || activeActionStartedAt.value === null) {
      return;
    }
    activeElapsedSeconds.value = getActiveActionElapsedSeconds(now);
  }

  function getActiveActionElapsedSeconds(now = engine.now()): number {
    if (activeActionStartedAt.value === null) {
      return 0;
    }
    return Math.max(
      0,
      Math.round((now - activeActionStartedAt.value) / 1000),
    );
  }

  function finishCurrentTimerAction(
    completedBy: "auto" | "manual",
    now = engine.now(),
  ): void {
    const action = currentAction.value;
    const result = currentActionResult.value;
    if (
      !action ||
      !result ||
      result.status !== "active" ||
      action.type === ACTION_TYPES.METRONOME ||
      action.type !== result.type
    ) {
      return;
    }

    engine.cancel("action-deadline");
    engine.cancel("action-display");
    sessionToken.value += 1;
    const elapsedSeconds = getActiveActionElapsedSeconds(now);
    result.status = "completed";
    result.elapsedSeconds = elapsedSeconds;
    if (action.type === ACTION_TYPES.STOPWATCH && result.type === ACTION_TYPES.STOPWATCH) {
      result.completedBy = completedBy;
    } else {
      throw new Error("The active action and result types do not match.");
    }
    activeActionStartedAt.value = null;
    startNextAction();
  }

  function startMetronomeAction(
    action: MetronomeAction,
    result: MetronomeActionResult,
    resolvedValues: Readonly<Record<string, number>>,
    previousResults: readonly ActionResult[],
  ): void {
    const runtimeSettings = getActionRuntimeMetronomeSettings(
      action,
      resolvedValues,
      previousResults,
    );
    result.settings = cloneValue(runtimeSettings);
    settings.value = runtimeSettings;
    phase.value = "countdown";
    beatCount.value = 0;
    currentBpm.value = runtimeSettings.initialBpm;
    direction.value = "up";
    tempoCounter.value = 0;
    stuckAtMaximum.value = false;
    countdownValue.value = 3;
    resumeCountdownValue.value = 0;
    breakSessions.value = 0;
    breakRecords.value = [];
    activeBreak.value = null;
    activeBreakElapsedSeconds.value = 0;
    executionMessage.value = "";
    if (!engine.playTone(TONE.countdownFrequency) || phase.value !== "countdown") {
      return;
    }
    scheduleCountdownStep();
  }

  function scheduleCountdownStep(): void {
    engine.scheduleTimeout("countdown", sessionToken.value, 1000);
  }

  function handleCountdownStep(now: number): void {
    if (phase.value !== "countdown") {
      return;
    }
    countdownValue.value -= 1;
    if (countdownValue.value <= 0) {
      beginBeatRun(now);
      return;
    }
    if (
      !engine.playTone(TONE.countdownFrequency) ||
      phase.value !== "countdown"
    ) {
      return;
    }
    scheduleCountdownStep();
  }

  function beginBeatRun(now: number): void {
    if (phase.value !== "countdown") {
      return;
    }
    phase.value = "running";
    executeBeat(now);
  }

  function executeBeat(now = engine.now()): void {
    const runtimeSettings = settings.value;
    if (phase.value !== "running" || !runtimeSettings) {
      return;
    }

    const isAccent =
      runtimeSettings.accentuate &&
      beatCount.value % toNumber(runtimeSettings.accentRepeat, "accentRepeat") ===
        0;
    currentBpm.value = Math.max(1, currentBpm.value);
    const tonePlayed = engine.playTone(
      isAccent ? TONE.accentFrequency : TONE.regularFrequency,
    );
    if (!tonePlayed || phase.value !== "running" || !settings.value) {
      return;
    }

    beatCount.value += 1;
    if (
      runtimeSettings.sessionEndEnabled &&
      beatCount.value >= toNumber(runtimeSettings.sessionEndBeats, "sessionEndBeats")
    ) {
      finalizeMetronomeAction("automatic");
      return;
    }
    applyTempoProgression();
    scheduleNextBeat(now);
  }

  function applyTempoProgression(): void {
    const runtimeSettings = settings.value;
    if (!runtimeSettings?.increaseTempo || stuckAtMaximum.value) {
      return;
    }

    const interval = toNumber(
      direction.value === "up"
        ? runtimeSettings.increaseAfter
        : runtimeSettings.decreaseAfter,
      direction.value === "up" ? "increaseAfter" : "decreaseAfter",
    );
    tempoCounter.value += 1;
    if (tempoCounter.value < interval) {
      return;
    }
    tempoCounter.value = 0;

    if (direction.value === "down") {
      const nextBpm =
        currentBpm.value - toNumber(runtimeSettings.decreaseBy, "decreaseBy");
      if (nextBpm <= runtimeSettings.initialBpm) {
        currentBpm.value = runtimeSettings.initialBpm;
        direction.value = "up";
      } else {
        currentBpm.value = nextBpm;
      }
      return;
    }

    let nextBpm =
      currentBpm.value + toNumber(runtimeSettings.increaseBy, "increaseBy");
    if (runtimeSettings.maximum === "none") {
      currentBpm.value = nextBpm;
      return;
    }

    const maximumLimit = toNumber(runtimeSettings.maximumLimit, "maximumLimit");
    if (nextBpm < maximumLimit) {
      currentBpm.value = nextBpm;
      return;
    }

    nextBpm = maximumLimit;
    currentBpm.value = nextBpm;
    if (runtimeSettings.maximum === "stick") {
      stuckAtMaximum.value = true;
      return;
    }
    if (runtimeSettings.maximum === "reset") {
      currentBpm.value = runtimeSettings.initialBpm;
      return;
    }
    direction.value = "down";
  }

  function scheduleNextBeat(now = engine.now()): void {
    if (phase.value !== "running") {
      return;
    }
    const interval = 60000 / currentBpm.value;
    const nextBeatDue = now + interval;
    engine.scheduleTimeout(
      "beat",
      sessionToken.value,
      Math.max(0, nextBeatDue - engine.now()),
    );
  }

  function startBreak(): void {
    const runtimeSettings = settings.value;
    if (!runtimeSettings) {
      return;
    }
    const action = currentAction.value;
    const result = currentActionResult.value;
    if (
      action?.type !== ACTION_TYPES.METRONOME ||
      result?.type !== ACTION_TYPES.METRONOME
    ) {
      throw new Error("Pause formulas require an active Metronom action.");
    }

    const sessionNumber = breakSessions.value + 1;
    breakSessions.value = sessionNumber;
    const breakCount =
      runtimeSettings.breakCount === null
        ? null
        : toNumber(runtimeSettings.breakCount, "breakCount");
    const record: BreakRecord = {
      number: sessionNumber,
      beat: beatCount.value,
      bpm: currentBpm.value,
      overLimit: breakCount !== null && sessionNumber > breakCount,
      durationSeconds: null,
      scheduledDurationSeconds: null,
      ended: "Active",
    };

    let durationSeconds: number | null = null;
    if (runtimeSettings.breakSecondsFormula) {
      const currentValues = Object.fromEntries(
        (result.formulaValues ?? []).map(({ field, value }) => [field, value]),
      );
      const evaluation = resolvePauseDuration(
        action,
        runtimeSettings.breakSecondsFormula,
        actionResults.value.slice(0, currentActionIndex.value),
        currentValues,
        currentBpm.value,
      );
      if (!evaluation.valid) {
        breakSessions.value -= 1;
        executionMessage.value = `Pausendauer konnte nicht berechnet werden: ${evaluation.error}`;
        return;
      }
      durationSeconds = evaluation.value;
      record.scheduledDurationSeconds = durationSeconds;
      record.formulaFallbackUsed = evaluation.fallbackUsed;
      record.formulaClamped = evaluation.clamped;
      const previousActions: FormulaRuntimeAction[] = actionResults.value
        .slice(0, currentActionIndex.value)
        .filter((previous) => previous.status === "completed")
        .map((previous) => ({
          id: previous.id,
          type: previous.type,
          name: previous.name,
          elapsedSeconds: previous.elapsedSeconds,
          endBpm:
            previous.type === ACTION_TYPES.METRONOME
              ? previous.endBpm
              : undefined,
        }));
      const formulaValue = createFormulaValueRecord(
        action,
        "breakSeconds",
        runtimeSettings.breakSecondsFormula,
        evaluation,
        previousActions,
      );
      result.formulaValues = [
        ...(result.formulaValues ?? []).filter(
          (entry) => entry.field !== "breakSeconds",
        ),
        formulaValue,
      ];
    }

    breakRecords.value.push(record);
    executionMessage.value = "";
    engine.cancel("beat");
    phase.value = "paused";
    const startedAt = engine.now();
    activeBreak.value = {
      record,
      durationSeconds,
      startedAt,
      deadline:
        durationSeconds === null
          ? null
          : startedAt + durationSeconds * 1000,
    };
    activeBreakElapsedSeconds.value = 0;

    if (durationSeconds !== null) {
      engine.scheduleTimeout(
        "break-deadline",
        sessionToken.value,
        Math.max(0, durationSeconds - Math.min(3, durationSeconds)) * 1000,
      );
      engine.scheduleInterval("break-display", sessionToken.value, 250);
    }
  }

  function updateBreakDisplay(now: number): void {
    const active = activeBreak.value;
    if (!active) {
      return;
    }
    activeBreakElapsedSeconds.value = Math.max(
      0,
      Math.round((now - active.startedAt) / 1000),
    );
  }

  function beginAutoResumeCountdown(now: number): void {
    const active = activeBreak.value;
    if (phase.value !== "paused" || !active) {
      return;
    }
    if (active.deadline === null || now >= active.deadline) {
      resumeFromBreak("timer", now);
      return;
    }
    if (active.durationSeconds === null) {
      resumeFromBreak("timer", now);
      return;
    }

    phase.value = "resume-countdown";
    resumeCountdownValue.value = Math.min(3, active.durationSeconds);
    if (
      !engine.playTone(TONE.countdownFrequency) ||
      phase.value !== "resume-countdown"
    ) {
      return;
    }
    scheduleAutoResumeCountdownStep();
  }

  function scheduleAutoResumeCountdownStep(): void {
    engine.scheduleTimeout(
      "resume-countdown",
      sessionToken.value,
      1000,
    );
  }

  function handleResumeCountdownStep(now: number): void {
    if (phase.value !== "resume-countdown") {
      return;
    }
    const active = activeBreak.value;
    if (
      !active ||
      active.deadline === null ||
      now >= active.deadline
    ) {
      resumeFromBreak("timer", now);
      return;
    }
    if (resumeCountdownValue.value > 1) {
      resumeCountdownValue.value -= 1;
      if (
        !engine.playTone(TONE.countdownFrequency) ||
        phase.value !== "resume-countdown"
      ) {
        return;
      }
      scheduleAutoResumeCountdownStep();
      return;
    }
    resumeFromBreak("timer", now);
  }

  function resumeFromBreak(
    reason: "timer" | "manual" | "ended" | "aborted",
    now: number,
  ): void {
    const active = activeBreak.value;
    if (
      (phase.value !== "paused" && phase.value !== "resume-countdown") ||
      !active
    ) {
      return;
    }

    engine.cancel("break-deadline");
    engine.cancel("resume-countdown");
    engine.cancel("break-display");
    const elapsedSeconds = Math.max(
      0,
      Math.round((now - active.startedAt) / 1000),
    );
    active.record.durationSeconds = elapsedSeconds;
    active.record.ended =
      reason === "timer"
        ? `Automatisch fortgesetzt nach ${elapsedSeconds} Sekunden`
        : reason === "ended"
          ? `Weiter nach ${elapsedSeconds} Sekunden`
          : reason === "aborted"
            ? `Abgebrochen nach ${elapsedSeconds} Sekunden`
            : `Manuell fortgesetzt nach ${elapsedSeconds} Sekunden`;
    activeBreak.value = null;
    activeBreakElapsedSeconds.value = 0;
    resumeCountdownValue.value = 0;
    executionMessage.value = "";

    if (reason === "ended" || reason === "aborted") {
      return;
    }
    phase.value = "running";
    scheduleNextBeat(now);
  }

  function finalizeMetronomeAction(
    endReason: "automatic" | "manual",
  ): void {
    const result = currentActionResult.value;
    if (
      !result ||
      result.type !== ACTION_TYPES.METRONOME ||
      result.status !== "active" ||
      !settings.value
    ) {
      return;
    }
    result.status = "completed";
    result.elapsedSeconds = getActiveActionElapsedSeconds();
    result.settings = cloneValue(settings.value);
    result.beatCount = beatCount.value;
    result.breakRecords = cloneBreakRecords(breakRecords.value);
    result.endReason = endReason;
    result.endBpm = currentBpm.value;

    cancelSessionTimers();
    sessionToken.value += 1;
    phase.value = "transition";
    settings.value = null;
    activeBreak.value = null;
    activeActionStartedAt.value = null;
    startNextAction();
  }

  function finalizeActionSequence(aborted: boolean): void {
    cancelSessionTimers();
    sessionToken.value += 1;
    phase.value = "finished";
    settings.value = null;
    activeBreak.value = null;
    activeActionStartedAt.value = null;
    report.value = {
      actions: cloneActionResults(actionResults.value),
      aborted,
    };
  }

  function handleAudioFailure(error: Error): void {
    cancelSessionTimers();
    sessionToken.value += 1;
    phase.value = "idle";
    settings.value = null;
    actionPlan.value = [];
    actionResults.value = [];
    currentActionIndex.value = -1;
    activeActionStartedAt.value = null;
    activeBreak.value = null;
    settingsError.value = getErrorMessage(
      error,
      "Audio wurde unerwartet beendet. Zu den Einstellungen zurückkehren und erneut versuchen.",
    );
    executionMessage.value = settingsError.value;
  }

  function cancelSessionTimers(): void {
    SESSION_TIMERS.forEach((timer) => engine.cancel(timer));
  }

  return {
    actionDefinitions,
    hideProgress,
    autoStart,
    actionError,
    settingsError,
    phase,
    sessionToken,
    actionPlan,
    actionResults,
    currentActionIndex,
    activeActionStartedAt,
    activeElapsedSeconds,
    settings,
    beatCount,
    currentBpm,
    direction,
    tempoCounter,
    stuckAtMaximum,
    countdownValue,
    resumeCountdownValue,
    breakSessions,
    breakRecords,
    activeBreak,
    activeBreakElapsedSeconds,
    executionMessage,
    report,
    currentAction,
    currentActionResult,
    currentStopwatchSettings,
    stopwatchLimitReached,
    shouldWarnBeforeContinue,
    progressLabel,
    isFinished,
    validateDefinitions,
    replaceActionDefinitions,
    applyPreset,
    resetConfiguration,
    addAction,
    updateAction,
    removeAction,
    moveAction,
    startSession,
    continueTimerAction,
    pauseOrResumeMetronome,
    continueMetronome,
    abortSession,
    repeatSession,
    resetSession,
  };
});

function createPendingActionResult(action: Action): ActionResult {
  const base = {
    id: action.id,
    name: action.name,
    status: "not-started" as const,
  };
  switch (action.type) {
    case ACTION_TYPES.METRONOME:
      return {
        ...base,
        type: action.type,
        settings: cloneValue(action.settings),
      };
    case ACTION_TYPES.STOPWATCH:
      return {
        ...base,
        type: action.type,
        settings: cloneValue(action.settings),
      };
  }
}

function cloneActionResults(results: readonly ActionResult[]): ActionResult[] {
  return results.map((result) => cloneValue(result));
}

function cloneBreakRecords(records: readonly BreakRecord[]): BreakRecord[] {
  return records.map((record) => ({ ...record }));
}

function cloneValue<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((nested: unknown) => cloneValue(nested)) as T;
  }
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, cloneValue(nested)]),
    ) as T;
  }
  return value;
}

function formatActionErrors(
  errors: readonly { index: number; field: string; message: string }[],
  rawActions: unknown,
): string {
  const actions = Array.isArray(rawActions) ? rawActions : [];
  return errors
    .map((error) => {
      if (error.index < 0) {
        return error.message;
      }
      const rawAction = actions[error.index];
      const name =
        isRecord(rawAction) && typeof rawAction.name === "string"
          ? rawAction.name
          : "ohne Namen";
      return `Aktion ${error.index + 1} (${name}): ${error.message}`;
    })
    .join(" ");
}

function toNumber(value: NumericSetting, field: string): number {
  const numberValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numberValue)) {
    throw new Error(`The configured ${field} value is not numeric.`);
  }
  return numberValue;
}

function getResolvedTimerValue(
  values: Readonly<Record<string, number>>,
  field: string,
  label: string,
): number {
  const value = values[field];
  if (typeof value !== "number") {
    throw new Error(`The resolved ${label} value is unavailable.`);
  }
  return value;
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isRuntimeStopwatchSettings(
  settings: StopwatchSettings | RuntimeStopwatchSettings,
): settings is RuntimeStopwatchSettings {
  return (
    (typeof settings.automaticSeconds === "number" ||
      settings.automaticSeconds === null) &&
    (typeof settings.manualLimitSeconds === "number" ||
      settings.manualLimitSeconds === null) &&
    (typeof settings.earlyContinueWarningSeconds === "number" ||
      settings.earlyContinueWarningSeconds === null)
  );
}
