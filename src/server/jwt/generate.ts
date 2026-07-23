import { SignJWT } from "jose";

// ── Token Payload Types ─────────────────────────────────────────────

export interface TokenPayload {
  sub: string;
  email?: string;
  provider?: string;
}

export interface GeneratedTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  /** Absolute timestamp (ms) when the refresh token expires. Used for DB TTL cleanup. */
  refreshExpiresAt: number;
}

export interface TokenExpiryOptions {
  /** Access token lifetime string (e.g. "15m", "30m", "1h"). Default: "15m". */
  accessTokenExpiresIn?: string;
  /** Refresh token lifetime string (e.g. "7d", "30d"). Default: "30d". */
  refreshTokenExpiresIn?: string;
}

// ── Defaults ────────────────────────────────────────────────────────

const DEFAULT_ACCESS_TOKEN_EXPIRY = "15m";
const DEFAULT_REFRESH_TOKEN_EXPIRY = "30d";

// ── Duration Parsing ────────────────────────────────────────────────

/**
 * Parse a human-readable duration string into milliseconds and a jose-compatible
 * expiration string. Supports formats: "15m" (minutes), "2h" (hours), "7d" (days).
 */
export function parseDuration(duration: string): {
  ms: number;
  jose: string;
} {
  const match = duration.match(/^(\d+)\s*(m|min|h|d|day|days)?$/);
  if (!match || !match[1]) {
    throw new Error(`Invalid duration format: "${duration}". Use e.g. "15m", "2h", "7d".`);
  }

  const value = parseInt(match[1], 10);
  const unit = match[2] || "m";

  switch (unit) {
    case "m":
    case "min":
      return { ms: value * 60 * 1000, jose: `${value}m` };
    case "h":
      return { ms: value * 60 * 60 * 1000, jose: `${value}h` };
    case "d":
    case "day":
    case "days":
      return { ms: value * 24 * 60 * 60 * 1000, jose: `${value}d` };
    default:
      throw new Error(`Unknown duration unit: "${unit}". Use "m", "h", or "d".`);
  }
}

// ── Token Generation ────────────────────────────────────────────────

/**
 * Generate an access token (short-lived, defaults to 15 minutes).
 */
export async function generateAccessToken(
  payload: TokenPayload,
  secret: string,
  expiresIn: string = DEFAULT_ACCESS_TOKEN_EXPIRY
): Promise<string> {
  const secretKey = new TextEncoder().encode(secret);
  const { jose } = parseDuration(expiresIn);

  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(jose)
    .setSubject(payload.sub)
    .sign(secretKey);
}

/**
 * Generate a refresh token (long-lived, defaults to 30 days).
 */
export async function generateRefreshToken(
  payload: TokenPayload,
  secret: string,
  expiresIn: string = DEFAULT_REFRESH_TOKEN_EXPIRY
): Promise<string> {
  const secretKey = new TextEncoder().encode(secret);
  const { jose } = parseDuration(expiresIn);

  return new SignJWT({ ...payload, type: "refresh" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(jose)
    .setSubject(payload.sub)
    .sign(secretKey);
}

/**
 * Generate both access and refresh tokens in one call.
 * Returns the tokens along with the absolute expiry timestamp (ms).
 * The expiresAt is derived from the same duration used for the JWT's
 * exp claim for the access token, ensuring they stay in sync.
 */
export async function generateTokens(
  payload: TokenPayload,
  secret: string,
  options?: TokenExpiryOptions
): Promise<GeneratedTokens> {
  const accessTokenExpiry = options?.accessTokenExpiresIn ?? DEFAULT_ACCESS_TOKEN_EXPIRY;
  const refreshTokenExpiry = options?.refreshTokenExpiresIn ?? DEFAULT_REFRESH_TOKEN_EXPIRY;

  const [accessToken, refreshToken] = await Promise.all([
    generateAccessToken(payload, secret, accessTokenExpiry),
    generateRefreshToken(payload, secret, refreshTokenExpiry),
  ]);

  const { ms: accessTokenMs } = parseDuration(accessTokenExpiry);
  const { ms: refreshTokenMs } = parseDuration(refreshTokenExpiry);
  const expiresAt = Date.now() + accessTokenMs;
  const refreshExpiresAt = Date.now() + refreshTokenMs;

  return { accessToken, refreshToken, expiresAt, refreshExpiresAt };
}
