import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";

export type Session = {
  profileId?: string;
  username?: string;
};

const sessionPassword = process.env.SESSION_SECRET ?? "";

if (!sessionPassword || sessionPassword.length < 32) {
  if (process.env.NODE_ENV !== "test") {
    console.warn(
      "[session] SESSION_SECRET is missing or too short. Sessions will not work. " +
        "Generate one with: openssl rand -base64 48"
    );
  }
}

export const sessionOptions: SessionOptions = {
  password: sessionPassword || "x".repeat(32),
  cookieName: "openmlc_session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    httpOnly: true,
    path: "/",
  },
};

export async function getSession() {
  const store = await cookies();
  return getIronSession<Session>(store, sessionOptions);
}

export async function requireSession() {
  const session = await getSession();
  if (!session.profileId) throw new Error("UNAUTHORIZED");
  return session as Required<Pick<Session, "profileId" | "username">> & Session;
}
