import type { PopupOptions } from "../types/responses";
import type { AuthError } from "../types/auth";
import {
  DEFAULT_POPUP_WIDTH,
  DEFAULT_POPUP_HEIGHT,
  POPUP_MESSAGE_CHANNEL,
  POPUP_TIMEOUT_MS,
  DEFAULT_BASE_URLS,
} from "../constants";
import { createLogger } from "../utils/logger";
import type { SDKConfig } from "../types/config";

interface PopupResult {
  code: string;
  state: string;
}

export class PopupManager {
  private popup: Window | null = null;
  private logger: ReturnType<typeof createLogger>;
  private expectedOrigin: string;
  private baseUrl: string;
  private cleanupFns: Array<() => void> = [];

  constructor(config: SDKConfig) {
    this.logger = createLogger(config.environment ?? "production");
    // The expected origin is the origin of the API server (developer's Express app)
    const apiUrl = config.apiUrl ?? DEFAULT_BASE_URLS.production;
    try {
      const url = new URL(apiUrl);
      this.expectedOrigin = url.origin;
      this.baseUrl = apiUrl.replace(/\/+$/, "");
    } catch {
      // If apiUrl is a relative path (production), accept any origin
      this.expectedOrigin = "*";
      // Resolve relative URL against the current page origin
      this.baseUrl = typeof window !== "undefined"
        ? `${window.location.origin}${apiUrl}`.replace(/\/+$/, "")
        : apiUrl.replace(/\/+$/, "");
    }
  }

  async open(url: string, options?: PopupOptions): Promise<PopupResult> {
    const width = options?.width ?? DEFAULT_POPUP_WIDTH;
    const height = options?.height ?? DEFAULT_POPUP_HEIGHT;

    const left = Math.max(
      0,
      Math.round(window.screenX + (window.outerWidth - width) / 2)
    );
    const top = Math.max(
      0,
      Math.round(window.screenY + (window.outerHeight - height) / 2)
    );

    const features = [
      `width=${width}`,
      `height=${height}`,
      `left=${left}`,
      `top=${top}`,
      "menubar=no",
      "toolbar=no",
      "location=no",
      "status=no",
      "scrollbars=yes",
      "resizable=yes",
    ].join(",");

    this.popup = window.open(url, "_blank", features);

    if (!this.popup) {
      throw {
        code: "POPUP_BLOCKED",
        message:
          "Popup was blocked by the browser. Please allow popups for this site.",
      } satisfies AuthError;
    }

    return new Promise<PopupResult>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.cleanup();
        reject({
          code: "POPUP_TIMEOUT",
          message: "Popup authentication timed out.",
        } satisfies AuthError);
      }, POPUP_TIMEOUT_MS);

      const authSessionId = options?.authSessionId;

      // ── Server-side result polling (handles COOP-severed popups) ──
      //
      // When the OAuth provider (e.g. Google) uses Cross-Origin-Opener-Policy
      // headers, window.opener is severed and postMessage won't work. The
      // OAuth callback stores the auth code on the server; we poll for it.
      let pollInterval: ReturnType<typeof setInterval> | null = null;

      if (authSessionId) {
        const resultUrl = `${this.baseUrl}/result/${encodeURIComponent(authSessionId)}`;
        const interval = setInterval(async () => {
          try {
            const response = await fetch(resultUrl, {
              method: "GET",
              headers: { "Accept": "application/json" },
              signal: AbortSignal.timeout(5_000),
            });

            if (response.ok) {
              const data = (await response.json()) as {
                status?: "PENDING";
                code?: string;
                state?: string;
                error?: string;
              };

              if (data.status === "PENDING") {
                // Result not yet stored — poll again
                return;
              }

              if (data.error) {
                clearTimeout(timeoutId);
                clearInterval(interval);
                this.cleanup();
                reject({
                  code: "PROVIDER_ERROR",
                  message: data.error,
                } satisfies AuthError);
                return;
              }

              if (data.code && data.state) {
                clearTimeout(timeoutId);
                clearInterval(interval);
                this.cleanup();
                resolve({ code: data.code, state: data.state });
              }
            }
          } catch {
            // Network errors are transient — poll again on next interval
          }
        }, 2000);
        pollInterval = interval;
      }

      // ── Post-message listener (fast path for non-COOP providers) ──
      const messageHandler = (event: MessageEvent) => {
        if (this.expectedOrigin !== "*" && event.origin !== this.expectedOrigin) {
          this.logger.warn(
            `Ignoring message from unexpected origin: ${event.origin}`
          );
          return;
        }

        const data = event.data;
        if (!data || data.channel !== POPUP_MESSAGE_CHANNEL) {
          return;
        }

        if (data.error) {
          clearTimeout(timeoutId);
          if (pollInterval) clearInterval(pollInterval);
          this.cleanup();
          reject({
            code: "PROVIDER_ERROR",
            message: data.error_description ?? data.error ?? "OAuth provider error",
          } satisfies AuthError);
          return;
        }

        if (data.code && data.state) {
          clearTimeout(timeoutId);
          if (pollInterval) clearInterval(pollInterval);
          this.cleanup();
          resolve({ code: data.code, state: data.state });
        }
      };

      window.addEventListener("message", messageHandler);
      this.cleanupFns.push(() => {
        window.removeEventListener("message", messageHandler);
      });
      this.cleanupFns.push(() => clearTimeout(timeoutId));
      if (pollInterval) {
        this.cleanupFns.push(() => clearInterval(pollInterval));
      }
    });
  }

  close(): void {
    try {
      this.popup?.close();
    } catch {
      // Popup may already be closed
    }
    this.cleanup();
  }

  private cleanup(): void {
    for (const fn of this.cleanupFns) {
      try {
        fn();
      } catch {
        // Ignore cleanup errors
      }
    }
    this.cleanupFns = [];
    this.popup = null;
  }
}
