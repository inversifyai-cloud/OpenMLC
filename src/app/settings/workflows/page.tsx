"use client";

import { useEffect, useState, useCallback } from "react";
import { CronExpressionParser } from "cron-parser";

type Schedule = {
  id: string;
  name: string;
  cron: string;
  kind: "chat" | "swarm";
  payload: string;
  enabled: boolean;
  lastRunAt: string | null;
  lastRunStatus: string | null;
  nextRunAt: string | null;
  createdAt: string;
};

type Webhook = {
  id: string;
  slug: string;
  kind: "chat" | "swarm";
  presetPayload: string;
  createdAt: string;
};

type Run = {
  id: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  error: string | null;
  schedule: { id: string; name: string } | null;
  webhook: { id: string; slug: string } | null;
};

const MONO: React.CSSProperties = { fontFamily: "var(--font-mono)", fontSize: 12 };
const LABEL: React.CSSProperties = {
  ...MONO,
  fontSize: 10,
  letterSpacing: "0.12em",
  textTransform: "uppercase" as const,
  color: "var(--fg-3)",
  marginBottom: 6,
  display: "block",
};
const INPUT: React.CSSProperties = {
  width: "100%",
  background: "var(--surface-1)",
  border: "1px solid var(--stroke-1)",
  borderRadius: "var(--r-2)",
  color: "var(--fg-1)",
  padding: "7px 10px",
  fontSize: 13,
  outline: "none",
  boxSizing: "border-box" as const,
};
const MONO_INPUT: React.CSSProperties = { ...INPUT, fontFamily: "var(--font-mono)" };
const BTN: React.CSSProperties = {
  background: "var(--accent)",
  color: "#fff",
  border: "none",
  borderRadius: "var(--r-2)",
  padding: "7px 16px",
  fontSize: 12,
  fontFamily: "var(--font-mono)",
  cursor: "pointer",
  letterSpacing: "0.04em",
};
const BTN_GHOST: React.CSSProperties = {
  ...BTN,
  background: "transparent",
  color: "var(--fg-2)",
  border: "1px solid var(--stroke-1)",
};
const BTN_DANGER: React.CSSProperties = { ...BTN_GHOST, color: "var(--red, #e53e3e)", borderColor: "var(--red, #e53e3e)" };
const ROW: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "10px 0",
  borderBottom: "1px solid var(--stroke-1)",
};

function nextFires(cron: string): string[] {
  try {
    const iter = CronExpressionParser.parse(cron);
    const times: string[] = [];
    for (let i = 0; i < 3; i++) {
      times.push(iter.next().toDate().toLocaleString());
    }
    return times;
  } catch {
    return [];
  }
}

function statusDot(status: string | null) {
  const color =
    status === "completed" ? "var(--accent)" :
    status === "failed" ? "var(--red, #e53e3e)" :
    status === "running" ? "#f6ad55" :
    "var(--fg-3)";
  return (
    <span
      style={{
        display: "inline-block",
        width: 7,
        height: 7,
        borderRadius: "50%",
        background: color,
        flexShrink: 0,
      }}
    />
  );
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

function CronInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const fires = nextFires(value);
  const invalid = value.length > 0 && fires.length === 0;

  return (
    <div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="*/5 * * * *"
        style={{
          ...MONO_INPUT,
          borderColor: invalid ? "var(--red, #e53e3e)" : undefined,
        }}
      />
      {fires.length > 0 && (
        <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 2 }}>
          {fires.map((t, i) => (
            <span key={i} style={{ ...MONO, fontSize: 11, color: "var(--fg-3)" }}>
              {i === 0 ? "next: " : `+${i}: `}{t}
            </span>
          ))}
        </div>
      )}
      {invalid && (
        <span style={{ ...MONO, fontSize: 11, color: "var(--red, #e53e3e)", marginTop: 4, display: "block" }}>
          invalid cron expression
        </span>
      )}
    </div>
  );
}

