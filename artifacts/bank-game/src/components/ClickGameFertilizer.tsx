import { useEffect, useRef, useCallback } from "react";

interface Props {
  onComplete: (skillScore: number) => void;
}

// ---- layout ----
const W    = 280;
const H    = 310;
const COLS = 4;
const ROWS = 4;
const CELL = 54;
const GAP  = 6;

const GRID_W = COLS * CELL + (COLS - 1) * GAP;   // 234
const GRID_X = (W - GRID_W) / 2;                  // 23
const GRID_Y = 36;

// ---- game ----
const GAME_MS     = 15_000;
const SKILL_DENOM = 6;    // catches at this level → 80/80 skill

type ItemType = "fertilizer" | "water" | "sun" | "stone";

const CELL_COLOR: Record<ItemType, string> = {
  fertilizer: "#22c55e",
  water:      "#60a5fa",
  sun:        "#fbbf24",
  stone:      "#9ca3af",
};

const CELL_ICON: Record<ItemType, string> = {
  fertilizer: "🌱",
  water:      "💧",
  sun:        "☀️",
  stone:      "🪨",
};

const CFG = {
  bg:          "rgba(240,253,244,0.97)",
  timerBg:     "#dcfce7",
  timerColor:  "#22c55e",
  border:      "2px solid #bbf7d0",
  scoreFg:     "#166534",
  resultColor: "#166534",
};

function randomType(): ItemType {
  const r = Math.random();
  if (r < 0.33) return "fertilizer";
  if (r < 0.56) return "water";
  if (r < 0.78) return "sun";
  return "stone";
}

function makeGrid(): ItemType[] {
  return Array.from({ length: COLS * ROWS }, () => randomType());
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y,     x + w, y + r,     r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x,     y + h, x,     y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x,     y,     x + r, y,         r);
  ctx.closePath();
}

function feedbackLabel(n: number): string {
  if (n >= 5) return "Отлично!";
  if (n >= 3) return "Хорошо";
  return "Попробуйте ещё";
}

