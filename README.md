# venm-auth

React authentication SDK for Venm — integrate Google and Facebook OAuth login into any React application with minimal code.

## Installation

```bash
pnpm add venm-auth
```

## Client Implementation

```tsx
import { VenmProvider, VenmAuth, Authenticated, Unauthenticated, Loading, useAuth } from "venm-auth";
import type { SDKConfig, ProviderType, Layout } from "venm-auth";

// ── Configuration ───────────────────────────────────────────────────

const config: SDKConfig = {
  // Base URL of your Express auth server (required)
  //   Development: "http://localhost:3000/api/auth"
  //   Production:  "/api/auth"
  apiUrl: "http://localhost:3000/api/auth",

  // SDK environment
  //   "development" — enables verbose logging
  //   "production"  — (default) minimal logging
  environment: "development",

  // Automatically refresh access tokens before they expire (default: true)
  autoRefresh: true,

  // Persist session to localStorage (default: true)
  persistSession: true,

  // Storage mechanism for session persistence (default: "localStorage")
  //   "localStorage"  — survives tab close
  //   "sessionStorage" — cleared on tab close
  storage: "localStorage",

  // HTTP request timeout in milliseconds (default: 10000)
  timeout: 10000,

  // Custom OAuth redirect URI (default: "{origin}/__venm/auth/callback")
  redirectUri: "http://localhost:3000/__venm/auth/callback",

  // OAuth provider credentials (required — at least one provider)
  oauth: {
    google: {
      clientId: "your-google-client-id.apps.googleusercontent.com",
    },
    facebook: {
      appId: "your-facebook-app-id",
    },
  },
};

// ── App Root ─────────────────────────────────────────────────────────

export default function App() {
  return (
    <VenmProvider
      config={config}
      // Called whenever auth state changes (login, logout, token refresh)
      onAuthStateChange={(state) => {
        console.log("[auth] State:", state);
      }}
    >
      <AppContent />
    </VenmProvider>
  );
}

// ── App Content ──────────────────────────────────────────────────────

function AppContent() {
  const { logout } = useAuth();

  return (
    <div>
      {/* Shows a loading spinner while the session initializes */}
      <Loading>
        <p>Loading session...</p>
      </Loading>

      {/* Shown when the user is NOT authenticated */}
      <Unauthenticated>
        {/* Renders OAuth provider buttons */}
        {/* layouts: "vertical" | "horizontal" | "card" | "minimal" */}
        <VenmAuth
          providers={["google", "facebook"] as ProviderType[]}
          layout="card"         // (default: "vertical")
          showDivider={false}   // Show "or" divider between buttons
        />
      </Unauthenticated>

      {/* Shown when the user IS authenticated */}
      <Authenticated>
        <h1>Welcome!</h1>
        <button onClick={() => logout()}>Sign Out</button>
      </Authenticated>
    </div>
  );
}
```

## Server Implementation

```tsx
import express from "express";
import { createVenmAuth, createMongoDBAdapter } from "venm-auth/server";
import type { VenmAuthConfig } from "venm-auth/server";

const app = express();

// ── Configuration ───────────────────────────────────────────────────

const authConfig: VenmAuthConfig = {
  // Google OAuth credentials (optional — omit if not using Google)
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  },

  // Facebook OAuth credentials (optional — omit if not using Facebook)
  facebook: {
    appId: process.env.FACEBOOK_APP_ID!,
    appSecret: process.env.FACEBOOK_APP_SECRET!,
  },

  // Secret key for signing JWT tokens (required — min 32 characters)
  jwtSecret: process.env.JWT_SECRET!,

  // Database adapter (required)
  //   Built-in: createMongoDBAdapter({ uri, databaseName })
  //   Custom:   implement the DatabaseAdapter interface
  database: createMongoDBAdapter({
    uri: process.env.MONGODB_URI!,
    databaseName: "myapp-auth",
  }),

  // Session configuration (optional)
  session: {
    // Session expiry in seconds (default: 604800 — 7 days)
    maxAge: 604800,
  },

  // Route prefix for auth endpoints (default: "/api/auth")
  prefix: "/api/auth",

  // Restrict token exchange POST requests to trusted origins
  // (optional — but recommended in production)
  allowedOrigins: ["http://localhost:3000"],
};

// ── Mount ────────────────────────────────────────────────────────────

app.use("/api/auth", createVenmAuth(authConfig));

app.listen(3000);
```

## OAuth Flow

