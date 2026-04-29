"use client";

import { useEffect, useState } from "react";

export type Folder = {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
  createdAt: string;
};

type Props = {
  activeFolder: string | null;
  onSelect: (folderId: string | null) => void;
};

export function FolderManager({ activeFolder, onSelect }: Props) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  useEffect(() => {
    fetch("/api/folders")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.folders) setFolders(d.folders); })
      .catch(() => {});
  }, []);

  async function createFolder() {
    const name = newName.trim();
    if (!name) return;
    const res = await fetch("/api/folders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      const d = await res.json();
      setFolders((f) => [...f, d.folder]);
      setNewName("");
      setCreating(false);
    }
  }

  async function deleteFolder(id: string) {
    if (activeFolder === id) onSelect(null);
    await fetch(`/api/folders/${id}`, { method: "DELETE" });
    setFolders((f) => f.filter((x) => x.id !== id));
  }

  async function renameFolder(id: string) {
    const name = editName.trim();
    if (!name) return;
    const res = await fetch(`/api/folders/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      const d = await res.json();
      setFolders((f) => f.map((x) => x.id === id ? d.folder : x));
      setEditId(null);
    }
  }

  return (
    <div className="fm-wrap">
      <button
        className="fm-toggle"
        onClick={() => setExpanded((e) => !e)}
        type="button"
        title="folders"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        </svg>
        <span>folders</span>
        <span className="fm-count">{folders.length}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={`fm-chev${expanded ? " fm-chev--open" : ""}`} aria-hidden>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {expanded && (
        <div className="fm-list">
          <button
            className={`fm-folder-row${activeFolder === null ? " fm-folder-row--active" : ""}`}
            onClick={() => onSelect(null)}
            type="button"
          >
            <span className="fm-folder-dot" style={{ background: "var(--fg-3)" }} />
            <span className="fm-folder-name">all conversations</span>
          </button>

          {folders.map((f) => (
            <div key={f.id} className="fm-folder-item">
              {editId === f.id ? (
                <form
                  className="fm-edit-form"
                  onSubmit={(e) => { e.preventDefault(); renameFolder(f.id); }}
                >
                  <input
                    className="fm-edit-input"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    autoFocus
                    onBlur={() => setEditId(null)}
                  />
                </form>
              ) : (
                <button
                  className={`fm-folder-row${activeFolder === f.id ? " fm-folder-row--active" : ""}`}
                  onClick={() => onSelect(f.id)}
                  type="button"
                >
                  <span className="fm-folder-dot" style={{ background: f.color }} />
                  <span className="fm-folder-name">{f.name}</span>
                  <button
                    className="fm-icon-btn"
                    onClick={(e) => { e.stopPropagation(); setEditId(f.id); setEditName(f.name); }}
                    title="rename"
                    type="button"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                  <button
                    className="fm-icon-btn fm-icon-btn--danger"
                    onClick={(e) => { e.stopPropagation(); deleteFolder(f.id); }}
                    title="delete folder"
                    type="button"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
                    </svg>
                  </button>
                </button>
              )}
            </div>
          ))}

          {creating ? (
            <form
              className="fm-create-form"
              onSubmit={(e) => { e.preventDefault(); createFolder(); }}
            >
              <input
                className="fm-create-input"
                placeholder="folder name…"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                autoFocus
                onBlur={() => { if (!newName.trim()) setCreating(false); }}
              />
              <button type="submit" className="fm-create-btn">add</button>
            </form>
          ) : (
            <button
              className="fm-add-btn"
              onClick={() => setCreating(true)}
              type="button"
            >
              + new folder
            </button>
          )}
        </div>
      )}
    </div>
  );
}
