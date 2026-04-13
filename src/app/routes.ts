import { createBrowserRouter } from 'react-router';
import { RootLayout } from './components/RootLayout';
import { LandingPage } from './pages/LandingPage';
import { GoalInputPage } from './pages/GoalInputPage';
import { PlanPage } from './pages/PlanPage';
import { DashboardPage } from './pages/DashboardPage';
import { SharePage } from './pages/SharePage';
import { PRDPage } from './pages/PRDPage';
import { ProfilePage } from './pages/ProfilePage';
import { AdminPage } from './pages/AdminPage';
import { SimulatorPage } from './pages/SimulatorPage';
import { BrandingPage } from './pages/BrandingPage';
import { TomiInsightsPage } from './pages/TomiInsightsPage';

export const router = createBrowserRouter([
  {
    Component: RootLayout,
    children: [
      { path: '/',               Component: LandingPage },
      { path: '/new',            Component: GoalInputPage },
      { path: '/plan/:id',       Component: PlanPage },
      { path: '/dashboard',      Component: DashboardPage },
      { path: '/share/:shareId', Component: SharePage },
      { path: '/prd',            Component: PRDPage },
      { path: '/profile',        Component: ProfilePage },
      { path: '/admin',          Component: AdminPage },
      { path: '/simulator',      Component: SimulatorPage },
      { path: '/branding',       Component: BrandingPage },
      { path: '/tomi-insights',  Component: TomiInsightsPage },
      { path: '*',               Component: LandingPage },
    ],
  },
]);