import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import type { AuthState, AuthAction, AuthContextValue, ProviderType, AuthError } from "../types/auth";
import type { SDKConfig } from "../types/config";
import { validateConfig } from "../utils/validate";
import { createLogger } from "../utils/logger";
import { AuthService } from "../services/auth-service";
import { PopupManager } from "../services/popup-manager";
import { SessionService } from "../services/session-service";
import { GoogleOAuthProvider } from "../providers/google";
import { FacebookOAuthProvider } from "../providers/facebook";
// ── Reducer ──────────────────────────────────────────────────────────

export function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case "INIT":
    case "LOADING":
      return { ...state, loading: true, error: null };

    case "AUTHENTICATED":
      return {
        user: action.payload.user,
        session: action.payload.session,
        loading: false,
        error: null,
      };

    case "UNAUTHENTICATED":
      return {
        user: null,
        session: null,
        loading: false,
        error: action.payload?.error ?? null,
      };

    case "SESSION_REFRESHED":
      return { ...state, session: action.payload, loading: false };

    case "ERROR":
      return { ...state, error: action.payload, loading: false };

    default:
      return state;
  }
}

const initialState: AuthState = {
  user: null,
  session: null,
  loading: true,
  error: null,
};

// ── Context ──────────────────────────────────────────────────────────

export const AuthContext = createContext<AuthContextValue | null>(null);

// ── Provider ─────────────────────────────────────────────────────────

interface AuthProviderProps {
  children: ReactNode;
  config: SDKConfig;
  onAuthStateChange?: (state: AuthState) => void;
  /**
   * When true, skips config validation — used when the calling component
   * (e.g., VenmProvider) has already validated the config.
   */
  skipValidation?: boolean;
}

export function AuthProvider({
  children,
  config,
  onAuthStateChange,
  skipValidation = false,
}: AuthProviderProps) {
  const resolvedConfig = React.useMemo(
    () => skipValidation ? config as SDKConfig : validateConfig(config),
    [config, skipValidation]
  );

  const [state, dispatch] = useReducer(authReducer, initialState);
  const logger = useRef(
    createLogger(resolvedConfig.environment)
  ).current;

  // Store mutable refs so callbacks always use the latest values
  const stateRef = useRef(state);
  stateRef.current = state;

  // Initialize services — stable references via useRef
  const services = useRef<{
    authService: AuthService;
    popupManager: PopupManager;
    sessionService: SessionService;
  } | null>(null);

  if (!services.current) {
    const getSession = () => stateRef.current.session;
    const authService = new AuthService(resolvedConfig, getSession);
    const popupManager = new PopupManager(resolvedConfig);
    const sessionService = new SessionService(
      resolvedConfig,
      authService,
      () => {
        sessionService.clearSession();
        dispatch({
          type: "UNAUTHENTICATED",
          payload: {
            error: {
              code: "SESSION_EXPIRED",
              message: "Auto-refresh failed — session expired",
            },
          },
        });
      }
    );

    services.current = { authService, popupManager, sessionService };
  }

  // ── Initialize session on mount ─────────────────────────────────
  //
  // In React 18 StrictMode (development), the effect fires twice.
  // Without a guard, two parallel initialize() calls race to refresh
  // with the same refresh token — the first rotates tokens on the server,
  // the second fails with SESSION_NOT_FOUND, then clears localStorage
  // and logs the user out. The "cancelled" flag below ensures stale
  // callbacks from a previous invocation are ignored.
  //
  // The concurrency guard in SessionService.refreshSession() ensures
  // duplicate calls share the same in-flight promise, but the cancelled
  // flag prevents stale dispatches after a re-mount.

  useEffect(() => {
    let cancelled = false;
    const { sessionService } = services.current!;

    dispatch({ type: "INIT" });

    sessionService
      .initialize()
      .then(({ session, user }) => {
        if (cancelled) return;
        if (session && user) {
          dispatch({ type: "AUTHENTICATED", payload: { user, session } });
        } else {
          dispatch({ type: "UNAUTHENTICATED" });
        }
      })
      .catch((error) => {
        if (cancelled) return;
        logger.error("Session initialization failed:", error);
        dispatch({
          type: "UNAUTHENTICATED",
          payload: {
            error: {
              code: "INIT_ERROR",
              message:
                error instanceof Error
                  ? error.message
                  : "Failed to initialize session",
            },
          },
        });
      });

    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Notify on auth state change ──────────────────────────────────

  // Store callback in a ref to avoid stale closures
  // when users inline onAuthStateChange
  const onAuthStateChangeRef = useRef(onAuthStateChange);
  onAuthStateChangeRef.current = onAuthStateChange;

  useEffect(() => {
    if (!state.loading) {
      onAuthStateChangeRef.current?.(state);
    }
  }, [state]);

  // ── Cleanup on unmount ───────────────────────────────────────────

  useEffect(() => {
    return () => {
      services.current?.sessionService.cancelRefresh();
      services.current?.popupManager.close();
    };
  }, []);

  // ── Login ────────────────────────────────────────────────────────

  const login = useCallback(
    async (provider: ProviderType) => {
      const { popupManager, authService, sessionService } = services.current!;

      dispatch({ type: "LOADING" });

      try {
        const providerInstance =
          provider === "google"
            ? new GoogleOAuthProvider()
            : new FacebookOAuthProvider();

        const { authorizationCode, codeVerifier } = await providerInstance.login(
          popupManager,
          resolvedConfig
        );

        const response = await authService.loginWithProvider(
          provider,
          authorizationCode,
          codeVerifier
        );

        sessionService.saveSession(response.session, response.user);

        dispatch({
          type: "AUTHENTICATED",
          payload: { user: response.user, session: response.session },
        });
      } catch (error) {
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          "message" in error
        ) {
          dispatch({ type: "ERROR", payload: error as AuthError });
        } else {
          dispatch({
            type: "ERROR",
            payload: {
              code: "LOGIN_FAILED",
              message:
                error instanceof Error
                  ? error.message
                  : "Login failed unexpectedly",
            },
          });
        }
      }
    },
    [resolvedConfig]
  );

  // ── Logout ───────────────────────────────────────────────────────

  const logout = useCallback(async () => {
    const { authService, sessionService } = services.current!;

    dispatch({ type: "LOADING" });

    try {
      await authService.logout();
    } catch {
      // Logout is fire-and-forget
    }

    sessionService.clearSession();
    dispatch({ type: "UNAUTHENTICATED" });
  }, []);

  // ── Refresh ──────────────────────────────────────────────────────

  const refresh = useCallback(async () => {
    const { sessionService } = services.current!;

    try {
      const session = await sessionService.refreshSession();
      dispatch({ type: "SESSION_REFRESHED", payload: session });
    } catch (error) {
      sessionService.clearSession();
      dispatch({
        type: "UNAUTHENTICATED",
        payload: {
          error: {
            code: "REFRESH_FAILED",
            message:
              error instanceof Error
                ? error.message
                : "Session refresh failed",
          },
        },
      });
    }
  }, []);

  const contextValue: AuthContextValue = {
    user: state.user,
    session: state.session,
    loading: state.loading,
    error: state.error,
    login,
    logout,
    refresh,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────

export function useAuthContext(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error(
      "useAuth() must be used within a <VenmProvider> component."
    );
  }
  return context;
}
