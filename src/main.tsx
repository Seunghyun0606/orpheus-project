import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { AppShell } from './app/AppShell';
import './ui/base.css';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Application root element was not found.');
}

createRoot(root).render(
  <StrictMode>
    <AppShell />
  </StrictMode>,
);
