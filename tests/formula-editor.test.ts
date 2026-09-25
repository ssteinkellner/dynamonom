// @vitest-environment jsdom

import assert from "node:assert/strict";
import { mount } from "@vue/test-utils";
import { afterEach, test } from "vitest";
import {
  ACTION_TYPES,
  createDefaultAction,
  createDefaultStopwatchSettings,
} from "../src/action-model.ts";
import {
  createNumericFormulaInput,
  createPauseMessageUntilFormulaInput,
  getLocalFormulaDate,
  type FormulaNode,
} from "../src/formula-model.ts";
import { createDefaultMetronomeSettings } from "../src/models/metronome-settings.ts";
import FormulaEditorDialog from "../src/components/formula/FormulaEditorDialog.vue";
import FormulaCurrentNode from "../src/components/formula/FormulaCurrentNode.vue";
import FormulaInput from "../src/components/formula/FormulaInput.vue";
import FormulaReferenceNode from "../src/components/formula/FormulaReferenceNode.vue";

const action = createDefaultAction(ACTION_TYPES.STOPWATCH, []);
const input = createNumericFormulaInput(10, 1, 600);
const getFutureFormulaDate = (): string => {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return getLocalFormulaDate(date);
};

const commonProps = {
  modelValue: input,
  action,
  previousActions: [],
  field: "automaticSeconds",
  label: "Sekunden",
  defaultValue: 10,
  hardMin: 1,
  hardMax: 600,
};

const dynamicInput = {
  ...input,
  expression: {
    id: "dynamic-expression",
    type: "fallback" as const,
    input: { id: "dynamic-input", type: "static" as const, value: 10 },
    fallback: 10,
  },
};

const mounted: Array<{ unmount: () => void }> = [];

afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount());
});

test("formula input opens a custom dialog and emits only after confirmation", async () => {
  const wrapper = mount(FormulaInput, {
    props: {
      ...commonProps,
      id: "duration-formula",
    },
  });

  mounted.push(wrapper);

  const trigger = wrapper.get("#duration-formula");
  assert.equal(trigger.find(".formula-input-range").exists(), false);
  assert.match(trigger.attributes("aria-label") ?? "", /Min .*; Max /);

  await trigger.trigger("click");
  const dialog = wrapper.get('[role="dialog"]');
  assert.deepEqual(
    dialog
      .get(".formula-dialog-actions")
      .findAll("button")
      .map((button) => button.text()),
    ["Abbrechen", "Bestätigen"],
  );
  assert.deepEqual(
    dialog.findAll("legend").map((legend) => legend.text()),
    ["Formel", "Merken", "Löschen", "Hinzufügen"],
  );
  assert.equal(dialog.findAll(".formula-field-scroll").length, 1);
  assert.equal(
    dialog
      .get(".formula-field-scroll > .formula-node-drag-wrapper")
      .classes()
      .includes("formula-node-drag-wrapper--root"),
    true,
  );
  assert.deepEqual(
    dialog
      .get(".formula-palette-operators")
      .findAll("button")
      .map((button) => button.text()),
    ["+", "−", "×", "÷"],
  );
  assert.deepEqual(
    dialog
      .get(".formula-palette-items")
      .findAll("button")
      .map((button) => button.text()),
    [
      "Zahl",
      "Min - Max",
      "Tage seit",
      "Monate seit",
      "Referenz",
      "Aktuell",
      "Ersatzwert",
      "Aufrunden ab",
    ],
  );
  await dialog.get(".formula-node--static input").setValue("15");
  await dialog.get(".formula-dialog-actions .primary-button").trigger("click");

  assert.equal(wrapper.find('[role="dialog"]').exists(), false);
  const emitted = wrapper.emitted("update:modelValue");
  assert.ok(emitted);
  const saved = emitted[0]?.[0] as typeof input;
  assert.equal(saved.expression?.type, "static");
  if (saved.expression?.type === "static") {
    assert.equal(saved.expression.value, 15);
  }
});

