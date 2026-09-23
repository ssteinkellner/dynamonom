export const PRE_TIMER_TYPES = Object.freeze({
  SECONDS: "sekunden",
  STOPWATCH: "stoppuhr",
  MANUAL: "manuell",
} as const);

export type PreTimerType = typeof PRE_TIMER_TYPES[keyof typeof PRE_TIMER_TYPES];

export const PRE_TIMER_TYPE_LABELS = Object.freeze({
  [PRE_TIMER_TYPES.SECONDS]: "Sekunden",
  [PRE_TIMER_TYPES.STOPWATCH]: "Stoppuhr",
  [PRE_TIMER_TYPES.MANUAL]: "Manuell",
} satisfies Record<PreTimerType, string>);

export function getPreTimerTypeLabel(type: string): string {
  return isPreTimerType(type) ? PRE_TIMER_TYPE_LABELS[type] : type;
}

export function getPreTimerDefaultName(type: PreTimerType): string {
  return getPreTimerTypeLabel(type);
}

export function formatPreTimerDuration(seconds: number): string {
  const totalSeconds = Math.max(0, Math.round(Number(seconds) || 0));
  const minutes = Math.floor(totalSeconds / 60);
  const remainder = totalSeconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function isPreTimerType(value: unknown): value is PreTimerType {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(PRE_TIMER_TYPE_LABELS, value)
  );
}
