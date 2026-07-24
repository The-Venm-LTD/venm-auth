import { useState, useCallback, useRef, useEffect } from "react";
import { useAuthContext } from "../context/AuthContext";
import type { AuthError } from "../types/auth";

// ── Types ───────────────────────────────────────────────────────────

export interface SignInResultOption {
  isSuccess: boolean;
  success?: {
    idToken?: string;
    serverAuthCode?: string;
    user?: {
      email?: string;
      displayName?: string;
      photoUrl?: string;
    };
  };
  noSuccess?: {
    type?: "CANCELLED" | "NO_SAVED_CREDENTIAL" | "INTERNAL_ERROR";
    message?: string;
  };
}

export interface UseGoogleOneTapResult {
  /** Attempt auto sign-in first, then show One Tap prompt if auto fails */
  tryAutoOrOneTapSignIn: () => Promise<void>;
  /** Attempt auto sign-in only (no UI shown) */
  tryAutoSignIn: () => Promise<void>;
  /** Show the One Tap prompt UI */
  tryOneTapSignIn: () => Promise<void>;
  /** Triggers the native button flow (Android/iOS only) */
  signInWithGoogleButtonFlowForNative: () => Promise<void>;
  /** Cancel the current One Tap dialog */
  cancelOneTapDialog: () => Promise<void>;
  /** Sign out from Google (clears saved credentials) */
  signOut: () => Promise<void>;
  /** Whether a sign-in operation is in progress */
  loading: boolean;
  /** The last error, if any */
  error: AuthError | null;
  /** Whether the Capacitor plugin is available */
  isAvailable: boolean;
}

// ── Capacitor Plugin Proxy ──────────────────────────────────────────
//
// The capacitor-native-google-one-tap-signin plugin is an optional peer
// dependency. We import it lazily and gracefully degrade when it's not
// available (e.g., in a regular browser without Capacitor).
//
// We also check for Capacitor's runtime availability before attempting
// to load or initialize the plugin, because even when the npm package is
// installed, the plugin's methods will fail without the Capacitor native
// bridge (window.Capacitor) being present.

type PluginModule = typeof import("capacitor-native-google-one-tap-signin");
let pluginModule: PluginModule | null = null;

/**
 * Detect mobile platforms via user-agent as a fallback for Capacitor
 * detection when the Capacitor global is not (yet) available.
 */
function isMobilePlatform(): boolean {
  try {
    const ua = navigator.userAgent.toLowerCase();
    return /android|iphone|ipad|ipod/.test(ua);
  } catch {
    return false;
  }
}

/**
 * Returns true when the Capacitor runtime appears available.
 *
 * We check for `window.Capacitor` being truthy rather than requiring
 * `getPlatform` to be a function, because:
 * 1. Some Capacitor versions expose the global without `getPlatform`
 *    during early initialization.
 * 2. The native bridge may set `Capacitor` as a plain object before
 *    all methods are registered.
 */
function isCapacitorAvailable(): boolean {
  try {
    return (window as any)?.Capacitor != null;
  } catch {
    return false;
  }
}

let loadPluginError: any = null;

