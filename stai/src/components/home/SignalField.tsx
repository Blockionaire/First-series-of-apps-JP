"use client";

import { useEffect, useRef } from "react";

/**
 * The hero's signal field: a fine lattice of dots over which a slow
 * interference pattern travels — the visual register of "live intelligence"
 * without a single external asset. Pure canvas, no dependencies.
 *
 * Discipline: caps device-pixel-ratio at 1.5, pauses when offscreen or the
 * tab is hidden, renders one static frame under prefers-reduced-motion,
 * and is aria-hidden decoration only.
 */
export default function SignalField() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    let raf = 0;
    let running = false;
    let w = 0;
    let h = 0;
    const pointer = { x: -9999, y: -9999 };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const GAP = 26;

    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      const time = t * 0.00022;
      const cols = Math.ceil(w / GAP) + 1;
      const rows = Math.ceil(h / GAP) + 1;
      // two slow travelling wave origins
      const ox1 = w * (0.5 + 0.45 * Math.sin(time * 0.7));
      const oy1 = h * (0.4 + 0.35 * Math.cos(time * 0.5));
      const ox2 = w * (0.3 + 0.4 * Math.cos(time * 0.4));
      const oy2 = h * (0.6 + 0.3 * Math.sin(time * 0.6));

      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const x = i * GAP;
          const y = j * GAP;
          const d1 = Math.hypot(x - ox1, y - oy1);
          const d2 = Math.hypot(x - ox2, y - oy2);
          const wave = Math.sin(d1 * 0.02 - time * 6) * 0.5 + Math.sin(d2 * 0.017 + time * 4.4) * 0.5;
          const dp = Math.hypot(x - pointer.x, y - pointer.y);
          const local = dp < 140 ? (1 - dp / 140) * 0.5 : 0;
          const a = Math.max(0, 0.05 + wave * 0.055 + local);
          if (a <= 0.012) continue;
          const r = 0.8 + Math.max(0, wave) * 0.7 + local * 1.4;
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(237, 234, 227, ${a.toFixed(3)})`;
          ctx.fill();
        }
      }
    };

    const loop = (t: number) => {
      if (!running) return;
      draw(t);
      raf = requestAnimationFrame(loop);
    };

    const start = () => {
      if (running || reduced) return;
      running = true;
      raf = requestAnimationFrame(loop);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    resize();
    if (reduced) {
      draw(9000); // one considered static frame
    } else {
      start();
    }

    const io = new IntersectionObserver(([e]) => (e.isIntersecting ? start() : stop()), { threshold: 0.02 });
    io.observe(canvas);
    const onVis = () => (document.hidden ? stop() : start());
    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = e.clientX - rect.left;
      pointer.y = e.clientY - rect.top;
    };
    const onLeave = () => {
      pointer.x = -9999;
      pointer.y = -9999;
    };
    const onResize = () => {
      resize();
      if (reduced) draw(9000);
    };

    document.addEventListener("visibilitychange", onVis);
    canvas.parentElement?.addEventListener("pointermove", onMove);
    canvas.parentElement?.addEventListener("pointerleave", onLeave);
    window.addEventListener("resize", onResize);

    return () => {
      stop();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      canvas.parentElement?.removeEventListener("pointermove", onMove);
      canvas.parentElement?.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return <canvas ref={ref} className="absolute inset-0 h-full w-full" aria-hidden="true" />;
}
