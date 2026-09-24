import { ACTION_TYPES } from "../action-model.ts";
import type {
  ActionType,
  BreakMode,
  MaximumMode,
  MetronomeAction,
  ManualAction,
  NumericSetting,
  SecondsAction,
  StopwatchAction,
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
  | "action-sekunden"
  | "action-stoppuhr"
  | "action-manuell";

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
  lockBeats: NumericSetting;
  sessionEndEnabled: boolean;
  sessionEndBeats: NumericSetting;
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

export interface SecondsActionResult
  extends ActionResultBase<
    SecondsAction["type"],
    SecondsAction["settings"] | { seconds: number }
  > {
  configuredSeconds?: number;
  completedBy?: "auto" | "manual";
}

export interface StopwatchActionResult
  extends ActionResultBase<StopwatchAction["type"], StopwatchAction["settings"]> {
  completedBy?: "manual";
}

export interface ManualActionResult
  extends ActionResultBase<
    ManualAction["type"],
    ManualAction["settings"] | { limitSeconds: number | null }
  > {
  completedBy?: "manual";
  limitSeconds?: number | null;
}

export type ActionResult =
  | MetronomeActionResult
  | SecondsActionResult
  | StopwatchActionResult
  | ManualActionResult;

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
