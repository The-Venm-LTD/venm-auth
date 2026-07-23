import type { SDKConfig } from "../types/config";
import type { Session } from "../types/session";
import type { User } from "../types/user";
import type { StorageInterface } from "../utils/storage";
import { createStorage } from "../utils/storage";
import { AuthService } from "./auth-service";
import { createLogger } from "../utils/logger";
import { TOKEN_REFRESH_MARGIN_MS } from "../constants";

export class SessionService {
  private storage: StorageInterface;
  private authService: AuthService;
  private logger: ReturnType<typeof createLogger>;
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private config: SDKConfig;
  private onRefreshFailed: (() => void) | null;
  /**
   * Guards against concurrent refresh calls.
   * When a refresh is already in-flight, subsequent callers share the same
   * pending promise instead of racing and potentially corrupting each other's
   * token rotation (e.g., StrictMode double-init in React 18 development).
   */
  private refreshPromise: Promise<Session> | null = null;

  constructor(
    config: SDKConfig,
    authService: AuthService,
    onRefreshFailed?: () => void
  ) {
    this.config = config;
    this.authService = authService;
    this.storage = createStorage(config.storage);
    this.logger = createLogger(config.environment ?? "production");
    this.onRefreshFailed = onRefreshFailed ?? null;
  }

  async initialize(): Promise<{
    session: Session | null;
    user: User | null;
  }> {
    if (typeof window === "undefined") {
      return { session: null, user: null };
    }

    const session = this.storage.getSession();
    const user = this.storage.getUser();

    if (!session || !user) {
      return { session: null, user: null };
    }

    // Check if session is expired
    if (session.expiresAt <= Date.now()) {
      // Try to refresh if we have a refresh token
      if (session.refreshToken && this.config.autoRefresh) {
        try {
          const refreshed = await this.refreshSession();
          return { session: refreshed, user };
        } catch {
          // Refresh failed — clear everything
          this.clearSession();
          return { session: null, user: null };
        }
      }

      // No refresh token or auto-refresh disabled — clear
      this.clearSession();
      return { session: null, user: null };
    }

    // Session is still valid — schedule refresh
    if (this.config.autoRefresh) {
      this.scheduleRefresh(session.expiresAt);
    }

    return { session, user };
  }

  saveSession(session: Session, user: User): void {
    if (this.config.persistSession) {
      this.storage.setSession(session);
      this.storage.setUser(user);
    }

    if (this.config.autoRefresh) {
      this.scheduleRefresh(session.expiresAt);
    }
  }

  clearSession(): void {
    this.cancelRefresh();
    this.storage.clear();
  }

  async refreshSession(): Promise<Session> {
    // If a refresh is already in-flight, return the existing promise so
    // concurrent callers (e.g. StrictMode double-mount) share the same
    // result instead of racing and corrupting the token rotation.
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.executeRefresh().finally(() => {
      this.refreshPromise = null;
    });

    return this.refreshPromise;
  }

  private async executeRefresh(): Promise<Session> {
    const session = this.storage.getSession();
    if (!session?.refreshToken) {
      throw {
        code: "NO_REFRESH_TOKEN",
        message: "No refresh token available to refresh the session.",
      };
    }

    const response = await this.authService.refreshSession(
      session.refreshToken
    );
    const newSession = response.session;

    // Persist updated session
    if (this.config.persistSession) {
      this.storage.setSession(newSession);
    }

    // Schedule next refresh
    if (this.config.autoRefresh) {
      this.scheduleRefresh(newSession.expiresAt);
    }

    return newSession;
  }

  getSession(): Session | null {
    return this.storage.getSession();
  }

  getUser(): User | null {
    return this.storage.getUser();
  }

  private scheduleRefresh(expiresAt: number): void {
    this.cancelRefresh();

    const delay = expiresAt - Date.now() - TOKEN_REFRESH_MARGIN_MS;
    if (delay <= 0) return;

    this.logger.debug(
      `Scheduling token refresh in ${Math.round(delay / 1000)}s`
    );

    this.refreshTimer = setTimeout(async () => {
      try {
        this.logger.debug("Auto-refreshing token...");
        await this.refreshSession();
        this.logger.debug("Token refreshed successfully");
      } catch (error) {
        this.logger.error("Auto-refresh failed:", error);
        this.onRefreshFailed?.();
      }
    }, delay);
  }

  cancelRefresh(): void {
    if (this.refreshTimer !== null) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }
}
