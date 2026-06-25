import { jwtVerify, type JWTPayload } from "jose";

// ── Token Payload Types ─────────────────────────────────────────────

export interface TokenPayload extends JWTPayload {
  sub: string;
  email?: string;
  provider?: string;
  type?: "access" | "refresh";
}

export interface VerifiedToken {
  payload: TokenPayload;
  protectedHeader: { alg: string };
}

// ── Token Verification ──────────────────────────────────────────────

/**
 * Verify a JWT token and return its decoded payload.
 * Throws if the token is invalid, expired, or has a bad signature.
 */
export async function verifyToken(
  token: string,
  secret: string
): Promise<VerifiedToken> {
  const secretKey = new TextEncoder().encode(secret);

  const { payload, protectedHeader } = await jwtVerify(token, secretKey, {
    algorithms: ["HS256"],
  });

  return {
    payload: payload as TokenPayload,
    protectedHeader: protectedHeader as { alg: string },
  };
}

/**
 * Verify a token and extract the subject (user ID).
 * Convenience wrapper for the common case.
 */
export async function getSubjectFromToken(
  token: string,
  secret: string
): Promise<string> {
  const { payload } = await verifyToken(token, secret);
  if (!payload.sub) {
    throw new Error("Token payload missing subject (sub)");
  }
  return payload.sub;
}

/**
 * Verify a refresh token specifically.
 * Checks that the token type is "refresh".
 */
export async function verifyRefreshToken(
  token: string,
  secret: string
): Promise<VerifiedToken> {
  const result = await verifyToken(token, secret);

  if (result.payload.type !== "refresh") {
    throw new Error("Token is not a refresh token");
  }

  return result;
}
