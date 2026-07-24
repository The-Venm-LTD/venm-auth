import { useState, useEffect, useCallback, type ReactNode } from "react";
import {
  VenmProvider,
  VenmAuth,
  Authenticated,
  Unauthenticated,
  Loading,
  useAuth,
  useUser,
  useSession,
  DEVELOPMENT,
  PRODUCTION,
} from "venm-auth";
import type {
  Layout,
  ProviderType,
  AuthState,
  GoogleButtonProps,
} from "venm-auth";
import "./App.css";

// ── Configuration ───────────────────────────────────────────────────
// Replace these with your actual credentials before running in production.

const IS_PRODUCTION = false;

const VENM_CONFIG = {
  // Points to your Express server running createVenmAuth()
  // In development, the Vite proxy forwards /api/auth to the Express server
  apiUrl: IS_PRODUCTION ? "/api/auth" : "http://localhost:3001/api/auth",
  environment: IS_PRODUCTION ? PRODUCTION : DEVELOPMENT,
  autoRefresh: true,
  oauth: {
    google: {
      // Set via VITE_GOOGLE_CLIENT_ID env var, or replace with your own
      clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "your-google-client-id",
      androidClientId:
        import.meta.env.VITE_GOOGLE_CLIENT_ID_ANDROID ?? undefined,
      iosClientId:
        import.meta.env.VITE_GOOGLE_CLIENT_ID_IOS ?? undefined,
    },
    facebook: {
      appId: import.meta.env.VITE_FACEBOOK_APP_ID ?? "your-facebook-app-id",
    },
  },
};

// ── Event Log Types ─────────────────────────────────────────────────

interface AuthEvent {
  id: number;
  timestamp: Date;
  type: string;
  detail: string;
}

let eventIdCounter = 0;

// ── App Root ─────────────────────────────────────────────────────────

export default function App() {
  const [events, setEvents] = useState<AuthEvent[]>([]);

  const addEvent = useCallback((type: string, detail: string) => {
    const event: AuthEvent = {
      id: ++eventIdCounter,
      timestamp: new Date(),
      type,
      detail,
    };
    setEvents((prev) => [event, ...prev].slice(0, 50));
  }, []);

  const handleAuthStateChange = useCallback(
    (state: AuthState) => {
      if (state.loading) {
        addEvent("Loading", "Auth state loading…");
      } else if (state.user && state.session) {
        addEvent(
          "Authenticated",
          `User "${state.user.email}" — token expires at ${new Date(
            state.session.expiresAt
          ).toLocaleTimeString()}`
        );
      } else if (state.error) {
        addEvent("Error", `${state.error.code}: ${state.error.message}`);
      } else {
        addEvent("Unauthenticated", "No active session");
      }
      console.log("[venm-auth] Auth state:", state);
    },
    [addEvent]
  );

  return (
    <VenmProvider config={VENM_CONFIG} onAuthStateChange={handleAuthStateChange}>
      <PageShell events={events} onClearEvents={() => setEvents([])} />
    </VenmProvider>
  );
}

// ── Shell: layout + global chrome ─────────────────────────────────────

