import { useEffect, useMemo, useState } from 'react';

import { usePresentationPreferences } from '../app/presentation-settings.ts';
import { useI18n, useMessages } from '../i18n/I18n.ts';
import { defineMessages } from '../i18n/locale.ts';
import {
  onboardingGuide,
  renderHintText,
  selectHint,
  setOnboardingPreferences,
  useOnboardingPreferences,
  type OnboardingState,
  type OnboardingSurface,
} from './onboarding.ts';

const messages = defineMessages({
  en: {
    label: 'Tip from your lead',
    channel: 'Direct message',
    show: 'Show me',
    dismiss: 'Got it',
    disable: 'Turn off tips',
  },
  ko: {
    label: '리드의 팁',
    channel: 'DM',
    show: '어디예요?',
    dismiss: '알겠어요',
    disable: '팁 끄기',
  },
});

const targetSelector = (focus: string) => `[data-onboarding-target~="${CSS.escape(focus)}"]`;

// A colleague's direct message during the first Incidents. It reads the
// Incident state and points at the next useful part of the screen; it never
// performs or blocks an action.
export function OnboardingCoach({
  surface,
  state,
  availableActionIds,
  actionTitle,
}: {
  surface: OnboardingSurface;
  state: OnboardingState | undefined;
  availableActionIds: readonly string[];
  // Authored (English) action title; translated here for display.
  actionTitle: (id: string) => string | undefined;
}) {
  const m = useMessages(messages);
  const { locale, ct } = useI18n();
  const preferences = useOnboardingPreferences();
  const reducedMotion = usePresentationPreferences().preferences.reducedAnimation;
  const dismissed = useMemo(() => new Set(preferences.dismissed), [preferences.dismissed]);
  const active =
    preferences.enabled && state !== undefined
      ? selectHint(onboardingGuide, state, availableActionIds, dismissed, surface, locale)
      : undefined;
  const focus = active?.focus;
  const [targetShown, setTargetShown] = useState(false);

  // Quietly mark the element the tip talks about; the mark follows re-renders.
  useEffect(() => {
    if (focus === undefined) return;
    const target = document.querySelector<HTMLElement>(targetSelector(focus));
    target?.setAttribute('data-onboarding-focus', '');
    return () => target?.removeAttribute('data-onboarding-focus');
  });

  // "Show me" is offered only while that element is on screen (a postmortem
  // view, for instance, has no action buttons).
  useEffect(() => {
    setTargetShown(focus !== undefined && document.querySelector(targetSelector(focus)) !== null);
  }, [focus, state, availableActionIds]);

  if (active === undefined) return null;

  const text = renderHintText(active.text, (id) => {
    const title = actionTitle(id);
    return title === undefined ? id : ct(title);
  });
  const showTarget = () => {
    if (focus === undefined) return;
    const target = document.querySelector<HTMLElement>(targetSelector(focus));
    if (target === null) return;
    target.scrollIntoView?.({ block: 'center', behavior: reducedMotion ? 'auto' : 'smooth' });
    target.focus({ preventScroll: true });
  };
  const dismiss = () =>
    setOnboardingPreferences({
      ...preferences,
      dismissed: [...preferences.dismissed, active.key],
    });

  return (
    <aside className="onboarding-coach" aria-label={m.label}>
      <p className="onboarding-coach-sender">
        <span aria-hidden="true">✉ </span>
        {onboardingGuide.sender[locale]} · {m.channel}
      </p>
      <p className="onboarding-coach-text" aria-live="polite">
        {text}
      </p>
      <div className="onboarding-coach-actions">
        {targetShown ? (
          <button type="button" onClick={showTarget}>
            {m.show}
          </button>
        ) : null}
        <button type="button" onClick={dismiss}>
          {m.dismiss}
        </button>
        <button
          className="onboarding-coach-off"
          type="button"
          onClick={() => setOnboardingPreferences({ ...preferences, enabled: false })}
        >
          {m.disable}
        </button>
      </div>
    </aside>
  );
}
