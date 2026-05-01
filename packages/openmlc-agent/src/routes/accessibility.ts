import { Router } from "express";
import { accessibilityTree } from "../platform/index.js";

export const accessibilityRouter = Router();

accessibilityRouter.get("/accessibility/tree", async (req, res) => {
  const app = typeof req.query.app === "string" ? req.query.app : undefined;
  const maxDepth = req.query.max_depth ? parseInt(String(req.query.max_depth)) : 5;
  try {
    const tree = await accessibilityTree(app, maxDepth);
    res.json({ tree });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
