import { createBrowserRouter } from 'react-router';
import { Placeholder } from '../components/Placeholder';
import { LoginPage } from '../features/auth/LoginPage';
import { MentionsPage } from '../features/legal/MentionsPage';
import { AppLayout } from './AppLayout';
import { HomeRedirect, RequireRole } from './RequireRole';

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <HomeRedirect /> },
      { path: 'connexion', element: <LoginPage /> },
      { path: 'mentions', element: <MentionsPage /> },
      {
        path: 'etudiant',
        element: <RequireRole role="STUDENT" />,
        children: [
          { index: true, element: <Placeholder title="Mes signalements" story="US-08" /> },
          { path: 'signaler', element: <Placeholder title="Signaler un incident" story="US-03" /> },
          { path: 'assistant', element: <Placeholder title="Assistant IA" story="US-19" /> },
        ],
      },
      {
        path: 'agent',
        element: <RequireRole role="AGENT" />,
        children: [{ index: true, element: <Placeholder title="Tickets" story="US-14" /> }],
      },
      {
        path: 'admin',
        element: <RequireRole role="ADMIN" />,
        children: [
          { index: true, element: <Placeholder title="Tableau de bord" story="US-28" /> },
          { path: 'tickets', element: <Placeholder title="Tickets" story="US-13" /> },
        ],
      },
      { path: '*', element: <Placeholder title="Page introuvable" story="404" /> },
    ],
  },
]);
