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
}

// ── Defaults ────────────────────────────────────────────────────────
// Both the JWT exp claim and the expiresAt field derive from the same
// constants to stay in sync. Change only these values to adjust expiry.

const ACCESS_TOKEN_EXPIRY_MINUTES = 15;
const REFRESH_TOKEN_EXPIRY_DAYS = 30;

const ACCESS_TOKEN_EXPIRY = `${ACCESS_TOKEN_EXPIRY_MINUTES}m`;
const REFRESH_TOKEN_EXPIRY = `${REFRESH_TOKEN_EXPIRY_DAYS}d`;

// ── Token Generation ────────────────────────────────────────────────

/**
 * Generate an access token (short-lived, 15 minutes).
 */
export async function generateAccessToken(
  payload: TokenPayload,
  secret: string
): Promise<string> {
  const secretKey = new TextEncoder().encode(secret);

  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_EXPIRY)
    .setSubject(payload.sub)
    .sign(secretKey);
}

/**
 * Generate a refresh token (long-lived, 30 days).
 */
export async function generateRefreshToken(
  payload: TokenPayload,
  secret: string
): Promise<string> {
  const secretKey = new TextEncoder().encode(secret);

  return new SignJWT({ ...payload, type: "refresh" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(REFRESH_TOKEN_EXPIRY)
    .setSubject(payload.sub)
    .sign(secretKey);
}

/**
 * Generate both access and refresh tokens in one call.
 * Returns the tokens along with the absolute expiry timestamp (ms).
 * The expiresAt is derived from the same ACCESS_TOKEN_EXPIRY_MINUTES
 * constant used for the JWT's exp claim, ensuring they stay in sync.
 */
export async function generateTokens(
  payload: TokenPayload,
  secret: string
): Promise<GeneratedTokens> {
  const [accessToken, refreshToken] = await Promise.all([
    generateAccessToken(payload, secret),
    generateRefreshToken(payload, secret),
  ]);

  const expiresAt = Date.now() + ACCESS_TOKEN_EXPIRY_MINUTES * 60 * 1000;

  return { accessToken, refreshToken, expiresAt };
}
