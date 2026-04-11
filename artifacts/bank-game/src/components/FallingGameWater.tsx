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
    timerNormal: "#3b82f6",
    timerFast:   "#f97316",
    phaseColor:  "#93c5fd",
    scoreFg:     "#1e40af",
    scoreEmoji:  "💧",
    dropColor:   "#3b82f6",
    dropShadow:  "rgba(59,130,246,0.15)",
    barColor:    "#1e40af",
    resultColor: "#1d4ed8",
    border:      "2px solid #bfdbfe",
  },
  sun: {
    bg:          "rgba(255,251,235,0.97)",
    timerBg:     "#fef3c7",
    timerNormal: "#f59e0b",
    timerFast:   "#ef4444",
    phaseColor:  "#fcd34d",
    scoreFg:     "#92400e",
    scoreEmoji:  "☀️",
    dropColor:   "#f59e0b",
    dropShadow:  "rgba(245,158,11,0.15)",
    barColor:    "#92400e",
    resultColor: "#92400e",
    border:      "2px solid #fde68a",
  },
  fertilizer: {
    bg:          "rgba(240,253,244,0.97)",
    timerBg:     "#dcfce7",
    timerNormal: "#22c55e",
    timerFast:   "#f97316",
    phaseColor:  "#86efac",
    scoreFg:     "#166534",
    scoreEmoji:  "🌱",
    dropColor:   "#22c55e",
    dropShadow:  "rgba(34,197,94,0.15)",
    barColor:    "#166534",
    resultColor: "#166534",
    border:      "2px solid #bbf7d0",
  },
} as const;

// ---- constants ----
const GAME_MS      = 4000;
const TOTAL_DROPS  = 22;
const DROP_R       = 11;
const BAR_W        = 88;
const BAR_H        = 11;
const PERFECT_HALF = BAR_W / 4;   // center ±22 px = perfect zone
const W            = 280;
const H            = 310;
const BAR_Y        = H - 28;
const MAX_SCORE    = TOTAL_DROPS * 2; // all-perfect ceiling

function makeDrop(id: number) {
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

export default function FallingGameWater({ type = "water", onComplete }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const barX      = useRef(W / 2);
  const doneRef   = useRef(false);

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

    const drops: Drop[] = Array.from({ length: TOTAL_DROPS }, (_, i) => makeDrop(i));
    let score        = 0;
    let perfectCount = 0;
    let spawned      = 0;
    let rafId     = 0;
    let lastTs    = -1;
    const start   = performance.now();

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

    function finish() {
      if (doneRef.current) return;
      doneRef.current = true;
      cancelAnimationFrame(rafId);

      const skillScore = Math.min(80, Math.round((score / MAX_SCORE) * 80));
      console.log(`[FallingGame:${type}] caught: ${score}/${MAX_SCORE}  perfect: ${perfectCount}  skillScore: ${skillScore}/80`);

      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = cfg.bg;
      ctx.fillRect(0, 0, W, H);

      ctx.textAlign = "center";
      ctx.fillStyle = cfg.resultColor;
      ctx.font      = "bold 20px sans-serif";
      ctx.fillText(cfg.scoreEmoji, W / 2, H / 2 - 36);
      ctx.font = "bold 16px sans-serif";
      ctx.fillText(`${score} / ${MAX_SCORE} очков`, W / 2, H / 2 - 6);
      ctx.font      = "13px sans-serif";
      ctx.fillStyle = "#d97706";
      ctx.fillText(`⭐ ${perfectCount} perfect`, W / 2, H / 2 + 18);
      ctx.font      = "13px sans-serif";
      ctx.fillStyle = "#6b7280";
      ctx.fillText(`Результат: ${skillScore} / 80`, W / 2, H / 2 + 40);

      setTimeout(() => onComplete(skillScore), 700);
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
        d.y += d.speed * dt;

        if (!d.caught && d.y + DROP_R >= BAR_Y - BAR_H && d.y - DROP_R <= BAR_Y + BAR_H) {
          const bx = barX.current;
          if (d.x >= bx - BAR_W / 2 - DROP_R && d.x <= bx + BAR_W / 2 + DROP_R) {
            d.caught = true;
            d.active = false;
            if (d.x >= bx - PERFECT_HALF && d.x <= bx + PERFECT_HALF) {
              score += 2;   // PERFECT — center zone
              perfectCount++;
            } else {
              score += 1;   // NORMAL — outer zone
            }
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
      ctx.fillStyle = elapsed < 2000 ? cfg.timerNormal : cfg.timerFast;
      ctx.fillRect(0, 0, W * pct, 5);

      // phase label
      ctx.textAlign  = "center";
      ctx.font       = "11px sans-serif";
      ctx.fillStyle  = cfg.phaseColor;
      ctx.fillText(elapsed < 2000 ? "Медленно…" : "Быстрее!", W / 2, 20);

      // score
      ctx.textAlign  = "left";
      ctx.font       = "bold 13px sans-serif";
      ctx.fillStyle  = cfg.scoreFg;
      ctx.fillText(`${cfg.scoreEmoji} ${score}`, 10, 20);

      // particles
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
      drawRoundedRect(bx - BAR_W / 2, BAR_Y - BAR_H / 2, BAR_W, BAR_H, BAR_H / 2);
      ctx.fillStyle = cfg.barColor;
      ctx.fill();
      // perfect-zone highlight (center stripe, gold tint)
      drawRoundedRect(bx - PERFECT_HALF, BAR_Y - BAR_H / 2, PERFECT_HALF * 2, BAR_H, BAR_H / 2);
      ctx.fillStyle = "rgba(251,191,36,0.35)";
      ctx.fill();
      // shine
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
  }, [type]); // eslint-disable-line react-hooks/exhaustive-deps

  const cfg = CONFIGS[type];

  return (
    <canvas
      ref={canvasRef}
      width={W}
      height={H}
      onMouseMove={onMouseMove}
      style={{
        display:      "block",
        borderRadius: 16,
        cursor:       "none",
        touchAction:  "none",
        border:       cfg.border,
        userSelect:   "none",
      }}
    />
  );
}
