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
  MetronomeSettings,
  NumericSetting,
  SecondsAction,
  StopwatchAction,
} from "../action-model.ts";
import {
  evaluatePreTimerFormula,
  getPreTimerFormulaVariables,
  isStaticPreTimerFormula,
} from "../pre-timer-model.ts";
import type { PreTimerFormulaVariables } from "../pre-timer-model.ts";
import type { MetronomePreset } from "../presets.ts";
import {
  createDefaultMetronomeSettings,
  getMetronomeMaximumLimit,
  getStopwatchSourcesBeforeMetronome,
  parseBreakInput,
  validateMetronomeActionSettings,
} from "../models/metronome-settings.ts";
import type {
  BreakInput,
  StopwatchActionSource,
} from "../models/metronome-settings.ts";
import type {
  ActionResult,
  ActiveBreak,
  BreakRecord,
  RuntimeMetronomeSettings,
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
  const secondsRemaining = ref(0);
  const settings = shallowRef<RuntimeMetronomeSettings | null>(null);
  const beatCount = ref(0);
  const currentBpm = ref(createDefaultMetronomeSettings().bpm);
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
  const progressLabel = computed(() =>
    actionPlan.value.length === 0 || currentActionIndex.value < 0
      ? ""
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
    actionDefinitions.value = nextActions;
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
    if (
      action.type === ACTION_TYPES.SECONDS &&
      getActiveSecondsRemaining() > 10 &&
      !confirmEarly
    ) {
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
    if (!action || !result || result.status !== "active") {
      return false;
    }

    const abortedSettings =
      action.type === ACTION_TYPES.METRONOME ? settings.value : action.settings;
    if (!abortedSettings) {
      return false;
    }
    if (
      action.type === ACTION_TYPES.METRONOME &&
      (phase.value === "paused" || phase.value === "resume-countdown")
    ) {
      resumeFromBreak("aborted", engine.now());
    }
    result.status = "active-aborted";
    result.elapsedSeconds = getActiveActionElapsedSeconds();
    result.settings = cloneValue(abortedSettings);
    if (action.type === ACTION_TYPES.METRONOME) {
      result.beatCount = beatCount.value;
      result.breakRecords = cloneBreakRecords(breakRecords.value);
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
    secondsRemaining.value = 0;
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
      if (phase.value === "action-sekunden") {
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
    if (!action || !result) {
      throw new Error("The active action sequence is incomplete.");
    }

    result.status = "active";
    result.startedAt = engine.now();
    activeActionStartedAt.value = result.startedAt;
    activeElapsedSeconds.value = 0;
    secondsRemaining.value = 0;

    if (action.type === ACTION_TYPES.METRONOME) {
      startMetronomeAction(action, result);
    } else {
      startTimerAction(action);
    }
  }

  function startTimerAction(
    action: Exclude<Action, MetronomeAction>,
  ): void {
    settings.value = null;
    activeBreak.value = null;
    executionMessage.value = "";
    phase.value =
      action.type === ACTION_TYPES.SECONDS
        ? "action-sekunden"
        : action.type === ACTION_TYPES.STOPWATCH
          ? "action-stoppuhr"
          : "action-manuell";
    updateTimerDisplay(engine.now());
    engine.scheduleInterval("action-display", sessionToken.value, 250);

    if (action.type === ACTION_TYPES.SECONDS) {
      engine.scheduleTimeout(
        "action-deadline",
        sessionToken.value,
        action.settings.seconds * 1000,
      );
    }
  }

  function updateTimerDisplay(now: number): void {
    const action = currentAction.value;
    if (!action || activeActionStartedAt.value === null) {
      return;
    }
    activeElapsedSeconds.value = getActiveActionElapsedSeconds(now);
    secondsRemaining.value =
      action.type === ACTION_TYPES.SECONDS
        ? getActiveSecondsRemaining(now)
        : 0;
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

  function getActiveSecondsRemaining(now = engine.now()): number {
    const action = currentAction.value;
    if (
      action?.type !== ACTION_TYPES.SECONDS ||
      activeActionStartedAt.value === null
    ) {
      return 0;
    }
    return Math.max(
      0,
      Math.ceil(
        (activeActionStartedAt.value + action.settings.seconds * 1000 - now) /
          1000,
      ),
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
      action.type === ACTION_TYPES.METRONOME
    ) {
      return;
    }

    engine.cancel("action-deadline");
    engine.cancel("action-display");
    sessionToken.value += 1;
    const elapsedSeconds = getActiveActionElapsedSeconds(now);
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
    activeActionStartedAt.value = null;
    startNextAction();
  }

  function completeStopwatchResult(
    action: StopwatchAction,
    result: ActionResult,
    elapsedSeconds: number,
  ): void {
    const { settings: stopwatchSettings } = action;
    const variables = getPreTimerFormulaVariables(
      elapsedSeconds,
      stopwatchSettings.rounding,
      stopwatchSettings.roundingThreshold,
    );
    const evaluation = evaluatePreTimerFormula(
      stopwatchSettings.formula,
      variables,
    );
    result.formula = stopwatchSettings.formula;
    result.rounding = stopwatchSettings.rounding;
    result.roundingThreshold = stopwatchSettings.roundingThreshold;
    result.variables = variables;
    result.substitution = evaluation.valid ? evaluation.substitution : null;
    result.resultValid = evaluation.valid;
    result.formulaResult = evaluation.valid ? evaluation.result : null;
    result.invalidReason = evaluation.valid ? null : evaluation.error;

    if (isStaticPreTimerFormula(stopwatchSettings.formula)) {
      result.appliedBeats = evaluation.valid
        ? evaluation.result
        : stopwatchSettings.min;
      return;
    }
    if (!evaluation.valid) {
      result.appliedBeats = stopwatchSettings.min;
      return;
    }
    result.appliedBeats = Math.max(
      stopwatchSettings.min,
      stopwatchSettings.max === null
        ? evaluation.result
        : Math.min(stopwatchSettings.max, evaluation.result),
    );
    result.clamped = result.appliedBeats !== evaluation.result;
  }

  function startMetronomeAction(
    action: MetronomeAction,
    result: ActionResult,
  ): void {
    const derived = getDerivedStopwatchEnd(currentActionIndex.value);
    const runtimeSettings = createRuntimeMetronomeSettings(
      action.settings,
      derived,
    );
    result.settings = cloneValue(runtimeSettings);
    result.derivedEnd = derived
      ? { total: derived.total, sources: derived.sources.map((source) => source.name) }
      : null;
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

  function createRuntimeMetronomeSettings(
    configured: MetronomeSettings,
    derived: { total: number; sources: StopwatchActionSource[] } | null,
  ): RuntimeMetronomeSettings {
    let breakSeconds: BreakInput | null = null;
    if (configured.breaks === "limited" && configured.breakSeconds) {
      const parsed = parseBreakInput(configured.breakSeconds);
      if (!parsed.valid) {
        throw new Error(parsed.error);
      }
      breakSeconds = parsed.value;
    }
    const total = derived?.total ?? null;
    return {
      initialBpm: configured.bpm,
      accentuate: configured.accentuate,
      accentRepeat: configured.accentRepeat,
      increaseTempo: configured.increaseTempo,
      increaseBy: configured.increaseBy,
      increaseAfter: configured.increaseAfter,
      maximum: configured.maximum,
      maximumLimit: getMetronomeMaximumLimit(configured),
      decreaseBy: configured.decreaseBy,
      decreaseAfter: configured.decreaseAfter,
      breaks: configured.breaks,
      breakCount: configured.breaks === "limited" ? configured.breakCount : null,
      breakSeconds,
      breakSecondsRaw:
        configured.breaks === "limited" ? configured.breakSeconds : "",
      lockSettings: derived ? true : configured.lockSettings,
      lockBeats: derived ? derived.total : configured.lockBeats,
      sessionEndEnabled: derived ? true : configured.sessionEndEnabled,
      sessionEndBeats: derived ? derived.total : configured.sessionEndBeats,
      derivedEndTotal: total,
      derivedEndSources: derived?.sources.map((source) => source.name) ?? [],
    };
  }

  function getDerivedStopwatchEnd(
    metronomeIndex: number,
  ): {
    total: number;
    sources: (StopwatchActionSource & { appliedBeats: number })[];
  } | null {
    const sources = getStopwatchSourcesBeforeMetronome(
      actionPlan.value,
      metronomeIndex,
    );
    if (sources.length === 0) {
      return null;
    }

    const completedSources = sources.map((source) => {
      const result = actionResults.value.find(
        (entry) => entry.id === source.id,
      );
      const appliedBeats = result?.appliedBeats;
      if (
        !result ||
        !source.id ||
        typeof appliedBeats !== "number" ||
        !Number.isSafeInteger(appliedBeats) ||
        appliedBeats < 1
      ) {
        throw new Error(
          "A preceding Stoppuhr action has no valid applied beat result.",
        );
      }
      return { ...source, appliedBeats };
    });
    return {
      total: completedSources.reduce(
        (total, source) => total + source.appliedBeats,
        0,
      ),
      sources: completedSources,
    };
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
      ended: "Active",
    };
    breakRecords.value.push(record);

    let durationSeconds: number | null = null;
    if (runtimeSettings.breakSeconds) {
      durationSeconds = evaluateBreakDuration(
        runtimeSettings.breakSeconds,
        currentBpm.value,
      );
      if (durationSeconds === null) {
        breakRecords.value.pop();
        breakSessions.value -= 1;
        executionMessage.value =
          "Dieser Pausenausdruck ist beim aktuellen BPM nicht positiv; die Pause wurde nicht gestartet.";
        return;
      }
    }

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

  function evaluateBreakDuration(
    parsedInput: BreakInput,
    bpm: number,
  ): number | null {
    let seconds: number;
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

  function finalizeMetronomeAction(
    endReason: "automatic" | "manual",
  ): void {
    const result = currentActionResult.value;
    if (!result || result.status !== "active" || !settings.value) {
      return;
    }
    result.status = "completed";
    result.settings = cloneValue(settings.value);
    result.beatCount = beatCount.value;
    result.breakRecords = cloneBreakRecords(breakRecords.value);
    result.endReason = endReason;

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
    secondsRemaining,
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
  return {
    id: action.id,
    type: action.type,
    name: action.name,
    status: "not-started",
    settings: cloneAction(action).settings,
  };
}

function cloneActionResults(results: readonly ActionResult[]): ActionResult[] {
  return results.map((result) => ({
    ...result,
    settings: cloneValue(result.settings),
    breakRecords: result.breakRecords
      ? cloneBreakRecords(result.breakRecords)
      : undefined,
    derivedEnd: result.derivedEnd
      ? {
          total: result.derivedEnd.total,
          sources: [...result.derivedEnd.sources],
        }
      : result.derivedEnd,
    variables: result.variables ? { ...result.variables } : undefined,
  }));
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

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
