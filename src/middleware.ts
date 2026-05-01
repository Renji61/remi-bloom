import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { nextUrl } = req;
  const pathname = nextUrl.pathname;
  const isLoggedIn = !!req.auth;

  // Public routes that do not require authentication.
  // /api/auth/* are NextAuth's own endpoints (sign-in callback, session, etc.)
  // and must never be blocked.
  const publicPaths = [
    "/login",
    "/register",
    "/_next/",
    "/api/auth/",
    "/favicon",
    "/sw.js",
    "/manifest.webmanifest",
    "/workbox-",
    "/icons/",
    "/offline",
  ];
  const isPublic = publicPaths.some((p) => pathname.startsWith(p));

  // Redirect HTTP to HTTPS in production
  if (
    process.env.NODE_ENV === "production" &&
    req.headers.get("x-forwarded-proto") !== "https" &&
    !req.headers.get("host")?.startsWith("localhost")
  ) {
    return NextResponse.redirect(
      `https://${req.headers.get("host")}${pathname}${nextUrl.search}`,
      301
    );
  }

  // Nonce for inline script/style hashing in CSP
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");

  const cspHeader = [
    `default-src 'self'`,
    `script-src 'self' 'unsafe-inline' 'unsafe-eval'`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' https: blob: data:`,
    `font-src 'self'`,
    `connect-src 'self' https: wss:`,
    `frame-src 'self'`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `report-uri /api/csp-report`,
  ].join("; ");

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  response.headers.set("Content-Security-Policy", cspHeader);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // --- Auth guard (runs before the response is returned) ---
  // Root path: redirect authenticated users to /home, unauthenticated to /login
  if (pathname === "/") {
    return isLoggedIn
      ? NextResponse.redirect(new URL("/home", nextUrl))
      : NextResponse.redirect(new URL("/login", nextUrl));
  }

  // Block unauthenticated access to non-public routes
  if (!isLoggedIn && !isPublic) {
    return NextResponse.redirect(new URL("/login", nextUrl));
  }

  return response;
});

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico|sw\\.js|icons/|manifest\\.json).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
