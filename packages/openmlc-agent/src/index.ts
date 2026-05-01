import express from "express";
import rateLimit from "express-rate-limit";
import { authMiddleware } from "./auth.js";
import { screenshotRouter } from "./routes/screenshot.js";
import { mouseRouter } from "./routes/mouse.js";
import { keyboardRouter } from "./routes/keyboard.js";
import { shellRouter } from "./routes/shell.js";
import { filesRouter } from "./routes/files.js";
import { clipboardRouter } from "./routes/clipboard.js";
import { appsRouter } from "./routes/apps.js";
import { systemRouter } from "./routes/system.js";

if (!process.env.AGENT_TOKEN) {
  console.error("Error: AGENT_TOKEN environment variable is required.");
  process.exit(1);
}

const app = express();
app.use(express.json({ limit: "10mb" }));

// Status endpoint — no auth, used for health checks
app.get("/status", (_req, res) => {
  res.json({ ok: true, version: "0.1.0" });
});

const readLimit = rateLimit({ windowMs: 60_000, max: 120, standardHeaders: true, legacyHeaders: false });
const writeLimit = rateLimit({ windowMs: 60_000, max: 20, standardHeaders: true, legacyHeaders: false });

app.use(authMiddleware);

app.use(readLimit, screenshotRouter);
app.use(readLimit, systemRouter);
app.use(readLimit, clipboardRouter);
app.use(readLimit, filesRouter);

app.use(writeLimit, mouseRouter);
app.use(writeLimit, keyboardRouter);
app.use(writeLimit, shellRouter);
app.use(writeLimit, appsRouter);

const PORT = parseInt(process.env.AGENT_PORT ?? "3031", 10);
app.listen(PORT, "127.0.0.1", () => {
  console.log(`openmlc-agent listening on http://127.0.0.1:${PORT}`);
  console.log(`Platform: ${process.platform}`);
});
