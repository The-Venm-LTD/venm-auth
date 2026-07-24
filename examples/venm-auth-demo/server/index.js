/**
 * Venm Auth Demo Server
 *
 * A simple Express server demonstrating how to use createVenmAuth()
 * for Google and Facebook OAuth authentication.
 *
 * Usage:
 *   1. Copy vars/.env.example to vars/.env and fill in your credentials
 *   2. pnpm install
 *   3. pnpm dev  (starts web demo, ionic app, and this server concurrently)
 *   4. Open http://localhost:3000 (web demo) or http://localhost:3002 (ionic)
 *
 * The Vite dev servers run on port 3000 (demo) and 3002 (ionic) and proxy
 * auth requests to this Express server on port 3001.
 */

import express from "express";
import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import cors from "cors";

// Use dynamic import for venm-auth (ESM package)
const { createVenmAuth, createMongoDBAdapter } = await import("venm-auth/server");

// Load environment variables from the shared vars/ folder
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, "..", "vars", ".env");
config({ path: envPath });

console.log(`[demo] Loaded env from ${envPath}`);

const app = express();
const PORT = parseInt(process.env.PORT ?? "3001", 10);

// ── CORS ────────────────────────────────────────────────────────────
// Allow the Vite dev servers (port 3000, 3002) to make requests
const clientOrigins = process.env.CLIENT_ORIGIN
  ? process.env.CLIENT_ORIGIN.split(",").map(o => o.trim())
  : ["http://localhost:3000", "http://localhost:3002"];

app.use(cors({
  origin: clientOrigins,
  credentials: true,
}));

// ── Database Adapter ────────────────────────────────────────────────
// Use MongoDB if a URI is provided, otherwise use a simple in-memory adapter
let databaseAdapter;

if (process.env.MONGODB_URI) {
  databaseAdapter = createMongoDBAdapter({
    uri: process.env.MONGODB_URI,
    databaseName: process.env.MONGODB_DATABASE ?? "venm-auth-demo",
  });
  console.log("[demo] Using MongoDB adapter");
} else {
  console.log("[demo] No MONGODB_URI set — using in-memory adapter (data lost on restart)");
  databaseAdapter = createMemoryAdapter();
}

// ── Auth Routes ─────────────────────────────────────────────────────
// The allowedOrigins option enables CSRF protection on POST token exchange
// endpoints by validating Origin/Referer headers against the client origin.
app.use("/api/auth", createVenmAuth({
  google: process.env.GOOGLE_CLIENT_ID
    ? {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
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
  // Restrict token exchange POST requests to the client app's origin
  allowedOrigins: clientOrigins,
}));

// ── Static files (production) ───────────────────────────────────────
// Serve the built Vite app in production
if (process.env.NODE_ENV === "production") {
  const distPath = join(__dirname, "..", "dist");
  app.use(express.static(distPath));
  app.get("*", (_req, res) => {
    res.sendFile(join(distPath, "index.html"));
  });
}

// ── Start ───────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n  🚀  Venm Auth Demo Server`);
  console.log(`  ───────────────────────────`);
  console.log(`  Local:    http://localhost:${PORT}`);
  console.log(`  Auth API: http://localhost:${PORT}/api/auth/health\n`);
});

// ── In-Memory Adapter (for development without MongoDB) ─────────────

function createMemoryAdapter() {
  const users = new Map();
  const sessions = new Map();
  let nextId = 1;

  return {
    // Users
    async createUser(data) {
      const user = { ...data, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      users.set(user.id, user);
      return user;
    },
    async findUserByEmail(email) {
      for (const user of users.values()) {
        if (user.email === email) return user;
      }
      return null;
    },
    async findUserByProvider(provider, providerAccountId) {
      for (const user of users.values()) {
        if (user.provider === provider && user.providerAccountId === providerAccountId) return user;
      }
      return null;
    },
    async findUserById(id) {
      return users.get(id) ?? null;
    },
    async updateUser(id, data) {
      const user = users.get(id);
      if (!user) return null;
      const updated = { ...user, ...data, updatedAt: new Date().toISOString() };
      users.set(id, updated);
      return updated;
    },
    async deleteUser(id) {
      return users.delete(id);
    },

    // Sessions
    async createSession(data) {
      const session = {
        ...data,
        id: `sess_${nextId++}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      sessions.set(session.accessToken, session);
      sessions.set(session.refreshToken, session);
      return session;
    },
    async findSessionByToken(token) {
      return sessions.get(token) ?? null;
    },
    async findSessionsByUserId(userId) {
      return Array.from(sessions.values()).filter(s => s.userId === userId);
    },
    async deleteSession(token) {
      const session = sessions.get(token);
      if (!session) return false;
      sessions.delete(session.accessToken);
      sessions.delete(session.refreshToken);
      return true;
    },
    async deleteAllUserSessions(userId) {
      let count = 0;
      for (const [token, session] of sessions) {
        if (session.userId === userId) {
          sessions.delete(token);
          count++;
        }
      }
      return count;
    },
    async updateSession(token, data) {
      const session = sessions.get(token);
      if (!session) return null;
      const updated = { ...session, ...data, updatedAt: new Date().toISOString() };
      // Remove old token keys if tokens were rotated
      if (data.accessToken && data.accessToken !== session.accessToken) {
        sessions.delete(session.accessToken);
      }
      if (data.refreshToken && data.refreshToken !== session.refreshToken) {
        sessions.delete(session.refreshToken);
      }
      // Store under the new tokens
      sessions.set(updated.accessToken, updated);
      sessions.set(updated.refreshToken, updated);
      return updated;
    },
  };
}
