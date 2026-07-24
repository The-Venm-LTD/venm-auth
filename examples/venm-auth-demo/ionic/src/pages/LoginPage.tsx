import { useState } from "react";
import {
  IonGrid,
  IonRow,
  IonCol,
  IonCard,
  IonCardContent,
  IonText,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonNote,
} from "@ionic/react";
import { VenmAuth } from "venm-auth";
import type { ProviderType, Layout } from "venm-auth";

export default function LoginPage() {
  const [authMode, setAuthMode] = useState<"popup" | "onetap">("onetap");
  const [selectedProviders] = useState<ProviderType[]>(["google"]);
  const [layout] = useState<Layout>("vertical");

  const googleButtonProps: Record<string, unknown> =
    authMode === "onetap"
      ? { useCapacitorOnetap: true }
      : {};

  return (
    <div className="login-page">
      <IonGrid fixed>
        {/* Hero */}
        <IonRow className="ion-justify-content-center ion-margin-top">
          <IonCol size="12" sizeMd="6" sizeLg="5">
            <div className="login-hero">
              <div className="login-hero-icon">🔐</div>
              <IonText>
                <h1 className="login-title">Welcome</h1>
              </IonText>
              <IonText color="medium">
                <p className="login-subtitle">
                  Sign in to experience Venm Auth on your Android device.
                </p>
              </IonText>
            </div>
          </IonCol>
        </IonRow>

        {/* Auth Mode Picker */}
        <IonRow className="ion-justify-content-center">
          <IonCol size="12" sizeMd="6" sizeLg="5">
            <IonCard className="auth-mode-card">
              <IonCardContent>
                <IonSegment
                  value={authMode}
                  onIonChange={(e) =>
                    setAuthMode(e.detail.value as "popup" | "onetap")
                  }
                >
                  <IonSegmentButton value="onetap">
                    <IonLabel>One Tap (Native)</IonLabel>
                  </IonSegmentButton>
                  <IonSegmentButton value="popup">
                    <IonLabel>Popup OAuth</IonLabel>
                  </IonSegmentButton>
                </IonSegment>

                {authMode === "onetap" && (
                  <IonNote color="medium" className="mode-description">
                    Uses the Capacitor native Google One Tap plugin for a
                    seamless sign-in experience on Android. Requires
                    <code> capacitor-native-google-one-tap-signin</code> to be
                    installed in your Capacitor project.
                  </IonNote>
                )}

                {authMode === "popup" && (
                  <IonNote color="medium" className="mode-description">
                    Opens a browser popup for the standard OAuth redirect flow.
                    Works in any browser but may be blocked by popup blockers on
                    some devices.
                  </IonNote>
                )}
              </IonCardContent>
            </IonCard>
          </IonCol>
        </IonRow>

        {/* Sign-in Card */}
        <IonRow className="ion-justify-content-center">
          <IonCol size="12" sizeMd="6" sizeLg="5">
            <IonCard className="signin-card">
              <IonCardContent>
                <IonText>
                  <h2 className="signin-heading">Sign in</h2>
                </IonText>

                <div className="auth-buttons-container">
                  <VenmAuth
                    providers={selectedProviders}
                    layout={layout}
                    showDivider={false}
                    googleButtonProps={googleButtonProps}
                  />
                </div>

                <div className="signin-footer">
                  <IonNote color="medium">
                    Your session is managed securely server-side. No
                    credentials are stored on the device beyond the encrypted
                    session token.
                  </IonNote>
                </div>
              </IonCardContent>
            </IonCard>
          </IonCol>
        </IonRow>
      </IonGrid>
    </div>
  );
}
