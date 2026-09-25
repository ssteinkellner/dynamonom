// @vitest-environment jsdom

import assert from "node:assert/strict";
import { mount, flushPromises } from "@vue/test-utils";
import { afterEach, test, vi } from "vitest";
import ReportView from "../src/components/views/ReportView.vue";
import {
  ACTION_TYPES,
  validateActionDefinitions,
} from "../src/action-model.ts";
import { validateMetronomeActionSettings } from "../src/models/metronome-settings.ts";
import { validateStopwatchActionSettings } from "../src/models/stopwatch-settings.ts";
import { formatNumericFormulaInput } from "../src/formula-model.ts";
import { METRONOME_PRESETS } from "../src/presets.ts";
import { buildShortReportText } from "../src/models/report-text.ts";
import type { SessionReport } from "../src/models/session.ts";

const maximalValidation = validateActionDefinitions(
  METRONOME_PRESETS["test-maximal"].actions,
  {
    validateMetronomeSettings: validateMetronomeActionSettings,
    validateStopwatchSettings: validateStopwatchActionSettings,
    requireMetronome: true,
  },
);
assert.equal(
  maximalValidation.valid,
  true,
  maximalValidation.errors.map((error) => error.message).join(" "),
);

const report: SessionReport = {
  aborted: false,
  actions: maximalValidation.actions.map((action, index) => {
    if (action.type === ACTION_TYPES.METRONOME) {
      return {
        ...action,
        status: "completed" as const,
        beatCount: 24 + index,
        elapsedSeconds: 30 + index,
        breakRecords: [],
        endReason: "automatic" as const,
        endBpm: 180 + index,
        maximumBpm: 220 + index,
      };
    }
    return {
      ...action,
      status: "completed" as const,
      elapsedSeconds: 10 + index,
      completedBy: action.settings.endMode === "automatic" ? "auto" : "manual",
    };
  }),
};

afterEach(() => {
  vi.restoreAllMocks();
});

test("report sections and action buttons preserve their requested order and styles", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
  const wrapper = mount(ReportView, { props: { report } });

  assert.deepEqual(
    wrapper.findAll(".report-card h3").map((heading) => heading.text()),
    [
      "Stoppuhr - Stoppuhr unbegrenzt",
      "Stoppuhr - Stoppuhr manuell",
      "Stoppuhr - Stoppuhr automatisch",
      "Metronom - Metronom 1",
      "Metronom - Metronom 2",
    ],
  );
  const firstMetronome = maximalValidation.actions.find(
    (action) =>
      action.type === ACTION_TYPES.METRONOME && action.name === "Metronom 1",
  );
  assert.ok(firstMetronome?.type === ACTION_TYPES.METRONOME);
  assert.ok(
    wrapper
      .findAll(".report-detail-line")
      .some(
        (line) =>
          line.text() ===
          `Starttempo: ${formatNumericFormulaInput(firstMetronome.settings.bpm)} BPM`,
      ),
  );
  assert.equal(wrapper.findAll(".report-breaks").length, 2);
  assert.match(
    wrapper.findAll(".report-breaks")[0]?.text() ?? "",
    /Keine Pausen gebraucht/,
  );
  assert.ok(
    wrapper
      .findAll(".report-detail-line")
      .some((line) => line.text().startsWith("Manuelles Limit:")),
  );
  assert.ok(
    wrapper
      .findAll(".report-detail-line")
      .some((line) => line.text().startsWith("Automatisches Ende:")),
  );
  const rows = wrapper.findAll(".report-action-row");
  assert.equal(rows.length, 2);
  assert.equal(rows[0]?.findAll("button").length, 2);
  assert.ok(rows[0]?.findAll("button")[1]?.classes().includes("primary-button"));
  assert.equal(rows[1]?.findAll("button")[0]?.text(), "Zurück zu Voreinstellungen");
  assert.equal(rows[1]?.findAll("button")[1]?.text(), "Zurück zu Einstellungen");
  assert.ok(rows[1]?.findAll("button")[2]?.classes().includes("primary-button"));

  await rows[0]?.findAll("button")[1]?.trigger("click");
  await flushPromises();
  assert.equal(writeText.mock.calls[0]?.[0], buildShortReportText(report));
  assert.equal(rows[0]?.findAll("button")[1]?.text(), "Kopiert!");
  wrapper.unmount();
});
