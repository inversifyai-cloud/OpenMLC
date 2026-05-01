import { db } from "./db";

export async function getSettings() {
  return db.settings.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });
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
