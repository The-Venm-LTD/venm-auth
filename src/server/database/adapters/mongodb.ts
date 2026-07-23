import { randomUUID } from "node:crypto";
import { MongoClient, type Collection, type Filter, type Document } from "mongodb";
import type { User } from "../../../types/user";
import type {
  DatabaseAdapter,
  CreateUserData,
  ServerSession,
  CreateSessionData,
} from "../adapter";

// ── MongoDB Document Schemas ────────────────────────────────────────

interface UserDocument extends Document {
  id: string;
  email: string;
  name: string;
  picture: string | null;
  provider: "google" | "facebook" | "email";
  emailVerified: boolean;
  providerAccountId: string;
  createdAt: string;
  updatedAt: string;
}

interface SessionDocument extends Document {
  id: string;
  userId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  refreshExpiresAt: number;
  createdAt: string;
  updatedAt: string;
}

// ── Type-Safe Query Helpers ─────────────────────────────────────────
// These helpers avoid unsafe inline casts (e.g., `as Filter<T>`) while
// keeping the narrow filter type that MongoDB's collection methods expect.
// The `as Filter<T>` cast is confined to a single location per helper,
// making it easy to audit if the MongoDB types drift.

function emailFilter(email: string): Filter<UserDocument> {
  return { email } as Filter<UserDocument>;
}

function providerFilter(
  provider: string,
  providerAccountId: string
): Filter<UserDocument> {
  return { provider, providerAccountId } as Filter<UserDocument>;
}

function idFilter(id: string): Filter<UserDocument> {
  return { id } as Filter<UserDocument>;
}

function userIdFilter(userId: string): Filter<SessionDocument> {
  return { userId } as Filter<SessionDocument>;
}

/**
 * Build a filter that matches a session document by either access token
 * or refresh token.
 */
function sessionTokenFilter(token: string): Filter<SessionDocument> {
  return {
    $or: [
      { accessToken: token } as Filter<SessionDocument>,
      { refreshToken: token } as Filter<SessionDocument>,
    ],
  };
}

// ── Adapter Factory ─────────────────────────────────────────────────

export interface MongoDBAdapterConfig {
  uri: string;
  databaseName?: string;
}

