import { Router } from "express";
import { exec } from "child_process";
import { promisify } from "util";
import { logShell } from "../logger.js";

const execP = promisify(exec);
export const shellRouter = Router();

shellRouter.post("/shell/exec", async (req, res) => {
  const { command, cwd, timeout } = req.body;
  try {
    const { stdout, stderr } = await execP(command, {
      cwd: cwd ?? process.env.HOME,
      timeout: timeout ?? 30000,
      maxBuffer: 5 * 1024 * 1024,
    });
    await logShell(command, stdout, stderr, 0).catch(() => {});
    res.json({ stdout, stderr, exitCode: 0 });
  } catch (err: any) {
    const stdout = err.stdout ?? "";
    const stderr = err.stderr ?? err.message;
    const exitCode = err.code ?? 1;
    await logShell(command, stdout, stderr, exitCode).catch(() => {});
    res.json({ stdout, stderr, exitCode });
  }
});
