import { useEffect, useMemo, useRef } from "react";
import { useApp } from "../store";
import type { FloorSlice } from "../scene/collider";

const SIZE = 168;
const PAD = 10;

/** Top-down plan cut from the collision mesh, with the visitor's position and view cone. */
export function Minimap({ slice }: { slice: FloorSlice | null }) {
  const planRef = useRef<HTMLCanvasElement>(null);
  const dotRef = useRef<HTMLCanvasElement>(null);
  const pose = useApp((s) => s.pose);

  const fit = useMemo(() => {
    if (!slice) return null;
    const { min, max } = slice.bounds;
    const w = max.x - min.x || 1;
    const d = max.z - min.z || 1;
    const scale = (SIZE - PAD * 2) / Math.max(w, d);
    const ox = PAD + (SIZE - PAD * 2 - w * scale) / 2 - min.x * scale;
    const oz = PAD + (SIZE - PAD * 2 - d * scale) / 2 - min.z * scale;
    return { scale, ox, oz };
  }, [slice]);

  useEffect(() => {
    const c = planRef.current;
    if (!c || !slice || !fit) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = c.height = SIZE * dpr;
    const ctx = c.getContext("2d")!;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.lineCap = "round";
    const draw = (segs: number[][], color: string, width: number) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      for (const [x1, z1, x2, z2] of segs) {
        ctx.moveTo(fit.ox + x1 * fit.scale, fit.oz + z1 * fit.scale);
        ctx.lineTo(fit.ox + x2 * fit.scale, fit.oz + z2 * fit.scale);
      }
      ctx.stroke();
    };
    const css = getComputedStyle(document.documentElement);
    draw(slice.low, css.getPropertyValue("--map-low").trim() || "#b9b4a8", 1);
    draw(slice.walls, css.getPropertyValue("--map-wall").trim() || "#2b302d", 2);
  }, [slice, fit]);

  useEffect(() => {
    const c = dotRef.current;
    if (!c || !fit) return;
    const dpr = window.devicePixelRatio || 1;
    if (c.width !== SIZE * dpr) c.width = c.height = SIZE * dpr;
    const ctx = c.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, SIZE, SIZE);
    const x = fit.ox + pose.x * fit.scale;
    const y = fit.oz + pose.z * fit.scale;
    // Camera yaw 0 looks towards -Z, which is "up" on the map.
    const dir = -Math.PI / 2 - pose.yaw;
    ctx.fillStyle = "rgba(29,158,117,0.22)";
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(x, y, 26, dir - 0.55, dir + 0.55);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#0f6e56";
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }, [pose, fit]);

  if (!slice) return null;
  return (
    <div className="panel pointer-events-none relative overflow-hidden p-0" style={{ width: SIZE, height: SIZE }} aria-label="Minimap">
      <canvas ref={planRef} className="absolute inset-0" style={{ width: SIZE, height: SIZE }} />
      <canvas ref={dotRef} className="absolute inset-0" style={{ width: SIZE, height: SIZE }} />
      <span className="mono absolute bottom-1.5 left-2 text-[10px] text-[var(--muted)]">N ↑</span>
    </div>
  );
}
