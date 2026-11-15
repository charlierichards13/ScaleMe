import { requirePrivateAi } from "@/lib/private-ai/access";

/** Explicit, free access check: no AWS configuration lookup, quota use, or model call. */
export async function POST(request: Request) {
  const rejected = requirePrivateAi(request);
  return rejected ?? Response.json({ available: true }, {
    headers: { "Cache-Control": "no-store", Vary: "Authorization" },
  });
}
