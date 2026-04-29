"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HudLabel } from "@/components/chrome/HudLabel";
import { LiveDot } from "@/components/chrome/LiveDot";
import { AttachIcon } from "@/components/icons/AttachIcon";
import { TrashIcon } from "@/components/icons/TrashIcon";
import { RegenIcon } from "@/components/icons/RegenIcon";
import { CloseIcon } from "@/components/icons/CloseIcon";
import { PlusIcon } from "@/components/icons/PlusIcon";

export type EmbeddingStatus = "pending" | "processing" | "completed" | "failed";

export type KnowledgeFileRow = {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  active: boolean;
  embeddingStatus: EmbeddingStatus;
  createdAt: string;
  chunkCount: number;
};

const ACCEPTED_MIME = [
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/pdf",
  "application/json",
  "text/javascript",
  "text/x-python",
  "text/x-typescript",
  "text/x-go",
  "text/x-rust",
];

const ACCEPTED_EXT = ".txt,.md,.markdown,.csv,.pdf,.json,.js,.mjs,.ts,.tsx,.py,.go,.rs";

const CODE_MIME = new Set([
  "text/javascript",
  "text/x-python",
  "text/x-typescript",
  "text/x-go",
  "text/x-rust",
  "application/json",
]);

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
  }
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: sameYear ? undefined : "numeric",
  });
}

function shortMime(mime: string): string {

  const tail = mime.split("/").pop() ?? mime;
  return tail.replace(/^x-/, "").replace(/^vnd\..*$/, "doc");
}

type UploadState = {
  id: string;
  filename: string;
  size: number;
  progress: number;
  error?: string;
};

