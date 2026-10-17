import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import './ui/base.css';
import {
  applyPresentationPreferences,
  readPresentationPreferences,
} from './app/presentation-settings.ts';
import { Root } from './Root.tsx';

// Apply stored display preferences before the first paint so text scale, theme
// and CRT/motion settings never flash their defaults during the lazy load.
applyPresentationPreferences(readPresentationPreferences());

const root = document.getElementById('root');

if (!root) {
  throw new Error('Application root element was not found.');
}

createRoot(root).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
