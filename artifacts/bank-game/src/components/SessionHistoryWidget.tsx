import type { XpHistoryEntry } from "@/lib/engine";

interface Props {
  xpHistory: XpHistoryEntry[];
}

function fmtDate(iso: string, n: number): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y.slice(2)}(${n})`;
}

export default function SessionHistoryWidget({ xpHistory }: Props) {
  if (xpHistory.length === 0) return null;

  return (
    <div className="sh-widget">
      <div className="sh-widget-title">История опыта</div>
      <div className="sh-widget-scroll">
        {xpHistory.map((e, i) => (
          <div key={i} className="sh-row">
            <span className="sh-date">{fmtDate(e.date, e.n)}</span>
            <span className="sh-pct">{e.pct}%</span>
            <span className="sh-xp">+{e.xp} оп.</span>
          </div>
        ))}
      </div>
    </div>
  );
}
