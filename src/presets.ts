import {
  ACTION_TYPES,
  createDefaultStopwatchSettings,
} from "./action-model.ts";
import type {
  MetronomeAction,
  StopwatchAction,
} from "./action-model.ts";
import {
  createFormulaDateNode,
  createFormulaNodeId,
  createNumericFormulaInput,
  createStaticFormulaNode,
} from "./formula-model.ts";
import type {
  FormulaMetric,
  FormulaNode,
  NumericFormulaInput,
} from "./formula-model.ts";
import { createDefaultMetronomeSettings } from "./models/metronome-settings.ts";

export type PresetActionDefinition =
  | (Omit<MetronomeAction, "id"> & { id?: string })
  | (Omit<StopwatchAction, "id"> & { id?: string });

export interface MetronomePreset {
  label: string;
  autoStart: boolean;
  hideProgress: boolean;
  actions: readonly PresetActionDefinition[];
}

function presetAction(
  values: {
    bpm: number;
    increaseBy: number;
    maximumLimit: number;
    breakCount: number;
    breakSeconds: number;
  },
): PresetActionDefinition {
  const settings = createDefaultMetronomeSettings();
  return {
    type: ACTION_TYPES.METRONOME,
    name: "Metronom",
    settings: {
      ...settings,
      bpm: createNumericFormulaInput(values.bpm, 20, 300),
      increaseBy: createNumericFormulaInput(values.increaseBy, 1, 20),
      maximum: "stick",
      maximumLimitStick: createNumericFormulaInput(
        values.maximumLimit,
        60,
        400,
      ),
      maximumLimitReset: createNumericFormulaInput(
        values.maximumLimit,
        60,
        400,
      ),
      maximumLimitReverse: createNumericFormulaInput(
        values.maximumLimit,
        60,
        400,
      ),
      breaks: "limited",
      breakCount: createNumericFormulaInput(values.breakCount, 1, null),
      breakSeconds: createNumericFormulaInput(values.breakSeconds, 1, null),
      sessionEndEnabled: true,
      lockSettings: true,
    },
  };
}

function createFormulaInput(
  expression: FormulaNode,
  min: number,
  max: number | null,
): NumericFormulaInput {
  return {
    expression,
    min: createStaticFormulaNode(min),
    max: max === null ? null : createStaticFormulaNode(max),
  };
}

function createOperator(
  operator: "+" | "-" | "*" | "/",
  left: FormulaNode,
  right: FormulaNode,
): FormulaNode {
  return {
    id: createFormulaNodeId(),
    type: "operator",
    operator,
    left,
    right,
  };
}

function createFallback(input: FormulaNode, fallback = 1): FormulaNode {
  return {
    id: createFormulaNodeId(),
    type: "fallback",
    input,
    fallback,
  };
}

function createReference(
  actionId: string,
  metric: FormulaMetric,
): FormulaNode {
  return {
    id: createFormulaNodeId(),
    type: "reference",
    actionId,
    metric,
  };
}

function createCurrent(property: string): FormulaNode {
  return {
    id: createFormulaNodeId(),
    type: "current",
    property,
  };
}

function createClamp(
  min: FormulaNode,
  input: FormulaNode,
  max: FormulaNode | null = null,
): FormulaNode {
  return {
    id: createFormulaNodeId(),
    type: "clamp",
    min,
    input,
    max,
  };
}

function createSessionEndLock(): NumericFormulaInput {
  return createFormulaInput(
    createFallback(createCurrent("sessionEndBeats")),
    1,
    null,
  );
}

function createMetronomeSettings(
  sessionEndBeats: NumericFormulaInput,
  breakCount: NumericFormulaInput | null = null,
): MetronomeAction["settings"] {
  const settings = createDefaultMetronomeSettings();
  return {
    ...settings,
    bpm: createNumericFormulaInput(160, 20, 300),
    increaseTempo: false,
    breaks: breakCount ? "limited" : settings.breaks,
    breakCount,
    breakSeconds: null,
    sessionEndEnabled: true,
    sessionEndBeats,
    lockSettings: true,
    lockBeats: createSessionEndLock(),
  };
}