test("pause message minimum bounds display Ab Pause without requiring a fallback", async () => {
  const metronomeAction = createDefaultAction(
    ACTION_TYPES.METRONOME,
    [],
    createDefaultMetronomeSettings(),
  );
  const wrapper = mount(FormulaEditorDialog, {
    props: {
      ...commonProps,
      action: metronomeAction,
      field: "pauseMessageUntil:message-1",
      label: "Bis Pause",
      modelValue: createPauseMessageUntilFormulaInput(),
      defaultValue: 0,
      hardMin: 0,
      hardMax: null,
    },
  });
  mounted.push(wrapper);

  const prefilled = createPauseMessageUntilFormulaInput();
  assert.equal(prefilled.expression?.type, "static");
  assert.equal(
    prefilled.expression?.type === "static" ? prefilled.expression.value : null,
    1,
  );
  assert.equal(prefilled.min?.type, "current");
  assert.equal(
    prefilled.min?.type === "current" ? prefilled.min.property : null,
    "abPause",
  );
  assert.equal(prefilled.max, null);

  const minimumCard = wrapper.findAll(".formula-bound-card")[0];
  assert.ok(minimumCard);
  assert.equal(minimumCard.find("span").text(), "Aktuell: Ab Pause");
  assert.equal(minimumCard.find("button").exists(), false);
  assert.equal(
    wrapper.findAll(".formula-bound-card button").some((button) =>
      button.text().includes("Minimum"),
    ),
    false,
  );
  assert.equal(
    wrapper.find(".formula-field-scroll .formula-node--fallback").exists(),
    false,
  );

  await wrapper.get(".formula-dialog-actions .primary-button").trigger("click");
  assert.equal(wrapper.emitted("confirm")?.length, 1);

  const lowerWrapper = mount(FormulaEditorDialog, {
    props: {
      ...commonProps,
      action: metronomeAction,
      field: "pauseMessageFrom:message-1",
      label: "Bei/ab Pause",
      modelValue: {
        ...createNumericFormulaInput(0, 0, null),
        expression: {
          id: "invalid-ab-pause",
          type: "current",
          property: "abPause",
        },
      },
      defaultValue: 0,
      hardMin: 0,
      hardMax: null,
    },
  });
  mounted.push(lowerWrapper);
  assert.equal(
    Array.from(
      lowerWrapper.get<HTMLSelectElement>(
        ".formula-node--current select",
      ).element.options,
    ).some((option) => option.value === "abPause"),
    false,
  );
});

test("date palette nodes stay bare until a future date is selected", async () => {
  const wrapper = mount(FormulaEditorDialog, {
    props: {
      ...commonProps,
      modelValue: { ...input, expression: null },
    },
  });
  mounted.push(wrapper);

  const palette = wrapper.get(".formula-palette-items").findAll("button");
  assert.equal(palette[2]?.text(), "Tage seit");
  assert.equal(palette[3]?.text(), "Monate seit");
  assert.equal(palette[2]?.classes().includes("formula-node--days"), true);
  assert.equal(palette[3]?.classes().includes("formula-node--months"), true);

  await palette[2]?.trigger("click");

  assert.equal(
    wrapper.get<HTMLInputElement>(".formula-node--days input[type=date]").element
      .value,
    getLocalFormulaDate(),
  );
  assert.equal(
    wrapper.find(".formula-field-scroll .formula-node--fallback").exists(),
    false,
  );
  assert.equal(wrapper.find(".formula-date-marker").exists(), false);
  assert.equal(
    wrapper.get<HTMLInputElement>(".formula-node--days input[type=date]")
      .attributes("aria-label"),
    "Tage-Datum",
  );

  await wrapper
    .get<HTMLInputElement>(".formula-node--days input[type=date]")
    .setValue(getFutureFormulaDate());

  assert.equal(
    wrapper.find(".formula-field-scroll .formula-node--fallback").exists(),
    true,
  );
  assert.equal(
    wrapper.get<HTMLInputElement>(".formula-node--fallback input[type=number]")
      .element.value,
    "1",
  );
  await wrapper
    .get<HTMLInputElement>(".formula-node--days input[type=date]")
    .setValue(getLocalFormulaDate(new Date()));
  assert.equal(
    wrapper.find(".formula-field-scroll .formula-node--fallback").exists(),
    true,
  );
});

