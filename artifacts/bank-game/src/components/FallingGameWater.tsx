import { useEffect, useRef, useCallback } from "react";

interface Props {
  onComplete: (skillScore: number) => void;
}

// ---- config ----
const GAME_MS     = 4000;
const TOTAL_DROPS = 22;
const DROP_R      = 11;
const BAR_W       = 88;
const BAR_H       = 11;
const W           = 280;
const H           = 310;
const BAR_Y       = H - 28;

// Pre-generate all drops at module level (regenerated each render via useMemo alternative)
function makeDrop(id: number) {
  // first half = slow, second half = fast
  const spawnAt = (id / TOTAL_DROPS) * (GAME_MS * 0.88) + (Math.random() * 120 - 60);
  const slow    = id < TOTAL_DROPS / 2;
  return {
    id,
    x:       DROP_R + Math.random() * (W - DROP_R * 2),
    y:       -DROP_R,
    speed:   slow ? 85 + Math.random() * 35 : 160 + Math.random() * 55,
    spawnAt: Math.max(0, spawnAt),
    active:  false,
    caught:  false,
  };
}

type Drop = ReturnType<typeof makeDrop>;

export default function FallingGameWater({ onComplete }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const barX      = useRef(W / 2);
  const doneRef   = useRef(false);

  // mouse / touch → update bar position
  const onMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) barX.current = e.clientX - rect.left;
  }, []);

  const onTouchMove = useCallback((e: TouchEvent) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) barX.current = e.touches[0].clientX - rect.left;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.addEventListener("touchmove", onTouchMove, { passive: false });

    // state (mutable, no re-render needed)
    const drops: Drop[] = Array.from({ length: TOTAL_DROPS }, (_, i) => makeDrop(i));
    let score     = 0;
    let spawned   = 0;
    let rafId     = 0;
    let lastTs    = -1;
    const start   = performance.now();

    function drawRoundedRect(
      x: number, y: number, w: number, h: number, r: number,
    ) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.arcTo(x + w, y, x + w, y + r, r);
      ctx.lineTo(x + w, y + h - r);
      ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
      ctx.lineTo(x + r, y + h);
      ctx.arcTo(x, y + h, x, y + h - r, r);
      ctx.lineTo(x, y + r);
      ctx.arcTo(x, y, x + r, y, r);
      ctx.closePath();
    }

    function finish() {
      if (doneRef.current) return;
      doneRef.current = true;
      cancelAnimationFrame(rafId);

      const skillScore = Math.round((score / TOTAL_DROPS) * 80);
      console.log(
        `[FallingGameWater] caught: ${score}/${TOTAL_DROPS}  skillScore: ${skillScore}/80`,
      );

      // brief result screen
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "rgba(239,246,255,0.97)";
      ctx.fillRect(0, 0, W, H);

      ctx.textAlign = "center";
      ctx.fillStyle = "#1d4ed8";
      ctx.font      = "bold 20px sans-serif";
      ctx.fillText("💧", W / 2, H / 2 - 28);
      ctx.font = "bold 16px sans-serif";
      ctx.fillText(`${score} / ${TOTAL_DROPS} поймано`, W / 2, H / 2 + 2);
      ctx.font      = "13px sans-serif";
      ctx.fillStyle = "#6b7280";
      ctx.fillText(`Результат: ${skillScore} / 80`, W / 2, H / 2 + 26);

      setTimeout(() => onComplete(skillScore), 700);
    }

    function frame(ts: number) {
      if (doneRef.current) return;
      if (lastTs < 0) lastTs = ts;
      const dt      = Math.min(ts - lastTs, 50) / 1000; // capped delta in seconds
      lastTs        = ts;
      const elapsed = ts - start;

      // spawn
      while (spawned < TOTAL_DROPS && drops[spawned].spawnAt <= elapsed) {
        drops[spawned].active = true;
        spawned++;
      }

      // update
      let activeCnt = 0;
      for (const d of drops) {
        if (!d.active) continue;
        d.y += d.speed * dt;

        // catch check
        if (!d.caught && d.y + DROP_R >= BAR_Y - BAR_H && d.y - DROP_R <= BAR_Y + BAR_H) {
          const bx = barX.current;
          if (d.x >= bx - BAR_W / 2 - DROP_R && d.x <= bx + BAR_W / 2 + DROP_R) {
            d.caught = true;
            d.active = false;
            score++;
            continue;
          }
        }
        if (d.y - DROP_R > H) { d.active = false; continue; }
        activeCnt++;
      }

      // end condition
      if (elapsed >= GAME_MS && activeCnt === 0) { finish(); return; }

      // ---- draw ----
      ctx.clearRect(0, 0, W, H);

      // bg
      ctx.fillStyle = "rgba(239,246,255,0.97)";
      ctx.fillRect(0, 0, W, H);

      // timer bar (top)
      const pct = Math.max(0, 1 - elapsed / GAME_MS);
      ctx.fillStyle = "#dbeafe";
      ctx.fillRect(0, 0, W, 5);
      ctx.fillStyle = elapsed < 2000 ? "#3b82f6" : "#f97316";
      ctx.fillRect(0, 0, W * pct, 5);

      // phase label
      ctx.textAlign  = "center";
      ctx.font       = "11px sans-serif";
      ctx.fillStyle  = "#93c5fd";
      ctx.fillText(elapsed < 2000 ? "Медленно…" : "Быстрее!", W / 2, 20);

      // score
      ctx.textAlign  = "left";
      ctx.font       = "bold 13px sans-serif";
      ctx.fillStyle  = "#1e40af";
      ctx.fillText(`💧 ${score}`, 10, 20);

      // drops
      for (const d of drops) {
        if (!d.active) continue;
        // shadow
        ctx.beginPath();
        ctx.arc(d.x + 2, d.y + 2, DROP_R, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(59,130,246,0.15)";
        ctx.fill();
        // body
        ctx.beginPath();
        ctx.arc(d.x, d.y, DROP_R, 0, Math.PI * 2);
        ctx.fillStyle = "#3b82f6";
        ctx.fill();
        // shine
        ctx.beginPath();
        ctx.arc(d.x - 3, d.y - 3, 4, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.45)";
        ctx.fill();
      }

      // catch bar
      const bx = barX.current;
      drawRoundedRect(bx - BAR_W / 2, BAR_Y - BAR_H / 2, BAR_W, BAR_H, BAR_H / 2);
      ctx.fillStyle = "#1e40af";
      ctx.fill();
      // shine on bar
      drawRoundedRect(bx - BAR_W / 2 + 6, BAR_Y - BAR_H / 2 + 2, BAR_W - 12, 3, 2);
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.fill();

      rafId = requestAnimationFrame(frame);
    }

    rafId = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(rafId);
      canvas.removeEventListener("touchmove", onTouchMove);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <canvas
      ref={canvasRef}
      width={W}
      height={H}
      onMouseMove={onMouseMove}
      style={{
        display:       "block",
        borderRadius:  16,
        cursor:        "none",
        touchAction:   "none",
        border:        "2px solid #bfdbfe",
        userSelect:    "none",
      }}
    />
  );
}
