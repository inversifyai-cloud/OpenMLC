import Link from "next/link";

export type TopSpaceRow = {
  id: string;
  name: string;
  emoji: string | null;
  chatCount: number;
  lastActivity: Date | null;
};

type Props = { spaces: TopSpaceRow[] };

function relTime(d: Date | null): string {
  if (!d) return "no activity";
  const diff = Date.now() - d.getTime();
  const min = 60_000, hr = 60 * min, day = 24 * hr, week = 7 * day;
  if (diff < min) return "just now";
  if (diff < hr) return `${Math.floor(diff / min)}m ago`;
  if (diff < day) return `${Math.floor(diff / hr)}h ago`;
  if (diff < week) return `${Math.floor(diff / day)}d ago`;
  if (diff < 30 * day) return `${Math.floor(diff / week)}w ago`;
  return `${Math.floor(diff / (30 * day))}mo ago`;
}

export function TopSpaces({ spaces }: Props) {
  return (
    <section className="home-section">
      <div className="home-label">
        <em>Spaces</em>
      </div>
      {spaces.length === 0 ? (
        <p className="home-empty">
          Group your chats into spaces — keep work, side projects, and journaling
          separate. <Link href="/spaces">Create your first space →</Link>
        </p>
      ) : (
        <>
          <div className="home-rowlist">
            {spaces.slice(0, 3).map((s) => (
              <Link key={s.id} href={`/spaces/${s.id}`} className="home-row">
                <span className="home-row__emoji" aria-hidden>
                  {s.emoji || "·"}
                </span>
                <span className="home-row__name">
                  <b>{s.name}</b>
                </span>
                <span className="home-row__count">
                  {s.chatCount} {s.chatCount === 1 ? "chat" : "chats"}
                </span>
                <span className="home-row__time" suppressHydrationWarning>
                  {relTime(s.lastActivity)}
                </span>
              </Link>
            ))}
          </div>
          <div className="home-tail">
            <Link href="/spaces" className="home-link-mono">
              View all spaces →
            </Link>
          </div>
        </>
      )}
    </section>
  );
}
