import type { MetronomeAction } from "./action-model.ts";

export type PresetActionDefinition = Omit<MetronomeAction, "id">;

export interface MetronomePreset {
  label: string;
  autoStart: boolean;
  hideProgress: boolean;
  values: {
    actions: readonly PresetActionDefinition[];
  };
}

export const METRONOME_PRESETS = Object.freeze({
  "120-150-2x10": Object.freeze({
    label: "120-150 : 2x10",
    autoStart: true,
    hideProgress: false,
    values: Object.freeze({
      actions: Object.freeze([
        Object.freeze({
          type: "metronom",
          name: "Metronom",
          settings: Object.freeze({
            bpm: 120,
            accentuate: true,
            accentRepeat: 10,
            increaseTempo: true,
            increaseBy: 2,
            increaseAfter: 10,
            maximum: "stick",
            maximumLimitStick: 150,
            maximumLimitReset: 150,
            maximumLimitReverse: 150,
            decreaseBy: 1,
            decreaseAfter: 10,
            breaks: "limited",
            breakCount: 2,
            breakSeconds: "10",
            sessionEndEnabled: true,
            sessionEndBeats: 100,
            lockSettings: true,
            lockBeats: 100,
          }),
        }),
      ]),
    }),
  }),
  "130-200-4x5": Object.freeze({
    label: "130-200 : 4x5",
    autoStart: true,
    hideProgress: false,
    values: Object.freeze({
      actions: Object.freeze([
        Object.freeze({
          type: "metronom",
          name: "Metronom",
          settings: Object.freeze({
            bpm: 130,
            accentuate: true,
            accentRepeat: 10,
            increaseTempo: true,
            increaseBy: 10,
            increaseAfter: 10,
            maximum: "stick",
            maximumLimitStick: 200,
            maximumLimitReset: 200,
            maximumLimitReverse: 200,
            decreaseBy: 1,
            decreaseAfter: 10,
            breaks: "limited",
            breakCount: 4,
            breakSeconds: "5",
            sessionEndEnabled: true,
            sessionEndBeats: 100,
            lockSettings: true,
            lockBeats: 100,
          }),
        }),
      ]),
    }),
  }),
} satisfies Record<string, MetronomePreset>);

export type PresetId = keyof typeof METRONOME_PRESETS;