test("date palette nodes can be dropped into Runden with a contextual threshold", async () => {
  const roundInput = {
    ...input,
    expression: {
      id: "round",
      type: "round" as const,
      input: null,
      threshold: 30,
    },
  };
  const wrapper = mount(FormulaEditorDialog, {
    props: { ...commonProps, modelValue: roundInput },
  });
  mounted.push(wrapper);

  const paletteItem = wrapper
    .findAll(".formula-palette-item")
    .find((button) => button.text() === "Tage seit");
  const inputSlot = wrapper.get('[data-formula-path="round.input"]');
  assert.ok(paletteItem);

  const dataTransfer = {
    setData() {},
    effectAllowed: "",
    dropEffect: "",
  };
  await paletteItem.trigger("dragstart", { dataTransfer });
  await inputSlot.trigger("dragover", { dataTransfer });
  await inputSlot.trigger("drop", { dataTransfer });

  assert.equal(wrapper.find(".formula-node--days input[type=date]").exists(), true);
  assert.equal(wrapper.get(".formula-node--round").text(), "");
  assert.equal(
    wrapper
      .get(".formula-node--round input[type=number]")
      .attributes("aria-label"),
    "Schwelle (Stunden)",
  );
});

test("date palette nodes added to a bound editor use fallback one", async () => {
  const wrapper = mount(FormulaEditorDialog, {
    props: {
      ...commonProps,
      modelValue: { ...dynamicInput, min: null, max: null },
    },
  });
  mounted.push(wrapper);

  await wrapper
    .get(".formula-bound-card .secondary-button")
    .trigger("click");
  const paletteItem = wrapper
    .findAll(".formula-palette-item")
    .find((button) => button.text() === "Monate seit");
  assert.ok(paletteItem);
  await paletteItem.trigger("click");
  await wrapper
    .get<HTMLInputElement>(".formula-node--months input[type=date]")
    .setValue(getFutureFormulaDate());

  assert.equal(wrapper.find(".formula-node--months").exists(), true);
  assert.equal(wrapper.find(".formula-node--fallback").exists(), true);
  assert.equal(
    wrapper.get<HTMLInputElement>(".formula-node--fallback input[type=number]")
      .element.value,
    "1",
  );
});

test("slash, reference, and current palette nodes are wrapped immediately", async () => {
  const slashWrapper = mount(FormulaEditorDialog, {
    props: { ...commonProps, modelValue: { ...input, expression: null } },
  });
  const referenceWrapper = mount(FormulaEditorDialog, {
    props: { ...commonProps, modelValue: { ...input, expression: null } },
  });
  const currentWrapper = mount(FormulaEditorDialog, {
    props: { ...commonProps, modelValue: { ...input, expression: null } },
  });
  mounted.push(slashWrapper, referenceWrapper, currentWrapper);

  const slashPalette = slashWrapper
    .findAll(".formula-palette-operators button")
    .find((button) => button.text() === "÷");
  const referencePalette = referenceWrapper
    .findAll(".formula-palette-item")
    .find((button) => button.text() === "Referenz");
  const currentPalette = currentWrapper
    .findAll(".formula-palette-item")
    .find((button) => button.text() === "Aktuell");
  assert.ok(slashPalette);
  assert.ok(referencePalette);
  assert.ok(currentPalette);
  await slashPalette.trigger("click");
  await referencePalette.trigger("click");
  await currentPalette.trigger("click");

  assert.equal(
    slashWrapper.find(".formula-field-scroll .formula-node--fallback").exists(),
    true,
  );
  assert.doesNotMatch(
    slashWrapper.get(".formula-node--fallback").text(),
    /Ersatzwert/,
  );
  assert.equal(
    slashWrapper
      .get(".formula-node--fallback input[type=number]")
      .attributes("aria-label"),
    "Ersatzwert",
  );
  assert.equal(
    slashWrapper.get<HTMLInputElement>(
      ".formula-field-scroll .formula-node--fallback input[type=number]",
    ).element.value,
    "10",
  );
  assert.equal(slashWrapper.get(".formula-operator-symbol").text(), "÷");
  assert.equal(slashWrapper.find(".formula-node--operator select").exists(), false);
  assert.equal(
    referenceWrapper.find(".formula-field-scroll .formula-node--fallback").exists(),
    true,
  );
  assert.equal(referenceWrapper.find(".formula-node--reference").exists(), true);
  assert.equal(
    currentWrapper.find(".formula-field-scroll .formula-node--fallback").exists(),
    true,
  );
  assert.equal(currentWrapper.find(".formula-node--current").exists(), true);
});

