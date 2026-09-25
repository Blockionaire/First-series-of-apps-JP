import type { Bucket } from "@/lib/analytics";

/**
 * The back office's charts. Inline SVG, rendered on the server, no library.
 *
 * ── Why one series per chart ─────────────────────────────────────────────
 * Page views and visitors were going to share one plot. Running the palette
 * validator on the two candidate colour pairs killed that: gold against the
 * de-emphasis grey scores ΔE 10.2 for normal vision, under the floor of 15 —
 * a reader with full colour vision cannot reliably tell the two lines apart,
 * and that is the one failure direct labels do not excuse. Cream against gold
 * separates fine (ΔE 24) but they are not a peer pair; one is the brightest
 * ink on the page.
 *
 * Small multiples solve it properly. Each chart carries one series, so colour
 * stops carrying identity — the heading does — and the two measures stop
 * sharing an axis they never belonged on: on a normal day views run several
 * times visitors, and a shared scale flattens the smaller line into the floor.
 *
 * ── Colour ───────────────────────────────────────────────────────────────
 * Everything is a brand token, so the light theme is handled by the same
 * remap as the rest of the site rather than a hand-picked second palette.
 * Gold on navy and gold-700 on beige both clear 3:1 against their surface.
 *
 * ── Hover ────────────────────────────────────────────────────────────────
 * Each point carries an SVG <title>, which browsers surface as a native
 * tooltip. A drawn crosshair would need client JavaScript behind a CSP nonce
 * for an internal dashboard whose numbers are already printed beside it —
 * the tooltip carries the exact value, the end label carries the latest, and
 * the top-pages table carries the rest.
 */

/**
 * The viewBox is scaled UNIFORMLY — no `preserveAspectRatio="none"`.
 *
 * Stretching the box to the container's width is tempting for a chart that
 * should fill its card, but it scales x and y by different factors, and a
 * circle drawn with r=4 then renders as an ellipse. The end-dots came out as
 * thin vertical ticks. Uniform scaling fixes that and costs only a height
 * that follows the width, which for a card in a grid is what you want anyway.
 */
const PAD = { top: 10, right: 10, bottom: 14, left: 10 };
const VIEW = { w: 640, h: 150 };

/** Rounds an axis maximum up to something a reader can do arithmetic on. */
function niceMax(v: number): number {
  if (v <= 4) return 4;
  const mag = 10 ** Math.floor(Math.log10(v));
  return Math.ceil(v / mag) * mag;
}

export function AreaChart({
  buckets,
  metric,
}: {
  buckets: Bucket[];
  metric: "pageViews" | "visitors";
}) {
  const { w, h } = VIEW;
  const values = buckets.map((b) => b[metric]);
  const max = niceMax(Math.max(...values, 0));
  const innerW = w - PAD.left - PAD.right;
  const innerH = h - PAD.top - PAD.bottom;

  // A single bucket has no width to draw a line across; pin it to the middle
  // so the point still lands somewhere sensible instead of dividing by zero.
  const x = (i: number) =>
    PAD.left + (buckets.length === 1 ? innerW / 2 : (i / (buckets.length - 1)) * innerW);
  const y = (v: number) => PAD.top + innerH - (max === 0 ? 0 : (v / max) * innerH);

  const line = values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = `${line} L${x(values.length - 1).toFixed(1)},${(PAD.top + innerH).toFixed(1)} L${x(0).toFixed(1)},${(PAD.top + innerH).toFixed(1)} Z`;

  const total = values.reduce((a, b) => a + b, 0);
  const lastIdx = values.length - 1;
  const peakIdx = values.indexOf(Math.max(...values));

  if (total === 0) {
    return (
      <p className="mt-3 text-sm" style={{ color: "var(--ink-muted)" }}>
        Nothing recorded in this window.
      </p>
    );
  }

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="mt-3 h-auto w-full"
      role="img"
      aria-label={`${metric === "pageViews" ? "Page views" : "Visitors"} per ${buckets.length === 24 ? "hour" : "day"}, ${total} in total`}
    >
      {/* Recessive hairline grid: the baseline and the axis maximum, nothing between. */}
      {[0, max].map((v) => (
        <line
          key={v}
          x1={PAD.left}
          x2={w - PAD.right}
          y1={y(v)}
          y2={y(v)}
          stroke="var(--line)"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
      ))}

      <path d={area} fill="var(--color-gold-500)" fillOpacity="0.1" />
      <path
        d={line}
        fill="none"
        stroke="var(--color-gold-500)"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />

      {/* The end point, and the peak when it is somewhere else worth pointing at. */}
      {[...new Set([lastIdx, peakIdx])].map((i) => (
        <circle
          key={i}
          cx={x(i)}
          cy={y(values[i])}
          r="4"
          fill="var(--color-gold-500)"
          stroke="var(--color-navy-900)"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
      ))}

      {/* Hit targets: invisible, full-height, and wide enough to hover. */}
      {buckets.map((b, i) => (
        <rect
          key={b.key}
          x={x(i) - innerW / Math.max(buckets.length, 1) / 2}
          y={PAD.top}
          width={innerW / Math.max(buckets.length, 1)}
          height={innerH}
          fill="transparent"
        >
          <title>{`${b.label} — ${b[metric]}`}</title>
        </rect>
      ))}
    </svg>
  );
}

/** Axis ends and the latest value, set as text rather than drawn into the plot. */
export function ChartFooter({ buckets, metric }: { buckets: Bucket[]; metric: "pageViews" | "visitors" }) {
  const values = buckets.map((b) => b[metric]);
  if (values.reduce((a, b) => a + b, 0) === 0) return null;
  return (
    <div className="f-mono mt-1 flex items-baseline justify-between text-[0.62rem] tabular-nums" style={{ color: "var(--ink-faint)" }}>
      <span>{buckets[0]?.label}</span>
      <span>
        peak <span className="text-cream-100">{Math.max(...values)}</span>
      </span>
      <span>{buckets[buckets.length - 1]?.label}</span>
    </div>
  );
}

/**
 * Horizontal bar, for magnitude comparisons — top pages, the funnel, demand.
 *
 * One hue, length carries the value. The track behind it is the hairline, not
 * a second colour, so a short bar still reads against a visible full width.
 */
export function BarRow({
  label,
  value,
  max,
  rate,
  gold = false,
  title,
}: {
  label: string;
  value: number;
  max: number;
  /** Shown after the count, e.g. "3%". */
  rate?: string | null;
  gold?: boolean;
  title?: string;
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <li className="flex items-center gap-3" title={title}>
      <span className="w-44 shrink-0 truncate text-sm text-cream-200 sm:w-56">{label}</span>
      <span className="h-[10px] flex-1 border rule">
        <span
          className="block h-full"
          style={{ width: `${pct}%`, background: gold ? "var(--color-gold-500)" : "var(--color-cream-400)" }}
        />
      </span>
      <span className="f-mono w-20 shrink-0 text-right text-[0.75rem] tabular-nums text-cream-100">
        {value}
        {rate && (
          <span className="ml-1.5" style={{ color: "var(--ink-faint)" }}>
            {rate}
          </span>
        )}
      </span>
    </li>
  );
}
