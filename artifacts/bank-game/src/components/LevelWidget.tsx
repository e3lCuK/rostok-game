import { getLevelProgress } from "@/lib/levels";

interface Props {
  totalXP: number;
  level: number;
}

export default function LevelWidget({ totalXP, level }: Props) {
  const progress = getLevelProgress(totalXP);

  return (
    <div className="level-widget">
      <span className="level-widget-lvl">У. {level}</span>
      <span className="level-widget-xp">
        {progress.isMax ? "MAX" : `опыт ${progress.xpInLevel} / ${progress.xpNeeded}`}
      </span>
    </div>
  );
}
