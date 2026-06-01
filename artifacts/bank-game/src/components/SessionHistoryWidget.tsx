import type { XpHistoryEntry } from "@/lib/engine";

interface Props {
  xpHistory: XpHistoryEntry[];
  highlightFirst?: boolean;
}

function fmtDate(iso: string, n: number): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y.slice(2)}(${n})`;
}

export default function SessionHistoryWidget({ xpHistory, highlightFirst }: Props) {
  if (xpHistory.length === 0) return null;

  return (
    <div className="sh-widget">
      <div className="sh-widget-title">История опыта</div>
      <div className="sh-widget-scroll">
        {xpHistory.map((e, i) => (
          <div key={i} className={`sh-row${i === 0 && highlightFirst ? " sh-row-new" : ""}`}>
            <span className="sh-date">{fmtDate(e.date, e.n)}</span>
            <span className="sh-xp">+{e.xp} оп.</span>
          </div>
        ))}
      </div>
    </div>
  );
}