function PageShell({
  events,
  onClearEvents,
}: {
  events: AuthEvent[];
  onClearEvents: () => void;
}) {
  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <span className="logo">
            <span className="logo-icon">🔐</span>
            Venm Auth
          </span>
          <div className="header-right">
            <span className="badge">Demo</span>
          </div>
        </div>
      </header>

      <main className="main">
        <Loading>
          <div className="loading-state">
            <div className="spinner" />
            <p>Initializing session…</p>
          </div>
        </Loading>

        <Unauthenticated>
          <LoginPage />
        </Unauthenticated>

        <Authenticated>
          <Dashboard />
        </Authenticated>

        {/* Auth Event Log — visible in both states */}
        <section className="card card-events">
          <div className="card-header">
            <h2>Auth Events</h2>
            {events.length > 0 && (
              <button className="btn btn-sm btn-ghost" onClick={onClearEvents}>
                Clear
              </button>
            )}
          </div>
          <div className="card-body">
            {events.length === 0 ? (
              <p className="hint">No auth events yet.</p>
            ) : (
              <div className="event-log">
                {events.map((evt) => (
                  <div key={evt.id} className={`event-row event-${evt.type.toLowerCase()}`}>
                    <span className="event-time">
                      {evt.timestamp.toLocaleTimeString()}
                    </span>
                    <span className={`event-type-badge event-type-${evt.type.toLowerCase()}`}>
                      {evt.type}
                    </span>
                    <span className="event-detail">{evt.detail}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      <footer className="footer">
        <p>
          Built with <a href="https://venm.com" target="_blank" rel="noopener noreferrer">Venm</a> Auth SDK
        </p>
      </footer>
    </div>
  );
}

// ── Login Page ───────────────────────────────────────────────────────

function LoginPage() {
  const [layout, setLayout] = useState<Layout>("card");
  const [selectedProviders, setSelectedProviders] = useState<ProviderType[]>([
    "google",
  ]);
  const [enableCapacitorOnetap, setEnableCapacitorOnetap] = useState(false);

  function toggleProvider(p: ProviderType) {
    setSelectedProviders((prev) =>
      prev.includes(p)
        ? prev.filter((x) => x !== p)
        : [...prev, p]
    );
  }

  // Compute googleButton props based on Capacitor One Tap toggle
  // When true, automatically resolves to the platform-appropriate client ID
  // from the SDK config (supports androidClientId / iosClientId).
  const googleButtonProps: Partial<GoogleButtonProps> = enableCapacitorOnetap
    ? {
        useCapacitorOnetap: true,
      }
    : {};

  return (
    <div className="page">
      <div className="hero">
        <h1 className="hero-title">Welcome</h1>
        <p className="hero-subtitle">
          Sign in to continue to the demo application.
        </p>
      </div>

      {/* Provider Toggles */}
      <div className="provider-toggles">
        {(["google", "facebook"] as ProviderType[]).map((p) => (
          <button
            key={p}
            className={`btn btn-provider-toggle ${selectedProviders.includes(p) ? "active" : ""}`}
            onClick={() => toggleProvider(p)}
          >
            {p === "google" ? "G" : "F"} {p}
          </button>
        ))}
      </div>

      {/* Auth Mode Toggles */}
      <div className="mode-toggles">
        <span className="row-label small-label">Auth mode:</span>
        <button
          className={`btn btn-sm ${!enableCapacitorOnetap ? "active" : "btn-ghost"}`}
          onClick={() => setEnableCapacitorOnetap(false)}
        >
          <span className="mode-icon">🪟</span>
          Popup OAuth
        </button>
        <button
          className={`btn btn-sm ${enableCapacitorOnetap ? "active" : "btn-ghost"}`}
          onClick={() => setEnableCapacitorOnetap(true)}
        >
          <span className="mode-icon">📱</span>
          One Tap
        </button>
      </div>

      {/* Mode Info */}
      {enableCapacitorOnetap && (
        <div className="mode-info">
          <span className="badge badge-capacitor">Capacitor</span>
          <span className="mode-info-text">
            Uses the native Google One Tap plugin via Capacitor. Requires
            <code>capacitor-native-google-one-tap-signin</code> to be installed.
            In a regular browser, the plugin is not available and the button
            will gracefully skip sign-in with a console warning.
          </span>
        </div>
      )}

      {/* Auth Buttons */}
      <div className="auth-section">
        {selectedProviders.length > 0 ? (
          <VenmAuth
            providers={selectedProviders}
            layout={layout}
            showDivider={layout === "vertical"}
            googleButtonProps={googleButtonProps}
          />
        ) : (
          <p className="hint">Select at least one provider above.</p>
        )}
      </div>

      {/* Layout Toggle */}
      <div className="layout-toggles">
        <span className="row-label small-label">Layout:</span>
        {(["card", "vertical", "horizontal"] as Layout[]).map((l) => (
          <button
            key={l}
            className={`btn btn-sm ${layout === l ? "active" : "btn-ghost"}`}
            onClick={() => setLayout(l)}
          >
            {l.charAt(0).toUpperCase() + l.slice(1)}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Dashboard (authenticated) ────────────────────────────────────────

function Dashboard() {
  const { logout, refresh, error, loading: authLoading } = useAuth();
  const { user, loading: userLoading } = useUser();
  const { accessToken, refreshToken, expiresAt, loading: sessionLoading } = useSession();
  const [loggingOut, setLoggingOut] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshResult, setRefreshResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Live countdown
  const [timeUntilExpiry, setTimeUntilExpiry] = useState<string>("—");
  const [expiryProgress, setExpiryProgress] = useState<number>(0);

  useEffect(() => {
    if (!expiresAt) {
      setTimeUntilExpiry("—");
      setExpiryProgress(0);
      return;
    }

    // Narrow the type so closures (update) don't see `null`
    const expiry = expiresAt;

    // Store the initial duration for progress calculation
    const initialDuration = 15 * 60 * 1000; // 15 min default — best guess

    function update() {
      const now = Date.now();
      const remaining = expiry - now;
      if (remaining <= 0) {
        setTimeUntilExpiry("Expired");
        setExpiryProgress(100);
        return;
      }
      const seconds = Math.floor(remaining / 1000);
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      setTimeUntilExpiry(`${mins}:${secs.toString().padStart(2, "0")}`);
      setExpiryProgress(Math.max(0, Math.min(100, ((initialDuration - remaining) / initialDuration) * 100)));
    }

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  async function handleLogout() {
    setLoggingOut(true);
    await logout();
    setLoggingOut(false);
  }

  async function handleRefresh() {
    setRefreshing(true);
    setRefreshResult(null);
    try {
      await refresh();
      setRefreshResult({ type: "success", message: "Session refreshed successfully" });
    } catch (err: any) {
      setRefreshResult({
        type: "error",
        message: err?.message ?? "Refresh failed",
      });
    } finally {
      setRefreshing(false);
      setTimeout(() => setRefreshResult(null), 4000);
    }
  }

  const expiryPercent = Math.round(expiryProgress);
  const isExpired = timeUntilExpiry === "Expired";
  const isExpiringSoon = !isExpired && expiresAt && expiresAt - Date.now() < 120_000;

  return (
    <div className="page">
      <div className="dashboard">
        {/* Profile card */}
        <section className="card">
          <div className="card-header">
            <h2>Profile</h2>
          </div>
          {userLoading ? (
            <div className="card-body">
              <div className="spinner-sm" />
            </div>
          ) : user ? (
            <div className="card-body profile">
              <Avatar name={user.name} picture={user.picture} />
              <div className="profile-details">
                <h3>{user.name}</h3>
                <p className="profile-email">{user.email}</p>
                <div className="profile-badges">
                  <span className={`provider-badge provider-${user.provider}`}>
                    {user.provider === "google" ? "Google" : "Facebook"}
                  </span>
                  {user.emailVerified && (
                    <span className="verified-badge">✓ Verified</span>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </section>

        {/* Session card */}
        <section className="card">
          <div className="card-header">
            <h2>Session</h2>
          </div>
          {sessionLoading ? (
            <div className="card-body">
              <div className="spinner-sm" />
            </div>
          ) : (
            <div className="card-body session-info">
              {/* Expiry countdown */}
              <div className="countdown-section">
                <div className="countdown-label">
                  <span>Access token</span>
                  <span className={`countdown-value ${isExpired ? "expired" : isExpiringSoon ? "warning" : ""}`}>
                    {timeUntilExpiry}
                  </span>
                </div>
                <div className="progress-bar-track">
                  <div
                    className={`progress-bar-fill ${isExpired ? "fill-expired" : isExpiringSoon ? "fill-warning" : "fill-ok"}`}
                    style={{ width: `${expiryPercent}%` }}
                  />
                </div>
                <div className="countdown-hint">
                  Auto-refreshes ~2 minutes before expiry
                </div>
              </div>

              <Row label="Status">
                <span className={`status-dot ${isExpired ? "inactive" : "active"}`} />
                {isExpired ? "Expired" : "Active"}
              </Row>
              <Row label="Expires At">
                {expiresAt ? new Date(expiresAt).toLocaleTimeString() : "—"}
              </Row>
              <Row label="Access Token">
                <code className="truncate">{accessToken?.slice(0, 48)}…</code>
              </Row>
              <Row label="Refresh Token">
                <code className="truncate">{refreshToken?.slice(0, 32)}…</code>
              </Row>
            </div>
          )}
        </section>

        {/* Actions card */}
        <section className="card">
          <div className="card-header">
            <h2>Actions</h2>
          </div>
          <div className="card-body actions">
            <div className="action-buttons">
              <button
                className="btn btn-refresh"
                onClick={handleRefresh}
                disabled={refreshing || authLoading}
              >
                {refreshing ? (
                  <>
                    <span className="spinner-xs" /> Refreshing…
                  </>
                ) : (
                  "⟳ Refresh Session"
                )}
              </button>
              <button
                className="btn btn-logout"
                onClick={handleLogout}
                disabled={loggingOut}
              >
                {loggingOut ? "Signing out…" : "Sign Out"}
              </button>
            </div>

            {refreshResult && (
              <div className={`refresh-result refresh-${refreshResult.type}`}>
                {refreshResult.type === "success" ? "✓" : "✗"} {refreshResult.message}
              </div>
            )}

            <div className="token-info">
              <p className="hint">
                The access token expires every 15 minutes. Auto-refresh keeps your
                session alive while the tab is open. Close the tab and come back
                within 30 days — the refresh token will restore your session.
              </p>
            </div>
          </div>
        </section>

        {/* Error display */}
        {error ? (
          <section className="card card-error">
            <div className="card-header">
              <h2>Error</h2>
            </div>
            <div className="card-body">
              <p className="error-message">
                <strong>{error.code}:</strong> {error.message}
              </p>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────

function Avatar({ name, picture }: { name: string; picture: string | null }) {
  if (picture) {
    return (
      <img
        className="avatar"
        src={picture}
        alt={`${name}'s avatar`}
        width={64}
        height={64}
      />
    );
  }
  // Fallback initials avatar
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return <div className="avatar avatar-fallback">{initials || "?"}</div>;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="row">
      <span className="row-label">{label}</span>
      <span className="row-value">{children}</span>
    </div>
  );
}
