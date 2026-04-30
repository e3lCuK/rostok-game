interface Props {
  timeLeftMs: number;
  totalMs: number;
  color: string;
  trackColor: string;
  label?: string;
}

export default function GameTimer({ timeLeftMs, totalMs, color, trackColor, label }: Props) {
  const pct = Math.max(0, (timeLeftMs / totalMs) * 100);
  return (
    <div className="game-timer">
      <div className="game-timer-row">
        <span className="game-timer-icon" style={{ color }}>⏱</span>
        <span className="game-timer-secs" style={{ color }}>{Math.ceil(timeLeftMs / 1000)}с</span>
        {label && <span className="game-timer-label">{label}</span>}
      </div>
      <div className="game-timer-track" style={{ background: trackColor }}>
        <div className="game-timer-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}
