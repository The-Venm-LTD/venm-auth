// ── Popup Message Channel ──────────────────────────────────────────

export const POPUP_CHANNEL = "venm_auth_response";

// ── Callback HTML Template ──────────────────────────────────────────

/**
 * Build the HTML page served after an OAuth provider redirects back.
 * The page uses postMessage to send the authorization code to the popup
 * opener, then closes itself.
 *
 * @param code  The OAuth authorization code (empty string on error).
 * @param error Optional error message to display and send.
 * @param state The OAuth state parameter for CSRF verification.
 */
export function callbackHtml(code: string, error?: string, state?: string): string {
  if (error) {
    const escapedError = JSON.stringify(error);
    return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Sign-in error</title></head>
<body>
<script>
  (function() {
    var targetOrigin = "*";
    try { if (window.opener && window.opener.origin) { targetOrigin = window.opener.origin; } } catch(e) {}
    window.opener.postMessage({ channel: "${POPUP_CHANNEL}", error: ${escapedError} }, targetOrigin);
    window.close();
  })();
</script>
<p>Sign-in error. Please close this window.</p>
</body>
</html>`;
  }

  const escapedCode = JSON.stringify(code);
  const escapedState = state ? JSON.stringify(state) : "null";

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Signing in...</title></head>
<body>
<script>
  (function() {
    var targetOrigin = "*";
    try { if (window.opener && window.opener.origin) { targetOrigin = window.opener.origin; } } catch(e) {}
    window.opener.postMessage({
      channel: "${POPUP_CHANNEL}",
      code: ${escapedCode},
      state: ${escapedState}
    }, targetOrigin);
    window.close();
  })();
</script>
<p>Signing in... Please close this window if it doesn't close automatically.</p>
</body>
</html>`;
}
