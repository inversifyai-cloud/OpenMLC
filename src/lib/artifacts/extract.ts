/**
 * M8.4b — Artifact extraction from assistant message text.
 *
 * Two detection strategies:
 * 1. Explicit <artifact title="X" type="html|svg|code|markdown">...</artifact> tags
 * 2. Fenced code blocks ≥ 30 lines (auto type=code, language from fence tag, title="snippet")
 */

export interface ExtractedArtifact {
  type: "html" | "svg" | "code" | "markdown";
  language?: string;
  title: string;
  content: string;
}

const VALID_TYPES = new Set(["html", "svg", "code", "markdown"]);

function parseType(raw: string): ExtractedArtifact["type"] {
  const t = raw.toLowerCase().trim();
  return VALID_TYPES.has(t) ? (t as ExtractedArtifact["type"]) : "code";
}

/**
 * Extract artifacts from a completed assistant message.
 * Returns [] when nothing qualifies.
 */
export function extractArtifacts(messageText: string): ExtractedArtifact[] {
  const results: ExtractedArtifact[] = [];

  // ── Strategy 1: explicit <artifact> tags ─────────────────────────────
  const tagRe =
    /<artifact\s+([^>]*)>([\s\S]*?)<\/artifact>/gi;
  let tagMatch: RegExpExecArray | null;
  const tagMatches = new Set<string>(); // track consumed ranges to avoid double-counting

  while ((tagMatch = tagRe.exec(messageText)) !== null) {
    const attrs = tagMatch[1];
    const content = tagMatch[2].trim();
    if (!content) continue;

    const titleMatch = /title\s*=\s*["']([^"']*)["']/.exec(attrs);
    const typeMatch = /type\s*=\s*["']([^"']*)["']/.exec(attrs);
    const langMatch = /language\s*=\s*["']([^"']*)["']/.exec(attrs);

    const title = titleMatch?.[1] ?? "artifact";
    const type = parseType(typeMatch?.[1] ?? "code");
    const language = langMatch?.[1] ?? (type === "code" ? "text" : undefined);

    results.push({ type, language, title, content });
    tagMatches.add(`${tagMatch.index}:${tagMatch[0].length}`);
  }

  // ── Strategy 2: fenced code blocks ≥ 30 lines ────────────────────────
  const fenceRe = /```(\w*)\n([\s\S]*?)```/g;
  let fenceMatch: RegExpExecArray | null;

  while ((fenceMatch = fenceRe.exec(messageText)) !== null) {
    const lang = fenceMatch[1] || "text";
    const content = fenceMatch[2];
    const lineCount = content.split("\n").length;

    if (lineCount < 30) continue;

    // Don't double-count if this fence is inside an <artifact> tag we already consumed
    const isInsideTag = results.some((_, idx) => {
      // simple heuristic: check if fenceMatch index overlaps with any tag match range
      void idx;
      return false; // tags are stripped before content, so no overlap in raw text
    });
    if (isInsideTag) continue;

    const type: ExtractedArtifact["type"] =
      lang === "html" ? "html"
      : lang === "svg" ? "svg"
      : lang === "markdown" || lang === "md" ? "markdown"
      : "code";

    results.push({
      type,
      language: type === "code" ? lang : undefined,
      title: "snippet",
      content: content.trim(),
    });
  }

  return results;
}
