import { db } from "./db";

// Settings is a global singleton that only changes via the settings API.
// Cache for 30s so every chat request doesn't pay a DB round-trip.
let _cache: Awaited<ReturnType<typeof db.settings.upsert>> | null = null;
let _cacheAt = 0;
const TTL = 30_000;

export async function getSettings() {
  const now = Date.now();
  if (_cache && now - _cacheAt < TTL) return _cache;
  _cache = await db.settings.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });
  _cacheAt = now;
  return _cache;
}

export function invalidateSettingsCache() {
  _cache = null;
}

export async function setProfileCreationLocked(locked: boolean) {
  return db.settings.upsert({
    where: { id: "singleton" },
    update: { profileCreationLocked: locked },
    create: { id: "singleton", profileCreationLocked: locked },
  });
}

export async function setSwarmEnabled(enabled: boolean) {
  return db.settings.upsert({
    where: { id: "singleton" },
    update: { swarmEnabled: enabled },
    create: { id: "singleton", swarmEnabled: enabled },
  });
}

export async function setCodeSandboxEnabled(enabled: boolean) {
  return db.settings.upsert({
    where: { id: "singleton" },
    update: { codeSandboxEnabled: enabled },
    create: { id: "singleton", codeSandboxEnabled: enabled },
  });
}

export async function setComputerAgent(url: string | null, token: string | null) {
  return db.settings.upsert({
    where: { id: "singleton" },
    update: { computerAgentUrl: url, computerAgentToken: token },
    create: { id: "singleton", computerAgentUrl: url, computerAgentToken: token },
  });
}
