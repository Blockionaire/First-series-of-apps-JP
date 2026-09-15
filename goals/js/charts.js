/* =====================================================================
   GOALS — charts
   =====================================================================
   Inline SVG, no library. Four shapes, each with one job:

     ring      a share of a whole, at a glance
     line      a reading over time, with its target as a threshold
     bars      how much per week, with this week picked out
     calendar  which days you actually showed up

   Charts are painted after mount, not built into the page's HTML, so
   they can measure their container and draw at real pixel sizes. Text
   inside a stretched SVG shrinks with it and turns to mush; this way a
   label is the size it says it is.

   Marks follow one set of specs: 2px lines with round caps, bars no
   thicker than 24px with a 4px rounded cap and a square foot, markers
   at least 8px across wearing a 2px ring in the surface colour, area
   washes at 10%, and hairline axes that never dash. The data is the
   only thing allowed to be loud.
   ===================================================================== */

import { $$, esc, formatValue, formatDate, fromISO, clamp } from "./util.js";

/* ---------------------------------------------------------------
   A ring — a meter, not a pie
   ---------------------------------------------------------------
   One value against its whole. The track is the same ink at a tenth
   of the weight, so the state reads across the whole circle.
   --------------------------------------------------------------- */
export function ring(fraction, { size = 72, stroke = 6, center = "", caption = "", tone = "" } = {}) {
  const safe = clamp(fraction || 0, 0, 1);
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - safe);

  return `
    <div class="ring ${tone ? "ring--" + tone : ""}">
      <div class="ring__dial" style="--size:${size}px">
        <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
          <circle class="ring__track" cx="${size / 2}" cy="${size / 2}" r="${radius}" stroke-width="${stroke}" fill="none"/>
          <circle class="ring__fill" cx="${size / 2}" cy="${size / 2}" r="${radius}" stroke-width="${stroke}" fill="none"
                  stroke-linecap="round"
                  stroke-dasharray="${circumference.toFixed(2)}"
                  style="--dash:${circumference.toFixed(2)};--offset:${offset.toFixed(2)}"/>
        </svg>
        ${center ? `<span class="ring__center num">${esc(center)}</span>` : ""}
      </div>
      ${caption ? `<span class="ring__caption">${esc(caption)}</span>` : ""}
    </div>`;
}

/* ---------------------------------------------------------------
   Painting
   ---------------------------------------------------------------
   A view drops an empty <div data-chart> with its settings on it; this
   fills it once the width is known, and again when that width changes.
   --------------------------------------------------------------- */
const painters = {};

export function paintCharts(root) {
  const nodes = $$("[data-chart]", root);
  if (!nodes.length) return null;

  const paint = () => {
    for (const node of nodes) {
      const kind = node.dataset.chart;
      const painter = painters[kind];
      if (!painter) continue;
      const width = node.clientWidth || node.parentElement?.clientWidth || 320;
      if (!width) continue;
      let data;
      try {
        data = JSON.parse(node.dataset.values || "null");
      } catch (e) {
        console.error(e);
        continue;
      }
      if (!data) continue;
      node.innerHTML = painter(data, width, node.dataset);
      hookTooltip(node);
    }
  };

  paint();

  /* Rotating the phone, or opening the keyboard, changes the width. */
  const observer = new ResizeObserver(debounceFrame(paint));
  nodes.forEach(node => observer.observe(node));
  return () => observer.disconnect();
}

function debounceFrame(fn) {
  let queued = false;
  return () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; fn(); });
  };
}

/* ---------------------------------------------------------------
   Line — a reading over time
   --------------------------------------------------------------- */
