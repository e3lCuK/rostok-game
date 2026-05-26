import { getLevelProgress } from "@/lib/levels";

interface Props {
  totalXP: number;
  level: number;
}

export default function LevelWidget({ totalXP, level }: Props) {
  const progress = getLevelProgress(totalXP);

  return (
    <div className="level-widget">
      <div className="level-widget-top">
        <span className="level-widget-icon">🌱</span>
        <span className="level-widget-lvl">LVL {level}</span>
      </div>
      <div className="level-widget-xp">
        {progress.isMax ? (
          <span>MAX</span>
        ) : (
          <span>{progress.xpInLevel} / {progress.xpNeeded} XP</span>
        )}
      </div>
    </div>
  );
}
