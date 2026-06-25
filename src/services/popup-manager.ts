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
  private cleanupFns: Array<() => void> = [];

  constructor(config: SDKConfig) {
    this.logger = createLogger(config.environment ?? "production");
    // The expected origin is the origin of the API server (developer's Express app)
    const apiUrl = config.apiUrl ?? DEFAULT_BASE_URLS.production;
    try {
      this.expectedOrigin = new URL(apiUrl).origin;
    } catch {
      // If apiUrl is a relative path (production), accept any origin
      this.expectedOrigin = "*";
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

      const closeInterval = setInterval(() => {
        try {
          if (this.popup?.closed) {
            clearInterval(closeInterval);
            clearTimeout(timeoutId);
            this.cleanup();
            reject({
              code: "POPUP_CLOSED",
              message: "Authentication popup was closed by the user.",
            } satisfies AuthError);
          }
        } catch {
          // Cross-Origin-Opener-Policy (COOP) can sever the relationship
          // with the popup, making .closed inaccessible. Skip this poll
          // cycle — the popup will return to our origin on completion, or
          // the overall timeout will fire as a safety net.
        }
      }, 200);

      const messageHandler = (event: MessageEvent) => {
        // Validate origin (skip if expected origin is wildcard)
        if (this.expectedOrigin !== "*" && event.origin !== this.expectedOrigin) {
          this.logger.warn(
            `Ignoring message from unexpected origin: ${event.origin}`
          );
          return;
        }

        const data = event.data;
        if (
          !data ||
          data.channel !== POPUP_MESSAGE_CHANNEL
        ) {
          return;
        }

        if (data.error) {
          clearTimeout(timeoutId);
          clearInterval(closeInterval);
          this.cleanup();
          reject({
            code: "PROVIDER_ERROR",
            message: data.error_description ?? data.error ?? "OAuth provider error",
          } satisfies AuthError);
          return;
        }

        if (data.code && data.state) {
          clearTimeout(timeoutId);
          clearInterval(closeInterval);
          this.cleanup();
          resolve({ code: data.code, state: data.state });
        }
      };

      window.addEventListener("message", messageHandler);
      this.cleanupFns.push(() => {
        window.removeEventListener("message", messageHandler);
      });
      this.cleanupFns.push(() => clearTimeout(timeoutId));
      this.cleanupFns.push(() => clearInterval(closeInterval));
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
