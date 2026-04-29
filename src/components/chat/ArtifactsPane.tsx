"use client";

import { useState, useCallback } from "react";

export interface ArtifactData {
  id: string;
  type: "html" | "svg" | "code" | "markdown";
  language?: string | null;
  title: string;
  content: string;
  version: number;
  createdAt: string | Date;
  messageId: string;
  conversationId: string;
}

interface ArtifactsPaneProps {
  artifact: ArtifactData | null;
  onClose: () => void;
  versions?: ArtifactData[];
}

type Tab = "preview" | "code" | "history";

function lcs(a: string[], b: string[]): number[][] {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
  return dp;
}

type DiffLine = { kind: "add" | "del" | "ctx"; text: string };

function diffLines(oldText: string, newText: string): DiffLine[] {
  const a = oldText.split("\n"), b = newText.split("\n");
  const dp = lcs(a, b);
  const result: DiffLine[] = [];
  let i = a.length, j = b.length;
  const path: DiffLine[] = [];
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      path.push({ kind: "ctx", text: a[i - 1] }); i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      path.push({ kind: "add", text: b[j - 1] }); j--;
    } else {
      path.push({ kind: "del", text: a[i - 1] }); i--;
    }
  }
  for (const line of path.reverse()) result.push(line);
  return result;
}

function extForType(type: ArtifactData["type"], language?: string | null): string {
  if (type === "html") return ".html";
  if (type === "svg") return ".svg";
  if (type === "markdown") return ".md";
  return `.${language ?? "txt"}`;
}

function downloadArtifact(artifact: ArtifactData) {
  const ext = extForType(artifact.type, artifact.language);
  const blob = new Blob([artifact.content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${artifact.title.replace(/[^\w\s-]/g, "")}${ext}`;
  a.click();
  URL.revokeObjectURL(url);
}

export function ArtifactsPane({ artifact, onClose, versions = [] }: ArtifactsPaneProps) {
  const [tab, setTab] = useState<Tab>("preview");
  const [selectedVersion, setSelectedVersion] = useState<ArtifactData | null>(null);
  const [copied, setCopied] = useState(false);

  const isOpen = !!artifact;

  const handleCopy = useCallback(async () => {
    if (!artifact) return;
    await navigator.clipboard.writeText(artifact.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [artifact]);

  const diffTarget = selectedVersion ?? (versions.length > 1 ? versions[versions.length - 2] : null);

  return (
    <div className={`artifacts-pane ${isOpen ? "open" : ""}`} role="complementary" aria-label="Artifact preview">

      <div className="artifacts-pane__header">
        <span className="artifacts-pane__title">{artifact?.title ?? "Artifact"}</span>
        {artifact && (
          <span className="artifacts-pane__badge">{artifact.type}{artifact.language ? ` · ${artifact.language}` : ""}</span>
        )}
        <div className="artifacts-pane__actions">
          <button className="artifacts-pane__btn" onClick={handleCopy} disabled={!artifact}>
            {copied ? "Copied!" : "Copy"}
          </button>
          <button
            className="artifacts-pane__btn"
            onClick={() => artifact && downloadArtifact(artifact)}
            disabled={!artifact}
          >
            Download
          </button>
        </div>
        <button className="artifacts-pane__close" onClick={onClose} aria-label="Close artifact pane">
          ×
        </button>
      </div>

      <div className="artifacts-pane__tabs">
        <button className={`artifacts-pane__tab ${tab === "preview" ? "active" : ""}`} onClick={() => setTab("preview")}>
          Preview
        </button>
        <button className={`artifacts-pane__tab ${tab === "code" ? "active" : ""}`} onClick={() => setTab("code")}>
          Code
        </button>
        <button className={`artifacts-pane__tab ${tab === "history" ? "active" : ""}`} onClick={() => setTab("history")}>
          History {versions.length > 0 ? `(${versions.length})` : ""}
        </button>
      </div>

      <div className="artifacts-pane__content">
        {tab === "preview" && artifact && (
          <>
            {artifact.type === "html" && (
              <iframe
                sandbox="allow-scripts"
                srcDoc={artifact.content}
                title={artifact.title}
              />
            )}
            {artifact.type === "svg" && (
              <div
                className="artifacts-pane__svg-wrap"

                dangerouslySetInnerHTML={{ __html: artifact.content }}
              />
            )}
            {artifact.type === "markdown" && (
              <div className="artifacts-pane__markdown">{artifact.content}</div>
            )}
            {artifact.type === "code" && (
              <pre>{artifact.content}</pre>
            )}
          </>
        )}

        {tab === "code" && artifact && (
          <pre>{artifact.content}</pre>
        )}

        {tab === "history" && (
          <div className="artifacts-history">
            {versions.length === 0 ? (
              <p style={{ color: "var(--fg-3)", fontSize: 12, fontFamily: "var(--font-mono, monospace)" }}>
                No version history yet.
              </p>
            ) : (
              <>
                {versions.map((v) => (
                  <div
                    key={v.id}
                    className={`artifacts-history__item ${selectedVersion?.id === v.id ? "selected" : ""}`}
                    onClick={() => setSelectedVersion(selectedVersion?.id === v.id ? null : v)}
                  >
                    <div className="artifacts-history__meta">
                      v{v.version} · {new Date(v.createdAt).toLocaleString()}
                    </div>
                  </div>
                ))}

                {artifact && diffTarget && diffTarget.id !== artifact.id && (
                  <div className="artifacts-diff">
                    <div style={{ color: "var(--fg-3)", fontSize: 11, marginBottom: 8, fontFamily: "var(--font-mono, monospace)" }}>
                      Diff: v{diffTarget.version} → v{artifact.version}
                    </div>
                    {diffLines(diffTarget.content, artifact.content).map((line, i) => (
                      <div
                        key={i}
                        className={`artifacts-diff__${line.kind}`}
                        style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
                      >
                        {line.kind === "add" ? "+ " : line.kind === "del" ? "- " : "  "}
                        {line.text}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
