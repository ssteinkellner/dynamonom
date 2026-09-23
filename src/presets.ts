import { ACTION_TYPES } from "./action-model.ts";
import type { MetronomeAction } from "./action-model.ts";
import { createNumericFormulaInput } from "./formula-model.ts";
import { createDefaultMetronomeSettings } from "./models/metronome-settings.ts";

export type PresetActionDefinition = Omit<MetronomeAction, "id">;

export interface MetronomePreset {
  label: string;
  autoStart: boolean;
  hideProgress: boolean;
  values: {
    actions: readonly PresetActionDefinition[];
  };
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

export const METRONOME_PRESETS = Object.freeze({
  "120-150-2x10": Object.freeze({
    label: "120-150 : 2x10",
    autoStart: true,
    hideProgress: false,
    values: Object.freeze({
      actions: Object.freeze([
        Object.freeze(
          presetAction({
            bpm: 120,
            increaseBy: 2,
            maximumLimit: 150,
            breakCount: 2,
            breakSeconds: 10,
          }),
        ),
      ]),
    }),
  }),
  "130-200-4x5": Object.freeze({
    label: "130-200 : 4x5",
    autoStart: true,
    hideProgress: false,
    values: Object.freeze({
      actions: Object.freeze([
        Object.freeze(
          presetAction({
            bpm: 130,
            increaseBy: 10,
            maximumLimit: 200,
            breakCount: 4,
            breakSeconds: 5,
          }),
        ),
      ]),
    }),
  }),
} satisfies Record<string, MetronomePreset>);

export type PresetId = keyof typeof METRONOME_PRESETS;
