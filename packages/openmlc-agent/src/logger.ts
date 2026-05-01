import { appendFile, mkdir } from "fs/promises";
import { join } from "path";
import { homedir } from "os";

const logDir = join(homedir(), ".openmlc-agent");
const logPath = join(logDir, "shell.log");

export async function logShell(command: string, stdout: string, stderr: string, exitCode: number): Promise<void> {
  await mkdir(logDir, { recursive: true });
  const ts = new Date().toISOString();
  const entry = `[${ts}] $ ${command}\n${stdout}${stderr ? `STDERR: ${stderr}` : ""}EXIT: ${exitCode}\n---\n`;
  await appendFile(logPath, entry, "utf8");
}
