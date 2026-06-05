import { useEffect, useRef } from "react";

import { visionBus } from "@/services/vision/visionBus";
import type { VisionSnapshot } from "@/services/vision/visionBus";
import { MOTION_KEYPOINTS, POSE_CONNECTIONS } from "@/services/vision/poseConstants";
import type { PoseKeypoint } from "@/types/motion";

/**
 * PoseOverlay — the cinematic computer-vision visualization layer.
 *
 * Reads the latest pose frame + analysis from the visionBus on its own
 * requestAnimationFrame loop (never re-rendering React) and paints, over the
 * source video:
 *   • per-person skeletons (bones + glowing joints)
 *   • activity heat zones (radial glow scaled by velocity)
 *   • motion vectors (per-joint displacement arrows)
 *   • motion trails (fading paths of the hands & head)
 *
 * Coordinates are mapped with the same object-cover transform the <video> uses,
 * so skeletons sit on the people. When the feed stops the bus clears and the
 * canvas blanks.
 */

const SUBJECT_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ec4899"];
const TRAIL_JOINTS = [0, 15, 16]; // nose, wrists
const TRAIL_LEN = 16;

interface PoseOverlayProps {
  active: boolean;
  className?: string;
}

export function PoseOverlay({ active, className = "" }: PoseOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Per-subject, per-joint trail history (mutable, outside React).
  const trailsRef = useRef<Map<string, { x: number; y: number }[]>>(new Map());
  const prevKpRef = useRef<Map<number, PoseKeypoint[]>>(new Map());

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    const trails = trailsRef.current;
    const prevKp = prevKpRef.current;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const draw = (time: number) => {
      raf = requestAnimationFrame(draw);
      const rect = canvas.getBoundingClientRect();
      const cw = rect.width;
      const ch = rect.height;
      ctx.clearRect(0, 0, cw, ch);
      if (!active) {
        trails.clear();
        prevKp.clear();
        return;
      }

      const snap: VisionSnapshot = visionBus.current;
      const frame = snap.frame;
      if (!frame || frame.subjects.length === 0) {
        // Decay trails when nobody is detected.
        trails.forEach((pts) => pts.splice(0, 1));
        return;
      }

      const vw = snap.sourceWidth || 1280;
      const vh = snap.sourceHeight || 720;
      const scale = Math.max(cw / vw, ch / vh);
      const dispW = vw * scale;
      const dispH = vh * scale;
      const offX = (cw - dispW) / 2;
      const offY = (ch - dispH) / 2;
      const mirror = frame.mirrored;

      const project = (k: PoseKeypoint): [number, number] => {
        const nx = mirror ? 1 - k.x : k.x;
        return [offX + nx * dispW, offY + k.y * dispH];
      };

      const velocity = snap.analysis?.velocity ?? 0;
      const pulse = 0.5 + 0.5 * Math.sin(time / 350);

      frame.subjects.forEach((subject, si) => {
        const color = SUBJECT_COLORS[si % SUBJECT_COLORS.length];
        const kp = subject.keypoints;

        // ── Heat zone: radial glow at the centroid, scaled by velocity ──
        const [cx, cy] = project({ x: subject.centroid.x, y: subject.centroid.y });
        const heatR = 70 + velocity * 1.6;
        const heat = ctx.createRadialGradient(cx, cy, 0, cx, cy, heatR);
        heat.addColorStop(0, hexA(color, 0.18 + (velocity / 100) * 0.22));
        heat.addColorStop(1, hexA(color, 0));
        ctx.fillStyle = heat;
        ctx.beginPath();
        ctx.arc(cx, cy, heatR, 0, Math.PI * 2);
        ctx.fill();

        // ── Skeleton bones ──
        ctx.lineWidth = 2.5;
        ctx.lineCap = "round";
        ctx.strokeStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;
        for (const [a, b] of POSE_CONNECTIONS) {
          const ka = kp[a];
          const kb = kp[b];
          if (!ka || !kb) continue;
          if ((ka.visibility ?? 1) < 0.4 || (kb.visibility ?? 1) < 0.4) continue;
          const [x1, y1] = project(ka);
          const [x2, y2] = project(kb);
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }

        // ── Motion vectors: per-joint displacement arrows ──
        const prev = prevKp.get(si);
        if (prev) {
          ctx.shadowBlur = 0;
          for (const idx of MOTION_KEYPOINTS) {
            const cur = kp[idx];
            const old = prev[idx];
            if (!cur || !old || (cur.visibility ?? 1) < 0.5) continue;
            const dx = (mirror ? -(cur.x - old.x) : cur.x - old.x) * dispW;
            const dy = (cur.y - old.y) * dispH;
            const mag = Math.hypot(dx, dy);
            if (mag < 3) continue;
            const [px, py] = project(cur);
            drawArrow(ctx, px, py, px + dx * 4, py + dy * 4, hexA(color, 0.7));
          }
        }
        prevKp.set(si, kp);

        // ── Joints ──
        ctx.shadowBlur = 8;
        for (let i = 0; i < kp.length; i++) {
          const k = kp[i];
          if ((k.visibility ?? 1) < 0.4) continue;
          const [x, y] = project(k);
          const r = MOTION_KEYPOINTS.includes(i) ? 4 : 2.5;
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
        }

        // Head ring accent
        const nose = kp[0];
        if (nose && (nose.visibility ?? 1) > 0.4) {
          const [hx, hy] = project(nose);
          ctx.strokeStyle = hexA(color, 0.6 + pulse * 0.4);
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(hx, hy, 16 + pulse * 3, 0, Math.PI * 2);
          ctx.stroke();
        }

        // ── Trails (nose + wrists) ──
        for (const j of TRAIL_JOINTS) {
          const k = kp[j];
          if (!k || (k.visibility ?? 1) < 0.4) continue;
          const key = `${si}:${j}`;
          const pts = trails.get(key) ?? [];
          pts.push({ x: project(k)[0], y: project(k)[1] });
          while (pts.length > TRAIL_LEN) pts.shift();
          trails.set(key, pts);

          ctx.shadowBlur = 0;
          for (let p = 1; p < pts.length; p++) {
            const alpha = (p / pts.length) * 0.5;
            ctx.strokeStyle = hexA(color, alpha);
            ctx.lineWidth = (p / pts.length) * 3;
            ctx.beginPath();
            ctx.moveTo(pts[p - 1].x, pts[p - 1].y);
            ctx.lineTo(pts[p].x, pts[p].y);
            ctx.stroke();
          }
        }
      });

      // Prune trails/prev for subjects that vanished.
      const live = frame.subjects.length;
      prevKp.forEach((_, si) => {
        if (si >= live) prevKp.delete(si);
      });
      trails.forEach((_, key) => {
        if (Number(key.split(":")[0]) >= live) trails.delete(key);
      });

      ctx.shadowBlur = 0;
    };

    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [active]);

  return <canvas ref={canvasRef} className={className} />;
}

function hexA(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
}

function drawArrow(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const head = 6;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - head * Math.cos(angle - Math.PI / 6), y2 - head * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(x2 - head * Math.cos(angle + Math.PI / 6), y2 - head * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fill();
}
