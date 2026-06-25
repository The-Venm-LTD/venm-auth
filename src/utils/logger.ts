export interface Logger {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

export function createLogger(
  environment: "production" | "development"
): Logger {
  const prefix = "[venm-auth]";

  function formatArgs(args: unknown[]): unknown[] {
    return [prefix, ...args];
  }

  return {
    debug(...args: unknown[]): void {
      if (environment === "development") {
        console.debug(...formatArgs(args));
      }
    },

    info(...args: unknown[]): void {
      if (environment === "development") {
        console.info(...formatArgs(args));
      }
    },

    warn(...args: unknown[]): void {
      console.warn(...formatArgs(args));
    },

    error(...args: unknown[]): void {
      console.error(...formatArgs(args));
    },
  };
}
