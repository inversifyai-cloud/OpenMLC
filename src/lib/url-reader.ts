import * as cheerio from "cheerio";

const FETCH_TIMEOUT = 15_000;
const MAX_CHARS = 12_000;
const USER_AGENT = "Mozilla/5.0 (compatible; OpenMLC/1.0)";

const NOISE_SELECTORS = [
  "script", "style", "nav", "footer", "header", "aside", "noscript",
  "iframe", "svg", "[role='banner']", "[role='navigation']",
  "[role='complementary']", ".sidebar", ".ad", ".ads", ".cookie",
  ".popup", ".modal", ".newsletter", ".social-share",
];

export async function fetchUrlContent(url: string): Promise<{
  title: string;
  text: string;
  hostname: string;
} | null> {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;

    const hostname = parsed.hostname.toLowerCase();
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "[::1]" ||
      hostname === "0.0.0.0" ||
      hostname.startsWith("10.") ||
      hostname.startsWith("172.16.") || hostname.startsWith("172.17.") || hostname.startsWith("172.18.") ||
      hostname.startsWith("172.19.") || hostname.startsWith("172.2") || hostname.startsWith("172.30.") || hostname.startsWith("172.31.") ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("169.254.") ||
      hostname.endsWith(".internal") ||
      hostname.endsWith(".local")
    ) {
      return null;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml,text/plain,application/json" },
      redirect: "follow", signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) return null;

    const contentType = res.headers.get("content-type") ?? "";
    const body = await res.text();

    if (!contentType.includes("html")) {
      return {
        title: parsed.hostname,
        text: body.slice(0, MAX_CHARS),
        hostname: parsed.hostname,
      };
    }

    const $ = cheerio.load(body);
    NOISE_SELECTORS.forEach((sel) => $(sel).remove());

    const mainEl = $("article, main, [role='main'], .post-content, .article-body, .entry-content, .content").first();
    const contentEl = mainEl.length ? mainEl : $("body");

    const title = $("title").first().text().trim()
      || $("h1").first().text().trim()
      || parsed.hostname;

    let text = contentEl.text()
      .replace(/\s+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    if (text.length > MAX_CHARS) {
      text = text.slice(0, MAX_CHARS) + "…";
    }

    if (!text || text.length < 50) return null;

    return { title, text, hostname: parsed.hostname };
  } catch {
    return null;
  }
}

export function extractUrls(text: string): string[] {
  const urlRegex = /https?:\/\/[^\s<>"')\]]+/gi;
  return [...new Set(text.match(urlRegex) ?? [])];
}
