import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";


export function middleware(request: NextRequest) {
  const session = request.cookies.get("mrms_session");
  const pathname = request.nextUrl.pathname;

  // (dashboard) 경로 (= /mrt 등) 보호
  if (pathname.startsWith("/mrt")) {
    if (!session) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  // 이미 로그인된 상태로 /login 가면 /mrt로
  if (pathname === "/login" && session) {
    return NextResponse.redirect(new URL("/mrt", request.url));
  }

  return NextResponse.next();
}


export const config = {
  matcher: ["/mrt/:path*", "/login"],
};
