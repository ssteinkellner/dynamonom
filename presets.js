"use strict";

window.METRONOME_PRESETS = Object.freeze({
  "120-150-2x10": Object.freeze({
    label: "Start 120-150 : 2x10",
    values: Object.freeze({
      bpm: 120,
      accentuate: true,
      accentRepeat: 10,
      increaseTempo: true,
      increaseBy: 2,
      increaseAfter: 10,
      maximum: "stick",
      maximumLimit: 150,
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
});
