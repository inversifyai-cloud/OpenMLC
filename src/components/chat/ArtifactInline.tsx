"use client";

interface ArtifactInlineProps {
  artifact: {
    id: string;
    title: string;
    type: "html" | "svg" | "code" | "markdown" | "react" | "mermaid" | "chart" | "research";
    language?: string | null;
  };
  index?: number;
  onOpen: () => void;
}

const TYPE_LABEL: Record<ArtifactInlineProps["artifact"]["type"], string> = {
  html: "Document",
  svg: "Vector",
  code: "Listing",
  markdown: "Note",
  react: "Component",
  mermaid: "Diagram",
  chart: "Figure",
  research: "Research",
};

function TypeGlyph({ type }: { type: ArtifactInlineProps["artifact"]["type"] }) {
  const common = {
    width: 14,
    height: 14,
    viewBox: "0 0 24 24",
    fill: "none" as const,
    stroke: "currentColor",
    strokeWidth: 1.4,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (type) {
    case "html":
      return (<svg {...common}><rect x="3" y="5" width="18" height="14" rx="1.5"/><path d="M3 9h18"/></svg>);
    case "svg":
      return (<svg {...common}><circle cx="8" cy="9" r="2"/><path d="M21 18 14 11l-9 9"/><rect x="3" y="3" width="18" height="18" rx="1.5"/></svg>);
    case "code":
      return (<svg {...common}><path d="m9 16-4-4 4-4M15 8l4 4-4 4"/></svg>);
    case "markdown":
      return (<svg {...common}><path d="M5 5h14v14H5z"/><path d="M8 15V9l2 2 2-2v6M16 9v6m0 0-2-2m2 2 2-2"/></svg>);
    case "react":
      return (<svg {...common}><circle cx="12" cy="12" r="2"/><ellipse cx="12" cy="12" rx="10" ry="4"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(120 12 12)"/></svg>);
    case "mermaid":
      return (<svg {...common}><rect x="3" y="3" width="6" height="4" rx="0.5"/><rect x="15" y="3" width="6" height="4" rx="0.5"/><rect x="9" y="17" width="6" height="4" rx="0.5"/><path d="M6 7v3a2 2 0 0 0 2 2h8a2 2 0 0 1 2 2v3M18 7v3a2 2 0 0 1-2 2h0"/></svg>);
    case "chart":
      return (<svg {...common}><path d="M4 20V8M10 20v-7M16 20v-4M22 20V4"/></svg>);
    case "research":
      return (<svg {...common}><circle cx="11" cy="11" r="6"/><path d="m21 21-5.5-5.5M11 8v6M8 11h6"/></svg>);
  }
}

export function ArtifactInline({ artifact, index, onOpen }: ArtifactInlineProps) {
  const figNum = (index ?? 0) + 1;
  const typeLabel = TYPE_LABEL[artifact.type];
  return (
    <button
      type="button"
      className="artifact-fig"
      onClick={onOpen}
      aria-label={`Open ${typeLabel.toLowerCase()}: ${artifact.title}`}
    >
      <span className="artifact-fig__num">Fig.&nbsp;{figNum}</span>
      <span className="artifact-fig__rule" aria-hidden />
      <span className="artifact-fig__glyph"><TypeGlyph type={artifact.type} /></span>
      <span className="artifact-fig__title">{artifact.title}</span>
      <span className="artifact-fig__type">
        {typeLabel}
        {artifact.language ? <span className="artifact-fig__lang"> · {artifact.language}</span> : null}
      </span>
      <span className="artifact-fig__arrow" aria-hidden>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 17 17 7M9 7h8v8"/>
        </svg>
      </span>
    </button>
  );
}
