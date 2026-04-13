/**
 * Navigation Bridge
 * Lets components outside <RouterProvider> tree call React Router's navigate()
 * and read the current pathname — without touching useLocation / useNavigate.
 */

type NavigateFn = (to: string) => void;

let _navigate: NavigateFn = (to) => { window.location.href = to; };

/** Called once from RootLayout (inside RouterProvider) to register the real navigate fn. */
export function registerNavigate(fn: NavigateFn) {
  _navigate = fn;
}

/** Navigate programmatically — works inside OR outside RouterProvider. */
export function bridgeNavigate(to: string) {
  _navigate(to);
}

/** Custom event dispatched by RootLayout on every route change. */
export const ROUTE_CHANGE_EVENT = 'stride:route-change';
