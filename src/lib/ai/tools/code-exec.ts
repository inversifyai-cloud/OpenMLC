import { tool } from "ai";
import { z } from "zod";
import { execFile } from "child_process";
import { promisify } from "util";
import { writeFile, unlink, mkdir } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import type { ToolDefinition } from "./types";

const execFileAsync = promisify(execFile);
const TIMEOUT_MS = 10_000;
const MAX_BUFFER = 512 * 1024;

const inputSchema = z.object({
  language: z
    .enum(["python", "javascript"])
    .describe("Execution environment: 'python' (python3) or 'javascript' (Node.js)"),
  code: z
    .string()
    .max(12000)
    .describe(
      "The code to execute. Print results to stdout. Keep under 10 seconds. No network access from sandbox."
    ),
});

async function runInSandbox(
  binary: string,
  args: string[],
  code: string,
  ext: string
): Promise<{ stdout: string; stderr: string; exitCode: number; durationMs: number }> {
  const dir = join(tmpdir(), "openmlc-sandbox");
  await mkdir(dir, { recursive: true });
  const file = join(dir, `exec-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`);
  await writeFile(file, code, "utf8");
  const start = Date.now();
  try {
    const { stdout, stderr } = await execFileAsync(binary, [...args, file], {
      timeout: TIMEOUT_MS,
      maxBuffer: MAX_BUFFER,
    });
    return { stdout: stdout.slice(0, MAX_BUFFER), stderr: stderr.slice(0, MAX_BUFFER), exitCode: 0, durationMs: Date.now() - start };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; code?: number | string; killed?: boolean; signal?: string };
    const timedOut = e.killed ?? e.signal === "SIGTERM";
    return {
      stdout: (e.stdout ?? "").slice(0, MAX_BUFFER),
      stderr: timedOut ? "Execution timed out after 10 seconds" : (e.stderr ?? String(err)).slice(0, MAX_BUFFER),
      exitCode: typeof e.code === "number" ? e.code : 1,
      durationMs: Date.now() - start,
    };
  } finally {
    await unlink(file).catch(() => {});
  }
}

export const codeExecDefinition: ToolDefinition<"code_exec"> = {
  name: "code_exec",
  displayName: "Ran code",
  verb: "Running code",
  isEnabled: ({ ctx }) => !!ctx.sandboxEnabled,
  build: (_ctx) =>
    tool({
      description:
        "Execute code in a sandboxed subprocess. Use for calculations, data transformations, algorithms, or verifying logic. Always print the final result. Supports Python (python3) and JavaScript (Node.js). Hard 10-second timeout.",
      inputSchema,
      execute: async ({ language, code }) => {
        if (language === "python") {
          return runInSandbox("python3", [], code, "py");
        } else {
          return runInSandbox("node", [], code, "js");
        }
      },
    }),
};