1. User clicks a provider button (Google/Facebook)
2. A popup opens to your Express server's OAuth authorize endpoint (`GET /google?state=...&code_challenge=...&auth_session_id=...`)
3. The server sets a signed CSRF state cookie, stores a state-to-session mapping, and redirects to the provider's consent screen
4. The user authenticates with the chosen provider
5. The provider redirects back to your server's callback endpoint (`GET /google/callback`)
6. The server validates the state cookie against the returned state parameter, then **stores the authorization code server-side** keyed by the `auth_session_id` (see [COOP Handling](#cross-origin-opener-policy-coop-handling) below)
7. The main page polls `GET /result/:authSessionId` every 2 seconds until the code is available
8. The popup closes; the SDK exchanges the code for tokens via `POST /google`
9. The server exchanges the code with the provider, creates/updates the user in the database, generates JWT tokens, and stores the session
10. The user and session are stored in React state and localStorage
11. The `onAuthStateChange` callback fires with the new auth state

> **Why server-side storage?** Some OAuth providers (notably Google) set `Cross-Origin-Opener-Policy: same-origin` on their consent pages, which severs the `window.opener` reference in the popup — making `postMessage` silently fail. Instead, the callback stores the OAuth result on the server, and the main page polls `GET /result/:authSessionId` to retrieve it. See the [COOP section](#cross-origin-opener-policy-coop-handling) for details.

## Server API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/google` | Initiate Google OAuth redirect (sets CSRF cookie) |
| `GET` | `/google/callback` | Google OAuth callback (validates CSRF cookie, stores result server-side) |
| `POST` | `/google` | Exchange Google auth code for JWT tokens |
| `GET` | `/facebook` | Initiate Facebook OAuth redirect (sets CSRF cookie) |
| `GET` | `/facebook/callback` | Facebook OAuth callback (validates CSRF cookie, stores result server-side) |
| `POST` | `/facebook` | Exchange Facebook auth code for JWT tokens |
| `GET` | `/result/:authSessionId` | Poll for OAuth auth result (bypasses COOP-broken postMessage) |
| `GET` | `/session` | Verify and return current session (requires Bearer token) |
| `POST` | `/refresh` | Refresh access token using refresh token |
| `GET` | `/user` | Return current user (requires Bearer token) |
| `POST` | `/logout` | Destroy current session |
| `POST` | `/logout/all` | Destroy all sessions for the user |
| `GET` | `/health` | Health check |

## Components

### VenmProvider

The root component. Must wrap all authentication-using code.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `config` | `SDKConfig` | — | SDK configuration (apiUrl, oauth, environment, etc.) |
| `onAuthStateChange` | `(state: AuthState) => void` | — | Called when auth state changes |

### VenmAuth

Renders OAuth provider buttons in a configurable layout.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `providers` | `ProviderType[]` | `["google", "facebook"]` | Which provider buttons to show |
| `layout` | `Layout` | `"vertical"` | `"vertical"`, `"horizontal"`, `"card"`, or `"minimal"` |
| `showDivider` | `boolean` | `false` | Show "or" divider between buttons |

### GoogleButton / FacebookButton

Standalone provider buttons.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `onClick` | `() => void` | — | Override default login handler |
| `disabled` | `boolean` | `false` | Disable the button |
| `loading` | `boolean` | `false` | Show loading spinner |
| `children` | `ReactNode` | — | Custom button label |

### Authenticated / Unauthenticated / Loading

Conditional rendering components.

```tsx
<Authenticated fallback={<LoginPage />}>
  <Dashboard />
</Authenticated>

<Unauthenticated>
  <LoginPage />
</Unauthenticated>

<Loading>
  <p>Loading...</p>
</Loading>
```

## Hooks

| Hook | Returns | Description |
|------|---------|-------------|
| `useAuth()` | `{ user, session, loading, error, login, logout, refresh }` | Full authentication state and methods |
| `useUser()` | `{ user, loading }` | Current user only |
| `useSession()` | `{ accessToken, refreshToken, expiresAt, loading }` | Session tokens only |
| `useLogin()` | `{ login, loading, error }` | Login method with loading state |
| `useLogout()` | `{ logout, loading }` | Logout method with loading state |

## Cross-Origin-Opener-Policy (COOP) Handling

### The Problem

Google's OAuth consent screen sets the `Cross-Origin-Opener-Policy: same-origin` HTTP header on its pages. This severs the `window.opener` reference in the popup, so `window.opener.postMessage()` silently fails — the popup closes but the main page never receives the auth code.

> Facebook does not set COOP headers, so `postMessage` works for Facebook logins. The fallback handles both cases transparently.

### The Solution: Server-Side Result Relay

The SDK uses a **dual-delivery mechanism**:

1. **Fast path (`postMessage`)** — The callback HTML always attempts `window.opener.postMessage()`. Resolves instantly when it works (e.g., Facebook).
2. **Fallback path (polling)** — In parallel, the client polls `GET /result/:authSessionId` every **2 seconds** to retrieve the OAuth result. Ensures the flow works even when COOP severs the opener.

Whichever path resolves first wins.

### Architecture

```
 Main Page                  Express Auth Server
    │                              │
    ├── 1. Open popup + auth_session_id ──▶  │
    │                              │
    ├── 2. Poll GET /result/:id ──▶  │
    │    (every 2s, returns        │
    │     { status: "PENDING" })   │
    │ ◀────────────────────────────┤
    │                              │
    │           ┌──────────────┐   │
    │           │   Google     │   │
    │           │   Consent    │───┼── 3. POST /google/callback ──▶ storeResult(state, code)
    │           │   Screen     │   │
    │           └──────────────┘   │
    │                              │
    ├── 4. Next poll: { code, state } ◀─┤
    │                              │
    ├── 5. POST /google (exchange) ──▶  │
    │                              │
```

### The `OauthResultStore`

An in-memory store that maps OAuth `state` parameters to client-generated `authSessionId` values:

| Step | Action | Description |
|------|--------|-------------|
| Authorization request | `setStateMapping(state, authSessionId)` | Stores `state → authSessionId` |
| OAuth callback | `storeResult(state, code)` | Looks up `authSessionId` from `state`, stores result |
| Client polling | `getResult(authSessionId)` | Returns result and **deletes it** (one-time retrieval) |
| Error callback | `storeError(state, errorMessage)` | Stores error so the client receives it promptly |

- **TTL**: Results expire after **5 minutes** (cleanup runs every 60 seconds)
- **One-time retrieval**: Once read, the result is immediately deleted
- **No console noise**: Returns `200 { status: "PENDING" }` while waiting (not 404)

### Rate Limiting

Dedicated `resultRateLimiter` — **30 requests per minute per `authSessionId`** (compared to 10/min for other OAuth endpoints), matching the 2-second polling interval.

## Security

- **PKCE** (Proof Key for Code Exchange) for Google OAuth — protects against authorization code interception
- **Cookie-based CSRF state** — state parameter stored in a signed, httpOnly, short-lived cookie; validated on callback
- **Server-side result storage** — auth codes stored in memory with 5-minute TTL; retrieved once and immediately deleted
- **Popup origin validation** — only accepts messages from the expected origin
- **Token refresh margin** — refreshes tokens 60 seconds before expiry
- **Rate limiting** — built-in limiters for OAuth (10/min), result polling (30/min), and session (30/min) endpoints

## Local Development

```bash
# Install dependencies
pnpm install

# Type-check
pnpm typecheck

# Run tests
pnpm test

# Build
pnpm build

# Watch mode
pnpm dev
```

Supported localhost origins:
- `http://localhost:3000`
- `http://localhost:5173`
- `http://localhost:4173`

You can also run the included demo app:

```bash
cd examples/venm-auth-demo
# Create a .env file with your OAuth credentials
pnpm install
pnpm dev
```

## Error Handling

Client-side error codes:

| Code | Description |
|------|-------------|
| `POPUP_BLOCKED` | Browser blocked the popup |
| `POPUP_CLOSED` | User closed the popup |
| `POPUP_TIMEOUT` | Authentication timed out |
| `STATE_MISMATCH` | OAuth state parameter mismatch (potential CSRF) |
| `PROVIDER_ERROR` | OAuth provider returned an error |
| `UNAUTHORIZED` | Invalid or expired token |
| `TIMEOUT` | HTTP request timed out |
| `NO_REFRESH_TOKEN` | No refresh token available for session refresh |

Server-side error codes:

| Code | Description |
|------|-------------|
| `MISSING_CODE` | Authorization code missing from request |
| `TOKEN_EXCHANGE_FAILED` | OAuth token exchange with provider failed |
| `USER_CREATE_FAILED` | Failed to create or update user |
| `MISSING_TOKEN` | No Bearer token in request |
| `SESSION_NOT_FOUND` | Session not found in database |
| `USER_NOT_FOUND` | User not found in database |
| `INVALID_TOKEN` | Access token is invalid or expired |
| `INVALID_REFRESH_TOKEN` | Refresh token is invalid or expired |
| `MISSING_REFRESH_TOKEN` | Refresh token missing from request |
| `CSRF_INVALID_STATE` | CSRF state parameter missing or mismatch |
| `RATE_LIMIT_EXCEEDED` | Too many requests |

## TypeScript

```tsx
import type { User, Session, AuthState, ProviderType, SDKConfig, OAuthConfig } from "venm-auth";
import type { DatabaseAdapter, ServerSession, VenmAuthConfig } from "venm-auth/server";
```

## Package Exports

| Import Path | Contents |
|-------------|----------|
| `venm-auth` | React components, hooks, context, services, types |
| `venm-auth/server` | Express router, JWT utilities, database adapters, middleware |
| `venm-auth/components` | React components only |
| `venm-auth/hooks` | React hooks only |

## Database Adapters

Built-in MongoDB adapter:

```ts
import { createMongoDBAdapter } from "venm-auth/server";

const db = createMongoDBAdapter({
  uri: "mongodb://localhost:27017/myapp",
  databaseName: "myapp-auth",
});
```

You can also implement the `DatabaseAdapter` interface for any database (PostgreSQL, SQLite, Redis, etc.).

---

License: MIT
