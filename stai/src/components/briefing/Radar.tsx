"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { fmtDate } from "@/lib/format";

/**
 * The Radar — the Briefing's spatial instrument. Every published piece is
 * plotted on a sweep display: sector = category, distance from centre = age
 * (fresh intelligence sits close), blip size = urgency. A rotating sweep
 * pings blips as it passes.
 *
 * It is a lens, never a gate: the full index list renders beneath it, it is
 * fully keyboard-operable (arrows cycle, Enter opens), the active blip is
 * described in a live text panel, and reduced-motion users get a static
 * plot with no sweep. Pure canvas — no dependencies, nothing fetched.
 */

export type RadarItem = {
  slug: string;
  title: string;
  category: string;
  publishedAt: string;
  urgency: number;
  premium: boolean;
  author: string;
  readingMin: number;
  dek: string;
};

const CATEGORIES = ["Regulation", "Analysis", "Practice", "Tools", "News"];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

type Blip = RadarItem & { angle: number; radius: number; x: number; y: number; ping: number };

export default function Radar({ items }: { items: RadarItem[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [active, setActive] = useState<number>(-1);
  const [reduced, setReduced] = useState(false);
  const activeRef = useRef(active);
  activeRef.current = active;

  const blips = useMemo<Blip[]>(() => {
    const now = Date.now();
    const ages = items.map((it) => (now - new Date(it.publishedAt).getTime()) / 864e5);
    const maxAge = Math.max(60, ...ages);
    return items.map((it, i) => {
      const sector = CATEGORIES.indexOf(it.category);
      const s = sector === -1 ? CATEGORIES.length - 1 : sector;
      const sectorSpan = (Math.PI * 2) / CATEGORIES.length;
      const angle = -Math.PI / 2 + s * sectorSpan + sectorSpan * (0.16 + 0.68 * hash(it.slug));
      const radius = 0.22 + 0.68 * Math.min(1, ages[i] / maxAge) ** 0.72;
      return { ...it, angle, radius, x: 0, y: 0, ping: 0 };
    });
  }, [items]);

  // Sorted for keyboard cycling: newest first.
  const order = useMemo(
    () =>
      blips
        .map((_, i) => i)
        .sort((a, b) => new Date(blips[b].publishedAt).getTime() - new Date(blips[a].publishedAt).getTime()),
    [blips]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    let raf = 0;
    let running = false;
    let w = 0;
    let h = 0;
    let sweep = -Math.PI / 2;
    const pointer = { x: -9999, y: -9999 };
    let hover = -1;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const cream = (a: number) => `rgba(237,234,227,${a})`;

    const draw = (animate: boolean) => {
      ctx.clearRect(0, 0, w, h);
      const cx = w / 2;
      const cy = h / 2;
      const R = Math.min(w, h) / 2 - 34;

      // rings
      ctx.strokeStyle = cream(0.09);
      ctx.lineWidth = 1;
      for (const r of [0.25, 0.5, 0.75, 1]) {
        ctx.beginPath();
        ctx.arc(cx, cy, R * r, 0, Math.PI * 2);
        ctx.stroke();
      }
      // sector spokes + labels
      const span = (Math.PI * 2) / CATEGORIES.length;
      ctx.font = "600 9px 'JetBrains Mono Variable', monospace";
      for (let s = 0; s < CATEGORIES.length; s++) {
        const a = -Math.PI / 2 + s * span;
        ctx.strokeStyle = cream(0.07);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
        ctx.stroke();
        const la = a + span / 2;
        const lx = cx + Math.cos(la) * (R + 16);
        const ly = cy + Math.sin(la) * (R + 16);
        ctx.fillStyle = cream(0.42);
        ctx.textAlign = lx < cx - 10 ? "right" : lx > cx + 10 ? "left" : "center";
        ctx.textBaseline = "middle";
        ctx.fillText(CATEGORIES[s].toUpperCase(), lx, ly);
      }
      // age labels on the vertical
      ctx.textAlign = "left";
      ctx.fillStyle = cream(0.22);
      ctx.fillText("NOW", cx + 4, cy - R * 0.12);
      ctx.fillText("ARCHIVE", cx + 4, cy - R * 0.99);

      // sweep
      if (animate && !mq.matches) {
        const grad = ctx.createConicGradient ? ctx.createConicGradient(sweep, cx, cy) : null;
        if (grad) {
          grad.addColorStop(0, cream(0.1));
          grad.addColorStop(0.08, cream(0.0));
          grad.addColorStop(1, cream(0));
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.arc(cx, cy, R, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.strokeStyle = cream(0.28);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(sweep) * R, cy + Math.sin(sweep) * R);
        ctx.stroke();
      }

      // blips
      hover = -1;
      blips.forEach((b, i) => {
        const drift = mq.matches ? 0 : Math.sin(Date.now() * 0.00035 + i * 2.1) * 0.006;
        const r = (b.radius + drift) * R;
        b.x = cx + Math.cos(b.angle) * r;
        b.y = cy + Math.sin(b.angle) * r;

        const dp = Math.hypot(pointer.x - b.x, pointer.y - b.y);
        if (dp < 14 && (hover === -1 || dp < Math.hypot(pointer.x - blips[hover].x, pointer.y - blips[hover].y)))
          hover = i;

        // sweep ping
        if (animate && !mq.matches) {
          let da = (Math.atan2(b.y - cy, b.x - cx) - sweep) % (Math.PI * 2);
          if (da > 0) da -= Math.PI * 2;
          if (da > -0.12) b.ping = 1;
          b.ping *= 0.965;
        }

        const isActive = i === activeRef.current || i === hover;
        const base = 2 + b.urgency * 1.4;
        const glow = b.ping * 5;

        if (isActive) {
          ctx.strokeStyle = cream(0.8);
          ctx.beginPath();
          ctx.arc(b.x, b.y, base + 7, 0, Math.PI * 2);
          ctx.stroke();
        }
        if (b.urgency >= 3) {
          ctx.strokeStyle = cream(0.4 + b.ping * 0.4);
          ctx.beginPath();
          ctx.arc(b.x, b.y, base + 3.5, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.fillStyle = cream(Math.min(1, 0.5 + b.ping * 0.6 + (isActive ? 0.4 : 0)));
        ctx.beginPath();
        ctx.arc(b.x, b.y, base + glow * 0.4, 0, Math.PI * 2);
        ctx.fill();
      });

      canvas.style.cursor = hover >= 0 ? "pointer" : "default";

      // hover tooltip
      const tipFor = hover >= 0 ? hover : -1;
      if (tipFor >= 0) {
        const b = blips[tipFor];
        ctx.font = "600 11px 'JetBrains Mono Variable', monospace";
        const label = b.title.length > 54 ? b.title.slice(0, 52) + "…" : b.title;
        const tw = ctx.measureText(label).width;
        const tx = Math.min(Math.max(b.x - tw / 2, 8), w - tw - 16);
        const ty = b.y - 22 < 14 ? b.y + 16 : b.y - 30;
        ctx.fillStyle = "rgba(10,17,29,0.92)";
        ctx.fillRect(tx - 6, ty, tw + 12, 20);
        ctx.strokeStyle = cream(0.25);
        ctx.strokeRect(tx - 6, ty, tw + 12, 20);
        ctx.fillStyle = cream(0.95);
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(label, tx, ty + 10);
      }
    };

    const loop = () => {
      if (!running) return;
      sweep += 0.0038;
      draw(true);
      raf = requestAnimationFrame(loop);
    };
    const start = () => {
      if (running) return;
      if (mq.matches) {
        draw(false);
        return;
      }
      running = true;
      raf = requestAnimationFrame(loop);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    resize();
    start();

    const io = new IntersectionObserver(([e]) => (e.isIntersecting ? start() : stop()), { threshold: 0.05 });
    io.observe(canvas);
    const onVis = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVis);

    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = e.clientX - rect.left;
      pointer.y = e.clientY - rect.top;
      if (mq.matches) draw(false);
    };
    const onLeave = () => {
      pointer.x = -9999;
      pointer.y = -9999;
      if (mq.matches) draw(false);
    };
    const onClick = () => {
      if (hover >= 0) {
        setActive(hover);
        router.push(`/briefing/${blips[hover].slug}`);
      }
    };
    const onResize = () => {
      resize();
      if (mq.matches) draw(false);
    };

    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerleave", onLeave);
    canvas.addEventListener("click", onClick);
    window.addEventListener("resize", onResize);

    return () => {
      stop();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("click", onClick);
      window.removeEventListener("resize", onResize);
    };
  }, [blips, router]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      const pos = order.indexOf(active);
      setActive(order[(pos + 1) % order.length]);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      const pos = order.indexOf(active);
      setActive(order[(pos - 1 + order.length) % order.length]);
    } else if (e.key === "Enter" && active >= 0) {
      router.push(`/briefing/${blips[active].slug}`);
    } else if (e.key === "Escape") {
      setActive(-1);
    }
  };

  const a = active >= 0 ? blips[active] : null;

  return (
    <div ref={wrapRef} className="border bg-navy-950 rule-strong">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2 rule">
        <span className="f-label" style={{ color: "var(--ink-faint)" }}>
          The Radar — sector: category · range: recency · blip: urgency
        </span>
        <span className="f-mono text-[0.62rem] tracking-[0.1em] uppercase" style={{ color: "var(--ink-faint)" }}>
          {items.length} pieces on scope{reduced ? " · static (reduced motion)" : ""}
        </span>
      </div>

      <div
        role="application"
        aria-label={`Radar view of ${items.length} briefing articles. Use arrow keys to cycle articles, Enter to open, Escape to deselect.`}
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="outline-offset-[-2px]"
      >
        <canvas ref={canvasRef} className="block h-[420px] w-full sm:h-[520px]" />
      </div>

      {/* live detail strip — doubles as the accessible readout */}
      <div className="border-t px-4 py-3 rule" aria-live="polite">
        {a ? (
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span className="f-mono text-[0.65rem] tracking-[0.14em] uppercase text-cream-400">
              {a.category} · {fmtDate(a.publishedAt)} · {a.readingMin} min
            </span>
            <a href={`/briefing/${a.slug}`} className="font-medium text-cream-100 underline-offset-4 hover:underline">
              {a.title}
            </a>
            <span className="w-full text-sm sm:w-auto sm:flex-1 sm:truncate" style={{ color: "var(--ink-muted)" }}>
              {a.dek}
            </span>
          </div>
        ) : (
          <p className="f-mono text-[0.68rem] tracking-[0.06em]" style={{ color: "var(--ink-faint)" }}>
            Hover a blip, or focus the radar and use arrow keys · Enter opens the piece · full index below
          </p>
        )}
      </div>
    </div>
  );
}
