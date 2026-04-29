#!/usr/bin/env -S npx tsx
import { Command } from "commander";
import readline from "readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { db } from "../src/lib/db";
import { setProfileCreationLocked, setSwarmEnabled, setCodeSandboxEnabled, getSettings } from "../src/lib/settings";
import { setProfilePassword, listProfiles, profileCount } from "../src/lib/profiles";

const program = new Command();
program.name("openmlc").description("openmlc operator cli").version("0.1.0");

program
  .command("seed")
  .description("ensure settings singleton exists")
  .action(async () => {
    const s = await getSettings();
    console.log(`[seed] settings ready · locked=${s.profileCreationLocked} swarm=${s.swarmEnabled} sandbox=${s.codeSandboxEnabled}`);
    await db.$disconnect();
  });

program
  .command("lock-profiles")
  .description("disable new profile creation")
  .action(async () => {
    await setProfileCreationLocked(true);
    console.log("[ok] profile creation locked. unlock with `npm run openmlc -- unlock-profiles`.");
    await db.$disconnect();
  });

program
  .command("unlock-profiles")
  .description("re-enable new profile creation")
  .action(async () => {
    await setProfileCreationLocked(false);
    console.log("[ok] profile creation unlocked.");
    await db.$disconnect();
  });

program
  .command("swarm:enable")
  .description("enable swarm feature")
  .action(async () => {
    await setSwarmEnabled(true);
    console.log("[ok] swarm enabled.");
    await db.$disconnect();
  });

program
  .command("swarm:disable")
  .description("disable swarm feature")
  .action(async () => {
    await setSwarmEnabled(false);
    console.log("[ok] swarm disabled.");
    await db.$disconnect();
  });

program
  .command("sandbox:enable")
  .description("enable code execution sandbox (requires docker)")
  .action(async () => {
    await setCodeSandboxEnabled(true);
    console.log("[ok] code sandbox enabled.");
    await db.$disconnect();
  });

program
  .command("sandbox:disable")
  .description("disable code execution sandbox")
  .action(async () => {
    await setCodeSandboxEnabled(false);
    console.log("[ok] code sandbox disabled.");
    await db.$disconnect();
  });

program
  .command("list-profiles")
  .description("list all profiles")
  .action(async () => {
    const profiles = await listProfiles();
    if (profiles.length === 0) console.log("no profiles yet.");
    for (const p of profiles) {
      console.log(`  ${p.username.padEnd(20)} ${p.displayName.padEnd(28)} ${p.avatarMonogram} · ${p.avatarAccent}`);
    }
    console.log(`\ntotal: ${profiles.length}`);
    await db.$disconnect();
  });

program
  .command("reset-password <username>")
  .description("reset a profile's password (interactive)")
  .action(async (username: string) => {
    const rl = readline.createInterface({ input, output });
    const pw = await rl.question(`new password for ${username}: `);
    rl.close();
    if (!pw || pw.length < 6) {
      console.error("password must be at least 6 characters.");
      process.exit(1);
    }
    try {
      await setProfilePassword(username, pw);
      console.log(`[ok] password updated for ${username}.`);
    } catch (e) {
      console.error(`[err] ${e instanceof Error ? e.message : e}`);
      process.exit(1);
    } finally {
      await db.$disconnect();
    }
  });

program
  .command("status")
  .description("print current state")
  .action(async () => {
    const s = await getSettings();
    const c = await profileCount();
    console.log(`openmlc · status`);
    console.log(`  profiles:           ${c}`);
    console.log(`  profile creation:   ${s.profileCreationLocked ? "locked" : "open"}`);
    console.log(`  swarm:              ${s.swarmEnabled ? "enabled" : "disabled"}`);
    console.log(`  code sandbox:       ${s.codeSandboxEnabled ? "enabled" : "disabled"}`);
    await db.$disconnect();
  });

program.parseAsync().catch((e) => {
  console.error(e);
  process.exit(1);
});
