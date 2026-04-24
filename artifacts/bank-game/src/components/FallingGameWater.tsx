import { useEffect, useRef, useCallback } from "react";

export type GameType = "water" | "sun" | "fertilizer";

interface Props {
  type?: GameType;
  onComplete: (skillScore: number) => void;
}

// ---- visual config per type ----
const CONFIGS = {
  water: {
    bg:          "rgba(239,246,255,0.97)",
    timerBg:     "#dbeafe",
    timerColor:  "#3b82f6",
    scoreFg:     "#1e40af",
    scoreEmoji:  "💧",
    dropColor:   "#3b82f6",
    dropShadow:  "rgba(59,130,246,0.15)",
    barColor:    "#2563eb",
    resultColor: "#1d4ed8",
    border:      "2px solid #bfdbfe",
  },
  sun: {
    bg:          "rgba(255,251,235,0.97)",
    timerBg:     "#fef3c7",
    timerColor:  "#f59e0b",
    scoreFg:     "#92400e",
    scoreEmoji:  "☀️",
    dropColor:   "#f59e0b",
    dropShadow:  "rgba(245,158,11,0.15)",
    barColor:    "#d97706",
    resultColor: "#92400e",
    border:      "2px solid #fde68a",
  },
  fertilizer: {
    bg:          "rgba(240,253,244,0.97)",
    timerBg:     "#dcfce7",
    timerColor:  "#22c55e",
    scoreFg:     "#166534",
    scoreEmoji:  "🌱",
    dropColor:   "#22c55e",
    dropShadow:  "rgba(34,197,94,0.15)",
    barColor:    "#16a34a",
    resultColor: "#166534",
    border:      "2px solid #bbf7d0",
  },
} as const;

// ---- constants ----
const GAME_MS     = 15_000;   // 15 seconds total
const TOTAL_DROPS = 30;       // objects to catch
const DROP_R      = 11;
const BAR_W       = 88;
const BAR_H       = 11;
const W           = 280;
const H           = 310;
const BAR_Y       = H - 28;
const DROP_SPEED  = 100;      // constant px/s — no acceleration

function makeDrop(id: number) {
  // spread evenly across the first 13 s so last drops land before time ends
  const spawnAt = (id / TOTAL_DROPS) * (GAME_MS * 0.87) + (Math.random() * 300 - 150);
  return {
    id,
    x:       DROP_R + Math.random() * (W - DROP_R * 2),
    y:       -DROP_R,
    spawnAt: Math.max(0, spawnAt),
    active:  false,
    caught:  false,
  };
}

type Drop = ReturnType<typeof makeDrop>;

