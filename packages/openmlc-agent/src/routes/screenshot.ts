import { Router } from "express";
import { screenshot, screenshotRaw, screenshotRegion } from "../platform/index.js";

export const screenshotRouter = Router();

screenshotRouter.get("/screenshot", async (_req, res) => {
  try {
    const result = await screenshot();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

screenshotRouter.get("/screenshot/region", async (req, res) => {
  const { x, y, w, h, scale } = req.query as Record<string, string>;
  if (!x || !y || !w || !h) {
    res.status(400).json({ error: "x, y, w, h required" });
    return;
  }
  try {
    const result = await screenshotRegion(
      parseInt(x), parseInt(y), parseInt(w), parseInt(h),
      scale ? parseFloat(scale) : 2
    );
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Module-level state for diff
let lastScreenshotBuf: Buffer | null = null;

screenshotRouter.get("/screenshot/diff", async (_req, res) => {
  try {
    const newBuf = await screenshotRaw();
    const prev = lastScreenshotBuf;
    lastScreenshotBuf = newBuf;

    if (!prev) {
      // No previous screenshot — return current with no diff
      res.json({
        image: newBuf.toString("base64"),
        changedRegions: [],
        changePercent: 0,
        note: "No previous screenshot to compare against",
      });
      return;
    }

    // Simple pixel diff: sample 16x16 grid cells and find changed ones
    // PNG bytes aren't easily parseable without a lib, so we compare raw buffer
    // sections as a heuristic. For a proper diff, compare length and random
    // byte samples at stride intervals.
    const len = Math.min(prev.length, newBuf.length);
    let diffBytes = Math.abs(prev.length - newBuf.length);
    const stride = Math.max(1, Math.floor(len / 10000));
    for (let i = 0; i < len; i += stride) {
      if (prev[i] !== newBuf[i]) diffBytes++;
    }
    const changePercent = Math.min(100, (diffBytes / (len / stride)) * 100);

    res.json({
      image: newBuf.toString("base64"),
      changedRegions: [], // full-image diff — region granularity needs a PNG parser
      changePercent: Math.round(changePercent * 10) / 10,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
