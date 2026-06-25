# venm-auth

React authentication SDK for Venm — integrate Google and Facebook OAuth login into any React application with minimal code.

```tsx
import { VenmProvider, VenmAuth } from "venm-auth";

function App() {
  return (
    <VenmProvider
      config={{
        apiUrl: "http://localhost:3000/api/auth",
        environment: "development",
        oauth: {
          google: { clientId: "xxx.apps.googleusercontent.com" },
        },
      }}
    >
      <VenmAuth providers={["google", "facebook"]} />
    </VenmProvider>
  );
}
```

## Installation

```bash
pnpm add venm-auth
```

## Quick Start

Wrap your app with `VenmProvider` and use `VenmAuth` to render login buttons.

```tsx
import { VenmProvider, VenmAuth, Authenticated, Unauthenticated, useAuth } from "venm-auth";

function App() {
  return (
    <VenmProvider
      config={{
        apiUrl: "http://localhost:3000/api/auth",
        environment: "development",
        oauth: {
          google: { clientId: "xxx.apps.googleusercontent.com" },
        },
      }}
    >
      <AppContent />
    </VenmProvider>
  );
}

function AppContent() {
  const { user } = useAuth();

  return (
    <div>
      <Authenticated>
        <h1>Welcome, {user?.name}</h1>
        <LogoutButton />
      </Authenticated>
      <Unauthenticated>
        <VenmAuth layout="card" />
      </Unauthenticated>
    </div>
  );
}

function LogoutButton() {
  const { logout } = useAuth();
  return <button onClick={() => logout()}>Logout</button>;
}
```

### Setting up the Server

venm-auth also ships an **Express server** that handles OAuth token exchange, JWT generation, and session management.

```tsx
import express from "express";
import { createVenmAuth, createMongoDBAdapter } from "venm-auth/server";

const app = express();

app.use("/api/auth", createVenmAuth({
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  },
  jwtSecret: process.env.JWT_SECRET!,
  database: createMongoDBAdapter({ uri: process.env.MONGODB_URI! }),
}));

app.listen(3000);
```

See the [demo app](./examples/venm-auth-demo) for a complete working example including an in-memory adapter for local development.

## Client Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiUrl` | `string` | `http://localhost:3000/api/auth` (dev) / `/api/auth` (prod) | Base URL of your Express auth server |
| `environment` | `"production" \| "development"` | `"production"` | Enables verbose logging in development |
| `autoRefresh` | `boolean` | `true` | Automatically refresh tokens before expiry |
| `persistSession` | `boolean` | `true` | Persist session to localStorage |
| `storage` | `"localStorage" \| "sessionStorage"` | `"localStorage"` | Storage mechanism for session persistence |
| `timeout` | `number` | `10000` | HTTP request timeout in milliseconds |
| `redirectUri` | `string` | `"{origin}/__venm/auth/callback"` | Custom OAuth redirect URI |
| `oauth` | `OAuthConfig` | — | OAuth provider credentials |

### OAuthConfig

| Option | Type | Description |
|--------|------|-------------|
| `google.clientId` | `string` | Google OAuth client ID |
| `facebook.appId` | `string` | Facebook OAuth app ID |

## Server Configuration

| Option | Type | Description |
|--------|------|-------------|
| `google` | `GoogleOAuthConfig` | Google OAuth credentials (`clientId`, `clientSecret`) |
| `facebook` | `FacebookOAuthConfig` | Facebook OAuth credentials (`appId`, `appSecret`) |
| `jwtSecret` | `string` | **Required.** Secret key for signing JWT tokens |
| `database` | `DatabaseAdapter` | **Required.** Database adapter (MongoDB or in-memory) |
| `session` | `SessionConfig` | Session configuration (optional) |
| `prefix` | `string` | `"/api/auth"` | Route prefix for auth endpoints |

## Components

### VenmProvider

The root component. Must wrap all authentication-using code.

```tsx
<VenmProvider
  config={{ apiUrl: "http://localhost:3000/api/auth", environment: "development" }}
  onAuthStateChange={(state) => console.log("Auth state:", state)}
>
  <App />
</VenmProvider>
```

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

