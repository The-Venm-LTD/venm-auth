# Venm Auth Demo — Configuration Guide

This guide walks you through setting up Google and Facebook OAuth credentials for the venm-auth demo. It covers all three run targets:

- **Web demo** — Browser-based popup OAuth flow (Vite dev server on `:3000`)
- **Ionic app** — Native Android/iOS app using Google One Tap via Capacitor (Vite dev server on `:3002`)
- **Express server** — Backend auth API using `createVenmAuth()` (port `:3001`)

---

## Table of Contents

1. [Google Cloud Console — Create OAuth Clients](#1-google-cloud-console--create-oauth-clients)
2. [Facebook App Setup](#2-facebook-app-setup)
3. [Environment Variables](#3-environment-variables)
4. [Server Configuration (`createVenmAuth`)](#4-server-configuration-createvenmauth)
5. [Client SDK Configuration](#5-client-sdk-configuration)
6. [One Tap & Capacitor Mobile Setup](#6-one-tap--capacitor-mobile-setup)
7. [Running the Demo](#7-running-the-demo)
8. [Troubleshooting](#8-troubleshooting)

---

## 1. Google Cloud Console — Create OAuth Clients

You need **three separate OAuth 2.0 Client IDs** in Google Cloud Console — one per platform.

### Step 1.1: Create or select a Google Cloud project

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Navigate to **APIs & Services → OAuth consent screen**
4. Choose **External** (unless you're on Google Workspace) and fill in the required fields
5. Add the `.../auth/userinfo.email` and `.../auth/userinfo.profile` and `openid` scopes
6. Add your email as a test user if you're in "Testing" mode

### Step 1.2: Create a Web application OAuth client

| Field | Value |
|-------|-------|
| **Application type** | Web application |
| **Name** | `venm-auth-web` (or any name) |
| **Authorized JavaScript origins** | `http://localhost:3000`, `http://localhost:3002` |
| **Authorized redirect URIs** | `http://localhost:3000/__venm/auth/callback`, `http://localhost:3002/__venm/auth/callback` |

This client generates both a **Client ID** and a **Client Secret**. The client secret is required by the backend (`createVenmAuth`) to exchange authorization codes for tokens.

### Step 1.3: Create an Android OAuth client

| Field | Value |
|-------|-------|
| **Application type** | Android |
| **Name** | `venm-auth-android` (or any name) |
| **Package name** | `com.venm.auth.ionic.demo` (must match `appId` in `ionic/capacitor.config.ts`) |
| **SHA-1 certificate fingerprint** | Run this command to get your debug key's SHA-1: |

```bash
keytool -keystore ~/.android/debug.keystore -list -v -alias androiddebugkey \
  -storepass android -keypass android
```

Android client IDs do **not** have a client secret — they rely on the package name and SHA-1 fingerprint for verification.

### Step 1.4: Create an iOS OAuth client

| Field | Value |
|-------|-------|
| **Application type** | iOS |
| **Name** | `venm-auth-ios` (or any name) |
| **Bundle ID** | `com.venm.auth.ionic.demo` (must match your iOS project's bundle ID) |

iOS client IDs also do **not** have a client secret.

### Step 1.5: Copy your three Google client IDs

After creation, you'll have three IDs that look like:

```
Web:      123456789-xxxxx.apps.googleusercontent.com
Android:  123456789-yyyyy.apps.googleusercontent.com
iOS:      123456789-zzzzz.apps.googleusercontent.com
```

---

## 2. Facebook App Setup

1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Create a new app (type: **Consumer**) or use an existing one
3. Navigate to **Settings → Basic** and copy your **App ID** and **App Secret**
4. Under **Facebook Login → Settings**, add:
   - **Valid OAuth Redirect URIs**: `http://localhost:3000/__venm/auth/callback`

> **Note:** Facebook requires HTTPS in production. In local development, `http://localhost` is allowed.

---

## 3. Environment Variables

The demo uses **no `.env` files** — all config is done via environment variables passed to each process.

### Minimal `.env` (server-only, Google auth)

```bash
# Required for server
GOOGLE_CLIENT_ID=123456789-xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxx
JWT_SECRET=your-secret-at-least-32-characters-long-for-hs256

# Optional: use a real database
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/venm-auth-demo
```

### Full `.env` (all platforms, all providers)

```bash
# ── Server (Express) ──────────────────────────────────────────────
GOOGLE_CLIENT_ID=123456789-xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxx
FACEBOOK_APP_ID=1234567890123456
FACEBOOK_APP_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
JWT_SECRET=your-secret-at-least-32-characters-long-for-hs256
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/venm-auth-demo
MONGODB_DATABASE=venm-auth-demo
CLIENT_ORIGIN=http://localhost:3000,http://localhost:3002
PORT=3001

# ── Web Demo (Vite, on port 3000) ─────────────────────────────────
VITE_GOOGLE_CLIENT_ID=123456789-xxxxx.apps.googleusercontent.com
VITE_FACEBOOK_APP_ID=1234567890123456

# ── Ionic App (Vite, on port 3002) ────────────────────────────────
# The Ionic app reads the same VITE_* vars as the web demo
# In production (on a real device), these are bundled at build time
```

> **Tip:** When using `pnpm dev` from the `examples/venm-auth-demo` root, the concurrently command runs all three processes. You can create a `.env` file in `examples/venm-auth-demo/server/` for the server vars, and the Vite processes pick up their `VITE_*` vars from your shell or a `.env` at the root.

---

## 4. Server Configuration (`createVenmAuth`)

The backend's `createVenmAuth` function expects the **Web application** client ID and client secret:

```js
// examples/venm-auth-demo/server/index.js

app.use("/api/auth", createVenmAuth({
  google: process.env.GOOGLE_CLIENT_ID
    ? {
        clientId: process.env.GOOGLE_CLIENT_ID,       // ← Web client ID
        clientSecret: process.env.GOOGLE_CLIENT_SECRET, // ← Only Web clients have this
      }
    : undefined,

  facebook: process.env.FACEBOOK_APP_ID
    ? {
        appId: process.env.FACEBOOK_APP_ID,
        appSecret: process.env.FACEBOOK_APP_SECRET,
      }
    : undefined,

  jwtSecret: process.env.JWT_SECRET ?? "dev-secret-change-in-production-min-32-chars!!",
  database: databaseAdapter,
  prefix: "/api/auth",
  allowedOrigins: clientOrigins,
}));
```

### Why the Web client ID on the server?

| Requirement | Solution |
|-------------|----------|
| Authorization code exchange | Needs `client_id` + `client_secret` — **only Web clients have a secret** |
| One Tap ID token verification | Uses `config.clientId` to check the token's `aud` claim |

### ⚠️ One Tap audience consideration

When a native Android/iOS app signs in via Google One Tap, the ID token's `aud` (audience) claim is set to the **Android/iOS client ID**, not the Web client ID. The current server verifies against `config.clientId` only. If you're using the One Tap flow on mobile, you'll need to enhance the audience check to also accept your Android/iOS client IDs, or configure the native plugin to use the Web client ID.

---

## 5. Client SDK Configuration

### Web Demo (`examples/venm-auth-demo/src/App.tsx`)

```ts
const VENM_CONFIG = {
  apiUrl: "http://localhost:3001/api/auth",
  environment: DEVELOPMENT,
  oauth: {
    google: {
      clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID,           // Web client ID
    },
    facebook: {
      appId: import.meta.env.VITE_FACEBOOK_APP_ID,
    },
  },
};
```

### Ionic App (`examples/venm-auth-demo/ionic/src/App.tsx`)

```ts
const VENM_CONFIG = {
  apiUrl: "http://localhost:3001/api/auth",
  environment: DEVELOPMENT,
  oauth: {
    google: {
      clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID,           // Web client ID
    },
    facebook: {
      appId: import.meta.env.VITE_FACEBOOK_APP_ID,
    },
  },
};
```

This is handled automatically by the SDK's `googleClientId` in the auth context and used by `GoogleButton` to initialize the Capacitor One Tap plugin.

---

## 6. One Tap & Capacitor Mobile Setup

### Prerequisites

```bash
# Install the Capacitor Google One Tap plugin in the Ionic app
cd examples/venm-auth-demo/ionic
pnpm add capacitor-native-google-one-tap-signin
```

### Capacitor plugin initialization

The `useGoogleOneTap` hook (`src/hooks/useGoogleOneTap.ts`) initializes the plugin with the web client ID:

```ts
const oneTap = useGoogleOneTap(googleClientId);
```

When `GoogleButton` receives `useCapacitorOnetap: true`, it triggers the native flow. You can control exactly which flow is used via the `nativeFlow` prop:

```tsx
// 1. Attempt Auto Sign-In, falling back to One Tap bottom-sheet dialog (Default)
<GoogleButton useCapacitorOnetap nativeFlow="autoOrOneTap" />

// 2. Only show the One Tap dialog
<GoogleButton useCapacitorOnetap nativeFlow="oneTap" />

// 3. Use the traditional full-screen Google Sign-In prompt (native button flow)
<GoogleButton useCapacitorOnetap nativeFlow="nativeButton" />
```

Under the hood, `GoogleButton` calls the appropriate plugin method and:
1. Detects the current platform (Android/iOS/web)
2. On Android/iOS: triggers the native plugin → receives an ID token
3. Sends the ID token to `POST /api/auth/google/onetap` for server verification
4. On web/browser: gracefully skips and automatically falls back to popup OAuth (also falls back if the plugin throws an error or user cancels)

### Capacitor Android build

```bash
# Sync the Capacitor project
cd examples/venm-auth-demo
pnpm cap:sync

# Open in Android Studio and build
pnpm cap:open:android
```

---

## 7. Running the Demo

### Development (all three targets)

```bash
cd examples/venm-auth-demo

# 1. Set your environment variables
export GOOGLE_CLIENT_ID=123456789-xxxxx.apps.googleusercontent.com
export GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxx
export VITE_GOOGLE_CLIENT_ID=123456789-xxxxx.apps.googleusercontent.com
# ... plus JWT_SECRET, FACEBOOK_APP_ID, etc.

# 2. Start everything (demo + ionic + server)
pnpm dev
```

| Process | URL | Purpose |
|---------|-----|---------|
| Web demo (Vite) | `http://localhost:3000` | Browser-based popup OAuth |
| Ionic app (Vite) | `http://localhost:3002` | Mobile-focused UI with One Tap |
| Express server | `http://localhost:3001` | Auth API |

### Individual processes

```bash
# Just the web demo
pnpm dev:demo

# Just the Ionic app
pnpm dev:ionic

# Just the Express server
pnpm dev:server
```

---

## 8. Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| `Client ID is required` error | `VITE_GOOGLE_CLIENT_ID` not set | Set the env var or update `App.tsx` with the hardcoded value |
| `Token audience mismatch` | Server `clientId` doesn't match the token's `aud` | Use the Web client ID on the server, or add Android/iOS IDs to audience verification |
| `redirect_uri_mismatch` | Google Cloud Console doesn't list your redirect URI | Add `http://localhost:3000/__venm/auth/callback` to authorized URIs |
| Popup blocked by browser | Browser popup blocker | Allow popups for localhost, or use the One Tap mode |
| `capacitor-native-google-one-tap-signin` not found | Plugin not installed in the Ionic project | Run `pnpm add capacitor-native-google-one-tap-signin` in the `ionic/` directory |
| CORS error on auth requests | Server `CLIENT_ORIGIN` doesn't include the request origin | Ensure `http://localhost:3000` and `http://localhost:3002` are both in `CLIENT_ORIGIN` |
| `jwtSecret must be at least 32 characters` | JWT_SECRET too short | Use a string at least 32 characters long |
| Android One Tap shows "audience mismatch" | Server uses Web client ID but the native token has Android client ID | See [Section 4's One Tap note](#⚠️-one-tap-audience-consideration) |

---

## Quick Reference: Which client ID goes where?

| Location | Config field | Google Cloud Console client type | Has client secret? |
|----------|-------------|----------------------------------|--------------------|
| **Server** `createVenmAuth` | `google.clientId` | **Web application** | ✅ Yes |
| **Server** `createVenmAuth` | `google.clientSecret` | **Web application** | ✅ Yes |
| **Client SDK** (web demo) | `oauth.google.clientId` | **Web application** | ❌ No (client-side only) |