painters.line = (points, width, settings) => {
  const unit = settings.unit || "";
  const decimals = settings.decimals === "" || settings.decimals === undefined ? null : Number(settings.decimals);
  const target = settings.target === "" || settings.target === undefined ? null : Number(settings.target);
  const height = Number(settings.height || 190);

  const values = points.map(p => p.value);
  if (values.length < 2) return "";

  const padLeft = 6, padRight = 52, padTop = 22, padBottom = 26;
  const low = Math.min(...values), high = Math.max(...values);

  /* The target only shares the scale when it is close enough to matter;
     a distant one would flatten the line it is meant to explain. */
  const reach = (high - low || Math.abs(high) || 1) * 1.6;
  const showTarget = target !== null && target >= low - reach && target <= high + reach;

  const all = showTarget ? values.concat([target]) : values;
  let min = Math.min(...all), max = Math.max(...all);
  const span = max - min || Math.abs(max) || 1;
  min -= span * 0.12;
  max += span * 0.12;

  const x = i => padLeft + (i / (points.length - 1)) * (width - padLeft - padRight);
  const y = v => padTop + (1 - (v - min) / (max - min)) * (height - padTop - padBottom);

  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const area = `${line} L${x(points.length - 1).toFixed(1)},${(height - padBottom).toFixed(1)} L${padLeft},${(height - padBottom).toFixed(1)} Z`;

  const last = points[points.length - 1];
  const lastX = x(points.length - 1), lastY = y(last.value);

  /* Hit areas wide enough for a thumb, one per reading. */
  const band = (width - padLeft - padRight) / Math.max(1, points.length - 1);
  const hits = points.map((p, i) => `
    <rect class="chart__hit" x="${(x(i) - band / 2).toFixed(1)}" y="0"
          width="${Math.max(24, band).toFixed(1)}" height="${height}"
          data-x="${x(i).toFixed(1)}" data-y="${y(p.value).toFixed(1)}"
          data-label="${esc(formatValue(p.value, unit, { decimals }))} · ${esc(formatDate(p.date, "short"))}"></rect>`).join("");

  return `
    <svg class="chart chart--line" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"
         role="img" aria-label="${esc(settings.label || "Trend")}">
      <line class="chart__axis" x1="${padLeft}" x2="${width - padRight}"
            y1="${height - padBottom}" y2="${height - padBottom}"/>

      ${showTarget ? `
        <line class="chart__threshold" x1="${padLeft}" x2="${width - padRight}"
              y1="${y(target).toFixed(1)}" y2="${y(target).toFixed(1)}"/>
        <text class="chart__note" x="${width - padRight + 6}" y="${(y(target) + 3.5).toFixed(1)}">
          ${esc(formatValue(target, unit))}
        </text>` : ""}

      <path class="chart__area" d="${area}"/>
      <path class="chart__line" d="${line}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>

      <circle class="chart__ring" cx="${lastX.toFixed(1)}" cy="${lastY.toFixed(1)}" r="4.5"/>
      <circle class="chart__dot" cx="${lastX.toFixed(1)}" cy="${lastY.toFixed(1)}" r="4"/>
      <text class="chart__value" x="${(lastX + 10).toFixed(1)}" y="${(lastY + 4).toFixed(1)}">
        ${esc(formatValue(last.value, unit, { decimals }))}
      </text>

      <text class="chart__tick" x="${padLeft}" y="${height - 8}">${esc(formatDate(points[0].date, "short"))}</text>
      <text class="chart__tick chart__tick--end" x="${(width - padRight).toFixed(1)}" y="${height - 8}">
        ${esc(formatDate(last.date, "short"))}
      </text>

      <g class="chart__crosshair" hidden>
        <line class="chart__crosshair-line" y1="${padTop - 8}" y2="${height - padBottom}"/>
        <circle class="chart__crosshair-dot" r="4"/>
      </g>
      ${hits}
    </svg>
    <div class="chart__tip" hidden></div>`;
};

/* ---------------------------------------------------------------
   Bars — how much, per week
   --------------------------------------------------------------- */
painters.bars = (weeks, width, settings) => {
  const height = Number(settings.height || 140);
  const unit = settings.unit || "";
  const padTop = 20, padBottom = 22;
  const max = Math.max(...weeks.map(w => w.value), Number(settings.min || 1));

  const band = width / weeks.length;
  const barWidth = Math.min(24, Math.max(5, band - 6));
  const plot = height - padTop - padBottom;
  const baseline = height - padBottom;

  const bars = weeks.map((week, i) => {
    const h = max ? (week.value / max) * plot : 0;
    const x = i * band + (band - barWidth) / 2;
    const y = baseline - h;
    const radius = Math.min(4, barWidth / 2, h || 4);

    /* A square foot on the baseline, a rounded cap on top. */
    const path = h < 0.5
      ? ""
      : `M${x},${baseline} L${x},${(y + radius).toFixed(1)}
         Q${x},${y.toFixed(1)} ${(x + radius).toFixed(1)},${y.toFixed(1)}
         L${(x + barWidth - radius).toFixed(1)},${y.toFixed(1)}
         Q${(x + barWidth).toFixed(1)},${y.toFixed(1)} ${(x + barWidth).toFixed(1)},${(y + radius).toFixed(1)}
         L${(x + barWidth).toFixed(1)},${baseline} Z`;

    return `
      <g class="chart__bar ${week.current ? "is-current" : ""} ${week.value ? "" : "is-empty"}">
        ${path ? `<path d="${path}"/>` : `<rect x="${x}" y="${baseline - 2}" width="${barWidth}" height="2" class="chart__stub"/>`}
        <rect class="chart__hit" x="${i * band}" y="0" width="${band}" height="${height}"
              data-x="${(i * band + band / 2).toFixed(1)}" data-y="${y.toFixed(1)}"
              data-label="${esc(String(week.label))} · ${esc(formatValue(week.value, unit))}"></rect>
      </g>`;
  }).join("");

  const current = weeks.find(w => w.current);

  return `
    <svg class="chart chart--bars" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"
         role="img" aria-label="${esc(settings.label || "Per week")}">
      <line class="chart__axis" x1="0" x2="${width}" y1="${baseline}" y2="${baseline}"/>
      ${bars}
      ${current ? `
        <text class="chart__value" x="${(weeks.indexOf(current) * band + band / 2).toFixed(1)}"
              y="${padTop - 6}" text-anchor="middle">
          ${esc(formatValue(current.value, unit))}
        </text>` : ""}
      <text class="chart__tick" x="0" y="${height - 6}">${esc(weeks[0].label)}</text>
      <text class="chart__tick chart__tick--end" x="${width}" y="${height - 6}">
        ${esc(weeks[weeks.length - 1].label)}
      </text>
    </svg>
    <div class="chart__tip" hidden></div>`;
};

