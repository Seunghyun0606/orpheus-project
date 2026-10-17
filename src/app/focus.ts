// Return focus to the element that opened a dialog or ran an action. When it is
// gone, disabled or inside an inert region, a stable fallback keeps focus on-screen.
export function restoreFocus(
  target: HTMLElement | null | undefined,
  fallback?: HTMLElement | null,
): void {
  if (
    target?.isConnected &&
    !(target instanceof HTMLButtonElement && target.disabled) &&
    !target.closest('[inert]')
  ) {
    target.focus();
    return;
  }
  fallback?.focus();
}
