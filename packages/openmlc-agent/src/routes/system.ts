import { Router } from "express";
import { exec } from "child_process";
import { promisify } from "util";
import si from "systeminformation";
import { listWindows, focusWindow } from "../platform/index.js";
import { detectPlatform } from "../platform/detect.js";

const execP = promisify(exec);
export const systemRouter = Router();

systemRouter.get("/status", (_req, res) => {
  res.json({ ok: true, platform: detectPlatform(), version: "0.1.0" });
});

systemRouter.get("/system/info", async (_req, res) => {
  try {
    const [cpu, mem, os, disk] = await Promise.all([
      si.cpu(),
      si.mem(),
      si.osInfo(),
      si.fsSize(),
    ]);
    res.json({ cpu, mem, os, disk });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

systemRouter.get("/processes", async (_req, res) => {
  try {
    const procs = await si.processes();
    res.json({ processes: procs.list.slice(0, 100) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

systemRouter.post("/processes/kill", async (req, res) => {
  try {
    const { pid, signal } = req.body;
    await execP(`kill -${signal ?? "TERM"} ${pid}`);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

systemRouter.get("/windows", async (_req, res) => {
  try {
    const windows = await listWindows();
    res.json({ windows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

systemRouter.post("/windows/focus", async (req, res) => {
  try {
    const { title, pid } = req.body;
    await focusWindow(title, pid);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
