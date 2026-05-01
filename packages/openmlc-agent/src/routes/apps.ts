import { Router } from "express";
import { launchApp } from "../platform/index.js";

export const appsRouter = Router();

appsRouter.post("/app/launch", async (req, res) => {
  try {
    const { app, args } = req.body;
    await launchApp(app, args ?? []);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
