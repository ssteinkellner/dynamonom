// @vitest-environment jsdom

import assert from "node:assert/strict";
import { mount, flushPromises } from "@vue/test-utils";
import { afterEach, test, vi } from "vitest";
import ReportView from "../src/components/views/ReportView.vue";
import { ACTION_TYPES } from "../src/action-model.ts";
import { createDefaultMetronomeSettings } from "../src/models/metronome-settings.ts";
import type { SessionReport } from "../src/models/session.ts";

const report: SessionReport = {
  aborted: false,
  actions: [
    {
      id: "metronome",
      type: ACTION_TYPES.METRONOME,
      name: "Warm-up",
      status: "completed",
      settings: createDefaultMetronomeSettings(),
      beatCount: 12,
      breakRecords: [],
      endReason: "manual",
    },
  ],
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

  assert.equal(wrapper.get(".report-card h3").text(), "Metronom - Warm-up");
  assert.match(wrapper.get(".report-breaks").text(), /Keine Pausen gebraucht/);
  const rows = wrapper.findAll(".report-action-row");
  assert.equal(rows.length, 2);
  assert.equal(rows[0]?.findAll("button").length, 2);
  assert.ok(rows[0]?.findAll("button")[1]?.classes().includes("primary-button"));
  assert.equal(rows[1]?.findAll("button")[0]?.text(), "Zurück zu Voreinstellungen");
  assert.equal(rows[1]?.findAll("button")[1]?.text(), "Zurück zu Einstellungen");
  assert.ok(rows[1]?.findAll("button")[2]?.classes().includes("primary-button"));

  await rows[0]?.findAll("button")[1]?.trigger("click");
  await flushPromises();
  assert.match(writeText.mock.calls[0]?.[0] ?? "", /\*\*Warm-up\*\*/);
  assert.match(writeText.mock.calls[0]?.[0] ?? "", /Keine Pausen gebraucht/);
  assert.equal(rows[0]?.findAll("button")[1]?.text(), "Kopiert!");
  wrapper.unmount();
});
