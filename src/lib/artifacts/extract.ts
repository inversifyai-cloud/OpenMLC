

export interface ExtractedArtifact {
  type: "html" | "svg" | "code" | "markdown" | "react";
  language?: string;
  title: string;
  content: string;
}

const VALID_TYPES = new Set(["html", "svg", "code", "markdown", "react"]);

function parseType(raw: string): ExtractedArtifact["type"] {
  const t = raw.toLowerCase().trim();
  return VALID_TYPES.has(t) ? (t as ExtractedArtifact["type"]) : "code";
}

export function extractArtifacts(messageText: string): ExtractedArtifact[] {
  const results: ExtractedArtifact[] = [];

  const tagRe =
    /<artifact\s+([^>]*)>([\s\S]*?)<\/artifact>/gi;
  let tagMatch: RegExpExecArray | null;
  const tagMatches = new Set<string>();

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

  const fenceRe = /```(\w*)\n([\s\S]*?)```/g;
  let fenceMatch: RegExpExecArray | null;

  while ((fenceMatch = fenceRe.exec(messageText)) !== null) {
    const lang = fenceMatch[1] || "text";
    const content = fenceMatch[2];
    const lineCount = content.split("\n").length;

    const isPreviewable =
      lang === "html" || lang === "svg";
    if (!isPreviewable && lineCount < 30) continue;
    if (isPreviewable && lineCount < 5) continue;

    const isInsideTag = results.some((_, idx) => {

      void idx;
      return false;
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
