// @vitest-environment jsdom

import assert from "node:assert/strict";
import { mount } from "@vue/test-utils";
import { afterEach, test } from "vitest";
import {
  ACTION_TYPES,
  createDefaultAction,
} from "../src/action-model.ts";
import {
  createNumericFormulaInput,
  type FormulaNode,
} from "../src/formula-model.ts";
import FormulaEditorDialog from "../src/components/formula/FormulaEditorDialog.vue";
import FormulaInput from "../src/components/formula/FormulaInput.vue";

const action = createDefaultAction(ACTION_TYPES.SECONDS, []);
const input = createNumericFormulaInput(10, 1, 600);

const commonProps = {
  modelValue: input,
  action,
  previousActions: [],
  field: "seconds",
  label: "Dauer",
  defaultValue: 10,
  hardMin: 1,
  hardMax: 600,
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

  await wrapper.get("#duration-formula").trigger("click");
  const dialog = wrapper.get('[role="dialog"]');
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
  await rightSlot.trigger("drop", { dataTransfer });

  assert.equal(
    wrapper.find('[data-formula-path="operator.right"]').exists(),
    false,
  );
  assert.equal(wrapper.findAll(".formula-node--static input").length, 2);
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
