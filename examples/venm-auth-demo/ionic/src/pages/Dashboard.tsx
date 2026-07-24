import { useState, useEffect } from "react";
import {
  IonGrid,
  IonRow,
  IonCol,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonText,
  IonAvatar,
  IonChip,
  IonIcon,
  IonButton,
  IonNote,
  IonSpinner,
  IonProgressBar,
  IonItem,
  IonLabel,
} from "@ionic/react";
import {
  personCircleOutline,
  keyOutline,
  timeOutline,
  refreshOutline,
  logOutOutline,
  checkmarkCircle,
} from "ionicons/icons";
import { useAuth, useUser, useSession } from "venm-auth";

export default function Dashboard() {
  const { logout, refresh, error, loading: authLoading } = useAuth();
  const { user, loading: userLoading } = useUser();
  const {
    accessToken,
    refreshToken,
    expiresAt,
    loading: sessionLoading,
  } = useSession();
  const [loggingOut, setLoggingOut] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshResult, setRefreshResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Live countdown — store expiresAt in state to handle null safely
  const [expiryTime, setExpiryTime] = useState<number | null>(null);
  const [timeUntilExpiry, setTimeUntilExpiry] = useState<string>("—");
  const [expiryProgress, setExpiryProgress] = useState<number>(0);

  useEffect(() => {
    setExpiryTime(expiresAt);
  }, [expiresAt]);

  useEffect(() => {
    if (!expiryTime) {
      setTimeUntilExpiry("—");
      setExpiryProgress(0);
      return;
    }

    function update() {
      if (!expiryTime) return;
      const now = Date.now();
      const remaining = expiryTime - now;
      if (remaining <= 0) {
        setTimeUntilExpiry("Expired");
        setExpiryProgress(100);
        return;
      }
      const seconds = Math.floor(remaining / 1000);
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      setTimeUntilExpiry(
        `${mins}:${secs.toString().padStart(2, "0")}`
      );
      setExpiryProgress(
        Math.max(
          0,
          Math.min(
            100,
            ((15 * 60 * 1000 - remaining) / (15 * 60 * 1000)) * 100
          )
        )
      );
    }

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [expiryTime]);

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
      setRefreshResult({
        type: "success",
        message: "Session refreshed",
      });
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

  const isExpired = timeUntilExpiry === "Expired";
  const isExpiringSoon =
    !isExpired && (expiryTime ?? Infinity) - Date.now() < 120_000;

  return (
    <div className="dashboard-page">
      <IonGrid fixed>
        {/* Profile Card */}
        <IonRow className="ion-justify-content-center">
          <IonCol size="12" sizeMd="8" sizeLg="6">
            <IonCard className="dashboard-card profile-card">
              {userLoading ? (
                <IonCardContent className="ion-text-center ion-padding">
                  <IonSpinner />
                </IonCardContent>
              ) : user ? (
                <>
                  <IonCardContent className="profile-header">
                    <IonAvatar className="profile-avatar">
                      {user.picture ? (
                        <img
                          src={user.picture}
                          alt={`${user.name}'s avatar`}
                        />
                      ) : (
                        <div className="avatar-fallback">
                          {user.name
                            .split(" ")
                            .map((n) => n[0])
                            .filter(Boolean)
                            .slice(0, 2)
                            .join("")
                            .toUpperCase()}
                        </div>
                      )}
                    </IonAvatar>
                    <div className="profile-info">
                      <IonText>
                        <h2 className="profile-name">{user.name}</h2>
                      </IonText>
                      <IonText color="medium">
                        <p className="profile-email">{user.email}</p>
                      </IonText>
                      <div className="profile-chips">
                        <IonChip
                          color={
                            user.provider === "google" ? "primary" : "tertiary"
                          }
                        >
                          <IonIcon icon={personCircleOutline} />
                          <IonLabel>
                            {user.provider === "google" ? "Google" : "Facebook"}
                          </IonLabel>
                        </IonChip>
                        {user.emailVerified && (
                          <IonChip color="success">
                            <IonIcon icon={checkmarkCircle} />
                            <IonLabel>Verified</IonLabel>
                          </IonChip>
                        )}
                      </div>
                    </div>
                  </IonCardContent>
                </>
              ) : null}
            </IonCard>
          </IonCol>
        </IonRow>

        {/* Session Card */}
        <IonRow className="ion-justify-content-center">
          <IonCol size="12" sizeMd="8" sizeLg="6">
            <IonCard className="dashboard-card">
              <IonCardHeader>
                <IonCardTitle>
                  <IonIcon icon={keyOutline} /> Session
                </IonCardTitle>
              </IonCardHeader>
              {sessionLoading ? (
                <IonCardContent className="ion-text-center">
                  <IonSpinner />
                </IonCardContent>
              ) : (
                <IonCardContent>
                  {/* Token expiry countdown */}
                  <div className="countdown-section">
                    <div className="countdown-header">
                      <IonIcon icon={timeOutline} />
                      <span>Access token</span>
                      <span
                        className={`countdown-value ${
                          isExpired
                            ? "countdown-expired"
                            : isExpiringSoon
                              ? "countdown-warning"
                              : ""
                        }`}
                      >
                        {timeUntilExpiry}
                      </span>
                    </div>
                    <IonProgressBar
                      value={expiryProgress / 100}
                      color={
                        isExpired
                          ? "danger"
                          : isExpiringSoon
                            ? "warning"
                            : "success"
                      }
                    />
                    <IonNote color="medium" className="countdown-note">
                      Auto-refreshes ~2 minutes before expiry
                    </IonNote>
                  </div>

                  <IonItem>
                    <IonLabel>
                      <p>Status</p>
                    </IonLabel>
                    <IonChip
                      slot="end"
                      color={isExpired ? "danger" : "success"}
                    >
                      {isExpired ? "Expired" : "Active"}
                    </IonChip>
                  </IonItem>
                  <IonItem>
                    <IonLabel>
                      <p>Expires At</p>
                    </IonLabel>
                    <IonNote slot="end">
                      {expiryTime
                        ? new Date(expiryTime).toLocaleTimeString()
                        : "—"}
                    </IonNote>
                  </IonItem>
                  <IonItem>
                    <IonLabel>
                      <p>Access Token</p>
                    </IonLabel>
                    <IonNote slot="end" className="token-truncate">
                      {accessToken
                        ? `${accessToken.slice(0, 24)}…`
                        : "—"}
                    </IonNote>
                  </IonItem>
                  <IonItem lines="none">
                    <IonLabel>
                      <p>Refresh Token</p>
                    </IonLabel>
                    <IonNote slot="end" className="token-truncate">
                      {refreshToken
                        ? `${refreshToken.slice(0, 16)}…`
                        : "—"}
                    </IonNote>
                  </IonItem>
                </IonCardContent>
              )}
            </IonCard>
          </IonCol>
        </IonRow>

        {/* Actions Card */}
        <IonRow className="ion-justify-content-center">
          <IonCol size="12" sizeMd="8" sizeLg="6">
            <IonCard className="dashboard-card">
              <IonCardHeader>
                <IonCardTitle>Actions</IonCardTitle>
              </IonCardHeader>
              <IonCardContent>
                <div className="action-buttons-row">
                  <IonButton
                    expand="block"
                    onClick={handleRefresh}
                    disabled={refreshing || authLoading}
                  >
                    {refreshing ? (
                      <>
                        <IonSpinner /> Refreshing…
                      </>
                    ) : (
                      <>
                        <IonIcon icon={refreshOutline} /> Refresh Session
                      </>
                    )}
                  </IonButton>
                  <IonButton
                    expand="block"
                    color="danger"
                    fill="outline"
                    onClick={handleLogout}
                    disabled={loggingOut}
                  >
                    {loggingOut ? (
                      "Signing out…"
                    ) : (
                      <>
                        <IonIcon icon={logOutOutline} /> Sign Out
                      </>
                    )}
                  </IonButton>
                </div>

                {refreshResult && (
                  <div
                    className={`refresh-toast refresh-${refreshResult.type}`}
                  >
                    {refreshResult.type === "success" ? "✓" : "✗"}{" "}
                    {refreshResult.message}
                  </div>
                )}

                <IonNote color="medium" className="token-info-note">
                  The access token expires every 15 minutes. Auto-refresh keeps
                  your session alive while using the app. Close and reopen
                  within 30 days — the refresh token restores your session.
                </IonNote>
              </IonCardContent>
            </IonCard>
          </IonCol>
        </IonRow>

        {/* Error Card */}
        {error ? (
          <IonRow className="ion-justify-content-center">
            <IonCol size="12" sizeMd="8" sizeLg="6">
              <IonCard color="danger">
                <IonCardHeader>
                  <IonCardTitle>Error</IonCardTitle>
                </IonCardHeader>
                <IonCardContent>
                  <strong>{error.code}:</strong> {error.message}
                </IonCardContent>
              </IonCard>
            </IonCol>
          </IonRow>
        ) : null}
      </IonGrid>
    </div>
  );
}
