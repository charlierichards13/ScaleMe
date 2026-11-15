import { NextResponse, type NextRequest } from "next/server";
import { requirePrivateAi } from "@/lib/private-ai/access";

/** Protect BOTH paid endpoints, including callers that bypass the browser UI. */
export function proxy(request: NextRequest) {
  const isAiRoute = request.nextUrl.pathname !== "/api/practice/access";
  if (isAiRoute && request.nextUrl.searchParams.get("demo") === "true") {
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
  matcher: ["/api/fit/analyze/:path*", "/api/interview/next/:path*", "/api/practice/access/:path*"],
};
