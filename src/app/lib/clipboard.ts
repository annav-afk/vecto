/**
 * Safe clipboard write — tries the modern Clipboard API first,
 * then falls back to the legacy execCommand approach for
 * environments where the Permissions-Policy blocks clipboard access
 * (e.g. cross-origin iframes / Figma preview).
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  // 1. Modern async API
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fall through to legacy approach
    }
  }

  // 2. Legacy execCommand fallback
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, ta.value.length); // iOS
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