export default function FallingGameWater({ type = "water", onComplete }: Props) {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const barX         = useRef(W / 2);
  const doneRef      = useRef(false);
  const pendingScore = useRef<number | null>(null);

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

    const cfg = CONFIGS[type];

    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    canvas.style.cursor = "none";

    const drops: Drop[] = Array.from({ length: TOTAL_DROPS }, (_, i) => makeDrop(i));
    let catches  = 0;
    let spawned  = 0;
    let rafId    = 0;
    let lastTs   = -1;
    const start  = performance.now();

    function drawRoundedRect(x: number, y: number, w: number, h: number, r: number) {
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

    function feedbackLabel(n: number): string {
      if (n >= 20) return "Отлично!";
      if (n >= 10) return "Хорошо";
      return "Попробуйте ещё";
    }

    function finish() {
      if (doneRef.current) return;
      doneRef.current = true;
      cancelAnimationFrame(rafId);
      canvas.style.cursor = "default";

      // map catches (0–30) → skillScore (0–80)
      const skillScore = Math.min(80, Math.round((catches / TOTAL_DROPS) * 80));
      pendingScore.current = skillScore;
      console.log(`[FallingGame:${type}] catches: ${catches}/${TOTAL_DROPS}  skillScore: ${skillScore}/80`);

      // ---- result screen ----
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = cfg.bg;
      ctx.fillRect(0, 0, W, H);

      // close button
      ctx.beginPath();
      ctx.arc(W - 22, 22, 14, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,0,0,0.08)";
      ctx.fill();
      ctx.textAlign = "center";
      ctx.font      = "bold 15px sans-serif";
      ctx.fillStyle = "#6b7280";
      ctx.fillText("✕", W - 22, 27);

      // emoji
      ctx.textAlign = "center";
      ctx.font      = "bold 36px sans-serif";
      ctx.fillText(cfg.scoreEmoji, W / 2, H / 2 - 32);

      // main result
      ctx.font      = "bold 20px sans-serif";
      ctx.fillStyle = cfg.resultColor;
      ctx.fillText(`Поймано: ${catches}`, W / 2, H / 2 + 8);

      // feedback
      ctx.font      = "14px sans-serif";
      ctx.fillStyle = "#6b7280";
      ctx.fillText(feedbackLabel(catches), W / 2, H / 2 + 34);
    }

    function frame(ts: number) {
      if (doneRef.current) return;
      if (lastTs < 0) lastTs = ts;
      const dt      = Math.min(ts - lastTs, 50) / 1000;
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
        d.y += DROP_SPEED * dt;

        if (!d.caught && d.y + DROP_R >= BAR_Y - BAR_H && d.y - DROP_R <= BAR_Y + BAR_H) {
          const bx = barX.current;
          if (d.x >= bx - BAR_W / 2 - DROP_R && d.x <= bx + BAR_W / 2 + DROP_R) {
            d.caught = true;
            d.active = false;
            catches++;
            continue;
          }
        }
        if (d.y - DROP_R > H) { d.active = false; continue; }
        activeCnt++;
      }

      if (elapsed >= GAME_MS && activeCnt === 0) { finish(); return; }

      // ---- draw ----
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = cfg.bg;
      ctx.fillRect(0, 0, W, H);

      // timer bar
      const pct = Math.max(0, 1 - elapsed / GAME_MS);
      ctx.fillStyle = cfg.timerBg;
      ctx.fillRect(0, 0, W, 5);
      ctx.fillStyle = cfg.timerColor;
      ctx.fillRect(0, 0, W * pct, 5);

      // catch counter
      ctx.textAlign = "left";
      ctx.font      = "bold 13px sans-serif";
      ctx.fillStyle = cfg.scoreFg;
      ctx.fillText(`${cfg.scoreEmoji} ${catches}`, 10, 20);

      // drops
      for (const d of drops) {
        if (!d.active) continue;
        // shadow
        ctx.beginPath();
        ctx.arc(d.x + 2, d.y + 2, DROP_R, 0, Math.PI * 2);
        ctx.fillStyle = cfg.dropShadow;
        ctx.fill();
        // body
        ctx.beginPath();
        ctx.arc(d.x, d.y, DROP_R, 0, Math.PI * 2);
        ctx.fillStyle = cfg.dropColor;
        ctx.fill();
        // shine
        ctx.beginPath();
        ctx.arc(d.x - 3, d.y - 3, 4, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.45)";
        ctx.fill();
      }

      // catch bar
      const bx = barX.current;
      ctx.shadowColor   = "rgba(0,0,0,0.18)";
      ctx.shadowBlur    = 4;
      ctx.shadowOffsetY = 2;
      drawRoundedRect(bx - BAR_W / 2, BAR_Y - BAR_H / 2, BAR_W, BAR_H, BAR_H / 2);
      ctx.fillStyle = cfg.barColor;
      ctx.fill();
      ctx.shadowColor   = "transparent";
      ctx.shadowBlur    = 0;
      ctx.shadowOffsetY = 0;
      // shine
      drawRoundedRect(bx - BAR_W / 2 + 6, BAR_Y - BAR_H / 2 + 2, BAR_W - 12, 3, 2);
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.fill();

      rafId = requestAnimationFrame(frame);
    }

    rafId = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(rafId);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.style.cursor = "default";
    };
  }, [type]); // eslint-disable-line react-hooks/exhaustive-deps

  const cfg = CONFIGS[type];

  const handleClick = useCallback(() => {
    if (doneRef.current && pendingScore.current !== null) {
      onComplete(pendingScore.current);
    }
  }, [onComplete]);

  return (
    <canvas
      ref={canvasRef}
      width={W}
      height={H}
      onMouseMove={onMouseMove}
      onClick={handleClick}
      style={{
        display:      "block",
        borderRadius: 16,
        cursor:       "default",
        touchAction:  "none",
        border:       cfg.border,
        userSelect:   "none",
      }}
    />
  );
}
