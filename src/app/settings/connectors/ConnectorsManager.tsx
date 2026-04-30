"use client";

import { useEffect, useState } from "react";

export type ConnectorView = {
  provider: string;
  displayName: string;
  scopes: string[];
  configured: boolean;
  hasAccessToken: boolean;
  enabled: boolean;
  accountInfo: { login?: string; email?: string; name?: string } | null;
  clientId: string | null;
};

const MONO: React.CSSProperties = { fontFamily: "var(--font-mono)", fontSize: 12 };
const LABEL: React.CSSProperties = {
  ...MONO,
  fontSize: 10,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "var(--fg-3)",
  marginBottom: 6,
  display: "block",
};

const SETUP_DOCS: Record<string, { url: string; redirect: string; help: string[] }> = {
  github: {
    url: "https://github.com/settings/developers",
    redirect: "/api/connectors/github/callback",
    help: [
      "Open GitHub → Settings → Developer settings → OAuth Apps → New OAuth App.",
      "Set Authorization callback URL to the redirect URI shown below.",
      "Copy the Client ID and generate a Client Secret, then paste both here.",
    ],
  },
  gmail: {
    url: "https://console.cloud.google.com/apis/credentials",
    redirect: "/api/connectors/gmail/callback",
    help: [
      "Open Google Cloud Console → APIs & Services → Credentials.",
      "Create an OAuth 2.0 Client ID (type: Web application).",
      "Add the redirect URI shown below to Authorized redirect URIs.",
      "Enable the Gmail API for the project.",
      "Copy the Client ID and Client Secret here.",
    ],
  },
};

function TextInput({
  value, onChange, placeholder, mono, type,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
  type?: string;
}) {
  return (
    <input
      type={type ?? "text"}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: "100%",
        background: "var(--surface-1)",
        border: "1px solid var(--stroke-1)",
        borderRadius: "var(--r-2)",
        color: "var(--fg-1)",
        padding: "7px 10px",
        fontSize: 13,
        fontFamily: mono ? "var(--font-mono)" : undefined,
        outline: "none",
        boxSizing: "border-box",
      }}
    />
  );
}

