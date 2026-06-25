import type { SDKConfig } from "../types/config";
import type { Session } from "../types/session";
import type { AuthError } from "../types/auth";
import { DEFAULT_BASE_URLS } from "../constants";
import { createLogger } from "../utils/logger";

type GetSessionFn = () => Session | null;

export class HttpClient {
  private apiUrl: string;
  private timeout: number;
  private logger: ReturnType<typeof createLogger>;
  private getSession: GetSessionFn;

  constructor(config: SDKConfig, getSession: GetSessionFn) {
    this.apiUrl = config.apiUrl ?? DEFAULT_BASE_URLS.production;
    this.timeout = config.timeout ?? 10_000;
    this.logger = createLogger(config.environment ?? "production");
    this.getSession = getSession;
  }

  async request<T>(
    method: string,
    path: string,
    options?: {
      body?: unknown;
      skipAuth?: boolean;
      signal?: AbortSignal;
    }
  ): Promise<T> {
    const url = `${this.apiUrl}${path}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (!options?.skipAuth) {
      const session = this.getSession();
      if (session?.accessToken) {
        headers["Authorization"] = `Bearer ${session.accessToken}`;
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    const signal = options?.signal
      ? anySignal([controller.signal, options.signal])
      : controller.signal;

    try {
      this.logger.debug(`[HTTP] ${method} ${path}`);

      const response = await fetch(url, {
        method,
        headers,
        body: options?.body ? JSON.stringify(options.body) : undefined,
        signal,
      });

      if (!response.ok) {
        const errorBody = await this.parseErrorBody(response);
        const authError = this.createAuthError(response.status, errorBody);
        throw authError;
      }

      const data = (await response.json()) as T;
      return data;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw {
          code: "TIMEOUT",
          message: `Request timed out after ${this.timeout}ms`,
          status: 408,
        } satisfies AuthError;
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async parseErrorBody(response: Response): Promise<string | null> {
    try {
      const body = await response.json() as Record<string, unknown>;
      const error = body.error as Record<string, unknown> | undefined;
      return (error?.message as string) ?? response.statusText;
    } catch {
      return response.statusText;
    }
  }

  private createAuthError(
    status: number,
    errorMessage: string | null
  ): AuthError {
    const codeMap: Record<number, string> = {
      400: "BAD_REQUEST",
      401: "UNAUTHORIZED",
      403: "FORBIDDEN",
      404: "NOT_FOUND",
      429: "RATE_LIMITED",
      500: "SERVER_ERROR",
    };

    return {
      code: codeMap[status] ?? "UNKNOWN_ERROR",
      message: errorMessage ?? `HTTP ${status}`,
      status,
    };
  }
}

function anySignal(signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();

  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      return controller.signal;
    }
    signal.addEventListener("abort", () => controller.abort(signal.reason), {
      once: true,
    });
  }

  return controller.signal;
}