function SchedulesTab() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    cron: "",
    kind: "chat" as "chat" | "swarm",
    payloadRaw: "{}",
  });

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/workflows/schedules");
      const data = await res.json() as { schedules: Schedule[] };
      setSchedules(data.schedules);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function create() {
    setSaving(true);
    setErr(null);
    try {
      let payload: Record<string, unknown> = {};
      try { payload = JSON.parse(form.payloadRaw) as Record<string, unknown>; } catch {
        setErr("payload must be valid JSON");
        return;
      }
      const res = await fetch("/api/workflows/schedules", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: form.name, cron: form.cron, kind: form.kind, payload }),
      });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        setErr(d.error ?? "failed");
        return;
      }
      setAdding(false);
      setForm({ name: "", cron: "", kind: "chat", payloadRaw: "{}" });
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function toggle(id: string, enabled: boolean) {
    await fetch(`/api/workflows/schedules/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
    await load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this schedule?")) return;
    await fetch(`/api/workflows/schedules/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <span style={{ ...MONO, color: "var(--fg-2)", fontSize: 13 }}>
          {loading ? "loading..." : `${schedules.length} schedule${schedules.length !== 1 ? "s" : ""}`}
        </span>
        <button style={BTN} onClick={() => setAdding(true)}>+ new schedule</button>
      </div>

      {adding && (
        <div
          style={{
            background: "var(--surface-1)",
            border: "1px solid var(--stroke-1)",
            borderRadius: "var(--r-2)",
            padding: 20,
            marginBottom: 24,
          }}
        >
          <div style={{ marginBottom: 14 }}>
            <span style={LABEL}>name</span>
            <input style={INPUT} value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Daily haiku" />
          </div>
          <div style={{ marginBottom: 14 }}>
            <span style={LABEL}>cron expression</span>
            <CronInput value={form.cron} onChange={(v) => setForm(f => ({ ...f, cron: v }))} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <span style={LABEL}>kind</span>
            <select
              value={form.kind}
              onChange={(e) => setForm(f => ({ ...f, kind: e.target.value as "chat" | "swarm" }))}
              style={{ ...INPUT, width: "auto" }}
            >
              <option value="chat">chat</option>
              <option value="swarm">swarm</option>
            </select>
          </div>
          <div style={{ marginBottom: 14 }}>
            <span style={LABEL}>payload (json)</span>
            <textarea
              value={form.payloadRaw}
              onChange={(e) => setForm(f => ({ ...f, payloadRaw: e.target.value }))}
              rows={4}
              style={{ ...MONO_INPUT, resize: "vertical" as const }}
            />
          </div>
          {err && <p style={{ color: "var(--red, #e53e3e)", fontSize: 13, marginBottom: 10 }}>{err}</p>}
          <div style={{ display: "flex", gap: 8 }}>
            <button style={BTN} onClick={() => void create()} disabled={saving}>
              {saving ? "saving..." : "create"}
            </button>
            <button style={BTN_GHOST} onClick={() => { setAdding(false); setErr(null); }}>cancel</button>
          </div>
        </div>
      )}

      {schedules.length === 0 && !loading && !adding && (
        <p style={{ color: "var(--fg-3)", fontSize: 13 }}>no schedules yet. create one to run chat or swarm on a cron.</p>
      )}

      <div>
        {schedules.map((s) => (
          <div key={s.id} style={ROW}>
            {statusDot(s.lastRunStatus)}
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: 13, color: "var(--fg-1)", fontWeight: 500 }}>{s.name}</span>
              <div style={{ display: "flex", gap: 12, marginTop: 3 }}>
                <span style={{ ...MONO, fontSize: 11, color: "var(--fg-3)" }}>{s.cron}</span>
                <span style={{ ...MONO, fontSize: 11, color: "var(--fg-3)" }}>{s.kind}</span>
                <span style={{ ...MONO, fontSize: 11, color: "var(--fg-3)" }}>
                  next: {fmtDate(s.nextRunAt)}
                </span>
                {s.lastRunAt && (
                  <span style={{ ...MONO, fontSize: 11, color: "var(--fg-3)" }}>
                    last: {fmtDate(s.lastRunAt)} ({s.lastRunStatus})
                  </span>
                )}
              </div>
            </div>
            <button
              style={{ ...BTN_GHOST, fontSize: 11, padding: "4px 10px" }}
              onClick={() => void toggle(s.id, !s.enabled)}
            >
              {s.enabled ? "disable" : "enable"}
            </button>
            <button
              style={{ ...BTN_DANGER, fontSize: 11, padding: "4px 10px" }}
              onClick={() => void remove(s.id)}
            >
              delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function WebhooksTab() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({
    kind: "chat" as "chat" | "swarm",
    presetRaw: "{}",
  });
  const [created, setCreated] = useState<{ slug: string; secret: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/workflows/webhooks");
      const data = await res.json() as { webhooks: Webhook[] };
      setWebhooks(data.webhooks);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function create() {
    setSaving(true);
    setErr(null);
    try {
      let presetPayload: Record<string, unknown> = {};
      try { presetPayload = JSON.parse(form.presetRaw) as Record<string, unknown>; } catch {
        setErr("preset payload must be valid JSON");
        return;
      }
      const res = await fetch("/api/workflows/webhooks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: form.kind, presetPayload }),
      });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        setErr(d.error ?? "failed");
        return;
      }
      const data = await res.json() as { webhook: Webhook; secret: string };
      setCreated({ slug: data.webhook.slug, secret: data.secret });
      setAdding(false);
      setForm({ kind: "chat", presetRaw: "{}" });
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this webhook? The URL will stop working immediately.")) return;
    await fetch(`/api/workflows/webhooks/${id}`, { method: "DELETE" });
    await load();
  }

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://your-openmlc-url";

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <span style={{ ...MONO, color: "var(--fg-2)", fontSize: 13 }}>
          {loading ? "loading..." : `${webhooks.length} webhook${webhooks.length !== 1 ? "s" : ""}`}
        </span>
        <button style={BTN} onClick={() => { setAdding(true); setCreated(null); }}>+ new webhook</button>
      </div>

      {created && (
        <div
          style={{
            background: "var(--surface-1)",
            border: "1px solid var(--accent)",
            borderRadius: "var(--r-2)",
            padding: 20,
            marginBottom: 24,
          }}
        >
          <span style={{ ...LABEL, color: "var(--accent)" }}>webhook created — save secret now, it won&apos;t be shown again</span>
          <div style={{ marginBottom: 12 }}>
            <span style={LABEL}>endpoint url</span>
            <code style={{ ...MONO, fontSize: 12, color: "var(--fg-1)", wordBreak: "break-all" as const }}>
              {baseUrl}/api/hooks/{created.slug}
            </code>
          </div>
          <div style={{ marginBottom: 12 }}>
            <span style={LABEL}>secret</span>
            <code style={{ ...MONO, fontSize: 12, color: "var(--fg-1)", wordBreak: "break-all" as const }}>
              {created.secret}
            </code>
          </div>
          <div style={{ marginBottom: 12 }}>
            <span style={LABEL}>example curl</span>
            <pre
              style={{
                ...MONO,
                fontSize: 11,
                color: "var(--fg-2)",
                background: "var(--surface-0)",
                padding: 12,
                borderRadius: "var(--r-2)",
                overflowX: "auto" as const,
                whiteSpace: "pre-wrap" as const,
                wordBreak: "break-all" as const,
              }}
            >{`BODY='{"prompt":"say hello"}'
SIG=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "${created.secret}" | awk '{print $2}')
curl -X POST ${baseUrl}/api/hooks/${created.slug} \\
  -H "Content-Type: application/json" \\
  -H "X-OpenMLC-Signature: $SIG" \\
  -d "$BODY"`}</pre>
          </div>
          <button style={BTN_GHOST} onClick={() => setCreated(null)}>dismiss</button>
        </div>
      )}

      {adding && (
        <div
          style={{
            background: "var(--surface-1)",
            border: "1px solid var(--stroke-1)",
            borderRadius: "var(--r-2)",
            padding: 20,
            marginBottom: 24,
          }}
        >
          <div style={{ marginBottom: 14 }}>
            <span style={LABEL}>kind</span>
            <select
              value={form.kind}
              onChange={(e) => setForm(f => ({ ...f, kind: e.target.value as "chat" | "swarm" }))}
              style={{ ...INPUT, width: "auto" }}
            >
              <option value="chat">chat</option>
              <option value="swarm">swarm</option>
            </select>
          </div>
          <div style={{ marginBottom: 14 }}>
            <span style={LABEL}>preset payload (json — merged with incoming body)</span>
            <textarea
              value={form.presetRaw}
              onChange={(e) => setForm(f => ({ ...f, presetRaw: e.target.value }))}
              rows={4}
              style={{ ...MONO_INPUT, resize: "vertical" as const }}
            />
          </div>
          {err && <p style={{ color: "var(--red, #e53e3e)", fontSize: 13, marginBottom: 10 }}>{err}</p>}
          <div style={{ display: "flex", gap: 8 }}>
            <button style={BTN} onClick={() => void create()} disabled={saving}>
              {saving ? "creating..." : "create webhook"}
            </button>
            <button style={BTN_GHOST} onClick={() => { setAdding(false); setErr(null); }}>cancel</button>
          </div>
        </div>
      )}

      {webhooks.length === 0 && !loading && !adding && (
        <p style={{ color: "var(--fg-3)", fontSize: 13 }}>no webhooks yet. create one to trigger chat or swarm from external systems.</p>
      )}

      <div>
        {webhooks.map((w) => (
          <div key={w.id} style={ROW}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <code style={{ ...MONO, fontSize: 12, color: "var(--fg-1)" }}>/api/hooks/{w.slug}</code>
              <div style={{ display: "flex", gap: 12, marginTop: 3 }}>
                <span style={{ ...MONO, fontSize: 11, color: "var(--fg-3)" }}>{w.kind}</span>
                <span style={{ ...MONO, fontSize: 11, color: "var(--fg-3)" }}>
                  created {fmtDate(w.createdAt)}
                </span>
              </div>
            </div>
            <button
              style={{ ...BTN_GHOST, fontSize: 11, padding: "4px 10px" }}
              onClick={() => {
                void navigator.clipboard.writeText(`${baseUrl}/api/hooks/${w.slug}`);
              }}
            >
              copy url
            </button>
            <button
              style={{ ...BTN_DANGER, fontSize: 11, padding: "4px 10px" }}
              onClick={() => void remove(w.id)}
            >
              delete
            </button>
          </div>
        ))}
      </div>

      {webhooks.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <RecentRuns />
        </div>
      )}
    </div>
  );
}

