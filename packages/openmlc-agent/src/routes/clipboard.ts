import { Router } from "express";
import { clipboardRead, clipboardWrite } from "../platform/index.js";

export const clipboardRouter = Router();

clipboardRouter.get("/clipboard/read", async (_req, res) => {
  try {
    const text = await clipboardRead();
    res.json({ text });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

clipboardRouter.post("/clipboard/write", async (req, res) => {
  try {
    const { text } = req.body;
    await clipboardWrite(text);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
