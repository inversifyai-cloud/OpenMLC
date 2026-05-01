import { Router } from "express";
import { findText, ocrScreen } from "../platform/index.js";

export const visionRouter = Router();

visionRouter.post("/vision/find-text", async (req, res) => {
  const { text, region } = req.body;
  if (!text || typeof text !== "string") {
    res.status(400).json({ error: "text required" });
    return;
  }
  try {
    const matches = await findText(text, region);
    res.json({ matches });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

visionRouter.get("/vision/ocr", async (req, res) => {
  const { x, y, w, h } = req.query as Record<string, string>;
  const region = x && y && w && h
    ? { x: parseInt(x), y: parseInt(y), w: parseInt(w), h: parseInt(h) }
    : undefined;
  try {
    const result = await ocrScreen(region);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
