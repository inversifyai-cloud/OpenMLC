import { Router } from "express";
import { keyboardType, keyboardKey } from "../platform/index.js";

export const keyboardRouter = Router();

keyboardRouter.post("/keyboard/type", async (req, res) => {
  try {
    const { text } = req.body;
    await keyboardType(text);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

keyboardRouter.post("/keyboard/key", async (req, res) => {
  try {
    const { key, modifiers } = req.body;
    await keyboardKey(key, modifiers ?? []);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
