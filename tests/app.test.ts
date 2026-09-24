// @vitest-environment jsdom

import assert from "node:assert/strict";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia } from "pinia";
import { afterEach, beforeEach, test, vi } from "vitest";
import App from "../src/App.vue";
import { ACTION_TYPES } from "../src/action-model.ts";
import { createDefaultMetronomeSettings } from "../src/models/metronome-settings.ts";

function mountApp() {
  return mount(App, { global: { plugins: [createPinia()] } });
}

beforeEach(() => {
  window.history.replaceState({}, "", "/");
});

afterEach(() => {
  vi.restoreAllMocks();
});

test("the presets view opens first and manual settings can edit the initial action", async () => {
  const wrapper = mountApp();
  assert.equal(wrapper.get("h1").text(), "Metronom - Voreinstellungen");
  assert.equal(wrapper.find("#settings-import-error").exists(), false);

  await wrapper.get("button.secondary-button").trigger("click");
  assert.equal(wrapper.get("h1").text(), "Metronom-Einstellungen");
  await wrapper.get('button[aria-label="Metronom bearbeiten"]').trigger("click");
  assert.equal(wrapper.get("#action-editor-title").text(), "Metronom-Einstellungen");
  assert.deepEqual(
    wrapper
      .get(".action-editor-actions")
      .findAll("button")
      .map((button) => button.text()),
    ["Abbrechen", "Bestätigen"],
  );

  await wrapper.get("#action-name").setValue("Einlaufen");
  const confirmButton = wrapper
    .findAll("button")
    .find((button) => button.text() === "Bestätigen");
  assert.ok(confirmButton);
  await confirmButton.trigger("click");

  assert.match(wrapper.get("#actions-table").text(), /Einlaufen/);
  wrapper.unmount();
});

test("dirty action drafts guard navigation and can be discarded", async () => {
  const wrapper = mountApp();

  await wrapper.get("button.secondary-button").trigger("click");
  await wrapper.get('button[aria-label="Metronom bearbeiten"]').trigger("click");
  await wrapper.get("#action-name").setValue("Noch nicht gespeichert");

  const backButton = wrapper
    .findAll("button")
    .find((button) => button.text() === "Zurück zu den Voreinstellungen");
  assert.ok(backButton);
  await backButton.trigger("click");
  await flushPromises();
  const discardDialog = document.body.querySelector('[role="alertdialog"]');
  assert.ok(discardDialog);
  assert.match(discardDialog.textContent ?? "", /Nicht gespeicherte Änderungen verwerfen/);
  discardDialog.querySelector<HTMLButtonElement>("[data-dialog-cancel]")?.click();
  await flushPromises();
  assert.equal(wrapper.get("h1").text(), "Metronom-Einstellungen");
  assert.ok(wrapper.find("#action-editor-title").exists());

  await backButton.trigger("click");
  await flushPromises();
  const confirmDiscardDialog = document.body.querySelector('[role="alertdialog"]');
  assert.ok(confirmDiscardDialog);
  confirmDiscardDialog
    .querySelector<HTMLButtonElement>("[data-dialog-confirm]")
    ?.click();
  await flushPromises();
  assert.equal(wrapper.get("h1").text(), "Metronom - Voreinstellungen");
  wrapper.unmount();
});

test("action type dropdown creates a draft and returns to its disabled default", async () => {
  const wrapper = mountApp();
  await wrapper.get("button.secondary-button").trigger("click");

  const dropdown = wrapper.get<HTMLSelectElement>("#new-action-type");
  assert.equal(dropdown.element.value, "");
  assert.equal(dropdown.get("option[value='']").text(), "Aktion hinzufügen");
  assert.equal(dropdown.get("option[value='']").attributes("disabled"), "");

  await dropdown.setValue(ACTION_TYPES.SECONDS);
  await flushPromises();

  assert.equal(wrapper.get<HTMLSelectElement>("#new-action-type").element.value, "");
  assert.equal(wrapper.get("#action-editor-title").text(), "Sekunden-Einstellungen");
  await wrapper.get("#action-seconds").trigger("click");
  const formulaDialog = wrapper.get('[role="dialog"]');
  assert.deepEqual(
    formulaDialog
      .get(".formula-dialog-actions")
      .findAll("button")
      .map((button) => button.text()),
    ["Abbrechen", "Bestätigen"],
  );
  await formulaDialog.get(".formula-node--static input").setValue("15");
  await formulaDialog.get(".formula-dialog-actions .primary-button").trigger("click");
  await wrapper.get(".action-editor-actions .primary-button").trigger("click");

  assert.match(wrapper.get("#actions-table").text(), /Sekunden.*15 Sekunden/);
  wrapper.unmount();
});