test("palette targets avoid redundant wrappers inside an existing fallback", async () => {
  const wrapper = mount(FormulaEditorDialog, {
    props: {
      ...commonProps,
      modelValue: {
        ...input,
        expression: {
          id: "outer-fallback",
          type: "fallback",
          input: null,
          fallback: 10,
        },
      },
    },
  });
  mounted.push(wrapper);

  const paletteItem = wrapper
    .findAll(".formula-palette-item")
    .find((button) => button.text() === "Referenz");
  const inputSlot = wrapper.get('[data-formula-path="outer-fallback.input"]');
  assert.ok(paletteItem);

  const dataTransfer = {
    setData() {},
    effectAllowed: "",
    dropEffect: "",
  };
  await paletteItem.trigger("dragstart", { dataTransfer });
  await inputSlot.trigger("dragover", { dataTransfer });
  await inputSlot.trigger("drop", { dataTransfer });

  assert.equal(
    wrapper.findAll(".formula-field-scroll .formula-node--fallback").length,
    1,
  );
  assert.equal(wrapper.find(".formula-node--reference").exists(), true);
});

test("future dates do not add a nested fallback under an existing ancestor", async () => {
  const wrapper = mount(FormulaEditorDialog, {
    props: {
      ...commonProps,
      modelValue: {
        ...input,
        expression: {
          id: "outer-fallback",
          type: "fallback",
          input: {
            id: "days",
            type: "days",
            date: getLocalFormulaDate(),
          },
          fallback: 10,
        },
      },
    },
  });
  mounted.push(wrapper);

  await wrapper
    .get<HTMLInputElement>(".formula-node--days input[type=date]")
    .setValue(getFutureFormulaDate());

  assert.equal(
    wrapper.findAll(".formula-field-scroll .formula-node--fallback").length,
    1,
  );
});

test("Remembered nodes must be returned or deleted before formula confirmation", async () => {
  const wrapper = mount(FormulaEditorDialog, { props: commonProps });
  mounted.push(wrapper);

  const staticPaletteItem = wrapper
    .findAll(".formula-palette-item")
    .find((button) => button.text() === "Zahl");
  assert.ok(staticPaletteItem);
  await staticPaletteItem.trigger("click");
  await wrapper.get(".formula-dialog-actions .primary-button").trigger("click");

  assert.match(
    wrapper.get(".formula-validation-errors").text(),
    /gemerkten Formelbausteine/,
  );
  assert.equal(wrapper.emitted("confirm"), undefined);
});

test("result bounds are shown only for non-static expressions", () => {
  const wrapper = mount(FormulaEditorDialog, { props: commonProps });
  const dynamicWrapper = mount(FormulaEditorDialog, {
    props: { ...commonProps, modelValue: dynamicInput },
  });
  mounted.push(wrapper, dynamicWrapper);

  assert.equal(
    wrapper.findAll("legend").some((legend) => legend.text() === "Ergebnisbegrenzung"),
    false,
  );
  assert.equal(
    dynamicWrapper
      .findAll("legend")
      .some((legend) => legend.text() === "Ergebnisbegrenzung"),
    true,
  );
});

test("palette nodes can be dropped into empty operator slots", async () => {
  const operator: FormulaNode = {
    id: "operator",
    type: "operator",
    operator: "+",
    left: { id: "left", type: "static", value: 2 },
    right: null,
  };
  const nodeInput = {
    ...input,
    expression: {
      id: "fallback",
      type: "fallback" as const,
      input: operator,
      fallback: 10,
    },
  };
  const wrapper = mount(FormulaEditorDialog, {
    props: { ...commonProps, modelValue: nodeInput },
  });
  mounted.push(wrapper);

  const paletteItem = wrapper
    .findAll(".formula-palette-item")
    .find((button) => button.text() === "Zahl");
  const rightSlot = wrapper.find('[data-formula-path="operator.right"]');
  assert.ok(paletteItem);
  assert.ok(rightSlot.exists());

  const dataTransfer = {
    setData() {},
    effectAllowed: "",
    dropEffect: "",
  };
  await paletteItem.trigger("dragstart", { dataTransfer });
  await rightSlot.trigger("dragover", { dataTransfer });
  assert.equal(dataTransfer.dropEffect, "copy");
  await rightSlot.trigger("drop", { dataTransfer });

  assert.equal(
    wrapper.find('[data-formula-path="operator.right"]').exists(),
    false,
  );
  assert.equal(wrapper.findAll(".formula-node--static input").length, 2);
});

