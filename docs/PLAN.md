# VENM-AUTH Implementation Plan

## Overview

Build **venm-auth** as a dual-purpose npm package:
1. **React Client SDK** — Components, hooks, context for authentication UI
2. **Express Server** — `createVenmAuth()` middleware that handles OAuth, JWT, sessions, and database

> One package. One `npm install`. No external Venm servers.

---

## Current State Analysis

### ✅ Completed (Client SDK)

| Area | Files | Status |
|------|-------|--------|
| React Components | `VenmProvider`, `VenmAuth`, `GoogleButton`, `FacebookButton`, `Authenticated`, `Unauthenticated`, `Loading` | Complete |
| React Hooks | `useAuth`, `useUser`, `useSession`, `useLogin`, `useLogout` | Complete |
| Auth Context | `AuthContext` with reducer pattern, `VenmProvider` wrapper | Complete |
| Client Types | `User`, `Session`, `AuthState`, `AuthError`, `AuthResponse`, `SDKConfig` | Complete |
| Popup OAuth Flow | `PopupManager` with `postMessage`, origin validation, PKCE | Complete |
| Session Management | `SessionService` with storage, auto-refresh, expiration | Complete |
| HTTP Client | `HttpClient` with auth headers, timeout, error handling | Complete |
| Crypto | PKCE verifier/challenge, state generation | Complete |
| Config Validation | `validateConfig` with environment-aware defaults | Complete |
| Tests | Vitest with ~30 test files, 90 passing tests | Complete |

### ✅ Completed (Server)

| Area | Priority | Status |
|------|----------|--------|
| Express `createVenmAuth()` entry point | **P0** | Complete |
| Google OAuth server token exchange | **P0** | Complete |
| Facebook OAuth server token exchange | **P0** | Complete |
| JWT generation & verification | **P0** | Complete |
| Database adapter interface | **P0** | Complete |
| MongoDB adapter | **P1** | Complete |
| Server endpoints (POST /google, GET /google/callback, etc.) | **P0** | Complete |
| CSRF middleware (state validation) | **P1** | Complete |
| Rate limiting middleware | **P1** | Complete |
| Error handler (VenmAuthError, Axios, JWT) | **P0** | Complete |
| Package exports for `venm-auth/server` | **P0** | Complete |
| tsup multi-entry build | **P0** | Complete |

### ✅ Updated (Client-Server Alignment)

| Change | Status |
|--------|--------|
| `apiKey` → removed from SDKConfig | Complete |
| `baseUrl` → renamed to `apiUrl` | Complete |
| `mongodb` → removed from SDKConfig | Complete |
| `redirectUri` → added to SDKConfig | Complete |
| `/v1/` prefix → removed from API_ENDPOINTS | Complete |
| `DEFAULT_BASE_URLS` → points to dev server /api/auth | Complete |
| `buildAuthorizationUrl` → uses server routes not /oauth/authorize | Complete |
| Popup flow → two-step: popup gets code, POST exchanges for session | Complete |
| Server callback HTML → sends `{ code, state }` via postMessage | Complete |
| Deprecated `user-model.ts` → kept locally with own types | Complete |

### ✅ Demo App

| Area | Status |
|------|--------|
| Demo Express server with `createVenmAuth()` | Complete |
| In-memory adapter (no MongoDB required) | Complete |
| `.env.example` with configuration docs | Complete |
| Updated `App.tsx` with new `apiUrl` config | Complete |
| Vite proxy for `/api/auth` → Express server | Complete |

---

## Target Architecture

```
MERN Application
│
├── client (React)
│     │
│     ▼
│   venm-auth React SDK
│     │
│     ▼
│   HTTP Requests (fetch) → POST /google { code } → returns { user, session }
│
└── server (Express)
      │
      ▼
    venm-auth Express Router
      │
      ├── Google OAuth (GET /google → redirect, GET /google/callback → pass-through, POST /google → exchange)
      ├── Facebook OAuth (GET /facebook → redirect, GET /facebook/callback → pass-through, POST /facebook → exchange)
      ├── JWT + Sessions (access token: 15m, refresh token: 30d)
      └── Database Adapter → MongoDB (or in-memory for dev)
```

No external Venm servers. Everything runs inside the developer's own application.

---

## OAuth Popup Flow (Implemented)

