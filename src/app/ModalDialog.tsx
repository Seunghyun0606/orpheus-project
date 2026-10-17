import { useEffect, type KeyboardEvent, type ReactNode, type RefObject } from 'react';

export interface ModalDialogProps {
  readonly role: 'dialog' | 'alertdialog';
  readonly titleId: string;
  readonly descriptionId: string;
  readonly channel: string;
  readonly title: ReactNode;
  readonly description: ReactNode;
  readonly children: ReactNode;
  /** Element that receives focus when the dialog opens. */
  readonly initialFocusRef: RefObject<HTMLElement | null>;
  /** Escape handler. Omit to make Escape a no-op (e.g. a required acknowledgement). */
  readonly onEscape?: () => void;
}

// Shared modal frame: labelled, focus-trapped, Escape-aware. The caller owns
// returning focus to the trigger, because only it knows whether that still exists.
export function ModalDialog({
  role,
  titleId,
  descriptionId,
  channel,
  title,
  description,
  children,
  initialFocusRef,
  onEscape,
}: ModalDialogProps) {
  useEffect(() => {
    initialFocusRef.current?.focus();
  }, [initialFocusRef]);

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape' && onEscape !== undefined) {
      event.preventDefault();
      onEscape();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = [
      ...event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), [href]'),
    ];
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  };

  return (
    <div className="narrative-overlay">
      <section
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="narrative-dialog"
        onKeyDown={onKeyDown}
        role={role}
      >
        <span className="narrative-channel">{channel}</span>
        <h2 id={titleId}>{title}</h2>
        <p id={descriptionId}>{description}</p>
        <div className="dialog-actions">{children}</div>
      </section>
    </div>
  );
}
