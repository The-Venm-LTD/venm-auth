/**
 * Type declarations for `capacitor-native-google-one-tap-signin`.
 *
 * This is an optional Capacitor plugin. The types are declared here
 * so the SDK compiles cleanly even when the plugin is not installed.
 * At runtime, the plugin is dynamically imported and gracefully
 * degrades when unavailable.
 */

declare module "capacitor-native-google-one-tap-signin" {
  export interface InitializeOptions {
    clientId: string;
  }

  export interface SuccessResult {
    idToken?: string;
    serverAuthCode?: string;
    user?: {
      email?: string;
      displayName?: string;
      photoUrl?: string;
    };
  }

  export interface NoSuccessResult {
    type?: "CANCELLED" | "NO_SAVED_CREDENTIAL" | "INTERNAL_ERROR";
    message?: string;
  }

  export interface SignInResultOption {
    isSuccess: boolean;
    success?: SuccessResult;
    noSuccess?: NoSuccessResult;
  }

  type SignInCallback = (result: SignInResultOption) => Promise<void> | void;

  export interface GoogleOneTapAuthPlugin {
    initialize(options: InitializeOptions): Promise<void>;
    tryAutoOrOneTapSignIn(): Promise<SignInResultOption>;
    tryAutoOrOneTapSignInWithCallback(cb: SignInCallback): Promise<void>;
    tryAutoSignIn(): Promise<SignInResultOption>;
    tryOneTapSignIn(): Promise<SignInResultOption>;
    signInWithGoogleButtonFlowForNative(): Promise<SignInResultOption>;
    addSignInActionToExistingButtonWithCallback(
      selector: string,
      cb: SignInCallback
    ): Promise<void>;
    renderSignInButtonWithCallback(
      selector: string,
      cb: SignInCallback
    ): Promise<void>;
    cancelOneTapDialog(): Promise<void>;
    signOut(): Promise<void>;
    disconnect(): Promise<void>;
  }

  export const GoogleOneTapAuth: GoogleOneTapAuthPlugin;
}
