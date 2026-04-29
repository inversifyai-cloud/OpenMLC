import { ApiKeysManager } from "./manager";

export const dynamic = "force-dynamic";

export default function ApiKeysPage() {
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
          settings · keys
        </span>
        <h1 style={{ fontSize: 28, fontWeight: 300, letterSpacing: "-0.02em", margin: "8px 0 4px", color: "var(--fg-1)" }}>
          api keys
        </h1>
        <p style={{ color: "var(--fg-3)", fontSize: 14, lineHeight: 1.5 }}>
          your keys, your machine. encrypted at rest with{" "}
          <code style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>aes-256-gcm</code>.
          when a key is set here it overrides the platform-wide{" "}
          <code style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>.env</code> fallback.
        </p>
      </div>
      <ApiKeysManager />
    </div>
  );
}
