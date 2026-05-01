import { Router } from "express";
import { screenshot } from "../platform/index.js";

export const screenshotRouter = Router();

screenshotRouter.get("/screenshot", async (_req, res) => {
  try {
    const result = await screenshot();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