export default function ClickGameFertilizer({ onComplete }: Props) {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const doneRef      = useRef(false);
  const pendingScore = useRef<number | null>(null);

  // mutable game state (refs so RAF sees latest values without stale closure)
  const gridRef     = useRef<ItemType[]>(makeGrid());
  const selRef      = useRef<Set<number>>(new Set());
  const catchesRef  = useRef(0);
  const wrongFlash  = useRef(0);  // timestamp of last wrong click (for red flash)

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.style.cursor = "pointer";

    let rafId   = 0;
    const start = performance.now();

    // ---------- hit logic (shared by click & touch) ----------
    function processHit(mx: number, my: number, now: number) {
      if (doneRef.current) return;
      for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
          const cx = GRID_X + col * (CELL + GAP);
          const cy = GRID_Y + row * (CELL + GAP);
          if (mx >= cx && mx <= cx + CELL && my >= cy && my <= cy + CELL) {
            const idx = row * COLS + col;
            if (selRef.current.has(idx)) return;          // already in selection
            const type = gridRef.current[idx];
            if (type !== "fertilizer") {
              selRef.current = new Set();                  // wrong → reset
              wrongFlash.current = now;
              return;
            }
            selRef.current.add(idx);
            if (selRef.current.size === 3) {              // match!
              catchesRef.current++;
              selRef.current.forEach(i => { gridRef.current[i] = randomType(); });
              selRef.current = new Set();
            }
            return;
          }
        }
      }
    }

    function handleClick(e: MouseEvent) {
      const rect = canvas.getBoundingClientRect();
      processHit(e.clientX - rect.left, e.clientY - rect.top, performance.now());
    }

    function handleTouch(e: TouchEvent) {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const t    = e.changedTouches[0];
      processHit(t.clientX - rect.left, t.clientY - rect.top, performance.now());
    }

    canvas.addEventListener("click",    handleClick);
    canvas.addEventListener("touchend", handleTouch, { passive: false });

    // ---------- result screen ----------
    function finish() {
      if (doneRef.current) return;
      doneRef.current = true;
      cancelAnimationFrame(rafId);
      canvas.style.cursor = "default";

      const catches    = catchesRef.current;
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
      ctx.textAlign    = "center";
      ctx.font         = "bold 15px sans-serif";
      ctx.fillStyle    = "#6b7280";
      ctx.textBaseline = "middle";
      ctx.fillText("✕", W - 22, 22);

      ctx.font         = "bold 36px sans-serif";
      ctx.textBaseline = "middle";
      ctx.fillText("🌱", W / 2, H / 2 - 36);

      ctx.font         = "bold 20px sans-serif";
      ctx.fillStyle    = CFG.resultColor;
      ctx.fillText(`Поймано: ${catches}`, W / 2, H / 2 + 6);

      ctx.font      = "14px sans-serif";
      ctx.fillStyle = "#6b7280";
      ctx.fillText(feedbackLabel(catches), W / 2, H / 2 + 32);
    }

    // ---------- draw loop ----------
    function frame(ts: number) {
      if (doneRef.current) return;
      const elapsed = ts - start;
      if (elapsed >= GAME_MS) { finish(); return; }

      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = CFG.bg;
      ctx.fillRect(0, 0, W, H);

      // wrong-click flash (red tint)
      const flashAge = ts - wrongFlash.current;
      if (flashAge < 250) {
        ctx.fillStyle = `rgba(239,68,68,${0.18 * (1 - flashAge / 250)})`;
        ctx.fillRect(0, 0, W, H);
      }

      // timer bar
      const pct = Math.max(0, 1 - elapsed / GAME_MS);
      ctx.fillStyle = CFG.timerBg;
      ctx.fillRect(0, 0, W, 5);
      ctx.fillStyle = CFG.timerColor;
      ctx.fillRect(0, 0, W * pct, 5);

      // catch counter
      ctx.textAlign    = "left";
      ctx.textBaseline = "alphabetic";
      ctx.font         = "bold 13px sans-serif";
      ctx.fillStyle    = CFG.scoreFg;
      ctx.fillText(`🌱 ${catchesRef.current}`, 10, 22);

      // grid
      const grid = gridRef.current;
      const sel  = selRef.current;

      for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
          const idx        = row * COLS + col;
          const type       = grid[idx];
          const isSelected = sel.has(idx);
          const x          = GRID_X + col * (CELL + GAP);
          const y          = GRID_Y + row * (CELL + GAP);

          ctx.save();

          // selected glow
          if (isSelected) {
            ctx.shadowColor = "rgba(255,255,255,0.9)";
            ctx.shadowBlur  = 12;
          } else {
            ctx.shadowColor = "rgba(0,0,0,0.10)";
            ctx.shadowBlur  = 4;
            ctx.shadowOffsetY = 2;
          }

          drawRoundedRect(ctx, x, y, CELL, CELL, 10);
          ctx.fillStyle   = CELL_COLOR[type];
          ctx.globalAlpha = isSelected ? 0.70 : 1;
          ctx.fill();
          ctx.shadowBlur    = 0;
          ctx.shadowOffsetY = 0;

          // selected border
          if (isSelected) {
            ctx.globalAlpha = 1;
            ctx.strokeStyle = "white";
            ctx.lineWidth   = 2.5;
            ctx.stroke();
          }

          ctx.restore();

          // icon emoji (drawn after shadow is cleared)
          ctx.textAlign    = "center";
          ctx.textBaseline = "middle";
          ctx.globalAlpha  = isSelected ? 0.7 : 1;
          ctx.font         = "22px sans-serif";
          ctx.fillText(CELL_ICON[type], x + CELL / 2, y + CELL / 2 + 1);
          ctx.globalAlpha  = 1;
        }
      }

      // selection counter hint
      if (sel.size > 0) {
        ctx.textAlign    = "right";
        ctx.textBaseline = "alphabetic";
        ctx.font         = "bold 12px sans-serif";
        ctx.fillStyle    = "#166534";
        ctx.fillText(`${sel.size}/3`, W - 10, 22);
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

  // after game: click anywhere → dismiss
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
        cursor:       "pointer",
        touchAction:  "none",
        border:       CFG.border,
        userSelect:   "none",
      }}
    />
  );
}
