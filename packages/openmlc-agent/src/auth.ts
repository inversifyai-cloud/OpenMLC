import type { Request, Response, NextFunction } from "express";

const AGENT_TOKEN = process.env.AGENT_TOKEN ?? "";

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!AGENT_TOKEN) {
    res.status(500).json({ error: "AGENT_TOKEN not set" });
    return;
  }
  const token = req.headers["x-agent-token"];
  if (token !== AGENT_TOKEN) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}