```
Browser                          Express Server                  Google/Facebook
  │                                   │                              │
  │  1. Open popup to                 │                              │
  │     GET /api/auth/google          │                              │
  │     ?state=xyz                    │                              │
  │     &code_challenge=abc           │                              │
  │────────────────────────────────►  │                              │
  │                                   │  2. Redirect to OAuth        │
  │                                   │     provider consent screen  │
  │                                   │──────────────────────────────►
  │                                   │                              │
  │                                   │  3. User approves,           │
  │                                   │     redirected to callback   │
  │                                   │◄──────────────────────────────
  │                                   │     ?code=XYZ&state=xyz      │
  │                                   │                              │
  │                                   │  4. Validate state (CSRF)    │
  │                                   │  5. Send code to popup       │
  │                                   │     via postMessage          │
  │◄────────────────────────────────  │                              │
  │   { channel, code, state }       │                              │
  │                                   │                              │
  │  6. Popup closes                  │                              │
  │  7. Client POST /api/auth/google  │                              │
  │     { code, redirectUri }         │                              │
  │────────────────────────────────►  │                              │
  │                                   │  8. Exchange code w/ Google  │
  │                                   │──────────────────────────────►
  │                                   │◄──────────────────────────────
  │                                   │     { tokens, profile }      │
  │                                   │                              │
  │                                   │  9. Create/update user       │
  │                                   │ 10. Generate JWT tokens      │
  │                                   │ 11. Create session in DB     │
  │◄────────────────────────────────  │                              │
  │   { user, session }              │                              │
```

---

## Package Structure (Current)

```
venm-auth/
  src/
    client/ (top-level)
      components/
        VenmAuth.tsx
        GoogleButton.tsx
        FacebookButton.tsx
        Authenticated.tsx
        Unauthenticated.tsx
        Loading.tsx
        VenmProvider.tsx
      context/
        AuthContext.tsx
      hooks/
        useAuth.ts
        useUser.ts
        useSession.ts
        useLogin.ts
        useLogout.ts
      services/
        http-client.ts
        auth-service.ts
        popup-manager.ts
        session-service.ts
      styles/
        index.ts
      index.ts

    server/
      createVenmAuth.ts
      routes/
        google.ts         ← GET /, GET /callback, POST /
        facebook.ts       ← GET /, GET /callback, POST /
        session.ts        ← GET /, POST /refresh
        user.ts           ← GET /
        logout.ts         ← POST /, POST /all
        health.ts         ← GET /
      middleware/
        csrf.ts           ← validateState (basic), stateCookieMiddleware (cookie-based)
        rate-limit.ts     ← createRateLimiter, InMemoryStore
        error-handler.ts
      oauth/
        google.ts         ← Token exchange + profile fetch
        facebook.ts       ← Token exchange + profile fetch
      jwt/
        generate.ts       ← generateTokens, generateAccessToken, generateRefreshToken
        verify.ts         ← verifyToken, verifyRefreshToken, getSubjectFromToken
      session/
        index.ts          ← SessionManager class
      database/
        adapter.ts        ← DatabaseAdapter interface
        adapters/
          mongodb.ts      ← createMongoDBAdapter
      index.ts            ← Re-exports createVenmAuth, middlewares, etc.

    shared/ (distributed across types/)
      types/
        user.ts
        session.ts
        auth.ts
        config.ts
        responses.ts
        theme.ts
      constants/
        index.ts
      utils/
        crypto.ts
        storage.ts
        url.ts
        validate.ts
        logger.ts

  index.ts                ← Re-exports client API

  examples/
    venm-auth-demo/
      src/
        App.tsx           ← Demo React app with new config
      server/
        index.js          ← Demo Express server
        .env.example      ← Environment variables guide
```

---

## Developer Experience Examples

### Minimal MERN Integration

**Server (Express):**
```typescript
import express from "express";
import { createVenmAuth } from "venm-auth/server";
import { createMongoDBAdapter } from "venm-auth/server";

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

**Client (React):**
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
      <VenmAuth providers={["google"]} />
    </VenmProvider>
  );
}
```

That's all the developer needs to write. Everything else is handled by the package.

---

## Dependencies

| Package | Usage | Dependency Type |
|---------|-------|----------------|
| `react`, `react-dom` | Client SDK | `peerDependencies` |
| `express` | Server Router | `dependencies` |
| `jose` | JWT generation/verification | `dependencies` |
| `axios` | Server-side HTTP for OAuth token exchange | `dependencies` |
| `mongodb` | MongoDB adapter | `dependencies` |

---

## Implementation History

| Phase | Description | Status |
|-------|-------------|--------|
| 0 | Initial client SDK (components, hooks, context, services) | ✅ Complete |
| 1 | Database adapter interface + MongoDB adapter + JWT | ✅ Complete |
| 2 | OAuth handlers + Express router (9 routes) | ✅ Complete |
| 3 | Security middleware (CSRF, rate limiting, error handler) | ✅ Complete |
| 4 | Client SDK alignment (config changes, API paths, popup flow) | ✅ Complete |
| 5 | Build + Package config (tsup multi-entry, exports) | ✅ Complete |
| 6 | Demo app + tests | ✅ Complete |

**Total:** ~50 files, ~4,000 lines of code
