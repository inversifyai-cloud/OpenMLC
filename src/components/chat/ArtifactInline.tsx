"use client";

interface ArtifactInlineProps {
  artifact: {
    id: string;
    title: string;
    type: "html" | "svg" | "code" | "markdown";
    language?: string | null;
  };
  onOpen: (artifactId: string) => void;
}

export function ArtifactInline({ artifact, onOpen }: ArtifactInlineProps) {
  const icon =
    artifact.type === "html" ? "🌐"
    : artifact.type === "svg" ? "🖼"
    : artifact.type === "markdown" ? "📝"
    : "📄";

  return (
    <div className="artifact-inline">
      <span className="artifact-inline__icon">{icon}</span>
      <span className="artifact-inline__label">{artifact.title}</span>
      <span className="artifact-inline__type">
        ({artifact.type}{artifact.language ? ` · ${artifact.language}` : ""})
      </span>
      <button
        className="artifact-inline__open"
        onClick={() => onOpen(artifact.id)}
        aria-label={`Open artifact: ${artifact.title}`}
      >
        open ↗
      </button>
    </div>
  );
}
