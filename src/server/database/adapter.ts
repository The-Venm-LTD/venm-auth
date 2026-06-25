import type { User } from "../../types/user";

// ── Data Transfer Types ─────────────────────────────────────────────

export interface CreateUserData {
  id: string;
  email: string;
  name: string;
  picture: string | null;
  provider: "google" | "facebook" | "email";
  emailVerified: boolean;
  providerAccountId: string;
}

export interface ServerSession {
  id: string;
  userId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSessionData {
  userId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

// ── Adapter Interface ───────────────────────────────────────────────

export interface DatabaseAdapter {
  // ── Users ───────────────────────────────────────────────────────
  createUser(data: CreateUserData): Promise<User>;
  findUserByEmail(email: string): Promise<User | null>;
  findUserByProvider(
    provider: string,
    providerAccountId: string
  ): Promise<User | null>;
  findUserById(id: string): Promise<User | null>;
  updateUser(id: string, data: Partial<User>): Promise<User | null>;
  deleteUser(id: string): Promise<boolean>;

  // ── Server Sessions ─────────────────────────────────────────────
  createSession(data: CreateSessionData): Promise<ServerSession>;
  findSessionByToken(token: string): Promise<ServerSession | null>;
  findSessionsByUserId(userId: string): Promise<ServerSession[]>;
  deleteSession(token: string): Promise<boolean>;
  deleteAllUserSessions(userId: string): Promise<number>;
  updateSession(
    token: string,
    data: Partial<ServerSession>
  ): Promise<ServerSession | null>;
}
