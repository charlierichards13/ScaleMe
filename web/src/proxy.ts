import { NextResponse, type NextRequest } from "next/server";
import { requirePrivateAi } from "@/lib/private-ai/access";

/** Protect every paid endpoint, including callers that bypass the browser UI. */
export function proxy(request: NextRequest) {
  const hasFreeDemo = /^\/api\/(?:fit\/analyze|interview\/next)\/?$/.test(request.nextUrl.pathname);
  if (hasFreeDemo && request.nextUrl.searchParams.get("demo") === "true") {
    return NextResponse.next(); // Those handlers ignore the body and never call AWS.
  }
  const rejected = requirePrivateAi(request);
  if (rejected) return rejected;
  const response = NextResponse.next();
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Vary", "Authorization");
  return response;
}

export const config = {
  matcher: ["/api/fit/analyze/:path*", "/api/interview/next/:path*", "/api/practice/access/:path*", "/api/coach/message/:path*"],
};
