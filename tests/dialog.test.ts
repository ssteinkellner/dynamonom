// @vitest-environment jsdom

import assert from "node:assert/strict";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, test } from "vitest";
import AppDialogHost from "../src/components/common/AppDialogHost.vue";
import { useDialog } from "../src/services/dialog.ts";

const mounted: Array<{ unmount: () => void }> = [];

afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount());
  document.body
    .querySelectorAll(".dialog-test-trigger")
    .forEach((element) => element.remove());
});

test("confirmations use a queued custom dialog and restore trigger focus", async () => {
  const wrapper = mount(AppDialogHost);
  mounted.push(wrapper);

  const trigger = document.createElement("button");
  trigger.className = "dialog-test-trigger";
  document.body.append(trigger);
  trigger.focus();

  const { confirm, notify } = useDialog();
  const confirmation = confirm({
    title: "Test bestätigen?",
    message: "Testmeldung",
    confirmLabel: "Ja",
    cancelLabel: "Nein",
    tone: "danger",
  });
  const notification = notify({
    title: "Hinweis",
    message: "Gespeichert",
    kind: "success",
  });

  await flushPromises();
  const dialog = document.body.querySelector('[role="alertdialog"]');
  assert.ok(dialog);
  assert.equal(dialog.querySelector("[data-dialog-cancel]")?.textContent, "Nein");
  assert.equal(document.activeElement, dialog.querySelector("[data-dialog-cancel]"));
  assert.equal(document.body.classList.contains("dialog-open"), true);

  dialog.querySelector<HTMLButtonElement>("[data-dialog-confirm]")?.click();
  assert.equal(await confirmation, true);
  await flushPromises();

  const notificationDialog = document.body.querySelector('[role="dialog"]');
  assert.ok(notificationDialog);
  assert.equal(
    notificationDialog.querySelector("[data-dialog-ok]")?.textContent,
    "OK",
  );
  notificationDialog
    .querySelector<HTMLButtonElement>("[data-dialog-ok]")
    ?.click();
  await notification;
  await flushPromises();

  assert.equal(document.body.classList.contains("dialog-open"), false);
  assert.equal(document.activeElement, trigger);
});