function ConnectorCard({ c, onChanged }: { c: ConnectorView; onChanged: () => void }) {
  const [showSetup, setShowSetup] = useState(false);
  const [editing, setEditing] = useState(false);
  const [clientId, setClientId] = useState(c.clientId ?? "");
  const [clientSecret, setClientSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const docs = SETUP_DOCS[c.provider];
  const redirectUri =
    typeof window !== "undefined" && docs ? `${window.location.origin}${docs.redirect}` : docs?.redirect ?? "";

  const status = c.hasAccessToken
    ? "connected"
    : c.configured
      ? "credentials saved · not authorized"
      : "not configured";

  async function saveCreds(thenConnect: boolean) {
    if (!clientId || !clientSecret) {
      setErr("clientId and clientSecret required");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/connectors/${c.provider}/credentials`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ clientId, clientSecret }),
      });
      if (!res.ok) {
        setErr("failed to save credentials");
        return;
      }
      setClientSecret("");
      setEditing(false);
      onChanged();
      if (thenConnect) {
        window.location.href = `/api/connectors/${c.provider}/connect`;
      }
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    if (!confirm(`Disconnect ${c.displayName}?`)) return;
    setBusy(true);
    try {
      await fetch(`/api/connectors/${c.provider}/disconnect`, { method: "POST" });
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        background: "var(--surface-1)",
        border: "1px solid var(--stroke-1)",
        borderRadius: "var(--r-3)",
        padding: "16px 18px",
        marginBottom: 14,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <span style={{ fontWeight: 500, color: "var(--fg-1)", fontSize: 15 }}>{c.displayName}</span>
        <span
          style={{
            ...MONO,
            fontSize: 10,
            color: c.hasAccessToken
              ? "var(--mint-300)"
              : c.configured
                ? "var(--fg-accent)"
                : "var(--fg-4)",
            marginLeft: "auto",
          }}
        >
          {status}
        </span>
      </div>

      {c.hasAccessToken && c.accountInfo && (
        <div style={{ ...MONO, fontSize: 12, color: "var(--fg-3)", marginBottom: 10 }}>
          {c.accountInfo.login && <span>@{c.accountInfo.login} </span>}
          {c.accountInfo.email && <span>· {c.accountInfo.email}</span>}
          {c.accountInfo.name && !c.accountInfo.login && <span>{c.accountInfo.name}</span>}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
        {c.hasAccessToken ? (
          <>
            <button
              type="button"
              onClick={() => void disconnect()}
              disabled={busy}
              style={{
                ...MONO,
                background: "transparent",
                border: "1px solid color-mix(in oklch, var(--signal-err) 40%, transparent)",
                borderRadius: "var(--r-2)",
                color: "var(--signal-err)",
                padding: "5px 12px",
                cursor: "pointer",
                fontSize: 11,
              }}
            >
              disconnect
            </button>
            <a
              href={`/api/connectors/${c.provider}/connect`}
              style={{
                ...MONO,
                background: "transparent",
                border: "1px solid var(--stroke-1)",
                borderRadius: "var(--r-2)",
                color: "var(--fg-3)",
                padding: "5px 12px",
                fontSize: 11,
                textDecoration: "none",
                display: "inline-block",
              }}
            >
              re-authorize
            </a>
          </>
        ) : c.configured && !editing ? (
          <>
            <a
              href={`/api/connectors/${c.provider}/connect`}
              className="send-btn"
              style={{ width: "auto", padding: "0 16px", fontSize: 12, textDecoration: "none", lineHeight: "32px" }}
            >
              connect
            </a>
            <button
              type="button"
              onClick={() => setEditing(true)}
              style={{
                ...MONO,
                background: "transparent",
                border: "1px solid var(--stroke-1)",
                borderRadius: "var(--r-2)",
                color: "var(--fg-3)",
                padding: "5px 12px",
                cursor: "pointer",
                fontSize: 11,
              }}
            >
              edit credentials
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="send-btn"
            style={{ width: "auto", padding: "0 16px", fontSize: 12 }}
          >
            {editing ? "editing…" : "add credentials"}
          </button>
        )}
      </div>

      {editing && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--stroke-1)" }}>
          <div style={{ marginBottom: 10 }}>
            <span style={LABEL}>client id</span>
            <TextInput value={clientId} onChange={setClientId} placeholder="client id" mono />
          </div>
          <div style={{ marginBottom: 10 }}>
            <span style={LABEL}>client secret</span>
            <TextInput
              value={clientSecret}
              onChange={setClientSecret}
              placeholder={c.configured ? "(unchanged unless you enter a new value)" : "client secret"}
              mono
              type="password"
            />
          </div>
          {err && <p style={{ color: "var(--signal-err)", ...MONO, fontSize: 12, marginBottom: 10 }}>{err}</p>}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className="send-btn"
              style={{ width: "auto", padding: "0 16px", fontSize: 12 }}
              disabled={busy}
              onClick={() => void saveCreds(true)}
            >
              {busy ? "saving…" : "save & connect"}
            </button>
            <button
              type="button"
              style={{
                ...MONO,
                background: "transparent",
                border: "1px solid var(--stroke-1)",
                borderRadius: "var(--r-2)",
                color: "var(--fg-3)",
                padding: "6px 14px",
                cursor: "pointer",
                fontSize: 11,
              }}
              disabled={busy}
              onClick={() => void saveCreds(false)}
            >
              save only
            </button>
            <button
              type="button"
              style={{
                ...MONO,
                background: "transparent",
                border: "1px solid var(--stroke-1)",
                borderRadius: "var(--r-2)",
                color: "var(--fg-4)",
                padding: "6px 14px",
                cursor: "pointer",
                fontSize: 11,
              }}
              onClick={() => { setEditing(false); setErr(null); }}
            >
              cancel
            </button>
          </div>
        </div>
      )}

      {docs && (
        <div style={{ marginTop: 12 }}>
          <button
            type="button"
            onClick={() => setShowSetup((v) => !v)}
            style={{
              ...MONO,
              background: "transparent",
              border: "none",
              color: "var(--fg-4)",
              padding: 0,
              cursor: "pointer",
              fontSize: 11,
              textDecoration: "underline",
            }}
          >
            {showSetup ? "hide setup instructions" : "how to set up"}
          </button>
          {showSetup && (
            <div
              style={{
                marginTop: 10,
                padding: 12,
                border: "1px dashed var(--stroke-1)",
                borderRadius: "var(--r-2)",
                fontSize: 12,
                color: "var(--fg-3)",
                lineHeight: 1.6,
              }}
            >
              <ol style={{ margin: "0 0 10px", paddingLeft: 20 }}>
                {docs.help.map((h, i) => <li key={i}>{h}</li>)}
              </ol>
              <div style={{ marginBottom: 8 }}>
                <span style={LABEL}>redirect uri (copy this)</span>
                <code
                  style={{
                    ...MONO,
                    fontSize: 11,
                    color: "var(--fg-accent)",
                    background: "var(--surface-2)",
                    padding: "4px 8px",
                    borderRadius: "var(--r-1)",
                    wordBreak: "break-all",
                    display: "inline-block",
                  }}
                >
                  {redirectUri}
                </code>
              </div>
              <div style={{ marginBottom: 8 }}>
                <span style={LABEL}>scopes requested</span>
                <code style={{ ...MONO, fontSize: 11, color: "var(--fg-3)" }}>
                  {c.scopes.join(", ")}
                </code>
              </div>
              <a
                href={docs.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ ...MONO, fontSize: 11, color: "var(--fg-accent)" }}
              >
                open provider console ↗
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ConnectorsManager({ initial }: { initial: ConnectorView[] }) {
  const [connectors, setConnectors] = useState<ConnectorView[]>(initial);
  const [banner, setBanner] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function reload() {
    const res = await fetch("/api/connectors");
    if (!res.ok) return;
    const data = (await res.json()) as { connectors: Array<Omit<ConnectorView, "clientId"> & { clientId?: string | null }> };
    // /api/connectors doesn't expose clientId — preserve from current state
    setConnectors((prev) =>
      data.connectors.map((c) => ({
        ...c,
        clientId: prev.find((p) => p.provider === c.provider)?.clientId ?? null,
      })),
    );
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const connected = url.searchParams.get("connected");
    const error = url.searchParams.get("error");
    if (connected) {
      setBanner({ kind: "ok", text: `${connected} connected` });
      url.searchParams.delete("connected");
      window.history.replaceState({}, "", url.toString());
      void reload();
    } else if (error) {
      setBanner({ kind: "err", text: error });
      url.searchParams.delete("error");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ marginBottom: 28 }}>
        <span
          style={{
            ...MONO,
            fontSize: 10,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "var(--fg-3)",
          }}
        >
          settings · connectors
        </span>
        <h1
          style={{
            fontSize: 28,
            fontWeight: 300,
            letterSpacing: "-0.02em",
            margin: "8px 0 4px",
            color: "var(--fg-1)",
          }}
        >
          connectors
        </h1>
        <p style={{ color: "var(--fg-3)", fontSize: 14, lineHeight: 1.5, marginBottom: 0 }}>
          authorize OpenMLC to read and act in your external accounts (GitHub, Gmail, etc.) via OAuth. tokens are encrypted at rest.
        </p>
      </div>

      {banner && (
        <div
          style={{
            ...MONO,
            fontSize: 12,
            padding: "10px 14px",
            marginBottom: 16,
            borderRadius: "var(--r-2)",
            border: "1px solid",
            borderColor: banner.kind === "ok" ? "var(--mint-300)" : "var(--signal-err)",
            color: banner.kind === "ok" ? "var(--mint-300)" : "var(--signal-err)",
            background: "var(--surface-1)",
          }}
        >
          {banner.text}
        </div>
      )}

      {connectors.map((c) => (
        <ConnectorCard key={c.provider} c={c} onChanged={() => void reload()} />
      ))}

      <div
        style={{
          marginTop: 32,
          padding: "16px",
          background: "var(--surface-1)",
          border: "1px solid var(--stroke-1)",
          borderRadius: "var(--r-3)",
        }}
      >
        <p style={{ ...MONO, fontSize: 11, color: "var(--fg-4)", margin: 0, lineHeight: 1.6 }}>
          OAuth credentials and tokens are encrypted with your <code style={{ color: "var(--fg-accent)" }}>ENCRYPTION_KEY</code> before being stored. tokens auto-refresh when about to expire.
        </p>
      </div>
    </div>
  );
}
