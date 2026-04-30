import { SpendSparkline } from "./SpendSparkline";

type Props = {
  displayName: string;
  todaySpend: number;
  weekSpend: number;
  spark: number[]; // 7 values, oldest first
  // ISO date for display (server-rendered to avoid hydration mismatch with locale)
  dateLabel: string;
};

function formatUsd(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "$0.00";
  if (n < 0.01) return "<$0.01";
  if (n < 1) return `$${n.toFixed(2)}`;
  if (n < 100) return `$${n.toFixed(2)}`;
  return `$${Math.round(n).toLocaleString()}`;
}

export function HomeHeader({ displayName, todaySpend, weekSpend, spark, dateLabel }: Props) {
  return (
    <header className="home-header home-section">
      <div>
        <h1 className="home-header__date">{dateLabel}</h1>
        <p className="home-header__welcome">
          Welcome back, <strong>{displayName}</strong>.
        </p>
      </div>
      <div className="home-spend">
        <div className="home-spend__num">
          {formatUsd(todaySpend)} today <em>·</em> {formatUsd(weekSpend)} this week
        </div>
        <SpendSparkline points={spark} ariaLabel={`Spend over the last 7 days, ${formatUsd(weekSpend)} total`} />
        <span className="home-spark__caption">7-day spend</span>
      </div>
    </header>
  );
}

export function buildDateLabel(d: Date): string {
  // Avoid locale-dependent server/client mismatch: use a fixed en-US format
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`;
}
