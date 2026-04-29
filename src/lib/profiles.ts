import bcrypt from "bcryptjs";
import { db } from "./db";
import { getSettings } from "./settings";
import type { ProfileSummary, AvatarAccent } from "@/types/profile";

export async function listProfiles(): Promise<ProfileSummary[]> {
  const rows = await db.profile.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, username: true, displayName: true, avatarMonogram: true, avatarAccent: true },
  });
  return rows.map((r) => ({
    ...r,
    avatarAccent: (r.avatarAccent as AvatarAccent) ?? "cyan",
  }));
}

export async function profileCount(): Promise<number> {
  return db.profile.count();
}

export async function createProfile(input: {
  username: string;
  displayName: string;
  password: string;
  avatarMonogram?: string;
  avatarAccent?: AvatarAccent;
}) {
  const settings = await getSettings();
  const count = await profileCount();
  if (settings.profileCreationLocked && count > 0) {
    throw new Error("profile creation is locked");
  }
  const username = input.username.trim().toLowerCase();
  if (!/^[a-z0-9_-]{2,32}$/.test(username)) {
    throw new Error("username must be 2–32 chars (a–z, 0–9, _, -)");
  }
  if (input.password.length < 6) {
    throw new Error("password must be at least 6 characters");
  }
  const exists = await db.profile.findUnique({ where: { username } });
  if (exists) throw new Error("username taken");

  const hashedPassword = await bcrypt.hash(input.password, 10);
  const monogram = (input.avatarMonogram ?? input.displayName.slice(0, 2) ?? "·").toUpperCase();

  return db.profile.create({
    data: {
      username,
      displayName: input.displayName.trim() || username,
      hashedPassword,
      avatarMonogram: monogram,
      avatarAccent: input.avatarAccent ?? "cyan",
    },
  });
}

export async function verifyPassword(username: string, password: string) {
  const profile = await db.profile.findUnique({ where: { username: username.toLowerCase() } });
  if (!profile) return null;
  const ok = await bcrypt.compare(password, profile.hashedPassword);
  return ok ? profile : null;
}

export async function setProfilePassword(username: string, newPassword: string) {
  if (newPassword.length < 6) throw new Error("password must be at least 6 characters");
  const hashedPassword = await bcrypt.hash(newPassword, 10);
  return db.profile.update({
    where: { username: username.toLowerCase() },
    data: { hashedPassword },
  });
}
