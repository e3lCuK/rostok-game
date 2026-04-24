import { useEffect, useRef, useCallback } from "react";

interface Props {
  onComplete: (skillScore: number) => void;
}

const GAME_MS    = 15_000;
const WAVE_MS    = 1_100;   // wave duration before refresh
const OBJ_R      = 26;      // click/touch radius
const W          = 280;
const H          = 310;
const SKILL_DENOM = 20;     // reference count for skillScore mapping

type ObjType = "fertilizer" | "stone";

interface Obj {
  id: number;
  x: number;
  y: number;
  type: ObjType;
  clicked: boolean;
  spawnedAt: number;        // for spawn-in animation
}

let _nextId = 0;

function generateWave(ts: number): Obj[] {
  const count     = 3 + Math.floor(Math.random() * 3);           // 3–5 objects
  const fertCount = 1 + Math.floor(Math.random() * 2);           // 1–2 fertilizers
  const types: ObjType[] = [
    ...Array<ObjType>(fertCount).fill("fertilizer"),
    ...Array<ObjType>(count - fertCount).fill("stone"),
  ];
  // shuffle
  for (let i = types.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [types[i], types[j]] = [types[j], types[i]];
  }

  const margin = OBJ_R + 14;
  const objects: Obj[] = [];
  for (let i = 0; i < count; i++) {
    let x = 0, y = 0, attempts = 0;
    do {
      x = margin + Math.random() * (W - margin * 2);
      y = 44 + margin + Math.random() * (H - 44 - margin * 2 - 20);
      attempts++;
    } while (
      attempts < 40 &&
      objects.some(o => Math.hypot(o.x - x, o.y - y) < OBJ_R * 2.4)
    );
    objects.push({ id: _nextId++, x, y, type: types[i], clicked: false, spawnedAt: ts });
  }
  return objects;
}

function drawFertilizer(ctx: CanvasRenderingContext2D, x: number, y: number, alpha: number, scale: number) {
  const r = OBJ_R * scale;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.shadowColor = "rgba(34,197,94,0.45)";
  ctx.shadowBlur  = 14;

  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.06, x, y, r);
  g.addColorStop(0,   "#bbf7d0");
  g.addColorStop(0.6, "#22c55e");
  g.addColorStop(1,   "#15803d");
  ctx.fillStyle = g;
  ctx.fill();
  ctx.shadowBlur = 0;

  // white leaf stem + two branches (plant icon)
  ctx.strokeStyle = "rgba(255,255,255,0.92)";
  ctx.lineWidth   = 2.5;
  ctx.lineCap     = "round";
  ctx.beginPath();
  ctx.moveTo(x,              y + r * 0.55);
  ctx.lineTo(x,              y - r * 0.10);
  ctx.moveTo(x,              y - r * 0.10);
  ctx.lineTo(x - r * 0.48,  y - r * 0.58);
  ctx.moveTo(x,              y - r * 0.10);
  ctx.lineTo(x + r * 0.48,  y - r * 0.58);
  ctx.stroke();
  ctx.restore();
}

function drawStone(ctx: CanvasRenderingContext2D, x: number, y: number, alpha: number, scale: number) {
  const r = OBJ_R * scale;
  ctx.save();
  ctx.globalAlpha    = alpha;
  ctx.shadowColor    = "rgba(0,0,0,0.18)";
  ctx.shadowBlur     = 6;
  ctx.shadowOffsetY  = 2;

  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  const g = ctx.createRadialGradient(x - r * 0.25, y - r * 0.25, r * 0.05, x, y, r);
  g.addColorStop(0,   "#f3f4f6");
  g.addColorStop(0.55,"#9ca3af");
  g.addColorStop(1,   "#6b7280");
  ctx.fillStyle = g;
  ctx.fill();

  ctx.shadowBlur    = 0;
  ctx.shadowOffsetY = 0;

  // subtle crack
  ctx.strokeStyle = "rgba(255,255,255,0.38)";
  ctx.lineWidth   = 1.5;
  ctx.lineCap     = "round";
  ctx.beginPath();
  ctx.moveTo(x - r * 0.18, y - r * 0.42);
  ctx.lineTo(x + r * 0.12, y + r * 0.05);
  ctx.lineTo(x - r * 0.08, y + r * 0.38);
  ctx.stroke();
  ctx.restore();
}

