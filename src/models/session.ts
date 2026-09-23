import { ACTION_TYPES } from "../action-model.ts";
import type {
  Action,
  ActionType,
  BreakMode,
  MaximumMode,
  MetronomeAction,
  MetronomeSettings,
  NumericSetting,
  SecondsAction,
  StopwatchAction,
  ManualAction,
} from "../action-model.ts";
import type {
  PreTimerFormulaVariables,
  PreTimerRounding,
} from "../pre-timer-model.ts";
import type { BreakInput } from "./metronome-settings.ts";

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

export interface BreakRecord {
  number: number;
  beat: number;
  bpm: number;
  overLimit: boolean;
  durationSeconds: number | null;
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
  breakSeconds: BreakInput | null;
  breakSecondsRaw: string;
  lockSettings: boolean;
  lockBeats: NumericSetting;
  sessionEndEnabled: boolean;
  sessionEndBeats: NumericSetting;
  derivedEndTotal: number | null;
  derivedEndSources: string[];
}

export interface DerivedStopwatchEnd {
  total: number;
  sources: string[];
}

interface ActionResultBase<TType extends ActionType, TSettings> {
  id: string;
  type: TType;
  name: string;
  status: ActionResultStatus;
  settings: TSettings;
  startedAt?: number;
  elapsedSeconds?: number;
}

export interface MetronomeActionResult
  extends ActionResultBase<
    typeof ACTION_TYPES.METRONOME,
    MetronomeAction["settings"] | RuntimeMetronomeSettings
  > {
  beatCount?: number;
  breakRecords?: BreakRecord[];
  endReason?: "automatic" | "manual" | "aborted";
  derivedEnd?: DerivedStopwatchEnd | null;
}

export interface SecondsActionResult
  extends ActionResultBase<SecondsAction["type"], SecondsAction["settings"]> {
  configuredSeconds?: number;
  completedBy?: "auto" | "manual";
}

export interface StopwatchActionResult
  extends ActionResultBase<StopwatchAction["type"], StopwatchAction["settings"]> {
  completedBy?: "manual";
  formula?: string;
  rounding?: PreTimerRounding;
  roundingThreshold?: number | null;
  variables?: PreTimerFormulaVariables;
  substitution?: string | null;
  resultValid?: boolean;
  formulaResult?: number | null;
  invalidReason?: string | null;
  appliedBeats?: number;
  clamped?: boolean;
}

export interface ManualActionResult
  extends ActionResultBase<ManualAction["type"], ManualAction["settings"]> {
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
