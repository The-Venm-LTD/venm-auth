import axios from "axios";

// ── Types ───────────────────────────────────────────────────────────

export interface GoogleOneTapTokenPayload {
  /** Google account ID (sub claim) */
  sub: string;
  /** Email address */
  email: string;
  /** Whether the email is verified */
  email_verified: boolean;
  /** Full display name */
  name: string;
  /** Given (first) name */
  given_name: string;
  /** Family (last) name */
  family_name: string;
  /** Profile picture URL */
  picture: string;
  /** Locale (e.g., "en") */
  locale: string;
  /** Issuer (always "https://accounts.google.com") */
  iss: string;
  /** Audience (your app's client ID) */
  aud: string;
  /** Issued-at timestamp */
  iat: number;
  /** Expiration timestamp */
  exp: number;
}

export interface VerifyOneTapTokenResult {
  payload: GoogleOneTapTokenPayload;
}

// ── Token Verification ──────────────────────────────────────────────

/**
 * Verify a Google ID token from the One Tap sign-in flow.
 *
 * Uses Google's tokeninfo endpoint to verify the token's signature
 * and validate the audience (client ID).
 *
 * Accepts one or more valid client IDs so that Android, iOS, and Web
 * One Tap tokens can all be verified against the same endpoint. On
 * native Android/iOS, the ID token's `aud` claim is typically set to
 * the platform-specific client ID; on Web it uses the default `clientId`.
 *
 * @param idToken - The Google ID token (JWT) from the One Tap sign-in
 * @param clientIds - One or more allowed Google OAuth client IDs
 * @returns The verified token payload
 * @throws If the token is invalid, expired, or the audience doesn't match
 */
export async function verifyGoogleOneTapToken(
  idToken: string,
  clientIds: string | string[]
): Promise<GoogleOneTapTokenPayload> {
  if (!idToken) {
    throw new Error("Google One Tap: idToken is required");
  }

  // Normalize to an array and deduplicate
  const allowedAudiences = Array.isArray(clientIds) ? [...new Set(clientIds)] : [clientIds];

  if (allowedAudiences.length === 0 || !allowedAudiences[0]) {
    throw new Error("Google One Tap: at least one valid client ID is required");
  }

  console.log(`[venm-auth] Google One Tap: verifying ID token (allowed audiences: ${allowedAudiences.length})`);

  try {
    const response = await axios.post<GoogleOneTapTokenPayload>(
      "https://oauth2.googleapis.com/tokeninfo",
      null,
      {
        params: { id_token: idToken },
        headers: {
          "Accept": "application/json",
        },
        timeout: 10_000,
      }
    );

    const payload = response.data;

    // Validate the audience (must match one of our client IDs)
    if (!allowedAudiences.includes(payload.aud)) {
      throw new Error(
        `Google One Tap: token audience mismatch. Expected one of [${allowedAudiences.join(", ")}], got "${payload.aud}"`
      );
    }

    console.log(
      `[venm-auth] Google One Tap: token verified for user ${payload.sub}, email=${payload.email}`
    );

    return payload;
  } catch (err) {
    if (axios.isAxiosError(err) && err.response) {
      console.error(
        `[venm-auth] Google One Tap: token verification failed with status ${err.response.status}`,
        err.response.data
      );
      throw new Error(
        `Google One Tap: token verification failed — ${err.response.data?.error ?? err.message}`
      );
    }
    console.error(`[venm-auth] Google One Tap: token verification error`, err);
    throw err;
  }
}
