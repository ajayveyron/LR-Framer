import { NextResponse } from "next/server";

import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/onboarding(.*)",
  "/select-workspace(.*)",
  "/api/onboarding(.*)",
  "/api/posts(.*)",
  "/api/ai(.*)",
  "/api/meta/fields(.*)",
  "/api/uploads(.*)",
  "/api/billing(.*)",
  "/api/staged-items(.*)",
  "/api/notion(.*)",
  "/api/dashboard(.*)",
]);

function isClerkConfigured() {
  return Boolean(
    process.env.CLERK_SECRET_KEY?.trim() &&
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim(),
  );
}

export default isClerkConfigured()
  ? clerkMiddleware(async (auth, request) => {
      if (isProtectedRoute(request)) {
        await auth.protect();
      }
    })
  : function middleware() {
      return NextResponse.next();
    };

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)", "/", "/(api|trpc)(.*)"],
};
