import Link from "next/link";

export type RecentItem =
  | {
      kind: "artifact";
      id: string;
      type: "code" | "html" | "svg" | "markdown" | "react" | "mermaid" | "chart";
      title: string;
      language?: string | null;
      content: string;
      createdAt: Date;
    }
  | {
      kind: "research";
      id: string;
      query: string;
      createdAt: Date;
    }
  | {
      kind: "browser";
      id: string;
      startUrl: string | null;
      createdAt: Date;
    };

type Props = {
  items: RecentItem[];
};

const TYPE_LABEL: Record<string, string> = {
  code: "Listing",
  html: "Document",
  svg: "Vector",
  markdown: "Note",
  react: "Component",
  mermaid: "Diagram",
  chart: "Figure",
  research: "Research",
  browser: "Browser",
};

function firstLines(text: string, n: number): string {
  return text
    .split(/\r?\n/)
    .slice(0, n)
    .map((l) => (l.length > 60 ? l.slice(0, 60) + "…" : l))
    .join("\n");
}

function isLikelySvg(s: string): boolean {
  const trimmed = s.trim();
  return trimmed.startsWith("<svg") && trimmed.includes("</svg>");
}

function tilePath(it: RecentItem): string {
  if (it.kind === "artifact") return `/library/artifact:${it.id}`;
  if (it.kind === "research") return `/library/research:${it.id}`;
  return `/library/browser:${it.id}`;
}

function tileTitle(it: RecentItem): string {
  if (it.kind === "artifact") return it.title || "untitled artifact";
  if (it.kind === "research") return it.query || "research session";
  return it.startUrl ?? "browser session";
}

function tileTypeLabel(it: RecentItem): string {
  if (it.kind === "artifact") {
    const t = TYPE_LABEL[it.type] ?? "Artifact";
    return it.language ? `${t} · ${it.language}` : t;
  }
  if (it.kind === "research") return TYPE_LABEL.research;
  return TYPE_LABEL.browser;
}

function TilePreview({ item }: { item: RecentItem }) {
  if (item.kind === "research") {
    return (
      <div className="home-tile__preview-research">
        {item.query.length > 140 ? item.query.slice(0, 140) + "…" : item.query}
      </div>
    );
  }
  if (item.kind === "browser") {
    return (
      <div className="home-tile__preview-url">
        {item.startUrl ?? "(no start url)"}
      </div>
    );
  }
  // Artifact branches
  if (item.type === "svg" && isLikelySvg(item.content)) {
    // Inline the SVG, sanitised by serving as static markup. We trust our own
    // artifact store; further sanitisation lives in the library viewer.
    return (
      <div
        className="home-tile__preview-svg"
        // eslint-disable-next-line @typescript-eslint/naming-convention
        dangerouslySetInnerHTML={{ __html: item.content }}
      />
    );
  }
  if (item.type === "mermaid" || item.type === "chart") {
    return (
      <div className="home-tile__placeholder">
        {item.type === "mermaid" ? "Diagram" : "Figure"} — preview in library
      </div>
    );
  }
  // code, html, markdown, react → first 6 lines of source
  const preview = firstLines(item.content, 6);
  return <pre className="home-tile__preview-code">{preview || "—"}</pre>;
}

export function RecentLibrary({ items }: Props) {
  return (
    <section className="home-section">
      <div className="home-label">
        <em>Recently made</em>
      </div>
      {items.length === 0 ? (
        <p className="home-empty">
          No artifacts yet — generate a diagram or chart in chat to see them here.{" "}
          <Link href="/chat">→</Link>
        </p>
      ) : (
        <>
          <div className="home-tiles">
            {items.slice(0, 4).map((it, i) => (
              <Link key={`${it.kind}-${it.id}`} href={tilePath(it)} className="home-tile">
                <div className="home-tile__caption">
                  <span className="home-tile__num">Fig.&nbsp;{i + 1}</span>
                  <span className="home-tile__rule" aria-hidden />
                  <span className="home-tile__type">{tileTypeLabel(it)}</span>
                </div>
                <div className="home-tile__body">
                  <div className="home-tile__title">{tileTitle(it)}</div>
                  <TilePreview item={it} />
                </div>
              </Link>
            ))}
          </div>
          <div className="home-tail">
            <Link href="/library" className="home-link-mono">
              View all in library →
            </Link>
          </div>
        </>
      )}
    </section>
  );
}