### Authenticated / Unauthenticated

Conditional rendering components.

```tsx
<Authenticated fallback={<LoginPage />}>
  <Dashboard />
</Authenticated>

<Unauthenticated>
  <LoginPage />
</Unauthenticated>
```

### Loading

Shows a loading indicator while the session initializes.

## Hooks

| Hook | Returns | Description |
|------|---------|-------------|
| `useAuth()` | `{ user, session, loading, error, login, logout, refresh }` | Full authentication state and methods |
| `useUser()` | `{ user, loading }` | Current user only |
| `useSession()` | `{ accessToken, refreshToken, expiresAt, loading }` | Session tokens only |
| `useLogin()` | `{ login, loading, error }` | Login method with loading state |
| `useLogout()` | `{ logout, loading }` | Logout method with loading state |

## OAuth Flow

1. User clicks a provider button (Google/Facebook)
2. A popup opens to your Express server's OAuth authorize endpoint (`GET /google?state=...&code_challenge=...`)
3. The server sets a signed CSRF state cookie and redirects to the provider's consent screen
4. The user authenticates with the chosen provider
5. The provider redirects back to your server's callback endpoint (`GET /google/callback`)
6. The server validates the state cookie against the returned state parameter, then sends the authorization code back to the popup via `postMessage`
7. The popup closes; the SDK exchanges the code for tokens via `POST /google`
8. The server exchanges the code with the provider, creates/updates the user in the database, generates JWT tokens, and stores the session
9. The user and session are stored in React state and localStorage
10. The `onAuthStateChange` callback fires with the new auth state

## Server API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/google` | Initiate Google OAuth redirect (sets CSRF cookie) |
| `GET` | `/google/callback` | Google OAuth callback (validates CSRF cookie, returns code via postMessage) |
| `POST` | `/google` | Exchange Google auth code for JWT tokens |
| `GET` | `/facebook` | Initiate Facebook OAuth redirect (sets CSRF cookie) |
| `GET` | `/facebook/callback` | Facebook OAuth callback (validates CSRF cookie, returns code via postMessage) |
| `POST` | `/facebook` | Exchange Facebook auth code for JWT tokens |
| `GET` | `/session` | Verify and return current session (requires Bearer token) |
| `POST` | `/refresh` | Refresh access token using refresh token |
| `GET` | `/user` | Return current user (requires Bearer token) |
| `POST` | `/logout` | Destroy current session |
| `POST` | `/logout/all` | Destroy all sessions for the user |
| `GET` | `/health` | Health check |

## Security

- **PKCE** (Proof Key for Code Exchange) for Google OAuth — protects against authorization code interception
- **Cookie-based CSRF state** — state parameter is stored in a signed, httpOnly, short-lived cookie on the redirect; validated against the returned state on callback
- **Popup origin validation** — only accepts messages from the expected origin
- **Token refresh margin** — refreshes tokens 60 seconds before expiry
- **Rate limiting** — built-in rate limiters for OAuth and session endpoints
- **No external storage of secrets** — tokens stored in localStorage, accessible only on the same origin

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

Use `environment: "development"` in your config for verbose logging:

```tsx
<VenmProvider
  config={{
    apiUrl: "http://localhost:3000/api/auth",
    environment: "development",
  }}
>
  <App />
</VenmProvider>
```

You can also run the included demo app:

```bash
cd examples/venm-auth-demo
cp server/.env.example server/.env
# Fill in your OAuth credentials in .env
pnpm install
pnpm dev
```

## Error Handling

The SDK provides typed errors with codes:

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

Server-side error codes (returned as JSON):

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

All types are exported for use in your application:

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

venm-auth ships with a MongoDB adapter:

```ts
import { createMongoDBAdapter } from "venm-auth/server";

const db = createMongoDBAdapter({
  uri: "mongodb://localhost:27017/myapp",
  databaseName: "myapp-auth",
});
```

You can also implement the `DatabaseAdapter` interface for any database (PostgreSQL, SQLite, Redis, etc.).

License: MIT