test("required formula drop zones show a marker and accessible required text", () => {
  const operator: FormulaNode = {
    id: "required-operator",
    type: "operator",
    operator: "+",
    left: { id: "required-left", type: "static", value: 2 },
    right: null,
  };
  const wrapper = mount(FormulaEditorDialog, {
    props: { ...commonProps, modelValue: { ...input, expression: operator } },
  });
  mounted.push(wrapper);

  const rightSlot = wrapper.get(
    '[data-formula-path="required-operator.right"]',
  );
  assert.equal(rightSlot.get(".required-marker").text(), "*");
  assert.equal(rightSlot.attributes("aria-label"), "Ablegen, Pflichtfeld");
});

test("redundant node captions are removed without losing control names", () => {
  const referenceWrapper = mount(FormulaReferenceNode, {
    props: {
      node: {
        id: "reference",
        type: "reference",
        actionId: "previous",
        metric: "minutes",
      },
      actions: [
        {
          id: "previous",
            type: ACTION_TYPES.STOPWATCH,
          name: "Vorherige Aktion",
            settings: createDefaultStopwatchSettings(),
        },
      ],
    },
  });
  const currentWrapper = mount(FormulaCurrentNode, {
    props: {
      node: { id: "current", type: "current", property: "automaticSeconds" },
      currentProperties: [{ value: "automaticSeconds", label: "Sekunden" }],
    },
  });
  mounted.push(referenceWrapper, currentWrapper);

  assert.equal(referenceWrapper.findAll("label").length, 0);
  assert.equal(
    referenceWrapper.get("select").attributes("aria-label"),
    "Aktion",
  );
  assert.equal(
    referenceWrapper.findAll("select")[1]?.attributes("aria-label"),
    "Wert",
  );
  assert.equal(currentWrapper.findAll("label").length, 0);
  assert.equal(
    currentWrapper.get("select").attributes("aria-label"),
    "Aktuelle Einstellung",
  );
});

test("non-target operators remain bare and display a fixed symbol", async () => {
  const wrapper = mount(FormulaEditorDialog, {
    props: {
      ...commonProps,
      modelValue: createNumericFormulaInput(25, 1, 600),
    },
  });
  mounted.push(wrapper);

  const plus = wrapper
    .findAll(".formula-palette-item")
    .find((button) => button.text() === "+");
  assert.ok(plus);
  await plus.trigger("click");

  const dataTransfer = {
    setData() {},
    effectAllowed: "",
    dropEffect: "",
  };
  await wrapper.get(".formula-node-drag-wrapper").trigger("dragstart", {
    dataTransfer,
  });
  await wrapper.get('[data-formula-path="delete"]').trigger("drop", {
    dataTransfer,
  });
  await wrapper
    .get(".formula-remembered-list .formula-node-drag-wrapper")
    .trigger("dragstart", { dataTransfer });
  await wrapper.get('[data-formula-path="expression"]').trigger("drop", {
    dataTransfer,
  });

  assert.equal(
    wrapper.find(".formula-field-scroll .formula-node--fallback").exists(),
    false,
  );
  assert.equal(wrapper.get(".formula-operator-symbol").text(), "+");
});

test("bound editors use the same formula tools layout", async () => {
  const wrapper = mount(FormulaEditorDialog, {
    props: { ...commonProps, modelValue: dynamicInput },
  });
  mounted.push(wrapper);

  await wrapper.get(".formula-bound-card .secondary-button").trigger("click");

  assert.deepEqual(
    wrapper.findAll("legend").map((legend) => legend.text()),
    ["Formel", "Merken", "Löschen", "Hinzufügen"],
  );
  assert.equal(wrapper.find("legend").text(), "Formel");
  assert.equal(wrapper.findAll("legend").some((legend) => legend.text() === "Ergebnisbegrenzung"), false);
  assert.equal(wrapper.findAll(".formula-field-scroll").length, 1);
  assert.equal(
    wrapper
      .get(".formula-field-scroll > .formula-node-drag-wrapper")
      .classes()
      .includes("formula-node-drag-wrapper--root"),
    true,
  );
  assert.equal(wrapper.find(".formula-editor-tools").exists(), true);
});
