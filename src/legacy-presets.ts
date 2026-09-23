import { METRONOME_PRESETS } from "./presets.ts";

declare global {
  interface Window {
    METRONOME_PRESETS: typeof METRONOME_PRESETS;
  }
}

window.METRONOME_PRESETS = METRONOME_PRESETS;
