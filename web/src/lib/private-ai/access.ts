// Server-only private-preview access. Never import into a client component.
import { createHash, timingSafeEqual } from "node:crypto";

const headers = { "Cache-Control": "no-store", Vary: "Authorization" };
const deny = (code: string, message: string, status: number) =>
  Response.json({ error: { code, message, retryable: false } }, { status, headers });

/** No cookies, accounts or persistence. The owner distributes/revokes this private-preview code. */
export function requirePrivateAi(request: Request, env: Record<string, string | undefined> = process.env): Response | null {
  const expected = env.SCALEME_PRIVATE_AI_TOKEN;
  if (env.FIT_LIVE_AI_ENABLED?.trim().toLowerCase() !== "true" ||
      !expected || !/^[A-Za-z0-9_-]{32,256}$/.test(expected)) {
    return deny("AI_UNAVAILABLE", "Private live AI is not enabled on this server.", 503);
  }
  // Pin the browser-facing origin behind TLS-terminating proxies. Never derive an
  // authorization allowlist from caller-controlled Host/Forwarded headers.
  const configuredOrigin = env.SCALEME_PRIVATE_AI_ORIGIN;
  if ((env.RAILWAY_ENVIRONMENT_ID && !configuredOrigin) ||
      (configuredOrigin !== undefined && !validOrigin(configuredOrigin))) {
    return deny("AI_UNAVAILABLE", "Private live AI is not enabled on this server.", 503);
  }
  const origin = request.headers.get("Origin");
  if ((origin && origin !== (configuredOrigin ?? new URL(request.url).origin)) ||
      request.headers.get("Sec-Fetch-Site") === "cross-site") {
    return deny("PRIVATE_ACCESS_REQUIRED", "Open the private workspace on its own origin.", 403);
  }
  const supplied = request.headers.get("Authorization")?.match(/^Bearer ([A-Za-z0-9_-]{32,256})$/)?.[1];
  const digest = (value: string) => createHash("sha256").update(value).digest();
  if (!supplied || !timingSafeEqual(digest(supplied), digest(expected))) {
    return deny("PRIVATE_ACCESS_REQUIRED", "A valid private access code is required.", 401);
  }
  return null;
}

function validOrigin(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.origin === value;
  } catch {
    return false;
  }
}
