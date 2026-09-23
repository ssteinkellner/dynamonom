export async function copyText(
  text: string,
  returnFocusTo?: HTMLElement | null,
): Promise<void> {
  const activeElement =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
  let clipboardFailure: unknown;

  try {
    await navigator.clipboard.writeText(text);
    focusTarget(returnFocusTo, activeElement);
    return;
  } catch (error) {
    clipboardFailure = error;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.className = "visually-hidden";
  document.body.append(textarea);

  let copied = false;
  try {
    textarea.focus();
    textarea.select();
    copied = document.execCommand("copy");
  } catch (error) {
    clipboardFailure = error;
  } finally {
    textarea.remove();
    focusTarget(returnFocusTo, activeElement);
  }

  if (!copied) {
    throw new Error("Kopieren wurde vom Browser verweigert.", {
      cause: clipboardFailure,
    });
  }
}

function focusTarget(
  returnFocusTo: HTMLElement | null | undefined,
  fallback: HTMLElement | null,
): void {
  if (returnFocusTo?.isConnected) {
    returnFocusTo.focus();
  } else if (fallback?.isConnected) {
    fallback.focus();
  }
}
