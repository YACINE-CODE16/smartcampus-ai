import { createBrowserRouter } from 'react-router';
import { Placeholder } from '../components/Placeholder';
import { AdminSettingsPage } from '../features/admin/AdminSettingsPage';
import { DashboardPage } from '../features/admin/DashboardPage';
import { KnowledgePage } from '../features/admin/KnowledgePage';
import { UsersPage } from '../features/admin/UsersPage';
import { AdminTicketsPage } from '../features/admin/AdminTicketsPage';
import { AgentHomePage } from '../features/agent/AgentHomePage';
import { LoginPage } from '../features/auth/LoginPage';
import { MentionsPage } from '../features/legal/MentionsPage';
import { AssistantPage } from '../features/student/AssistantPage';
import { MyIncidentsPage } from '../features/student/MyIncidentsPage';
import { ReportPage } from '../features/student/ReportPage';
import { StudentIncidentPage } from '../features/student/StudentIncidentPage';
import { WorkIncidentPage } from '../features/work/WorkIncidentPage';
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
          { index: true, element: <MyIncidentsPage /> },
          { path: 'signaler', element: <ReportPage /> },
          { path: 'tickets/:id', element: <StudentIncidentPage /> },
          { path: 'assistant', element: <AssistantPage /> },
        ],
      },
      {
        path: 'agent',
        element: <RequireRole role="AGENT" />,
        children: [
          { index: true, element: <AgentHomePage /> },
          { path: 'tickets/:id', element: <WorkIncidentPage base="/agent" /> },
        ],
      },
      {
        path: 'admin',
        element: <RequireRole role="ADMIN" />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: 'tickets', element: <AdminTicketsPage /> },
          { path: 'tickets/:id', element: <WorkIncidentPage base="/admin/tickets" /> },
          { path: 'reglages', element: <AdminSettingsPage /> },
          { path: 'base-documentaire', element: <KnowledgePage /> },
          { path: 'utilisateurs', element: <UsersPage /> },
        ],
      },
      { path: '*', element: <Placeholder title="Page introuvable" story="404" /> },
    ],
  },
]);
