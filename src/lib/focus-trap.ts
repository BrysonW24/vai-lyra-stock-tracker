/**
 * Tab-cycle containment for modal overlays (drawers, sheets). Call from a keydown
 * listener while the overlay is open: Tab past the last focusable wraps to the first,
 * Shift+Tab before the first wraps to the last, and focus that escaped the container
 * (or sits on <body>) is pulled back in. Pure DOM, no React dependency, shared by
 * DetailDrawer / ChatWidget / InvestigationDrawerStack so the behavior cannot drift.
 */

// Stack of open dialogs. Only the TOP-MOST registered dialog contains focus, so two
// overlapping overlays (e.g. an investigation drawer under the feedback sheet) never
// fight over Tab - each dialog registers on open and unregisters on close.
const dialogStack: HTMLElement[] = [];

export function registerDialog(el: HTMLElement): () => void {
  dialogStack.push(el);
  return () => {
    const i = dialogStack.lastIndexOf(el);
    if (i >= 0) dialogStack.splice(i, 1);
  };
}

function isTopDialog(el: HTMLElement): boolean {
  if (dialogStack.length === 0) return true; // untracked container, nothing to defer to
  if (!dialogStack.includes(el)) return false; // a registered dialog is above this one
  return dialogStack[dialogStack.length - 1] === el;
}

function isTabbable(el: HTMLElement): boolean {
  if (el.getAttribute('aria-hidden') === 'true' || el.closest('[aria-hidden="true"]') !== null) return false;
  // display:none / detached elements silently no-op on .focus() AFTER we preventDefault,
  // eating the keystroke - filter them out. checkVisibility where available, else offsetParent.
  return typeof el.checkVisibility === 'function' ? el.checkVisibility() : el.offsetParent !== null;
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

export function focusableWithin(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(isTabbable);
}

/** Handle one keydown: contains Tab focus inside container. No-op for other keys. */
export function containFocus(container: HTMLElement | null, event: KeyboardEvent): void {
  if (event.key !== 'Tab' || !container || !isTopDialog(container)) return;
  const nodes = focusableWithin(container);
  if (nodes.length === 0) {
    event.preventDefault();
    return;
  }

  const first = nodes[0];
  const last = nodes[nodes.length - 1];
  const active = document.activeElement;
  const activeInside = active instanceof HTMLElement && container.contains(active);

  if (event.shiftKey) {
    if (!activeInside || active === first) {
      event.preventDefault();
      last.focus();
    }
  } else if (!activeInside || active === last) {
    event.preventDefault();
    first.focus();
  }
}
