import { useCallback, useState, useEffect, useRef } from "react";
import {
  IonApp,
  IonRouterOutlet,
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonButton,
  IonIcon,
  IonLabel,
  IonBadge,
  setupIonicReact,
} from "@ionic/react";
import { IonReactRouter } from "@ionic/react-router";
import { Route, Redirect } from "react-router-dom";
import {
  VenmProvider,
  Authenticated,
  Unauthenticated,
  Loading,
  useAuth,
  useUser,
  useSession,
  DEVELOPMENT,
  PRODUCTION,
} from "venm-auth";
import type { AuthState } from "venm-auth";
import { logOutOutline, refreshOutline } from "ionicons/icons";

/* ── Pages ───────────────────────────────────────────────────────── */
import LoginPage from "./pages/LoginPage";
import Dashboard from "./pages/Dashboard";

/* ── Ionic setup ─────────────────────────────────────────────────── */
setupIonicReact({
  mode: "ios",
});

/* ── Configuration ───────────────────────────────────────────────── */
const IS_PRODUCTION = false;

const VENM_CONFIG = {
  apiUrl: IS_PRODUCTION
    ? "/api/auth"
    : (import.meta.env.VITE_API_URL || "http://localhost:3001/api/auth"),
  environment: IS_PRODUCTION ? PRODUCTION : DEVELOPMENT,
  autoRefresh: true,
  oauth: {
    google: {
      clientId:
        import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "your-google-client-id",
    },
    facebook: {
      appId: import.meta.env.VITE_FACEBOOK_APP_ID ?? "your-facebook-app-id",
    },
  },
};

/* ── App Root ────────────────────────────────────────────────────── */

export default function App() {
  const [authEvent, setAuthEvent] = useState<string | null>(null);

  const handleAuthStateChange = useCallback((state: AuthState) => {
    if (state.loading) {
      setAuthEvent("⏳ Checking session…");
    } else if (state.user && state.session) {
      setAuthEvent(`✓ Signed in as ${state.user.email}`);
    } else if (state.error) {
      setAuthEvent(`✗ ${state.error.message}`);
    } else {
      setAuthEvent("👋 Not signed in");
    }
    console.log("[venm-auth] Auth state:", state);
  }, []);

  return (
    <VenmProvider config={VENM_CONFIG} onAuthStateChange={handleAuthStateChange}>
      <IonApp>
        <IonReactRouter>
          <IonRouterOutlet>
            <Route exact path="/login">
              <IonShell authEvent={authEvent}>
                <Unauthenticated>
                  <LoginPage />
                </Unauthenticated>
                <Authenticated>
                  <Redirect to="/dashboard" />
                </Authenticated>
              </IonShell>
            </Route>
            <Route exact path="/dashboard">
              <IonShell authEvent={authEvent}>
                <Authenticated>
                  <Dashboard />
                </Authenticated>
                <Unauthenticated>
                  <Redirect to="/login" />
                </Unauthenticated>
              </IonShell>
            </Route>
            <Route exact path="/">
              <Redirect to="/login" />
            </Route>
          </IonRouterOutlet>
        </IonReactRouter>
      </IonApp>
    </VenmProvider>
  );
}

/* ── Shared Shell ────────────────────────────────────────────────── */

function IonShell({
  children,
  authEvent,
}: {
  children: React.ReactNode;
  authEvent: string | null;
}) {
  const { logout, refresh, loading } = useAuth();
  const { user } = useUser();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    await logout();
    setLoggingOut(false);
  };

  const handleRefresh = async () => {
    await refresh();
  };

  return (
    <IonPage>
      <IonHeader translucent>
        <IonToolbar>
          <IonTitle>
            <span className="toolbar-title">
              <span className="toolbar-logo">🔐</span> Venm Auth
            </span>
          </IonTitle>
          <IonButtons slot="end">
            {user && (
              <>
                <IonButton
                  onClick={handleRefresh}
                  disabled={loading}
                  title="Refresh session"
                >
                  <IonIcon slot="icon-only" icon={refreshOutline} />
                </IonButton>
                <IonButton
                  onClick={handleLogout}
                  disabled={loggingOut}
                  title="Sign out"
                >
                  <IonIcon slot="icon-only" icon={logOutOutline} />
                </IonButton>
              </>
            )}
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen className="ion-padding">
        {/* Auth status banner */}
        {authEvent && (
          <div className="auth-status-banner">
            <IonLabel className="auth-status-text">{authEvent}</IonLabel>
          </div>
        )}

        {/* Loading state */}
        <Loading>
          <div className="loading-container">
            <div className="spinner-custom" />
            <p className="loading-text">Restoring session…</p>
          </div>
        </Loading>

        {children}
      </IonContent>
    </IonPage>
  );
}
