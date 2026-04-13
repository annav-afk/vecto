import { Outlet, useNavigate, useLocation } from 'react-router';
import { useEffect, useRef } from 'react';
import { MobileTabBar } from './MobileTabBar';
import { WelcomeGreeting } from './WelcomeGreeting';
import { registerNavigate, ROUTE_CHANGE_EVENT } from '../lib/navigationBridge';
import { recordSession } from '../lib/patternTracker';
import { startTomiNotificationChecker, stopTomiNotificationChecker } from '../lib/tomiNotifications';

/**
 * Root layout — wraps every route.
 * Lives inside RouterProvider, so useLocation / useNavigate are safe here.
 * Publishes navigate + route-change events to the navigation bridge so
 * components like MobileTabBar can work without using router hooks directly.
 */
function NavigationBridge() {
  const navigate = useNavigate();
  const location = useLocation();

  // Register the real navigate function with the bridge
  useEffect(() => {
    registerNavigate(navigate);
  }, [navigate]);

  // Dispatch a custom event on every route change so subscribers can update
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent(ROUTE_CHANGE_EVENT, { detail: { pathname: location.pathname } })
    );
  }, [location.pathname]);

  return null;
}

// Session tracker for Tomi-clone pattern analysis
function SessionTracker() {
  const sessionStart = useRef(Date.now());
  useEffect(() => {
    const start = sessionStart.current;
    // Start notification checker
    startTomiNotificationChecker();
    const handleEnd = () => {
      try { recordSession(start, 0); } catch {}
    };
    window.addEventListener('beforeunload', handleEnd);
    return () => {
      window.removeEventListener('beforeunload', handleEnd);
      stopTomiNotificationChecker();
      handleEnd();
    };
  }, []);
  return null;
}

export function RootLayout() {
  return (
    <>
      <NavigationBridge />
      <SessionTracker />
      <Outlet />
      <WelcomeGreeting />
      <MobileTabBar />
    </>
  );
}