async function loadPlugin(): Promise<PluginModule | null> {
  if (pluginModule) return pluginModule;

  // On mobile platforms, the Capacitor native bridge might take a moment to attach
  // to the window. If it's not present yet, we wait briefly.
  if (isMobilePlatform() && !isCapacitorAvailable()) {
    console.debug(
      "[venm-auth] Capacitor global not found on mobile platform — deferring 150ms before import..."
    );
    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  // Now, whether Capacitor is present or not, we attempt to import the plugin.
  // It handles its own web fallback via @capacitor/core if running in a browser.
  try {
    pluginModule = await import("capacitor-native-google-one-tap-signin");
    return pluginModule;
  } catch (e) {
    loadPluginError = e;
    console.debug(
      "[venm-auth] capacitor-native-google-one-tap-signin is not installed or import failed.",
      e
    );
    return null;
  }
}

// ── Error Factory ───────────────────────────────────────────────────

function notAvailableError(): AuthError {
  const err = new Error(
    "capacitor-native-google-one-tap-signin is not installed or not available in this environment"
  ) as Error & AuthError;
  err.code = "CAPACITOR_NOT_AVAILABLE";
  err.name = "AuthError";
  return err;
}

// ── Hook ────────────────────────────────────────────────────────────

/**
 * React hook for Google One Tap sign-in using the Capacitor native plugin.
 *
 * Works with the `capacitor-native-google-one-tap-signin` package to provide
 * native Google One Tap sign-in on Android, iOS, and web (via Google Identity
 * Services).
 *
 * Plugin availability is checked eagerly on mount so callers can inspect
 * `isAvailable` before attempting sign-in, avoiding thrown errors when the
 * plugin is not present (e.g., in a regular browser).
 *
 * Pass an empty string or omit the client ID when the plugin is not needed
 * (it will gracefully short-circuit).
 *
 * @param clientId - Your Google OAuth client ID for the web platform.
 *
 * @example
 * ```tsx
 * function SignInButton() {
 *   const oneTap = useGoogleOneTap("YOUR_CLIENT_ID");
 *
 *   return (
 *     <button onClick={() => oneTap.tryAutoOrOneTapSignIn()} disabled={oneTap.loading}>
 *       {oneTap.loading ? "Signing in..." : "Sign in with Google"}
 *     </button>
 *   );
 * }
 * ```
 */
export function useGoogleOneTap(clientId: string): UseGoogleOneTapResult {
  const { loginWithIdToken } = useAuthContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<AuthError | null>(null);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const initialized = useRef(false);

  // ── Eager Initialization ────────────────────────────────────────
  //
  // Probe plugin availability on mount so `isAvailable` reflects the
  // correct state before the user clicks. This lets callers (e.g.
  // GoogleButton) skip the One Tap flow entirely when the plugin is not
  // present, avoiding noisy fallback errors.
  //
  // Delays checking when `clientId` is not yet provided (e.g., during
  // the first render when config is still resolving).

  useEffect(() => {
    if (!clientId) return;

    let cancelled = false;

    loadPlugin()
      .then((plugin) => {
        if (cancelled) return;
        if (!plugin) {
          setIsAvailable(false);
          return;
        }
        // Try initializing the plugin — some environments have the module
        // but the native bridge is absent.
        return plugin.GoogleOneTapAuth.initialize({ clientId }).then(() => {
          if (cancelled) return;
          initialized.current = true;
          setIsAvailable(true);
        });
      })
      .catch((e) => {
        console.warn("[venm-auth] Google One Tap initialization failed:", e);
        if (!cancelled) setIsAvailable(false);
      });

    return () => {
      cancelled = true;
    };
  }, [clientId]);

  // ── Result Handler ─────────────────────────────────────────────

  const handleSignInResult = useCallback(
    async (result: SignInResultOption) => {
      if (result.isSuccess && result.success?.idToken) {
        setError(null);
        try {
          await loginWithIdToken(result.success.idToken);
        } catch (err: any) {
          const authErr = new Error(
            err?.message ??
              "Failed to complete Google One Tap sign-in on the server"
          ) as Error & AuthError;
          authErr.code = err?.code ?? "ONE_TAP_LOGIN_FAILED";
          authErr.name = "AuthError";
          setError(authErr);
          throw authErr;
        } finally {
          setLoading(false);
        }
      } else if (!result.isSuccess) {
        setLoading(false);
        const noSuccess = result.noSuccess;
        if (noSuccess?.type === "CANCELLED") {
          // User dismissed the One Tap dialog — not an error
          return;
        }
        const authErr = new Error(
            noSuccess?.message ??
              "Google One Tap sign-in returned without success"
          ) as Error & AuthError;
        authErr.code = noSuccess?.type ?? "ONE_TAP_FAILED";
        authErr.name = "AuthError";
        setError(authErr);
        throw authErr;
      }
    },
    [loginWithIdToken]
  );

  // ── Ensure Initialized (lazy) ───────────────────────────────────
  //
  // Called by sign-in methods as a safety net. When the eager check in
  // the useEffect hasn't finished yet (e.g., the user clicks very fast),
  // this ensures the plugin is initialized before proceeding.

  const ensureInitialized = useCallback(async (): Promise<PluginModule | null> => {
    if (!clientId) {
      setIsAvailable(false);
      return null;
    }

    if (initialized.current) {
      return pluginModule;
    }

    const plugin = await loadPlugin();
    if (!plugin) {
      setIsAvailable(false);
      throw loadPluginError || new Error("capacitor-native-google-one-tap-signin could not be loaded");
    }

    try {
      await plugin.GoogleOneTapAuth.initialize({ clientId });
      initialized.current = true;
      setIsAvailable(true);
      return plugin;
    } catch (e) {
      setIsAvailable(false);
      throw e;
    }
  }, [clientId]);

  // ── Public Methods ─────────────────────────────────────────────

  const tryAutoOrOneTapSignIn = useCallback(async () => {
    setLoading(true);
    setError(null);

    let plugin;
    try {
      plugin = await ensureInitialized();
    } catch (e: any) {
      setLoading(false);
      const authErr = new Error(
        e.message || "Failed to initialize Google One Tap"
      ) as Error & AuthError;
      authErr.code = "ONE_TAP_INIT_FAILED";
      authErr.name = "AuthError";
      setError(authErr);
      throw authErr;
    }

    if (!plugin) {
      setLoading(false);
      const err = notAvailableError();
      setError(err);
      throw err;
    }

    return new Promise<void>((resolve, reject) => {
      plugin.GoogleOneTapAuth.tryAutoOrOneTapSignInWithCallback(
        async (result: SignInResultOption) => {
          try {
            await handleSignInResult(result);
            resolve();
          } catch (err) {
            reject(err);
          }
        }
      ).catch(reject);
    });
  }, [ensureInitialized, handleSignInResult]);

  const tryAutoSignIn = useCallback(async () => {
    setLoading(true);
    setError(null);

    let plugin;
    try {
      plugin = await ensureInitialized();
    } catch (e: any) {
      setLoading(false);
      const authErr = new Error(
        e.message || "Failed to initialize Google One Tap"
      ) as Error & AuthError;
      authErr.code = "ONE_TAP_INIT_FAILED";
      authErr.name = "AuthError";
      setError(authErr);
      throw authErr;
    }

    if (!plugin) {
      setLoading(false);
      const err = notAvailableError();
      setError(err);
      throw err;
    }

    try {
      const result = await plugin.GoogleOneTapAuth.tryAutoSignIn();
      await handleSignInResult(result);
    } catch (err) {
      setLoading(false);
      throw err;
    }
  }, [ensureInitialized, handleSignInResult]);

  const tryOneTapSignIn = useCallback(async () => {
    setLoading(true);
    setError(null);

    let plugin;
    try {
      plugin = await ensureInitialized();
    } catch (e: any) {
      setLoading(false);
      const authErr = new Error(
        e.message || "Failed to initialize Google One Tap"
      ) as Error & AuthError;
      authErr.code = "ONE_TAP_INIT_FAILED";
      authErr.name = "AuthError";
      setError(authErr);
      throw authErr;
    }

    if (!plugin) {
      setLoading(false);
      const err = notAvailableError();
      setError(err);
      throw err;
    }

    try {
      const result = await plugin.GoogleOneTapAuth.tryOneTapSignIn();
      await handleSignInResult(result);
    } catch (err) {
      setLoading(false);
      throw err;
    }
  }, [ensureInitialized, handleSignInResult]);

  const signInWithGoogleButtonFlowForNative = useCallback(async () => {
    setLoading(true);
    setError(null);

    let plugin;
    try {
      plugin = await ensureInitialized();
    } catch (e: any) {
      setLoading(false);
      const authErr = new Error(
        e.message || "Failed to initialize Google One Tap"
      ) as Error & AuthError;
      authErr.code = "ONE_TAP_INIT_FAILED";
      authErr.name = "AuthError";
      setError(authErr);
      throw authErr;
    }

    if (!plugin) {
      setLoading(false);
      const err = notAvailableError();
      setError(err);
      throw err;
    }

    try {
      const result = await plugin.GoogleOneTapAuth.signInWithGoogleButtonFlowForNative();
      await handleSignInResult(result);
    } catch (err) {
      setLoading(false);
      throw err;
    }
  }, [ensureInitialized, handleSignInResult]);

  const cancelOneTapDialog = useCallback(async () => {
    const plugin = pluginModule;
    if (plugin) {
      await plugin.GoogleOneTapAuth.cancelOneTapDialog();
    }
  }, []);

  const signOut = useCallback(async () => {
    const plugin = pluginModule;
    if (plugin) {
      await plugin.GoogleOneTapAuth.signOut();
    }
  }, []);

  return {
    tryAutoOrOneTapSignIn,
    tryAutoSignIn,
    tryOneTapSignIn,
    signInWithGoogleButtonFlowForNative,
    cancelOneTapDialog,
    signOut,
    loading,
    error,
    isAvailable: isAvailable ?? false,
  };
}
