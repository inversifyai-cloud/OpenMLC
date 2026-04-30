import Link from "next/link";

export type InboxPreviewRow = {
  id: string;
  kind: string;
  title: string;
  summary: string | null;
  createdAt: Date;
};

type Props = { rows: InboxPreviewRow[] };

const KIND_LABEL: Record<string, string> = {
  workflow_run: "Workflow",
  swarm_run: "Swarm",
  research_done: "Research",
  browser_done: "Browser",
  schedule_fired: "Schedule",
};

function relTime(d: Date): string {
  const diff = Date.now() - d.getTime();
  const min = 60_000, hr = 60 * min, day = 24 * hr;
  if (diff < min) return "now";
  if (diff < hr) return `${Math.floor(diff / min)}m`;
  if (diff < day) return `${Math.floor(diff / hr)}h`;
  return `${Math.floor(diff / day)}d`;
}

export function InboxPreview({ rows }: Props) {
  if (rows.length === 0) return null;
  return (
    <section className="home-section">
      <div className="home-label">
        <em>Inbox</em>
      </div>
      <div className="home-rowlist">
        {rows.slice(0, 3).map((r) => (
          <Link key={r.id} href="/inbox" className="home-inbox">
            <span>
              <span className="home-inbox__title">
                <em>{KIND_LABEL[r.kind] ?? "Update"}</em>
                {r.title}
              </span>
              {r.summary ? <span className="home-inbox__sum">{r.summary}</span> : null}
            </span>
            <span className="home-inbox__time" suppressHydrationWarning>
              {relTime(r.createdAt)}
            </span>
          </Link>
        ))}
      </div>
      <div className="home-tail">
        <Link href="/inbox" className="home-link-mono">
          Open inbox →
        </Link>
      </div>
    </section>
  );
}
