import { computed, shallowRef } from "vue";

export type ConfirmDialogTone = "primary" | "danger";
export type NotificationDialogKind = "info" | "success" | "error";

export interface ConfirmDialogOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmDialogTone;
}

export interface NotificationDialogOptions {
  title: string;
  message: string;
  kind?: NotificationDialogKind;
  okLabel?: string;
}

interface BaseDialogRequest {
  id: number;
  trigger: HTMLElement | null;
}

interface ConfirmDialogRequest extends BaseDialogRequest {
  kind: "confirm";
  options: {
    title: string;
    message: string;
    confirmLabel: string;
    cancelLabel: string;
    tone: ConfirmDialogTone;
  };
  resolve: (confirmed: boolean) => void;
}

interface NotificationDialogRequest extends BaseDialogRequest {
  kind: "notify";
  options: {
    title: string;
    message: string;
    kind: NotificationDialogKind;
    okLabel: string;
  };
  resolve: () => void;
}

export type DialogRequest = ConfirmDialogRequest | NotificationDialogRequest;

const dialogQueue = shallowRef<readonly DialogRequest[]>([]);
let nextDialogId = 1;

export const activeDialog = computed<DialogRequest | null>(
  () => dialogQueue.value[0] ?? null,
);

function getTrigger(): HTMLElement | null {
  if (typeof document === "undefined") {
    return null;
  }
  return document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null;
}

function enqueue(request: DialogRequest): void {
  dialogQueue.value = [...dialogQueue.value, request];
}

export function requestConfirmation(
  options: ConfirmDialogOptions,
): Promise<boolean> {
  return new Promise((resolve) => {
    enqueue({
      id: nextDialogId++,
      kind: "confirm",
      trigger: getTrigger(),
      options: {
        title: options.title,
        message: options.message,
        confirmLabel: options.confirmLabel ?? "Bestätigen",
        cancelLabel: options.cancelLabel ?? "Abbrechen",
        tone: options.tone ?? "primary",
      },
      resolve,
    });
  });
}

export function requestNotification(
  options: NotificationDialogOptions,
): Promise<void> {
  return new Promise((resolve) => {
    enqueue({
      id: nextDialogId++,
      kind: "notify",
      trigger: getTrigger(),
      options: {
        title: options.title,
        message: options.message,
        kind: options.kind ?? "info",
        okLabel: options.okLabel ?? "OK",
      },
      resolve,
    });
  });
}

export function resolveActiveDialog(confirmed?: boolean): void {
  const request = dialogQueue.value[0];
  if (!request) {
    return;
  }
  dialogQueue.value = dialogQueue.value.slice(1);
  if (request.kind === "confirm") {
    request.resolve(confirmed === true);
  } else {
    request.resolve();
  }
}

export function useDialog(): {
  confirm: typeof requestConfirmation;
  notify: typeof requestNotification;
} {
  return {
    confirm: requestConfirmation,
    notify: requestNotification,
  };
}
