"use client";

import { useEffect, useRef } from "react";

interface GlobeInstance {
  destroy: () => void;
  setGlow: (g: number) => void;
}

interface Props {
  glow?: number;
}

export function MarketGlobe({ glow = 1 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const globeRef = useRef<GlobeInstance | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    if (!canvas) return;

    // Fibonacci sphere globe (vanilla canvas)
    const N = 620;
    const pts: { x: number; y: number; z: number }[] = [];
    const ga = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const th = ga * i;
      pts.push({ x: Math.cos(th) * r, y, z: Math.sin(th) * r });
    }

    const nodeColors = ["#818cf8","#a78bfa","#22d3ee","#fbbf24","#34d399","#60a5fa","#fb923c","#22d3ee","#818cf8"];
    const nodes = nodeColors.map((color, i) => ({
      idx: Math.floor((i + 0.5) * N / nodeColors.length),
      color,
      phase: i * 1.3,
    }));

    const ctx = canvas.getContext("2d")!;
    let currentGlow = glow;
    let raf: number | null = null;
    let destroyed = false;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function resize() {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (!w || !h) return;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    function frame(t: number) {
      if (destroyed) return;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (!w || !h) { raf = requestAnimationFrame(frame); return; }
      ctx.clearRect(0, 0, w, h);
      const cx = w / 2, cy = h / 2;
      const R = Math.min(w, h) * 0.42;
      const rot = t * 0.000085;
      const tilt = -0.34;
      const cosT = Math.cos(tilt), sinT = Math.sin(tilt);

      const atm = ctx.createRadialGradient(cx, cy, R * 0.55, cx, cy, R * 1.45);
      atm.addColorStop(0, `rgba(99,102,241,${(0.10 * currentGlow).toFixed(3)})`);
      atm.addColorStop(0.6, `rgba(34,211,238,${(0.045 * currentGlow).toFixed(3)})`);
      atm.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = atm;
      ctx.fillRect(0, 0, w, h);

      const proj: { sx: number; sy: number; z: number }[] = [];
      for (let i = 0; i < N; i++) {
        const p = pts[i];
        const cosR = Math.cos(rot), sinR = Math.sin(rot);
        const x = p.x * cosR - p.z * sinR;
        let z = p.x * sinR + p.z * cosR;
        const y = p.y * cosT - z * sinT;
        z = p.y * sinT + z * cosT;
        proj[i] = { sx: cx + x * R, sy: cy + y * R, z };
      }

      for (let pass = 0; pass < 2; pass++) {
        for (let i = 0; i < N; i++) {
          const q = proj[i];
          const front = q.z > 0;
          if ((pass === 0) === front) continue;
          const a = front ? 0.26 + q.z * 0.55 : 0.08 + (1 + q.z) * 0.06;
          const sz = front ? 1.3 + q.z * 1.0 : 0.9;
          ctx.fillStyle = `rgba(165,180,252,${(a * (0.6 + currentGlow * 0.4)).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(q.sx, q.sy, sz, 0, 6.2832);
          ctx.fill();
        }
      }

      for (let n = 0; n < nodes.length; n++) {
        const q = proj[nodes[n].idx];
        if (q.z < -0.15) continue;
        const pulse = 0.6 + 0.4 * Math.sin(t * 0.0018 + nodes[n].phase);
        const a = Math.max(0, (0.35 + q.z * 0.65)) * pulse * currentGlow;
        const g = ctx.createRadialGradient(q.sx, q.sy, 0, q.sx, q.sy, 9);
        g.addColorStop(0, nodes[n].color);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.globalAlpha = a;
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(q.sx, q.sy, 9, 0, 6.2832); ctx.fill();
        ctx.globalAlpha = Math.min(1, a + 0.25);
        ctx.fillStyle = "#fff";
        ctx.beginPath(); ctx.arc(q.sx, q.sy, 1.6, 0, 6.2832); ctx.fill();
        ctx.globalAlpha = 1;
      }

      if (!reduced) raf = requestAnimationFrame(frame);
    }

    function onVis() {
      if (document.hidden) {
        if (raf != null) cancelAnimationFrame(raf);
        raf = null;
      } else if (!raf && !reduced && !destroyed) {
        raf = requestAnimationFrame(frame);
      }
    }
    document.addEventListener("visibilitychange", onVis);
    raf = requestAnimationFrame(frame);

    globeRef.current = {
      setGlow: (g: number) => { currentGlow = g; if (reduced) frame(0); },
      destroy: () => {
        destroyed = true;
        if (raf != null) cancelAnimationFrame(raf);
        ro.disconnect();
        document.removeEventListener("visibilitychange", onVis);
      },
    };

    return () => globeRef.current?.destroy();
  }, []);

  useEffect(() => {
    globeRef.current?.setGlow(glow);
  }, [glow]);

  return <canvas ref={canvasRef} className="globe-canvas" />;
}
