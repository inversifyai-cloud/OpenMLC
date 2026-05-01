import { Router } from "express";
import { readFile, writeFile, unlink, mkdir, rename, readdir, stat } from "fs/promises";
import { join, resolve } from "path";
import { homedir } from "os";
import { readFileSync, existsSync } from "fs";

export const filesRouter = Router();

const configPath = join(homedir(), ".openmlc-agent", "config.json");

function getAllowedPaths(): string[] {
  if (existsSync(configPath)) {
    try {
      const cfg = JSON.parse(readFileSync(configPath, "utf8"));
      if (Array.isArray(cfg.allowedPaths)) return cfg.allowedPaths.map((p: string) => resolve(p));
    } catch {}
  }
  return [homedir()];
}

function isAllowed(filePath: string): boolean {
  const abs = resolve(filePath);
  return getAllowedPaths().some((allowed) => abs.startsWith(allowed));
}

filesRouter.get("/files/read", async (req, res) => {
  const { path } = req.query as { path: string };
  if (!path || !isAllowed(path)) {
    res.status(403).json({ error: "Path not allowed" });
    return;
  }
  try {
    const buf = await readFile(path);
    const MAX = 50 * 1024;
    const content = buf.length > MAX ? buf.slice(0, MAX).toString("utf8") + "\n[truncated]" : buf.toString("utf8");
    res.json({ content, size: buf.length, truncated: buf.length > MAX });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

filesRouter.post("/files/write", async (req, res) => {
  const { path, content } = req.body;
  if (!path || !isAllowed(path)) {
    res.status(403).json({ error: "Path not allowed" });
    return;
  }
  try {
    await mkdir(resolve(path, ".."), { recursive: true });
    await writeFile(path, content, "utf8");
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

filesRouter.get("/files/list", async (req, res) => {
  const { path } = req.query as { path: string };
  const dir = path ?? homedir();
  if (!isAllowed(dir)) {
    res.status(403).json({ error: "Path not allowed" });
    return;
  }
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    const files = await Promise.all(
      entries.map(async (e) => {
        const full = join(dir, e.name);
        let size = 0;
        try { size = (await stat(full)).size; } catch {}
        return { name: e.name, type: e.isDirectory() ? "dir" : "file", size };
      })
    );
    res.json({ files });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

filesRouter.delete("/files/delete", async (req, res) => {
  const { path } = req.body;
  if (!path || !isAllowed(path)) {
    res.status(403).json({ error: "Path not allowed" });
    return;
  }
  try {
    await unlink(path);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

filesRouter.post("/files/move", async (req, res) => {
  const { from, to } = req.body;
  if (!isAllowed(from) || !isAllowed(to)) {
    res.status(403).json({ error: "Path not allowed" });
    return;
  }
  try {
    await rename(from, to);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

filesRouter.post("/files/mkdir", async (req, res) => {
  const { path } = req.body;
  if (!path || !isAllowed(path)) {
    res.status(403).json({ error: "Path not allowed" });
    return;
  }
  try {
    await mkdir(path, { recursive: true });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
