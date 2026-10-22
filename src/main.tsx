import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Amplify } from 'aws-amplify';
// Généré par `npm run sandbox` (local) ou par le build Amplify Hosting (production).
import outputs from '../amplify_outputs.json';
import './index.css';
import App from './App.tsx';

Amplify.configure(outputs);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
