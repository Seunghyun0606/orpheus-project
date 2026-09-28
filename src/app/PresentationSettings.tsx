import type { PresentationPreferences, TextScale } from './presentation-settings.ts';

export interface PresentationSettingsProps {
  readonly preferences: PresentationPreferences;
  readonly onChange: (preferences: PresentationPreferences) => void;
}

export function PresentationSettings({ preferences, onChange }: PresentationSettingsProps) {
  return (
    <details className="presentation-settings">
      <summary>Display settings</summary>
      <div className="presentation-settings-controls">
        <label>
          <input
            checked={preferences.crtEffects}
            onChange={(event) =>
              onChange({ ...preferences, crtEffects: event.currentTarget.checked })
            }
            type="checkbox"
          />
          CRT effects
        </label>
        <label>
          <input
            checked={preferences.reducedAnimation}
            onChange={(event) =>
              onChange({ ...preferences, reducedAnimation: event.currentTarget.checked })
            }
            type="checkbox"
          />
          Reduce animation
        </label>
        <label>
          Text scale
          <select
            onChange={(event) =>
              onChange({ ...preferences, textScale: event.currentTarget.value as TextScale })
            }
            value={preferences.textScale}
          >
            <option value="standard">Standard (100%)</option>
            <option value="large">Large (125%)</option>
            <option value="extra-large">Extra large (150%)</option>
          </select>
        </label>
      </div>
    </details>
  );
}