function RecentRuns() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch("/api/workflows/runs?limit=20")
      .then(r => r.json())
      .then((d: { runs: Run[] }) => setRuns(d.runs))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <span style={LABEL}>recent runs</span>
      {loading && <p style={{ color: "var(--fg-3)", fontSize: 13 }}>loading...</p>}
      {!loading && runs.length === 0 && <p style={{ color: "var(--fg-3)", fontSize: 13 }}>no runs yet.</p>}
      {runs.map((r) => (
        <div key={r.id} style={{ ...ROW, fontSize: 12 }}>
          {statusDot(r.status)}
          <span style={{ ...MONO, color: "var(--fg-2)" }}>{r.status}</span>
          <span style={{ ...MONO, color: "var(--fg-3)" }}>
            {r.schedule ? `schedule: ${r.schedule.name}` : r.webhook ? `webhook: ${r.webhook.slug}` : "unknown"}
          </span>
          <span style={{ ...MONO, color: "var(--fg-3)", marginLeft: "auto" }}>{fmtDate(r.startedAt)}</span>
          {r.error && <span style={{ ...MONO, color: "var(--red, #e53e3e)", fontSize: 11 }}>{r.error}</span>}
        </div>
      ))}
    </div>
  );
}

export default function WorkflowsPage() {
  const [tab, setTab] = useState<"schedules" | "webhooks">("schedules");

  const TAB_STYLE = (active: boolean): React.CSSProperties => ({
    ...MONO,
    fontSize: 11,
    letterSpacing: "0.12em",
    textTransform: "uppercase" as const,
    padding: "6px 14px",
    background: active ? "var(--surface-1)" : "transparent",
    border: "1px solid",
    borderColor: active ? "var(--stroke-1)" : "transparent",
    borderRadius: "var(--r-2)",
    color: active ? "var(--fg-1)" : "var(--fg-3)",
    cursor: "pointer",
  });

  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ marginBottom: 28 }}>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "var(--fg-3)",
          }}
        >
          settings · workflows
        </span>
        <h1 style={{ fontSize: 28, fontWeight: 300, letterSpacing: "-0.02em", margin: "8px 0 4px", color: "var(--fg-1)" }}>
          agentic workflows
        </h1>
        <p style={{ color: "var(--fg-3)", fontSize: 14, lineHeight: 1.5 }}>
          schedule recurring chat or swarm runs. trigger them via authenticated webhooks from external systems.
        </p>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 24 }}>
        <button style={TAB_STYLE(tab === "schedules")} onClick={() => setTab("schedules")}>schedules</button>
        <button style={TAB_STYLE(tab === "webhooks")} onClick={() => setTab("webhooks")}>webhooks</button>
      </div>

      {tab === "schedules" ? <SchedulesTab /> : <WebhooksTab />}
    </div>
  );
}
