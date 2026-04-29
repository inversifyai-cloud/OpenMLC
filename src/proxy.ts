import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, type Session } from "@/lib/session";

const PROTECTED_PREFIXES = [
  "/chat",
  "/settings",
  "/swarm",
  "/api/chat",
  "/api/swarm",
  "/api/swarm-config",
  "/api/conversations",
  "/api/messages",
  "/api/knowledge",
  "/api/api-keys",
  "/api/attachments",
];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
  if (!isProtected) return NextResponse.next();

  const res = NextResponse.next();
  const session = await getIronSession<Session>(req, res, sessionOptions);
  if (!session.profileId) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/profiles";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|brand|api/auth).*)"],
};
