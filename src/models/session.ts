import { ACTION_TYPES } from "../action-model.ts";
import type {
  ActionType,
  BreakMode,
  MaximumMode,
  MetronomeAction,
  NumericSetting,
  StopwatchEndMode,
  StopwatchAction,
  StopwatchSettings,
} from "../action-model.ts";
import type { NumericFormulaInput } from "../formula-model.ts";

export type SessionPhase =
  | "idle"
  | "countdown"
  | "running"
  | "paused"
  | "resume-countdown"
  | "transition"
  | "finished"
  | "action-stoppuhr";

export type ActionResultStatus =
  | "not-started"
  | "active"
  | "completed"
  | "active-aborted";

export interface FormulaValueRecord {
  field: string;
  label: string;
  expression: string;
  value: number;
  isStatic: boolean;
  fallbackUsed: boolean;
  clamped: boolean;
}

export interface BreakRecord {
  number: number;
  beat: number;
  bpm: number;
  overLimit: boolean;
  durationSeconds: number | null;
  scheduledDurationSeconds: number | null;
  formulaFallbackUsed?: boolean;
  formulaClamped?: boolean;
  ended: string;
}

export interface RuntimeMetronomeSettings {
  initialBpm: number;
  accentuate: boolean;
  accentRepeat: NumericSetting;
  increaseTempo: boolean;
  increaseBy: NumericSetting;
  increaseAfter: NumericSetting;
  maximum: MaximumMode;
  maximumLimit: NumericSetting;
  decreaseBy: NumericSetting;
  decreaseAfter: NumericSetting;
  breaks: BreakMode;
  breakCount: NumericSetting | null;
  breakSecondsFormula: NumericFormulaInput | null;
  breakSecondsRaw: string;
  lockSettings: boolean;
  hideLockText: boolean;
  hideNextTempo: boolean;
  lockBeats: NumericSetting;
  sessionEndEnabled: boolean;
  sessionEndBeats: NumericSetting;
}

export interface RuntimeStopwatchSettings {
  endMode: StopwatchEndMode;
  automaticSeconds: number | null;
  hideDuration: boolean;
  manualLimitSeconds: number | null;
  earlyContinueWarning: boolean;
  earlyContinueWarningSeconds: number | null;
}

interface ActionResultBase<TType extends ActionType, TSettings> {
  id: string;
  type: TType;
  name: string;
  status: ActionResultStatus;
  settings: TSettings;
  startedAt?: number;
  elapsedSeconds?: number;
  formulaValues?: FormulaValueRecord[];
  initializationError?: string;
}

export interface MetronomeActionResult
  extends ActionResultBase<
    typeof ACTION_TYPES.METRONOME,
    MetronomeAction["settings"] | RuntimeMetronomeSettings
  > {
  beatCount?: number;
  breakRecords?: BreakRecord[];
  endReason?: "automatic" | "manual" | "aborted";
  endBpm?: number;
}

export interface StopwatchActionResult
  extends ActionResultBase<
    StopwatchAction["type"],
    StopwatchSettings | RuntimeStopwatchSettings
  > {
  completedBy?: "auto" | "manual";
}

export type ActionResult = MetronomeActionResult | StopwatchActionResult;

export interface SessionReport {
  actions: ActionResult[];
  aborted: boolean;
}

export interface ActiveBreak {
  record: BreakRecord;
  durationSeconds: number | null;
  startedAt: number;
  deadline: number | null;
}

export type TempoDirection = "up" | "down";