function feedbackLabel(n: number): string {
  if (n >= 16) return "Отлично!";
  if (n >= 8)  return "Хорошо";
  return "Попробуйте ещё";
}

const CFG = {
  bg:          "rgba(240,253,244,0.97)",
  timerBg:     "#dcfce7",
  timerColor:  "#22c55e",
  border:      "2px solid #bbf7d0",
  scoreFg:     "#166534",
  resultColor: "#166534",
};

export default function ClickGameFertilizer({ onComplete }: Props) {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const doneRef      = useRef(false);
  const pendingScore = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.style.cursor = "none";

    let catches        = 0;
    let rafId          = 0;
    let lastTs         = -1;
    const start        = performance.now();
    let wave: Obj[]    = [];
    let waveStart      = -1;

    function finish() {
      if (doneRef.current) return;
      doneRef.current = true;
      cancelAnimationFrame(rafId);
      canvas.style.cursor = "default";

      const skillScore = Math.min(80, Math.round((catches / SKILL_DENOM) * 80));
      pendingScore.current = skillScore;
      console.log(`[ClickGameFertilizer] catches: ${catches}  skillScore: ${skillScore}/80`);

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
      ctx.fillText("🌱", W / 2, H / 2 - 32);

      // result
      ctx.font      = "bold 20px sans-serif";
      ctx.fillStyle = CFG.resultColor;
      ctx.fillText(`Поймано: ${catches}`, W / 2, H / 2 + 8);

      // feedback
      ctx.font      = "14px sans-serif";
      ctx.fillStyle = "#6b7280";
      ctx.fillText(feedbackLabel(catches), W / 2, H / 2 + 34);
    }

    function hitTest(px: number, py: number) {
      if (doneRef.current) return;
      for (const obj of wave) {
        if (obj.clicked) continue;
        const dx = px - obj.x, dy = py - obj.y;
        if (dx * dx + dy * dy <= (OBJ_R + 6) * (OBJ_R + 6)) {
          obj.clicked = true;
          if (obj.type === "fertilizer") catches++;
          break; // one hit per click
        }
      }
    }

    function handleClick(e: MouseEvent) {
      if (doneRef.current) return;
      const rect = canvas.getBoundingClientRect();
      hitTest(e.clientX - rect.left, e.clientY - rect.top);
    }

    function handleTouch(e: TouchEvent) {
      if (doneRef.current) return;
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      hitTest(e.changedTouches[0].clientX - rect.left, e.changedTouches[0].clientY - rect.top);
    }

    canvas.addEventListener("click",      handleClick);
    canvas.addEventListener("touchend",   handleTouch, { passive: false });

    function frame(ts: number) {
      if (doneRef.current) return;
      if (lastTs < 0) lastTs = ts;
      lastTs        = ts;
      const elapsed = ts - start;

      // first wave or wave expired → spawn new
      if (waveStart < 0 || ts - waveStart >= WAVE_MS) {
        wave      = elapsed < GAME_MS - 200 ? generateWave(ts) : [];
        waveStart = ts;
      }

      if (elapsed >= GAME_MS && wave.length === 0) { finish(); return; }

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
      ctx.fillText(`🌱 ${catches}`, 10, 20);

      // objects
      const age      = ts - waveStart;
      const scaleIn  = Math.min(1, age / 130);
      const fadeOut  = age > WAVE_MS - 200 ? Math.max(0, 1 - (age - (WAVE_MS - 200)) / 200) : 1;

      for (const obj of wave) {
        if (obj.clicked) continue;
        if (obj.type === "fertilizer") {
          drawFertilizer(ctx, obj.x, obj.y, fadeOut, scaleIn);
        } else {
          drawStone(ctx, obj.x, obj.y, fadeOut, scaleIn);
        }
      }

      rafId = requestAnimationFrame(frame);
    }

    rafId = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(rafId);
      canvas.removeEventListener("click",    handleClick);
      canvas.removeEventListener("touchend", handleTouch);
      canvas.style.cursor = "default";
    };
  }, []);

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
