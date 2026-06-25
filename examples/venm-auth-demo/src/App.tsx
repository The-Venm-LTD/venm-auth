import { useState, type ReactNode } from "react";
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
import type { Layout, ProviderType } from "venm-auth";
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
      clientId: "960457208933-r40g5t9e6mo0urrij4oigdtse9613u4i.apps.googleusercontent.com",
    },
    facebook: {
      appId: "your-facebook-app-id",
    },
  },
};

// ── Toggle options ──────────────────────────────────────────────────

const LAYOUTS: Layout[] = ["vertical", "horizontal", "card", "minimal"];

const PROVIDERS: { id: ProviderType; label: string }[] = [
  { id: "google", label: "Google" },
  { id: "facebook", label: "Facebook" },
];

// ── App Root ─────────────────────────────────────────────────────────

export default function App() {
  return (
    <VenmProvider
      config={VENM_CONFIG}
      onAuthStateChange={(state) => {
        console.log("[venm-auth] Auth state:", state);
      }}
    >
      <PageShell />
    </VenmProvider>
  );
}

// ── Shell: layout + global chrome ─────────────────────────────────────

function PageShell() {
  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <span className="logo">
            <span className="logo-icon">🔐</span>
            Venm Auth
          </span>
          <span className="badge">Demo</span>
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
    // "facebook",
  ]);

  function toggleProvider(p: ProviderType) {
    setSelectedProviders((prev) =>
      prev.includes(p)
        ? prev.filter((x) => x !== p)
        : [...prev, p]
    );
  }

  return (
    <div className="page">
      <div className="hero">
        <h1 className="hero-title">Welcome</h1>
        <p className="hero-subtitle">
          Sign in to continue to the demo application.
        </p>
      </div>

      {/* Auth Buttons */}
      <div className="auth-section">
        {selectedProviders.length > 0 ? (
          <VenmAuth
            providers={selectedProviders}
            layout={layout}
            showDivider={layout === "vertical"}
          />
        ) : (
          <p className="hint">Select at least one provider above.</p>
        )}
      </div>

      <p className="hint">
        Click a provider button to simulate the OAuth popup flow —
        <br />
        the SDK dispatches provider authentication via a popup window.
      </p>
    </div>
  );
}

// ── Dashboard (authenticated) ────────────────────────────────────────

function Dashboard() {
  const { login, logout, error } = useAuth();
  const { user, loading: userLoading } = useUser();
  const { accessToken, expiresAt, loading: sessionLoading } = useSession();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    await logout();
    setLoggingOut(false);
  }

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
                <span className={`provider-badge provider-${user.provider}`}>
                  {user.provider === "google" ? "G" : "F"}
                </span>
                {user.emailVerified ? (
                  <span className="verified-badge">✓ Verified</span>
                ) : null}
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
              <Row label="Access Token">
                <code className="truncate">{accessToken?.slice(0, 48)}…</code>
              </Row>
              <Row label="Expires">
                {expiresAt
                  ? new Date(expiresAt).toLocaleString()
                  : "—"}
              </Row>
              <Row label="Status">
                <span className="status-dot active" /> Active
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
            <p className="hint">
              You are authenticated. Use the button below to sign out.
            </p>
            <button
              className="btn btn-logout"
              onClick={handleLogout}
              disabled={loggingOut}
            >
              {loggingOut ? "Signing out…" : "Sign Out"}
            </button>
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