function createManualStopwatch(
  id: string,
  name: string,
): PresetActionDefinition {
  return {
    id,
    type: ACTION_TYPES.STOPWATCH,
    name,
    settings: {
      ...createDefaultStopwatchSettings(),
      endMode: "manual",
    },
  };
}

function createStaticSessionEnd(value: number): NumericFormulaInput {
  return createNumericFormulaInput(value, 1, null);
}

function createDateSessionEnd(): NumericFormulaInput {
  const days = createFallback(
    createFormulaDateNode("days", "2026-09-13"),
    1,
  );
  return createFormulaInput(
    createOperator(
      "*",
      createOperator("+", days, createStaticFormulaNode(2)),
      createStaticFormulaNode(10),
    ),
    1,
    null,
  );
}

function createElapsedMinutesExpression(
  firstActionId: string,
  secondActionId: string,
  metric: FormulaMetric,
): FormulaNode {
  return createOperator(
    "+",
    createFallback(createReference(firstActionId, metric)),
    createFallback(createReference(secondActionId, metric)),
  );
}

function createTwoStopwatchBreakCount(
  firstStopwatchActionId: string,
  secondStopwatchActionId: string,
): NumericFormulaInput {
  return createFormulaInput(
    createElapsedMinutesExpression(
      firstStopwatchActionId,
      secondStopwatchActionId,
      "minutes",
    ),
    1,
    null,
  );
}

function createTwoStopwatchSessionEnd(
  firstStopwatchActionId: string,
  secondStopwatchActionId: string,
): NumericFormulaInput {
  const elapsedSum = createElapsedMinutesExpression(
    firstStopwatchActionId,
    secondStopwatchActionId,
    "sum-minutes",
  );
  return createFormulaInput(
    createClamp(
      createStaticFormulaNode(200),
      createOperator("*", elapsedSum, createStaticFormulaNode(10)),
    ),
    1,
    null,
  );
}

export const METRONOME_PRESETS = Object.freeze({
  "120-150-2x10": Object.freeze({
    label: "120-150 : 2x10",
    autoStart: true,
    hideProgress: false,
    actions: [
      Object.freeze(
        presetAction({
          bpm: 120,
          increaseBy: 2,
          maximumLimit: 150,
          breakCount: 2,
          breakSeconds: 10,
        }),
      ),
    ],
  }),
  "130-200-4x5": Object.freeze({
    label: "130-200 : 4x5",
    autoStart: true,
    hideProgress: false,
    actions: [
      Object.freeze(
        presetAction({
          bpm: 130,
          increaseBy: 10,
          maximumLimit: 200,
          breakCount: 4,
          breakSeconds: 5,
        }),
      ),
    ],
  }),
  unterwegs: Object.freeze({
    label: "unterwegs",
    autoStart: true,
    hideProgress: false,
    actions: [
      Object.freeze({
        id: "preset-unterwegs",
        type: ACTION_TYPES.METRONOME,
        name: "unterwegs",
        settings: createMetronomeSettings(createDateSessionEnd()),
      }),
    ],
  }),
  "zu-hause": Object.freeze({
    label: "zu hause",
    autoStart: true,
    hideProgress: false,
    actions: [
      Object.freeze({
        id: "preset-zu-hause",
        type: ACTION_TYPES.METRONOME,
        name: "zu hause",
        settings: createMetronomeSettings(createStaticSessionEnd(200)),
      }),
    ],
  }),
  "two-stopwatches-metronome": Object.freeze({
    label: "2x Stoppuhr + Metronom",
    autoStart: true,
    hideProgress: false,
    actions: [
      Object.freeze(
        createManualStopwatch("preset-stoppuhr-1", "Stoppuhr 1"),
      ),
      Object.freeze(
        createManualStopwatch("preset-stoppuhr-2", "Stoppuhr 2"),
      ),
      Object.freeze({
        id: "preset-summe",
        type: ACTION_TYPES.METRONOME,
        name: "summe",
        settings: createMetronomeSettings(
          createTwoStopwatchSessionEnd(
            "preset-stoppuhr-1",
            "preset-stoppuhr-2",
          ),
          createTwoStopwatchBreakCount(
            "preset-stoppuhr-1",
            "preset-stoppuhr-2",
          ),
        ),
      }),
    ],
  }),
} satisfies Record<string, MetronomePreset>);

export type PresetId = keyof typeof METRONOME_PRESETS;