export function KnowledgeManager({ initialFiles }: { initialFiles: KnowledgeFileRow[] }) {
  const [files, setFiles] = useState<KnowledgeFileRow[]>(initialFiles);
  const [uploads, setUploads] = useState<UploadState[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const hasInflight = useMemo(
    () => files.some((f) => f.embeddingStatus === "pending" || f.embeddingStatus === "processing"),
    [files]
  );

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/knowledge", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { files: KnowledgeFileRow[] };
      setFiles(data.files);
    } catch {

    }
  }, []);

  useEffect(() => {
    if (!hasInflight) return;
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, [hasInflight, refresh]);

  const uploadFile = useCallback(
    async (raw: File) => {
      const tempId = `up_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      setUploads((prev) => [
        ...prev,
        { id: tempId, filename: raw.name, size: raw.size, progress: 0 },
      ]);

      const fd = new FormData();
      fd.append("file", raw);

      try {
        const xhr = new XMLHttpRequest();
        await new Promise<void>((resolve, reject) => {
          xhr.open("POST", "/api/knowledge");
          xhr.upload.addEventListener("progress", (ev) => {
            if (!ev.lengthComputable) return;
            const p = ev.loaded / ev.total;
            setUploads((prev) =>
              prev.map((u) => (u.id === tempId ? { ...u, progress: Math.min(p, 0.99) } : u))
            );
          });
          xhr.addEventListener("load", () => {
            if (xhr.status >= 200 && xhr.status < 300) resolve();
            else {
              try {
                const data = JSON.parse(xhr.responseText);
                reject(new Error(data?.error ?? `upload failed (${xhr.status})`));
              } catch {
                reject(new Error(`upload failed (${xhr.status})`));
              }
            }
          });
          xhr.addEventListener("error", () => reject(new Error("network error")));
          xhr.addEventListener("abort", () => reject(new Error("upload aborted")));
          xhr.send(fd);
        });

        setUploads((prev) => prev.filter((u) => u.id !== tempId));
        await refresh();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "upload failed";
        setUploads((prev) => prev.map((u) => (u.id === tempId ? { ...u, error: msg } : u)));
        setGlobalError(msg);

        setTimeout(() => {
          setUploads((prev) => prev.filter((u) => u.id !== tempId));
        }, 6000);
      }
    },
    [refresh]
  );

  const onPickFiles = useCallback(
    (list: FileList | null) => {
      if (!list || list.length === 0) return;
      setGlobalError(null);
      Array.from(list).forEach((f) => {
        if (f.size > 20 * 1024 * 1024) {
          setGlobalError(`${f.name} exceeds 20 MB`);
          return;
        }
        void uploadFile(f);
      });
    },
    [uploadFile]
  );

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragOver(false);
      onPickFiles(e.dataTransfer.files);
    },
    [onPickFiles]
  );

  const setActive = useCallback(async (id: string, active: boolean) => {

    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, active } : f)));
    try {
      const res = await fetch(`/api/knowledge/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ active }),
      });
      if (!res.ok) throw new Error();
    } catch {

      setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, active: !active } : f)));
      setGlobalError("could not update file");
    }
  }, []);

  const reprocess = useCallback(
    async (id: string) => {

      setFiles((prev) =>
        prev.map((f) => (f.id === id ? { ...f, embeddingStatus: "pending" } : f))
      );
      try {
        const res = await fetch(`/api/knowledge/${id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ reprocess: true }),
        });
        if (!res.ok) throw new Error();
        await refresh();
      } catch {
        setGlobalError("could not start reprocessing");
        await refresh();
      }
    },
    [refresh]
  );

  const remove = useCallback(async (id: string, filename: string) => {
    if (!window.confirm(`delete "${filename}"? this removes the file and all of its chunks.`)) {
      return;
    }
    const prevFiles = files;
    setFiles((prev) => prev.filter((f) => f.id !== id));
    try {
      const res = await fetch(`/api/knowledge/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
    } catch {
      setFiles(prevFiles);
      setGlobalError("could not delete file");
    }
  }, [files]);

  const totalCount = files.length;
  const totalSize = files.reduce((acc, f) => acc + f.size, 0);
  const totalChunks = files.reduce((acc, f) => acc + f.chunkCount, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

      <div className="kb-hud">
        <div className="kb-hud-cell">
          <HudLabel>total</HudLabel>
          <span className="kb-hud-v">{totalCount} {totalCount === 1 ? "file" : "files"}</span>
        </div>
        <div className="kb-hud-cell">
          <HudLabel>size</HudLabel>
          <span className="kb-hud-v">{formatBytes(totalSize)}</span>
        </div>
        <div className="kb-hud-cell">
          <HudLabel>chunks</HudLabel>
          <span className="kb-hud-v">{totalChunks} chunks</span>
        </div>
        <div className="kb-hud-cell" style={{ marginLeft: "auto" }}>
          <HudLabel>status</HudLabel>
          <span className="kb-hud-v" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            {hasInflight ? (
              <>
                <LiveDot status="active" />
                <span style={{ color: "var(--fg-accent)" }}>indexing</span>
              </>
            ) : totalCount === 0 ? (
              <>
                <LiveDot status="idle" pulse={false} />
                <span style={{ color: "var(--fg-3)" }}>idle</span>
              </>
            ) : (
              <>
                <LiveDot status="ok" />
                <span style={{ color: "var(--fg-mint)" }}>ready</span>
              </>
            )}
          </span>
        </div>
      </div>

      <div
        className={`kb-drop ${dragOver ? "is-over" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => fileInput.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            fileInput.current?.click();
          }
        }}
      >
        <input
          ref={fileInput}
          type="file"
          multiple
          accept={ACCEPTED_EXT}
          style={{ display: "none" }}
          onChange={(e) => {
            onPickFiles(e.target.files);

            if (fileInput.current) fileInput.current.value = "";
          }}
        />
        <div className="kb-drop-icon" aria-hidden>
          <AttachIcon size={20} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ color: "var(--fg-1)", fontSize: 14 }}>
            drop files here or <span style={{ color: "var(--fg-accent)" }}>click to browse</span>
          </span>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "var(--fg-4)",
            }}
          >
            txt · md · csv · pdf · json · js · ts · py · go · rs · max 20 MB
          </span>
        </div>
        <button
          type="button"
          className="tool-pill"
          style={{ marginLeft: "auto" }}
          onClick={(e) => {
            e.stopPropagation();
            fileInput.current?.click();
          }}
        >
          <PlusIcon size={11} /> upload
        </button>
      </div>

      {uploads.length > 0 && (
        <div className="kb-uploads">
          {uploads.map((u) => (
            <div key={u.id} className={`kb-upload ${u.error ? "is-err" : ""}`}>
              <span className="kb-upload-name">{u.filename}</span>
              <span className="kb-upload-size">{formatBytes(u.size)}</span>
              {u.error ? (
                <>
                  <span style={{ color: "var(--signal-err)", fontFamily: "var(--font-mono)", fontSize: 11 }}>
                    {u.error}
                  </span>
                  <button
                    type="button"
                    className="kb-icon-btn"
                    onClick={() => setUploads((prev) => prev.filter((p) => p.id !== u.id))}
                    aria-label="dismiss"
                  >
                    <CloseIcon size={12} />
                  </button>
                </>
              ) : (
                <>
                  <div className="kb-upload-bar" aria-hidden>
                    <div
                      className="kb-upload-bar-fill"
                      style={{ width: `${Math.round(u.progress * 100)}%` }}
                    />
                  </div>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 10,
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      color: "var(--fg-accent)",
                    }}
                  >
                    {Math.round(u.progress * 100)}%
                  </span>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {globalError && (
        <div
          style={{
            padding: "8px 12px",
            border: "1px solid color-mix(in oklch, var(--signal-err) 40%, transparent)",
            background: "color-mix(in oklch, var(--signal-err) 8%, transparent)",
            borderRadius: 8,
            color: "var(--signal-err)",
            fontSize: 12,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span>{globalError}</span>
          <button
            type="button"
            onClick={() => setGlobalError(null)}
            className="kb-icon-btn"
            style={{ marginLeft: "auto" }}
            aria-label="dismiss error"
          >
            <CloseIcon size={12} />
          </button>
        </div>
      )}

      {files.length === 0 ? (
        <div className="kb-empty">
          <span className="kb-empty-title">no documents uploaded yet</span>
          <span className="kb-empty-hint">
            once you upload, the assistant can pull relevant snippets from these files into chat
            context — that&apos;s retrieval-augmented generation.
          </span>
        </div>
      ) : (
        <div className="kb-list">
          {files.map((f) => (
            <KnowledgeRow
              key={f.id}
              file={f}
              onToggle={() => setActive(f.id, !f.active)}
              onReprocess={() => reprocess(f.id)}
              onDelete={() => remove(f.id, f.filename)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function statusColor(s: EmbeddingStatus): string {
  if (s === "completed") return "var(--fg-mint)";
  if (s === "processing") return "var(--fg-accent)";
  if (s === "failed") return "var(--signal-err)";
  return "var(--fg-3)";
}

function statusLabel(s: EmbeddingStatus): string {
  if (s === "completed") return "ready";
  if (s === "processing") return "indexing";
  if (s === "failed") return "failed";
  return "queued";
}

function KnowledgeRow({
  file,
  onToggle,
  onReprocess,
  onDelete,
}: {
  file: KnowledgeFileRow;
  onToggle: () => void;
  onReprocess: () => void;
  onDelete: () => void;
}) {
  const isCode = CODE_MIME.has(file.mimeType);
  const showReprocess =
    file.embeddingStatus === "failed" || file.embeddingStatus === "completed";

  return (
    <div className={`kb-row ${file.active ? "" : "is-inactive"}`}>
      <div className="kb-row-head">
        <span
          className="kb-row-name"
          style={isCode ? { fontFamily: "var(--font-mono)", fontSize: 13 } : undefined}
          title={file.filename}
        >
          {file.filename}
        </span>
        <span className="kb-mime">{shortMime(file.mimeType)}</span>
      </div>

      <div className="kb-row-meta">
        <span className="kb-meta-cell">{formatBytes(file.size)}</span>
        <span className="kb-meta-sep">·</span>
        <span className="kb-meta-cell kb-meta-mute">{file.chunkCount} chunks</span>
        <span className="kb-meta-sep">·</span>
        <span
          className="kb-status"
          style={{ color: statusColor(file.embeddingStatus) }}
        >
          {file.embeddingStatus === "processing" && <LiveDot status="active" size={5} />}
          {file.embeddingStatus === "pending" && <LiveDot status="idle" pulse={false} size={5} />}
          {file.embeddingStatus === "completed" && <LiveDot status="ok" pulse={false} size={5} />}
          {file.embeddingStatus === "failed" && <LiveDot status="error" pulse={false} size={5} />}
          <span>{statusLabel(file.embeddingStatus)}</span>
        </span>
      </div>

      <div className="kb-row-actions">
        <label
          className={`kb-toggle ${file.active ? "is-on" : ""}`}
          title={file.active ? "active in retrieval" : "excluded from retrieval"}
        >
          <input
            type="checkbox"
            checked={file.active}
            onChange={onToggle}
            aria-label="active in retrieval"
          />
          <span className="kb-toggle-track" aria-hidden>
            <span className="kb-toggle-thumb" />
          </span>
          <span className="kb-toggle-label">{file.active ? "active" : "off"}</span>
        </label>

        {showReprocess && (
          <button
            type="button"
            className="tool-pill"
            onClick={onReprocess}
            title="re-extract and re-embed"
          >
            <RegenIcon size={11} /> reprocess
          </button>
        )}

        <button
          type="button"
          className="tool-pill kb-danger"
          onClick={onDelete}
          title="delete file and chunks"
        >
          <TrashIcon size={11} /> delete
        </button>
      </div>

      <span className="kb-row-date" title={new Date(file.createdAt).toLocaleString()}>
        {formatDate(file.createdAt)}
      </span>
    </div>
  );
}
