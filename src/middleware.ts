import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig, isPublicPath } from "@/lib/auth.config";
import { isEmailAllowed, isLoginRequired } from "@/lib/env";

const { auth } = NextAuth(authConfig);

export default auth((request) => {
  const pathname = request.nextUrl.pathname;
  const response = NextResponse.next();
  response.headers.set("x-pathname", pathname);

  if (!isLoginRequired() || isPublicPath(pathname)) {
    return response;
  }

  if (isEmailAllowed(request.auth?.user?.email)) {
    return response;
  }

  const login = new URL("/login", request.nextUrl.origin);
  if (pathname !== "/") {
    login.searchParams.set("callbackUrl", pathname);
  }
  return NextResponse.redirect(login);
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|brand/|demo/|uploads/).*)",
  ],
};
