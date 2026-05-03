// Shiki singleton — lazy-loads the highlighter and tokenizes code blocks
// to themed HTML. Used by <CodeBlock> after streaming completes.

import type { Highlighter, BundledLanguage, BundledTheme } from "shiki";

const PREWARM_LANGS: BundledLanguage[] = [
  "ts", "tsx", "js", "jsx",
  "py", "bash", "shell",
  "json", "yaml", "toml",
  "sql", "md",
  "rust", "go", "java", "c", "cpp",
  "html", "css",
];

const THEMES: BundledTheme[] = ["github-light", "github-dark"];

let highlighterPromise: Promise<Highlighter> | null = null;
const loadedLangs = new Set<string>(PREWARM_LANGS);

async function loadHighlighter(): Promise<Highlighter> {
  if (highlighterPromise) return highlighterPromise;
  highlighterPromise = (async () => {
    const { createHighlighter } = await import("shiki");
    return createHighlighter({ themes: THEMES, langs: PREWARM_LANGS });
  })();
  return highlighterPromise;
}

// Normalize a few common aliases so we don't fail on `sh`, `yml`, etc.
const ALIAS: Record<string, BundledLanguage> = {
  sh: "shell",
  zsh: "shell",
  yml: "yaml",
  py3: "py" as BundledLanguage,
  rs: "rust",
  golang: "go",
  "c++": "cpp",
};

function resolveLang(input: string): BundledLanguage | "text" {
  const lower = input.toLowerCase().trim();
  if (!lower) return "text";
  return (ALIAS[lower] ?? lower) as BundledLanguage;
}

export async function highlightToHtml(
  code: string,
  lang: string,
  theme: "light" | "dark"
): Promise<string> {
  const hl = await loadHighlighter();
  const resolved = resolveLang(lang);

  // Lazy-load any lang not in the pre-warm set
  if (resolved !== "text" && !loadedLangs.has(resolved)) {
    try {
      await hl.loadLanguage(resolved);
      loadedLangs.add(resolved);
    } catch {
      // unknown lang — fall through to plain
    }
  }

  const themeName: BundledTheme = theme === "dark" ? "github-dark" : "github-light";

  try {
    return hl.codeToHtml(code, {
      lang: loadedLangs.has(resolved) ? resolved : "text",
      theme: themeName,
    });
  } catch {
    return hl.codeToHtml(code, { lang: "text", theme: themeName });
  }
}
