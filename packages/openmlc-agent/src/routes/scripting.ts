import { Router } from "express";
import { runScript } from "../platform/index.js";

export const scriptingRouter = Router();

const VALID_LANGS = ["jxa", "applescript", "powershell", "python"] as const;
type Lang = typeof VALID_LANGS[number];

scriptingRouter.post("/script/run", async (req, res) => {
  const { script, language } = req.body as { script?: string; language?: string };
  if (!script || typeof script !== "string") {
    res.status(400).json({ error: "script required" });
    return;
  }
  if (!VALID_LANGS.includes(language as Lang)) {
    res.status(400).json({ error: `language must be one of: ${VALID_LANGS.join(", ")}` });
    return;
  }
  try {
    const result = await runScript(script, language as Lang);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
