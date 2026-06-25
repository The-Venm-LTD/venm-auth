import type { DatabaseAdapter, ServerSession } from "../database/adapter";

// ── Session Config ──────────────────────────────────────────────────

export interface SessionConfig {
  /** How long until the refresh token expires. Default: "30d". */
  expiresIn?: string;
}

// ── Server Session Service ─────────────────────────────────────────

export class SessionManager {
  private adapter: DatabaseAdapter;

  constructor(adapter: DatabaseAdapter) {
    this.adapter = adapter;
  }

  /**
   * Create a new server-side session record after successful authentication.
   */
  async createSession(data: {
    userId: string;
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
  }): Promise<ServerSession> {
    return this.adapter.createSession(data);
  }

  /**
   * Find a session by its access or refresh token.
   */
  async findSession(token: string): Promise<ServerSession | null> {
    return this.adapter.findSessionByToken(token);
  }

  /**
   * Get all sessions for a given user.
   */
  async getUserSessions(userId: string): Promise<ServerSession[]> {
    return this.adapter.findSessionsByUserId(userId);
  }

  /**
   * Delete a single session by token (used on logout).
   */
  async deleteSession(token: string): Promise<boolean> {
    return this.adapter.deleteSession(token);
  }

  /**
   * Delete all sessions for a user (used on password change or account deletion).
   */
  async deleteAllUserSessions(userId: string): Promise<number> {
    return this.adapter.deleteAllUserSessions(userId);
  }

  /**
   * Update a session's tokens after a refresh.
   */
  async updateSession(
    token: string,
    data: {
      accessToken?: string;
      refreshToken?: string;
      expiresAt?: number;
    }
  ): Promise<ServerSession | null> {
    return this.adapter.updateSession(token, data);
  }

  /**
   * Check if a session is expired.
   */
  isExpired(session: ServerSession): boolean {
    return session.expiresAt <= Date.now();
  }
}
