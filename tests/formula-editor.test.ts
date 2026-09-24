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
  type FormulaNode,
} from "../src/formula-model.ts";
import FormulaEditorDialog from "../src/components/formula/FormulaEditorDialog.vue";
import FormulaCurrentNode from "../src/components/formula/FormulaCurrentNode.vue";
import FormulaInput from "../src/components/formula/FormulaInput.vue";
import FormulaReferenceNode from "../src/components/formula/FormulaReferenceNode.vue";

const action = createDefaultAction(ACTION_TYPES.STOPWATCH, []);
const input = createNumericFormulaInput(10, 1, 600);

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
  assert.equal(dialog.get(".formula-palette-items").findAll("button").length, 6);
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

test("dynamic expressions use the field's current static value as fallback", async () => {
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
    wrapper.get<HTMLInputElement>(
      ".formula-node--fallback input[type=number]",
    ).element.value,
    "25",
  );
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