test("settings navigation and start controls follow the final settings section", async () => {
  const wrapper = mountApp();
  await wrapper.get("button.secondary-button").trigger("click");

  const settingsView = wrapper.get(".view");
  assert.equal(
    settingsView.element.lastElementChild?.classList.contains("settings-actions"),
    true,
  );
  assert.deepEqual(
    settingsView
      .find(".settings-actions")
      .findAll("button")
      .map((button) => button.text()),
    ["Zurück zu den Voreinstellungen", "Starten"],
  );
  wrapper.unmount();
});

test("invalid imported action rows preserve defaults while applying envelope options", async () => {
  const importedActions = [
    {
      type: ACTION_TYPES.METRONOME,
      name: "Importiert",
      settings: createDefaultMetronomeSettings(),
    },
    {
      type: ACTION_TYPES.SECONDS,
      name: "Ungültige Sekunden",
      settings: { seconds: "keine Zahl" },
    },
  ];
  const parameters = new URLSearchParams();
  parameters.set("version", "1");
  parameters.set("auto-start", "true");
  parameters.set("hide-progress", "true");
  parameters.set("actions", JSON.stringify(importedActions));

  const wrapper = mountApp();
  await wrapper.get("#settings-import").setValue(parameters.toString());
  await wrapper.get("#settings-import").trigger("keydown", { key: "Enter" });
  await flushPromises();

  assert.equal(wrapper.get("h1").text(), "Metronom-Einstellungen");
  assert.ok(wrapper.find(".import-error-panel").exists());
  assert.match(wrapper.get(".import-error-list").text(), /Dauer in Sekunden/);
  assert.match(wrapper.get("#actions-table").text(), /Metronom/);
  assert.doesNotMatch(wrapper.get("#actions-table").text(), /Importiert/);
  const globalOptions = wrapper.findAll(".global-settings input[type=checkbox]");
  assert.equal((globalOptions[0]?.element as HTMLInputElement).checked, true);
  assert.equal((globalOptions[1]?.element as HTMLInputElement).checked, true);
  assert.equal(wrapper.get(".import-error-text").text(), parameters.toString());
  wrapper.unmount();
});

test("valid imported actions are installed and the import field is cleared", async () => {
  const importedActions = [
    {
      type: ACTION_TYPES.METRONOME,
      name: "Abendtraining",
      settings: createDefaultMetronomeSettings(),
    },
  ];
  const parameters = new URLSearchParams();
  parameters.set("version", "1");
  parameters.set("auto-start", "false");
  parameters.set("actions", JSON.stringify(importedActions));

  const wrapper = mountApp();
  await wrapper.get("#settings-import").setValue(parameters.toString());
  await wrapper.get("#settings-import").trigger("keydown", { key: "Enter" });
  await flushPromises();

  assert.equal(wrapper.get("h1").text(), "Metronom-Einstellungen");
  assert.equal(wrapper.find("#settings-import").exists(), false);
  assert.match(wrapper.get("#actions-table").text(), /Abendtraining/);
  assert.equal(wrapper.find(".import-error-panel").exists(), false);
  wrapper.unmount();
});

test("a versioned query in the page URL is imported on mount", async () => {
  const parameters = new URLSearchParams();
  parameters.set("version", "1");
  parameters.set("auto-start", "false");
  parameters.set(
    "actions",
    JSON.stringify([
      {
        type: ACTION_TYPES.METRONOME,
        name: "URL-Import",
        settings: createDefaultMetronomeSettings(),
      },
    ]),
  );
  window.history.replaceState({}, "", `/?${parameters.toString()}`);

  const wrapper = mountApp();
  await flushPromises();

  assert.equal(wrapper.get("h1").text(), "Metronom-Einstellungen");
  assert.match(wrapper.get("#actions-table").text(), /URL-Import/);
  wrapper.unmount();
});

test("list-level import errors retain otherwise valid action rows", async () => {
  const parameters = new URLSearchParams();
  parameters.set("version", "1");
  parameters.set("auto-start", "false");
  parameters.set(
    "actions",
    JSON.stringify([
      {
        type: ACTION_TYPES.MANUAL,
        name: "Nur manuell",
        settings: { limitSeconds: null },
      },
    ]),
  );

  const wrapper = mountApp();
  await wrapper.get("#settings-import").setValue(parameters.toString());
  await wrapper.get("#settings-import").trigger("keydown", { key: "Enter" });
  await flushPromises();

  assert.match(wrapper.get(".import-error-list").text(), /Metronom/);
  assert.match(wrapper.get("#actions-table").text(), /Nur manuell/);
  assert.doesNotMatch(wrapper.get("#actions-table").text(), /Metronom/);
  wrapper.unmount();
});
