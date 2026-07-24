/**
 * Current runtime platform.
 * - `"android"` — running natively on Android (Capacitor)
 * - `"ios"` — running natively on iOS (Capacitor)
 * - `"web"` — running in a browser (default)
 */
export type Platform = "android" | "ios" | "web";

let cachedPlatform: Platform | null = null;

/**
 * Detect the current platform at runtime.
 *
 * On native Capacitor (Android / iOS), `window.Capacitor.getPlatform()`
 * returns the platform string. In a regular browser we fall back to user-agent
 * sniffing, defaulting to `"web"` when nothing matches.
 *
 * The result is cached after the first call so subsequent lookups are instant.
 */
export function detectPlatform(): Platform {
  if (cachedPlatform) return cachedPlatform;

  try {
    // Capacitor environment — use its native platform detection
    const cap = (window as any).Capacitor;
    if (cap?.getPlatform) {
      const p: string = cap.getPlatform();
      if (p === "android" || p === "ios") {
        cachedPlatform = p;
        return cachedPlatform;
      }
    }
  } catch {
    // window.Capacitor may not be available
  }

  // Fallback: user-agent sniffing
  const ua = navigator.userAgent.toLowerCase();
  if (/android/.test(ua)) {
    cachedPlatform = "android";
  } else if (/iphone|ipad|ipod/.test(ua)) {
    cachedPlatform = "ios";
  } else {
    cachedPlatform = "web";
  }

  return cachedPlatform;
}

