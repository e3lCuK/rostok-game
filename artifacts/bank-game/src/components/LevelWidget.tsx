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
        <span className="level-widget-icon">◆</span>
        <span className="level-widget-lvl">Ур.{level}</span>
      </div>
      <span className="level-widget-xp">
        {progress.isMax ? "MAX" : `${progress.xpInLevel} / ${progress.xpNeeded} уход`}
      </span>
    </div>
  );
}