export function createMongoDBAdapter(
  config: MongoDBAdapterConfig
): DatabaseAdapter {
  const dbName = config.databaseName ?? "venm-auth";

  let client: MongoClient | null = null;
  let usersCollection: Collection<UserDocument> | null = null;
  let sessionsCollection: Collection<SessionDocument> | null = null;

  async function ensureConnected(): Promise<{
    users: Collection<UserDocument>;
    sessions: Collection<SessionDocument>;
  }> {
    if (!client) {
      client = new MongoClient(config.uri);
      await client.connect();
      const db = client.db(dbName);

      usersCollection = db.collection<UserDocument>("users");
      sessionsCollection = db.collection<SessionDocument>("sessions");

      // Create indexes
      await usersCollection.createIndex({ email: 1 }, { unique: true });
      await usersCollection.createIndex(
        { provider: 1, providerAccountId: 1 },
        { unique: true }
      );
      await sessionsCollection.createIndex(
        { accessToken: 1 },
        { unique: true }
      );
      await sessionsCollection.createIndex(
        { refreshToken: 1 },
        { unique: true }
      );
      // TTL index on refreshExpiresAt so the session document lives as
      // long as the refresh token is valid — NOT on expiresAt (access
      // token lifetime), which would prematurely delete sessions before
      // the refresh token can be used to revive them.
      await sessionsCollection.createIndex(
        { refreshExpiresAt: 1 },
        { expireAfterSeconds: 0 }
      );
    }

    return {
      users: usersCollection!,
      sessions: sessionsCollection!,
    };
  }

  function toUser(doc: UserDocument): User {
    return {
      id: doc.id,
      email: doc.email,
      name: doc.name,
      picture: doc.picture,
      provider: doc.provider,
      emailVerified: doc.emailVerified,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  function toSession(doc: SessionDocument): ServerSession {
    return {
      id: doc.id,
      userId: doc.userId,
      accessToken: doc.accessToken,
      refreshToken: doc.refreshToken,
      expiresAt: doc.expiresAt,
      refreshExpiresAt: doc.refreshExpiresAt,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  return {
    // ── Users ─────────────────────────────────────────────────────

    async createUser(data: CreateUserData): Promise<User> {
      const { users } = await ensureConnected();
      const now = new Date().toISOString();
      const doc: UserDocument = {
        id: data.id,
        email: data.email,
        name: data.name,
        picture: data.picture,
        provider: data.provider,
        emailVerified: data.emailVerified,
        providerAccountId: data.providerAccountId,
        createdAt: now,
        updatedAt: now,
      };
      await users.insertOne(doc);
      return toUser(doc);
    },

    async findUserByEmail(email: string): Promise<User | null> {
      const { users } = await ensureConnected();
      const doc = await users.findOne(emailFilter(email));
      return doc ? toUser(doc) : null;
    },

    async findUserByProvider(
      provider: string,
      providerAccountId: string
    ): Promise<User | null> {
      const { users } = await ensureConnected();
      const doc = await users.findOne(providerFilter(provider, providerAccountId));
      return doc ? toUser(doc) : null;
    },

    async findUserById(id: string): Promise<User | null> {
      const { users } = await ensureConnected();
      const doc = await users.findOne(idFilter(id));
      return doc ? toUser(doc) : null;
    },

    async updateUser(
      id: string,
      data: Partial<User>
    ): Promise<User | null> {
      const { users } = await ensureConnected();
      const update = {
        $set: {
          ...data,
          updatedAt: new Date().toISOString(),
        },
      };
      const doc = await users.findOneAndUpdate(
        idFilter(id),
        update,
        { returnDocument: "after" }
      );
      return doc ? toUser(doc) : null;
    },

    async deleteUser(id: string): Promise<boolean> {
      const { users } = await ensureConnected();
      const result = await users.deleteOne(idFilter(id));
      return result.deletedCount > 0;
    },

    // ── Sessions ──────────────────────────────────────────────────

    async createSession(data: CreateSessionData): Promise<ServerSession> {
      const { sessions } = await ensureConnected();
      const now = new Date().toISOString();
      const doc: SessionDocument = {
        id: randomUUID(),
        userId: data.userId,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        expiresAt: data.expiresAt,
        refreshExpiresAt: data.refreshExpiresAt,
        createdAt: now,
        updatedAt: now,
      };
      await sessions.insertOne(doc);
      return toSession(doc);
    },

    async findSessionByToken(token: string): Promise<ServerSession | null> {
      const { sessions } = await ensureConnected();
      const doc = await sessions.findOne(sessionTokenFilter(token));
      return doc ? toSession(doc) : null;
    },

    async findSessionsByUserId(userId: string): Promise<ServerSession[]> {
      const { sessions } = await ensureConnected();
      const docs = await sessions
        .find(userIdFilter(userId))
        .toArray();
      return docs.map(toSession);
    },

    async deleteSession(token: string): Promise<boolean> {
      const { sessions } = await ensureConnected();
      const result = await sessions.deleteOne(sessionTokenFilter(token));
      return result.deletedCount > 0;
    },

    async deleteAllUserSessions(userId: string): Promise<number> {
      const { sessions } = await ensureConnected();
      const result = await sessions.deleteMany(userIdFilter(userId));
      return result.deletedCount;
    },

    async updateSession(
      token: string,
      data: Partial<ServerSession>
    ): Promise<ServerSession | null> {
      const { sessions } = await ensureConnected();
      const update = {
        $set: {
          ...data,
          updatedAt: new Date().toISOString(),
        },
      };
      const doc = await sessions.findOneAndUpdate(
        sessionTokenFilter(token),
        update,
        { returnDocument: "after" }
      );
      return doc ? toSession(doc) : null;
    },
  };
}
