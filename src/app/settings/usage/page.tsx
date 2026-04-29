import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

function fmtUsd(n: number): string {
  if (n < 0.01) return n.toFixed(4);
  return n.toFixed(2);
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return String(n);
}

function lastNDays(n: number): string[] {
  const days: string[] = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

export default async function UsagePage() {
  const session = await getSession();
  if (!session.profileId) redirect("/profiles");
  const profileId = session.profileId;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .slice(0, 10);

  const monthRows = await db.usageDaily.findMany({
    where: { profileId, day: { gte: monthStart } },
  });

  const monthCost = monthRows.reduce((s, r) => s + r.costUsd, 0);
  const monthRequests = monthRows.reduce((s, r) => s + r.requestCount, 0);
  const monthInputTokens = monthRows.reduce((s, r) => s + r.inputTokens, 0);
  const monthOutputTokens = monthRows.reduce((s, r) => s + r.outputTokens, 0);

  const thirtyDaysStart = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    return d.toISOString().slice(0, 10);
  })();

  const chartRows = await db.usageDaily.findMany({
    where: { profileId, day: { gte: thirtyDaysStart } },
  });

  const dayMap = new Map<string, number>();
  for (const r of chartRows) {
    dayMap.set(r.day, (dayMap.get(r.day) ?? 0) + r.costUsd);
  }
  const days30 = lastNDays(30);
  const dayCosts = days30.map((day) => ({ day, cost: dayMap.get(day) ?? 0 }));
  const maxCost = Math.max(...dayCosts.map((d) => d.cost), 0.0001);

  const modelMap = new Map<
    string,
    { modelId: string; providerId: string; cost: number; requests: number; inputTokens: number; outputTokens: number; lastDay: string }
  >();
  for (const r of chartRows) {
    const existing = modelMap.get(r.modelId);
    if (existing) {
      existing.cost += r.costUsd;
      existing.requests += r.requestCount;
      existing.inputTokens += r.inputTokens;
      existing.outputTokens += r.outputTokens;
      if (r.day > existing.lastDay) existing.lastDay = r.day;
    } else {
      modelMap.set(r.modelId, {
        modelId: r.modelId,
        providerId: r.providerId,
        cost: r.costUsd,
        requests: r.requestCount,
        inputTokens: r.inputTokens,
        outputTokens: r.outputTokens,
        lastDay: r.day,
      });
    }
  }
  const modelRows = Array.from(modelMap.values()).sort((a, b) => b.cost - a.cost);

  const caps = await db.budgetCap.findMany({ where: { profileId }, orderBy: { createdAt: "desc" } });

  const CHART_W = 600;
  const CHART_H = 80;
  const BAR_W = Math.floor((CHART_W - 30) / 30) - 1;
  const BAR_MAX_H = CHART_H - 4;

  return (
    <div style={{ maxWidth: 760 }}>

      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "var(--fg-3)",
        }}
      >
        settings · usage
      </span>

      <h1
        style={{
          fontSize: 28,
          fontWeight: 300,
          letterSpacing: "-0.02em",
          margin: "8px 0 28px",
          color: "var(--fg-1)",
        }}
      >
        cost &amp; usage
      </h1>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 12,
          marginBottom: 32,
        }}
      >
        {[
          { label: "this month", value: `$${fmtUsd(monthCost)}` },
          { label: "requests", value: monthRequests.toLocaleString() },
          { label: "input tokens", value: fmtTokens(monthInputTokens) },
          { label: "output tokens", value: fmtTokens(monthOutputTokens) },
        ].map(({ label, value }) => (
          <div
            key={label}
            style={{
              border: "1px solid var(--stroke-1)",
              borderRadius: 2,
              padding: "14px 16px",
              background: "var(--surface-1)",
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 9,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "var(--fg-3)",
                marginBottom: 6,
              }}
            >
              {label}
            </div>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 22,
                fontWeight: 600,
                color: "var(--fg-1)",
                letterSpacing: "-0.02em",
              }}
            >
              {value}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          border: "1px solid var(--stroke-1)",
          borderRadius: 2,
          padding: "20px 20px 14px",
          background: "var(--surface-1)",
          marginBottom: 28,
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--fg-3)",
            marginBottom: 12,
          }}
        >
          daily cost · last 30 days
        </div>
        <svg
          width={CHART_W}
          height={CHART_H}
          viewBox={`0 0 ${CHART_W} ${CHART_H}`}
          style={{ display: "block", overflow: "visible" }}
        >
          {dayCosts.map(({ day, cost }, i) => {
            const barH = cost > 0 ? Math.max(2, Math.round((cost / maxCost) * BAR_MAX_H)) : 1;
            const x = i * (BAR_W + 1);
            const y = CHART_H - barH;
            return (
              <g key={day}>
                <rect
                  x={x}
                  y={y}
                  width={BAR_W}
                  height={barH}
                  fill={cost > 0 ? "var(--accent)" : "var(--stroke-1)"}
                  rx={1}
                />
                <title>{`${day}: $${cost.toFixed(4)}`}</title>
              </g>
            );
          })}
        </svg>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 6,
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            color: "var(--fg-3)",
          }}
        >
          <span>{days30[0]?.slice(5)}</span>
          <span>{days30[14]?.slice(5)}</span>
          <span>{days30[29]?.slice(5)}</span>
        </div>
      </div>

      <div
        style={{
          border: "1px solid var(--stroke-1)",
          borderRadius: 2,
          background: "var(--surface-1)",
          marginBottom: 28,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr",
            padding: "10px 16px",
            borderBottom: "1px solid var(--stroke-1)",
            background: "var(--surface-2, var(--surface-1))",
          }}
        >
          {["model", "provider", "requests", "tokens", "cost"].map((h) => (
            <span
              key={h}
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 9,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "var(--fg-3)",
              }}
            >
              {h}
            </span>
          ))}
        </div>
        {modelRows.length === 0 ? (
          <div style={{ padding: "20px 16px", color: "var(--fg-3)", fontSize: 13 }}>
            No usage data for the last 30 days.
          </div>
        ) : (
          modelRows.map((r, i) => (
            <div
              key={r.modelId}
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr",
                padding: "10px 16px",
                borderBottom:
                  i < modelRows.length - 1 ? "1px solid var(--stroke-1)" : "none",
              }}
            >
              <span style={{ fontSize: 13, color: "var(--fg-1)", fontWeight: 500 }}>
                {r.modelId}
              </span>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  color: "var(--fg-3)",
                }}
              >
                {r.providerId}
              </span>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  color: "var(--fg-2, var(--fg-1))",
                }}
              >
                {r.requests.toLocaleString()}
              </span>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  color: "var(--fg-2, var(--fg-1))",
                }}
              >
                {fmtTokens(r.inputTokens + r.outputTokens)}
              </span>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  color: "var(--accent)",
                  fontWeight: 600,
                }}
              >
                ${fmtUsd(r.cost)}
              </span>
            </div>
          ))
        )}
      </div>

      <div
        style={{
          border: "1px solid var(--stroke-1)",
          borderRadius: 2,
          background: "var(--surface-1)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "14px 16px",
            borderBottom: "1px solid var(--stroke-1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 9,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--fg-3)",
            }}
          >
            budget caps
          </span>
        </div>
        {caps.length === 0 ? (
          <div style={{ padding: "20px 16px", color: "var(--fg-3)", fontSize: 13 }}>
            No budget caps set. Use POST /api/budgets to create one.
          </div>
        ) : (
          caps.map((cap, i) => (
            <div
              key={cap.id}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                padding: "10px 16px",
                borderBottom: i < caps.length - 1 ? "1px solid var(--stroke-1)" : "none",
              }}
            >
              <span style={{ fontSize: 13, color: "var(--fg-1)", fontWeight: 500 }}>
                {cap.providerId}
              </span>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  color: "var(--fg-2, var(--fg-1))",
                }}
              >
                ${fmtUsd(cap.capUsd)} / {cap.periodDays}d
              </span>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  color: "var(--fg-3)",
                }}
              >
                id: {cap.id.slice(0, 8)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
