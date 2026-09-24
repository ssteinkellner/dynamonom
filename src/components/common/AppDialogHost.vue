<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from "vue";
import {
  activeDialog,
  resolveActiveDialog,
  type DialogRequest,
} from "../../services/dialog.ts";

const dialogLayer = ref<HTMLDivElement | null>(null);
const dialogElement = ref<HTMLElement | null>(null);

const confirmDialog = computed(() =>
  activeDialog.value?.kind === "confirm" ? activeDialog.value : null,
);
const notificationDialog = computed(() =>
  activeDialog.value?.kind === "notify" ? activeDialog.value : null,
);
const dialogTitleId = computed(() =>
  activeDialog.value ? `app-dialog-title-${activeDialog.value.id}` : undefined,
);
const dialogMessageId = computed(() =>
  activeDialog.value ? `app-dialog-message-${activeDialog.value.id}` : undefined,
);
const dialogClass = computed(() => {
  const request = activeDialog.value;
  if (!request) {
    return "";
  }
  return request.kind === "confirm"
    ? `app-dialog--${request.options.tone}`
    : `app-dialog--${request.options.kind}`;
});

function isFocusable(element: HTMLElement): boolean {
  return element.isConnected && !element.hasAttribute("disabled");
}

function focusInitial(request: DialogRequest): void {
  const selector =
    request.kind === "confirm" ? "[data-dialog-cancel]" : "[data-dialog-ok]";
  const target =
    dialogElement.value?.querySelector<HTMLElement>(selector) ??
    dialogElement.value;
  target?.focus();
}

function restoreFocus(target: HTMLElement | null): void {
  if (target && isFocusable(target)) {
    target.focus();
    return;
  }
  dialogLayer.value?.focus();
}

watch(
  activeDialog,
  async (request, previousRequest) => {
    await nextTick();
    if (request) {
      if (activeDialog.value === request) {
        focusInitial(request);
      }
      return;
    }
    restoreFocus(previousRequest?.trigger ?? null);
  },
  { flush: "post", immediate: true },
);

watch(
  activeDialog,
  (request) => {
    if (typeof document !== "undefined") {
      document.body.classList.toggle("dialog-open", request !== null);
    }
  },
  { immediate: true },
);

onUnmounted(() => {
  if (typeof document !== "undefined") {
    document.body.classList.remove("dialog-open");
  }
});

function handleDialogKeydown(event: KeyboardEvent): void {
  const request = activeDialog.value;
  if (!request) {
    return;
  }
  if (event.key === "Escape") {
    event.preventDefault();
    resolveActiveDialog(request.kind === "confirm" ? false : undefined);
    return;
  }
  if (event.key !== "Tab") {
    return;
  }

  const focusable = dialogElement.value?.querySelectorAll<HTMLElement>(
    'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])',
  );
  if (!focusable || focusable.length === 0) {
    event.preventDefault();
    dialogElement.value?.focus();
    return;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const current = document.activeElement;
  if (
    event.shiftKey &&
    (current === first || current === dialogElement.value)
  ) {
    event.preventDefault();
    last?.focus();
  } else if (
    !event.shiftKey &&
    (current === last || current === dialogElement.value)
  ) {
    event.preventDefault();
    first?.focus();
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      ref="dialogLayer"
      class="app-dialog-layer"
      :class="{ 'app-dialog-layer--open': activeDialog }"
      tabindex="-1"
      aria-label="Dialogbereich"
    >
      <section
        v-if="activeDialog"
        ref="dialogElement"
        class="app-dialog"
        :class="dialogClass"
        :role="activeDialog.kind === 'confirm' ? 'alertdialog' : 'dialog'"
        aria-modal="true"
        :aria-labelledby="dialogTitleId"
        :aria-describedby="dialogMessageId"
        tabindex="-1"
        @keydown="handleDialogKeydown"
      >
        <h2 :id="dialogTitleId">{{ activeDialog.options.title }}</h2>
        <p :id="dialogMessageId" class="app-dialog-message">
          {{ activeDialog.options.message }}
        </p>

        <div v-if="confirmDialog" class="button-row app-dialog-actions">
          <button
            class="secondary-button"
            type="button"
            data-dialog-cancel
            @click="resolveActiveDialog(false)"
          >
            {{ confirmDialog.options.cancelLabel }}
          </button>
          <button
            :class="
              confirmDialog.options.tone === 'danger'
                ? 'danger-button'
                : 'primary-button'
            "
            type="button"
            data-dialog-confirm
            @click="resolveActiveDialog(true)"
          >
            {{ confirmDialog.options.confirmLabel }}
          </button>
        </div>

        <div
          v-else-if="notificationDialog"
          class="button-row app-dialog-actions single-action"
        >
          <button
            class="primary-button"
            type="button"
            data-dialog-ok
            @click="resolveActiveDialog()"
          >
            {{ notificationDialog.options.okLabel }}
          </button>
        </div>
      </section>
    </div>
  </Teleport>
</template>
