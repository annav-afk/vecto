import { useEffect } from 'react';
import { RouterProvider } from 'react-router';
import { router } from './routes';
import { Toaster } from 'sonner';
import { ThemeProvider } from 'next-themes';
import { AuthProvider } from './lib/auth';
import { ErrorBoundary } from './components/ErrorBoundary';
import { TomiProvider } from './components/TomiAssistant';
import { TimerProvider } from './lib/timerContext';

// ── Mobile viewport stability ──────────────────────────────────────────────────
function useMobileViewport() {
  useEffect(() => {
    let viewportMeta = document.querySelector('meta[name="viewport"]') as HTMLMetaElement | null;
    if (!viewportMeta) {
      viewportMeta = document.createElement('meta');
      viewportMeta.name = 'viewport';
      document.head.prepend(viewportMeta);
    }
    viewportMeta.content =
      'width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1, interactive-widget=resizes-content';

    const setVH = () => {
      const h = window.visualViewport?.height ?? window.innerHeight;
      document.documentElement.style.setProperty('--dvh', `${h * 0.01}px`);
    };

    setVH();
    window.visualViewport?.addEventListener('resize', setVH);
    window.visualViewport?.addEventListener('scroll', setVH);
    window.addEventListener('resize', setVH);
    window.addEventListener('orientationchange', setVH);

    return () => {
      window.visualViewport?.removeEventListener('resize', setVH);
      window.visualViewport?.removeEventListener('scroll', setVH);
      window.removeEventListener('resize', setVH);
      window.removeEventListener('orientationchange', setVH);
    };
  }, []);
}

// ── PWA assets ────────────────────────────────────────────────────────────────
function usePWA() {
  useEffect(() => {
    if (!document.querySelector('link[rel="manifest"]')) {
      const link = document.createElement('link');
      link.rel = 'manifest';
      link.href = '/manifest.json';
      document.head.appendChild(link);
    }

    // Theme color
    if (!document.querySelector('meta[name="theme-color"]')) {
      const meta = document.createElement('meta');
      meta.name = 'theme-color';
      meta.content = '#1d4ed8';
      document.head.appendChild(meta);
    }

    // Apple PWA meta tags for iPhone 16 Pro Max
    const appleMetaTags: [string, string][] = [
      ['apple-mobile-web-app-capable',        'yes'],
      ['apple-mobile-web-app-status-bar-style', 'black-translucent'],
      ['apple-mobile-web-app-title',          'Vecto'],
      ['mobile-web-app-capable',              'yes'],
      ['format-detection',                    'telephone=no'],
    ];
    appleMetaTags.forEach(([name, content]) => {
      if (!document.querySelector(`meta[name="${name}"]`)) {
        const m = document.createElement('meta');
        m.name = name;
        m.content = content;
        document.head.appendChild(m);
      }
    });

    // Apple touch icon
    if (!document.querySelector('link[rel="apple-touch-icon"]')) {
      const link = document.createElement('link');
      link.rel = 'apple-touch-icon';
      link.href = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 180 180'><rect width='180' height='180' rx='36' fill='%231d4ed8'/><path d='M74 44l80 0-52 110h72l-90 150 18-110H38z' fill='white' transform='scale(0.5) translate(32,12)'/></svg>";
      document.head.appendChild(link);
    }
  }, []);
}

export default function App() {
  useMobileViewport();
  usePWA();

  return (
    <ErrorBoundary context="App">
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} storageKey="stride-theme">
        <AuthProvider>
          <TimerProvider>
            <TomiProvider>
              {/*
                RouterProvider owns the router context.
                MobileTabBar and WelcomeGreeting live inside RootLayout
                (a child of RouterProvider) so useLocation / useNavigate work.
              */}
              <RouterProvider router={router} />
              <Toaster
                richColors
                position="top-right"
                offset={{ top: 'max(1rem, calc(env(safe-area-inset-top) + 0.75rem))' } as any}
                toastOptions={{
                  style: { marginTop: 0 },
                }}
              />
            </TomiProvider>
          </TimerProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}