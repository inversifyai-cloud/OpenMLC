import Link from "next/link";

export type UpcomingRow = {
  id: string;
  name: string;
  cron: string;
  nextRunAt: Date | null;
};

type Props = { rows: UpcomingRow[] };

// Tiny cron → human helper. Handles the common patterns the workflows page
// generates and falls back to the raw expression. This is intentionally
// conservative — there's no `cronstrue` dependency and we don't want to ship
// one for the home page.
export function describeCron(cron: string): string {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return cron;
  const [m, h, dom, mon, dow] = parts;
  const num = (s: string) => /^\d+$/.test(s);

  // every minute / every hour shortcuts
  if (m === "*" && h === "*" && dom === "*" && mon === "*" && dow === "*") return "every minute";
  if (m === "0" && h === "*" && dom === "*" && mon === "*" && dow === "*") return "every hour, on the hour";
  if (m === "*/5" && h === "*" && dom === "*" && mon === "*" && dow === "*") return "every 5 minutes";
  if (m === "*/15" && h === "*" && dom === "*" && mon === "*" && dow === "*") return "every 15 minutes";
  if (m === "*/30" && h === "*" && dom === "*" && mon === "*" && dow === "*") return "every 30 minutes";

  // daily at HH:MM
  if (num(m) && num(h) && dom === "*" && mon === "*" && dow === "*") {
    return `every day at ${formatHm(Number(h), Number(m))}`;
  }
  // weekday only
  if (num(m) && num(h) && dom === "*" && mon === "*" && dow === "1-5") {
    return `every weekday at ${formatHm(Number(h), Number(m))}`;
  }
  // weekend
  if (num(m) && num(h) && dom === "*" && mon === "*" && (dow === "0,6" || dow === "6,0")) {
    return `every weekend at ${formatHm(Number(h), Number(m))}`;
  }
  // single day-of-week
  const dowMap = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  if (num(m) && num(h) && dom === "*" && mon === "*" && num(dow)) {
    const d = Number(dow);
    if (d >= 0 && d <= 6) return `every ${dowMap[d]} at ${formatHm(Number(h), Number(m))}`;
  }
  // monthly
  if (num(m) && num(h) && num(dom) && mon === "*" && dow === "*") {
    return `monthly on day ${dom} at ${formatHm(Number(h), Number(m))}`;
  }
  return cron;
}

function formatHm(h: number, m: number): string {
  const ampm = h >= 12 ? "pm" : "am";
  const hr = h % 12 === 0 ? 12 : h % 12;
  if (m === 0) return `${hr}${ampm}`;
  return `${hr}:${String(m).padStart(2, "0")}${ampm}`;
}

function relFuture(d: Date | null): string {
  if (!d) return "unscheduled";
  const diff = d.getTime() - Date.now();
  const min = 60_000, hr = 60 * min, day = 24 * hr;
  if (diff < 0) return "due now";
  if (diff < min) return "in <1m";
  if (diff < hr) return `in ${Math.floor(diff / min)}m`;
  if (diff < day) return `in ${Math.floor(diff / hr)}h`;
  if (diff < 7 * day) return `in ${Math.floor(diff / day)}d`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function UpcomingRuns({ rows }: Props) {
  return (
    <section className="home-section">
      <div className="home-label">
        <em>Upcoming</em>
      </div>
      {rows.length === 0 ? (
        <p className="home-empty">
          No scheduled runs yet.{" "}
          <Link href="/settings/workflows">Create a schedule →</Link>
        </p>
      ) : (
        <>
          <div className="home-rowlist">
            {rows.slice(0, 5).map((r) => (
              <Link key={r.id} href="/settings/workflows" className="home-up">
                <span>
                  <span className="home-up__name">{r.name}</span>
                  <span className="home-up__cron">{describeCron(r.cron)}</span>
                </span>
                <span className="home-up__when" suppressHydrationWarning>
                  {relFuture(r.nextRunAt)}
                </span>
              </Link>
            ))}
          </div>
          <div className="home-tail">
            <Link href="/settings/workflows" className="home-link-mono">
              Manage workflows →
            </Link>
          </div>
        </>
      )}
    </section>
  );
}
