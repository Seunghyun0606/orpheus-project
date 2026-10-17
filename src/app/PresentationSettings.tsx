import { useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import {
  PresentationContext,
  applyPresentationPreferences,
  readPresentationPreferences,
  savePresentationPreferences,
  usePresentationPreferences,
  type ColorTheme,
  type PresentationPreferences,
  type TextScale,
} from './presentation-settings.ts';

// One shared preference state for every screen. A nested provider is a
// pass-through, so screens can also be mounted on their own (tests, QA entry)
// without creating a second, diverging copy of the settings.
export function PresentationProvider({ children }: { children: ReactNode }) {
  const parent = useContext(PresentationContext);
  if (parent !== null) return <>{children}</>;
  return <RootPresentationProvider>{children}</RootPresentationProvider>;
}

function RootPresentationProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<PresentationPreferences>(
    readPresentationPreferences,
  );

  useEffect(() => {
    applyPresentationPreferences(preferences);
    savePresentationPreferences(preferences);
  }, [preferences]);

  const value = useMemo(() => ({ preferences, setPreferences }), [preferences]);
  return <PresentationContext.Provider value={value}>{children}</PresentationContext.Provider>;
}

export function PresentationSettings() {
  const { preferences, setPreferences } = usePresentationPreferences();
  const update = (patch: Partial<PresentationPreferences>) =>
    setPreferences({ ...preferences, ...patch });

  return (
    <details className="presentation-settings">
      <summary>Display settings</summary>
      <div className="presentation-settings-controls">
        <label>
          <input
            checked={preferences.crtEffects}
            onChange={(event) => update({ crtEffects: event.currentTarget.checked })}
            type="checkbox"
          />
          CRT effects
        </label>
        <label>
          <input
            checked={preferences.reducedAnimation}
            onChange={(event) => update({ reducedAnimation: event.currentTarget.checked })}
            type="checkbox"
          />
          Reduce animation
        </label>
        <label>
          Text scale
          <select
            onChange={(event) => update({ textScale: event.currentTarget.value as TextScale })}
            value={preferences.textScale}
          >
            <option value="standard">Standard (100%)</option>
            <option value="large">Large (125%)</option>
            <option value="extra-large">Extra large (150%)</option>
          </select>
        </label>
        <label>
          Colour theme
          <select
            onChange={(event) => update({ colorTheme: event.currentTarget.value as ColorTheme })}
            value={preferences.colorTheme}
          >
            <option value="standard">Phosphor green (standard)</option>
            <option value="high-contrast">High contrast</option>
          </select>
        </label>
        <p className="presentation-settings-note">
          Settings apply to every screen. High contrast also removes scanlines and glow. Your
          system&apos;s reduced-motion and forced-colour settings are always respected.
        </p>
      </div>
    </details>
  );
}
