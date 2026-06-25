import type { ProviderType } from "../types/auth";
import type { SDKConfig } from "../types/config";
import { DEFAULT_BASE_URLS, DEFAULT_TIMEOUT } from "../constants";

export class ConfigError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "ConfigError";
    this.code = code;
  }
}

export function validateConfig(config: Partial<SDKConfig>): SDKConfig {
  // Resolve environment early
  const environment = config.environment ?? "production";

  if (
    config.environment !== undefined &&
    config.environment !== "production" &&
    config.environment !== "development"
  ) {
    throw new ConfigError(
      "INVALID_ENVIRONMENT",
      `SDKConfig.environment must be "production" or "development", got "${config.environment}"`
    );
  }

  // Validate apiUrl if provided
  if (config.apiUrl !== undefined) {
    try {
      new URL(config.apiUrl);
    } catch {
      throw new ConfigError(
        "INVALID_API_URL",
        `SDKConfig.apiUrl must be a valid URL: "${config.apiUrl}"`
      );
    }
  }

  return {
    apiUrl: config.apiUrl ?? DEFAULT_BASE_URLS[environment],
    environment,
    autoRefresh: config.autoRefresh ?? true,
    persistSession: config.persistSession ?? true,
    storage: config.storage ?? "localStorage",
    timeout: config.timeout ?? DEFAULT_TIMEOUT,
    redirectUri: config.redirectUri,
    oauth: config.oauth,
  };
}

export function validateProvider(
  provider: string
): asserts provider is ProviderType {
  if (provider !== "google" && provider !== "facebook") {
    throw new ConfigError(
      "INVALID_PROVIDER",
      `Provider must be "google" or "facebook", got "${provider}"`
    );
  }
}
