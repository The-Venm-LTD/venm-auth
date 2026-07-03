// ── Types ───────────────────────────────────────────────────────────

interface OauthResultData {
  code?: string;
  state: string;
  error?: string;
  createdAt: number;
}

// ── OAuth Result Store ──────────────────────────────────────────────

/**
 * In-memory store for temporary OAuth authorization results.
 *
 * The OAuth flow uses two keys:
 *   state → authSessionId mapping (set when the initial request comes in)
 *   authSessionId → result (set when the callback arrives)
 *
 * The main page polls GET /result/:authSessionId to retrieve the code,
 * which works even when Google's COOP headers have severed the
 * window.opener relationship.
 *
 * Entries expire after `ttlMs` (default 5 minutes) via periodic cleanup.
 */
export class OauthResultStore {
  /** authSessionId → { code?, state, error?, createdAt } */
  private results = new Map<string, OauthResultData>();

  /** state → authSessionId lookup for the callback handler */
  private stateIndex = new Map<string, string>();

  private ttl: number;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(ttlMs: number = 300_000) {
    this.ttl = ttlMs;
  }

  /**
   * Start the periodic cleanup timer.
   * Call this once after construction (separate from constructor so
   * instantiating in test or SSR does not leak a timer).
   */
  startCleanup(): void {
    if (this.cleanupTimer) return;
    this.cleanupTimer = setInterval(() => this.cleanup(), 60_000);
  }

  /**
   * Stop the cleanup timer. Useful for tests and graceful shutdown.
   */
  stopCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Called when the initial OAuth redirect request arrives.
   * Associates the OAuth `state` with the client-generated `authSessionId`.
   */
  setStateMapping(state: string, authSessionId: string): void {
    this.stateIndex.set(state, authSessionId);
  }

  /**
   * Called when the OAuth provider redirects back to the callback handler.
   * Looks up the `authSessionId` from the `state` and stores the auth code.
   */
  storeResult(state: string, code: string): void {
    const authSessionId = this.stateIndex.get(state);
    if (authSessionId) {
      this.results.set(authSessionId, { code, state, createdAt: Date.now() });
      this.stateIndex.delete(state);
    }
  }

  /**
   * Called when the OAuth provider returns an error (e.g. user denies consent).
   * Ensures the main page receives the error promptly instead of timing out.
   */
  storeError(state: string, error: string): void {
    const authSessionId = this.stateIndex.get(state);
    if (authSessionId) {
      this.results.set(authSessionId, { error, state, createdAt: Date.now() });
      this.stateIndex.delete(state);
    }
  }

  /**
   * Called by the main page's polling loop.
   * Returns the stored result and removes it (one-time retrieval).
   * Returns `null` if the result is not yet available or has expired.
   */
  getResult(authSessionId: string): { code?: string; state: string; error?: string } | null {
    const result = this.results.get(authSessionId);
    if (!result) return null;

    if (Date.now() - result.createdAt > this.ttl) {
      this.results.delete(authSessionId);
      return null;
    }

    this.results.delete(authSessionId);
    return { code: result.code, state: result.state, error: result.error };
  }

  /**
   * Retrieve an authSessionId by state (for error recovery).
   */
  getAuthSessionIdByState(state: string): string | undefined {
    return this.stateIndex.get(state);
  }

  // ── Private ──────────────────────────────────────────────────────

  private cleanup(): void {
    const now = Date.now();
    for (const [key, value] of this.results) {
      if (now - value.createdAt > this.ttl) {
        this.results.delete(key);
      }
    }
  }
}
