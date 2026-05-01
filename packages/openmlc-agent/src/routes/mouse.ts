import { Router } from "express";
import { mouseClick, mouseDoubleClick, mouseMove, mouseScroll, mouseDrag, cursorPosition } from "../platform/index.js";

export const mouseRouter = Router();

mouseRouter.post("/mouse/click", async (req, res) => {
  try {
    const { x, y, button } = req.body;
    await mouseClick(x, y, button);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

mouseRouter.post("/mouse/double-click", async (req, res) => {
  try {
    const { x, y } = req.body;
    await mouseDoubleClick(x, y);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

mouseRouter.post("/mouse/move", async (req, res) => {
  try {
    const { x, y } = req.body;
    await mouseMove(x, y);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

mouseRouter.post("/mouse/scroll", async (req, res) => {
  try {
    const { x, y, direction, amount } = req.body;
    await mouseScroll(x, y, direction, amount ?? 3);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

mouseRouter.post("/mouse/drag", async (req, res) => {
  try {
    const { fromX, fromY, toX, toY } = req.body;
    await mouseDrag(fromX, fromY, toX, toY);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

mouseRouter.get("/mouse/position", async (_req, res) => {
  try {
    const pos = await cursorPosition();
    res.json(pos);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
