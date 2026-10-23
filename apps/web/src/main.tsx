import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { router } from './app/router';
import { AuthProvider } from './lib/auth';
import { I18nProvider } from './lib/i18n';
import { LiveProvider } from './lib/live';
import '@fontsource-variable/atkinson-hyperlegible-next';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <AuthProvider>
        <LiveProvider>
          <RouterProvider router={router} />
        </LiveProvider>
      </AuthProvider>
    </I18nProvider>
  </StrictMode>,
);
