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

function createArithmeticFormula(
  operator: "+" | "-" | "*" | "/",
  left: number,
  right: number,
  min: number,
  max: number | null,
): NumericFormulaInput {
  return createFormulaInput(
    createOperator(
      operator,
      createStaticFormulaNode(left),
      createStaticFormulaNode(right),
    ),
    min,
    max,
  );
}

function createMaximalStopwatch(
  id: string,
  name: string,
  endMode: "unlimited" | "manual" | "automatic",
  variant: 1 | 2 | 3,
): PresetActionDefinition {
  const settings = createDefaultStopwatchSettings();
  return {
    id,
    type: ACTION_TYPES.STOPWATCH,
    name,
    settings: {
      ...settings,
      endMode,
      automaticSeconds: createArithmeticFormula(
        variant === 2 ? "*" : "+",
        variant === 2 ? 3 : 10,
        variant === 2 ? 5 : variant,
        1,
        600,
      ),
      hideDuration: true,
      manualLimitSeconds: createArithmeticFormula(
        variant === 3 ? "*" : "+",
        variant === 3 ? 20 : 60,
        variant === 3 ? 3 : variant,
        1,
        600,
      ),
      earlyContinueWarning: true,
      earlyContinueWarningSeconds: createArithmeticFormula(
        variant === 1 ? "+" : "*",
        variant === 1 ? 5 : 2,
        variant === 1 ? variant : 3,
        1,
        600,
      ),
    },
  };
}

function createMaximalMetronomeSettings(
  variant: 1 | 2,
): MetronomeAction["settings"] {
  const settings = createDefaultMetronomeSettings();
  const bpm =
    variant === 1
      ? createArithmeticFormula("+", 100, 20, 20, 300)
      : createFormulaInput(
          createClamp(
            createStaticFormulaNode(60),
            createOperator(
              "+",
              createStaticFormulaNode(180),
              createStaticFormulaNode(20),
            ),
            createStaticFormulaNode(300),
          ),
          20,
          300,
        );
  const maximumLimitReverse =
    variant === 1
      ? createFormulaInput(
          createFallback(
            createOperator(
              "+",
              createCurrent("bpm"),
              createStaticFormulaNode(20),
            ),
            200,
          ),
          60,
          400,
        )
      : createFormulaInput(
          createFallback(
            createClamp(
              createStaticFormulaNode(60),
              createOperator(
                "+",
                createCurrent("bpm"),
                createStaticFormulaNode(30),
              ),
              createStaticFormulaNode(400),
            ),
            240,
          ),
          60,
          400,
        );

  return {
    ...settings,
    bpm,
    accentuate: true,
    accentRepeat:
      variant === 1
        ? createArithmeticFormula("+", 4, 1, 1, null)
        : createArithmeticFormula("*", 2, 3, 1, null),
    increaseTempo: true,
    increaseBy:
      variant === 1
        ? createArithmeticFormula("+", 2, 1, 1, 20)
        : createArithmeticFormula("*", 2, 2, 1, 20),
    increaseAfter:
      variant === 1
        ? createArithmeticFormula("+", 5, 5, 1, null)
        : createArithmeticFormula("*", 3, 4, 1, null),
    maximum: "reverse",
    maximumLimitStick:
      variant === 1
        ? createArithmeticFormula("+", 80, 80, 60, 400)
        : createArithmeticFormula("*", 80, 2, 60, 400),
    maximumLimitReset:
      variant === 1
        ? createArithmeticFormula("+", 90, 90, 60, 400)
        : createArithmeticFormula("*", 90, 2, 60, 400),
    maximumLimitReverse,
    decreaseBy:
      variant === 1
        ? createArithmeticFormula("+", 1, 1, 1, 50)
        : createArithmeticFormula("*", 2, 2, 1, 50),
    decreaseAfter:
      variant === 1
        ? createArithmeticFormula("+", 5, 5, 1, null)
        : createArithmeticFormula("*", 3, 4, 1, null),
    breaks: "limited",
    breakCount:
      variant === 1
        ? createFormulaInput(
            createFallback(
              createOperator(
                "/",
                createStaticFormulaNode(12),
                createStaticFormulaNode(2),
              ),
              1,
            ),
            1,
            null,
          )
        : createArithmeticFormula("+", 3, 2, 1, null),
    breakSeconds:
      variant === 1
        ? createFormulaInput(
            createFallback(
              createOperator(
                "/",
                createStaticFormulaNode(60),
                createStaticFormulaNode(2),
              ),
              30,
            ),
            1,
            null,
          )
        : createFormulaInput(
            createFallback(
              createOperator(
                "+",
                createCurrent("current-bpm"),
                createStaticFormulaNode(5),
              ),
              30,
            ),
            1,
            null,
          ),
    sessionEndEnabled: true,
    sessionEndBeats:
      variant === 1
        ? createFormulaInput(
            createClamp(
              createStaticFormulaNode(100),
              createOperator(
                "*",
                createStaticFormulaNode(20),
                createStaticFormulaNode(10),
              ),
              createStaticFormulaNode(300),
            ),
            1,
            null,
          )
        : createArithmeticFormula("+", 150, 100, 1, null),
    lockSettings: true,
    hideLockText: true,
    hideNextTempo: true,
    lockBeats: createSessionEndLock(),
  };
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
  "test-maximal": Object.freeze({
    label: "test - maximal",
    autoStart: false,
    hideProgress: true,
    actions: [
      Object.freeze(
        createMaximalStopwatch(
          "test-maximal-stopwatch-unlimited",
          "Stoppuhr unbegrenzt",
          "unlimited",
          1,
        ),
      ),
      Object.freeze(
        createMaximalStopwatch(
          "test-maximal-stopwatch-manual",
          "Stoppuhr manuell",
          "manual",
          2,
        ),
      ),
      Object.freeze(
        createMaximalStopwatch(
          "test-maximal-stopwatch-automatic",
          "Stoppuhr automatisch",
          "automatic",
          3,
        ),
      ),
      Object.freeze({
        id: "test-maximal-metronome-1",
        type: ACTION_TYPES.METRONOME,
        name: "Metronom 1",
        settings: createMaximalMetronomeSettings(1),
      }),
      Object.freeze({
        id: "test-maximal-metronome-2",
        type: ACTION_TYPES.METRONOME,
        name: "Metronom 2",
        settings: createMaximalMetronomeSettings(2),
      }),
    ],
  }),
} satisfies Record<string, MetronomePreset>);

export type PresetId = keyof typeof METRONOME_PRESETS;
