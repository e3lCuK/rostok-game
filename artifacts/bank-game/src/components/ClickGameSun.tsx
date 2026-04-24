import { useEffect, useRef, useCallback } from "react";

interface Props {
  onComplete: (skillScore: number) => void;
}

const GAME_MS        = 15_000;
const SUN_R          = 26;          // visual + click radius
const SUN_VISIBLE_MS = 800;         // how long sun stays
const SPAWN_MIN      = 400;
const SPAWN_MAX      = 900;
const SKILL_DENOM    = 20;          // "perfect" catches for 80/80 skill
const W              = 280;
const H              = 310;

const CFG = {
  bg:          "rgba(255,251,235,0.97)",
  timerBg:     "#fef3c7",
  timerColor:  "#f59e0b",
  border:      "2px solid #fde68a",
  scoreFg:     "#92400e",
  resultColor: "#92400e",
};

function feedbackLabel(n: number): string {
  if (n >= 15) return "Отлично!";
  if (n >= 8)  return "Хорошо";
  return "Попробуйте ещё";
}

function drawSun(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  alpha: number,
  scale: number,
) {
  const r = SUN_R * scale;
  ctx.save();
  ctx.globalAlpha = alpha;

  // glow
  ctx.shadowColor = "#fbbf24";
  ctx.shadowBlur  = 20;

  // body gradient
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  const grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.08, x, y, r);
  grad.addColorStop(0,   "#fef9c3");
  grad.addColorStop(0.5, "#fbbf24");
  grad.addColorStop(1,   "#f59e0b");
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.shadowBlur = 0;

  // rays
  ctx.strokeStyle = "#fbbf24";
  ctx.lineWidth   = 2.5;
  ctx.lineCap     = "round";
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(angle) * (r + 5), y + Math.sin(angle) * (r + 5));
    ctx.lineTo(x + Math.cos(angle) * (r + 13), y + Math.sin(angle) * (r + 13));
    ctx.stroke();
  }

  ctx.restore();
}

export default function ClickGameSun({ onComplete }: Props) {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const doneRef      = useRef(false);
  const pendingScore = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.style.cursor = "none";

    let catches           = 0;
    let rafId             = 0;
    let lastTs            = -1;
    const start           = performance.now();

    // active sun state
    let sun: { x: number; y: number; spawnedAt: number } | null = null;
    let timeSinceLastSpawn = SPAWN_MAX; // spawn first one immediately
    let nextSpawnDelay     = SPAWN_MIN + Math.random() * (SPAWN_MAX - SPAWN_MIN);

    function finish() {
      if (doneRef.current) return;
      doneRef.current = true;
      cancelAnimationFrame(rafId);
      canvas.style.cursor = "default";

      const skillScore = Math.min(80, Math.round((catches / SKILL_DENOM) * 80));
      pendingScore.current = skillScore;
      console.log(`[ClickGameSun] catches: ${catches}  skillScore: ${skillScore}/80`);

      // result screen
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = CFG.bg;
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

      // big emoji
      ctx.textAlign = "center";
      ctx.font      = "bold 36px sans-serif";
      ctx.fillText("☀️", W / 2, H / 2 - 32);

      // result
      ctx.font      = "bold 20px sans-serif";
      ctx.fillStyle = CFG.resultColor;
      ctx.fillText(`Поймано: ${catches}`, W / 2, H / 2 + 8);

      // feedback
      ctx.font      = "14px sans-serif";
      ctx.fillStyle = "#6b7280";
      ctx.fillText(feedbackLabel(catches), W / 2, H / 2 + 34);
    }

    function handlePointer(e: MouseEvent | TouchEvent) {
      if (doneRef.current || !sun) return;
      const rect = canvas.getBoundingClientRect();
      let cx: number, cy: number;
      if (e instanceof TouchEvent) {
        cx = e.changedTouches[0].clientX - rect.left;
        cy = e.changedTouches[0].clientY - rect.top;
      } else {
        cx = e.clientX - rect.left;
        cy = e.clientY - rect.top;
      }
      const dx = cx - sun.x;
      const dy = cy - sun.y;
      if (dx * dx + dy * dy <= (SUN_R + 6) * (SUN_R + 6)) {
        catches++;
        sun = null;
        timeSinceLastSpawn = 0;
        nextSpawnDelay = SPAWN_MIN + Math.random() * (SPAWN_MAX - SPAWN_MIN);
      }
    }

    canvas.addEventListener("click",      handlePointer);
    canvas.addEventListener("touchstart", handlePointer, { passive: true });

    function frame(ts: number) {
      if (doneRef.current) return;
      if (lastTs < 0) lastTs = ts;
      const dt      = Math.min(ts - lastTs, 50);
      lastTs        = ts;
      const elapsed = ts - start;

      // spawn new sun
      timeSinceLastSpawn += dt;
      if (!sun && timeSinceLastSpawn >= nextSpawnDelay && elapsed < GAME_MS - 300) {
        const margin = SUN_R + 18;
        sun = {
          x: margin + Math.random() * (W - margin * 2),
          y: 44 + Math.random() * (H - 44 - margin - 12),
          spawnedAt: ts,
        };
        timeSinceLastSpawn = 0;
        nextSpawnDelay = SPAWN_MIN + Math.random() * (SPAWN_MAX - SPAWN_MIN);
      }

      // expire sun
      if (sun && ts - sun.spawnedAt >= SUN_VISIBLE_MS) {
        sun = null;
        timeSinceLastSpawn = 0;
        nextSpawnDelay = SPAWN_MIN + Math.random() * (SPAWN_MAX - SPAWN_MIN);
      }

      if (elapsed >= GAME_MS && !sun) { finish(); return; }

      // ---- draw ----
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = CFG.bg;
      ctx.fillRect(0, 0, W, H);

      // timer bar
      const pct = Math.max(0, 1 - elapsed / GAME_MS);
      ctx.fillStyle = CFG.timerBg;
      ctx.fillRect(0, 0, W, 5);
      ctx.fillStyle = CFG.timerColor;
      ctx.fillRect(0, 0, W * pct, 5);

      // catch counter
      ctx.textAlign = "left";
      ctx.font      = "bold 13px sans-serif";
      ctx.fillStyle = CFG.scoreFg;
      ctx.fillText(`☀️ ${catches}`, 10, 20);

      // draw the current sun with spawn-in / fade-out animation
      if (sun) {
        const age     = ts - sun.spawnedAt;
        const scale   = Math.min(1, age / 140);   // scale in over 140 ms
        const fadeMs  = 180;
        const alpha   = age > SUN_VISIBLE_MS - fadeMs
          ? Math.max(0, 1 - (age - (SUN_VISIBLE_MS - fadeMs)) / fadeMs)
          : 1;
        drawSun(ctx, sun.x, sun.y, alpha, scale);
      }

      rafId = requestAnimationFrame(frame);
    }

    rafId = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(rafId);
      canvas.removeEventListener("click",      handlePointer);
      canvas.removeEventListener("touchstart", handlePointer);
      canvas.style.cursor = "default";
    };
  }, []);

  // after game: any click on canvas → call onComplete
  const handleCanvasClick = useCallback(() => {
    if (doneRef.current && pendingScore.current !== null) {
      onComplete(pendingScore.current);
    }
  }, [onComplete]);

  return (
    <canvas
      ref={canvasRef}
      width={W}
      height={H}
      onClick={handleCanvasClick}
      style={{
        display:      "block",
        borderRadius: 16,
        cursor:       "default",
        touchAction:  "none",
        border:       CFG.border,
        userSelect:   "none",
      }}
    />
  );
}