/* ---------------------------------------------------------------
   Calendar — which days you showed up
   ---------------------------------------------------------------
   HTML rather than SVG: no text to scale, and a grid does this better
   than a drawing would. One hue, light to dark, with a scale to read
   it by.
   --------------------------------------------------------------- */
painters.calendar = (days, width, settings) => {
  const max = Math.max(1, ...days.map(d => d.count));
  const steps = 4;

  const cells = days.map(day => {
    const level = day.count ? Math.min(steps, Math.ceil((day.count / max) * steps)) : 0;
    const date = fromISO(day.date);
    return `
      <span class="cal__cell" data-level="${level}"
            style="grid-column:${day.column};grid-row:${((date.getDay() + 6) % 7) + 1}"
            title="${esc(formatDate(day.date, "long"))} · ${day.count} logged"
            data-label="${esc(formatDate(day.date, "short"))} · ${day.count === 1 ? "1 log" : day.count + " logs"}"></span>`;
  }).join("");

  return `
    <div class="cal" role="img" aria-label="${esc(settings.label || "Days logged")}">
      <div class="cal__grid">${cells}</div>
      <div class="cal__legend">
        <span class="faint">Less</span>
        ${[0, 1, 2, 3, 4].map(level => `<span class="cal__cell" data-level="${level}"></span>`).join("")}
        <span class="faint">More</span>
      </div>
    </div>`;
};

/* ---------------------------------------------------------------
   Reading a value off a chart
   ---------------------------------------------------------------
   Touch and mouse both land on the same wide hit areas. The tooltip
   only ever repeats what the activity list below already says, so
   nothing is locked behind a hover.
   --------------------------------------------------------------- */
function hookTooltip(node) {
  const tip = node.querySelector(".chart__tip");
  if (!tip) return;

  const crosshair = node.querySelector(".chart__crosshair");
  const line = node.querySelector(".chart__crosshair-line");
  const dot = node.querySelector(".chart__crosshair-dot");

  const show = hit => {
    const x = Number(hit.dataset.x), y = Number(hit.dataset.y);
    tip.textContent = hit.dataset.label;
    tip.hidden = false;
    const width = node.clientWidth;
    tip.style.left = `${clamp(x, 40, width - 40)}px`;
    tip.style.top = `${Math.max(0, y - 14)}px`;

    if (crosshair) {
      crosshair.hidden = false;
      line.setAttribute("x1", x);
      line.setAttribute("x2", x);
      dot.setAttribute("cx", x);
      dot.setAttribute("cy", y);
    }
    hit.closest("g")?.classList.add("is-hovered");
  };

  const hide = () => {
    tip.hidden = true;
    if (crosshair) crosshair.hidden = true;
    node.querySelectorAll(".is-hovered").forEach(el => el.classList.remove("is-hovered"));
  };

  node.querySelectorAll(".chart__hit").forEach(hit => {
    hit.addEventListener("pointerenter", () => show(hit));
    hit.addEventListener("pointerdown", () => show(hit));
  });

  node.addEventListener("pointerleave", hide);
  node.addEventListener("pointercancel", hide);
  window.addEventListener("pointerup", hide, { once: false });
}

/* A chart placeholder, for a view to drop into its HTML. */
export function chartSlot(kind, values, settings = {}) {
  const attributes = Object.entries(settings)
    .map(([key, value]) => ` data-${key}="${esc(value === null ? "" : value)}"`).join("");
  return `<div class="chart-slot" data-chart="${kind}"${attributes}
    data-values='${esc(JSON.stringify(values))}'></div>`;
}
