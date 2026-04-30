import { TopRail } from "@/components/chat/TopRail";

/**
 * Standard non-chat / non-settings page shell. Mirrors the settings layout
 * minus the left rail, so every section page (home, library, spaces,
 * inbox) has the same chrome and the same content gutter.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateRows: "44px 1fr",
        height: "100vh",
        position: "relative",
        isolation: "isolate",
      }}
    >
      <TopRail />
      <div style={{ overflow: "auto", minHeight: 0, background: "var(--bg-app)" }}>
        <main style={{ padding: "32px 40px", maxWidth: 1100, margin: "0 auto" }}>
          {children}
        </main>
      </div>
    </div>
  );
}

export function PageHeader({
  kicker,
  title,
  subtitle,
  right,
}: {
  kicker?: string;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <header style={{ marginBottom: 28 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {kicker ? (
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "var(--fg-3)",
              }}
            >
              {kicker}
            </span>
          ) : null}
          <h1
            style={{
              fontSize: 28,
              fontWeight: 300,
              letterSpacing: "-0.02em",
              margin: kicker ? "8px 0 4px" : "0 0 4px",
              color: "var(--fg-1)",
            }}
          >
            {title}
          </h1>
          {subtitle ? (
            <p style={{ color: "var(--fg-3)", fontSize: 14, lineHeight: 1.5, margin: 0 }}>
              {subtitle}
            </p>
          ) : null}
        </div>
        {right ? <div style={{ flexShrink: 0 }}>{right}</div> : null}
      </div>
    </header>
  );
}
