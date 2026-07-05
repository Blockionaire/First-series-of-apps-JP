/**
 * Placeholder art system: elegant SVG scenes per product, petals fillable
 * via the --tint CSS variable so colourways retint in place. Real
 * photography (p.images[]) overrides these when present.
 */
import type { Product } from '../data/products';
import { productById } from '../data/products';

const BONE = '#F2ECE3';
const PORCELAIN = '#F7F3EC';
const ESPRESSO = '#2A2521';
const COCOA = '#5C5248';
const STONE = '#8D8478';
const SAGE = '#6E7A66';
const WILT = '#C4AD8F';

export type ArtVariant = 'front' | 'detail' | 'room' | 'video' | 'compare';

/* — Signature motifs (recreated hand-drawn line art) ------------------- */

/** Curled sprout mark — loader and cursor. */
export function motifSprout(size = 30, stroke = SAGE): string {
  return `<svg class="motif-sprout" width="${(size * 23) / 30}" height="${size}" viewBox="0 0 23 30" fill="none" aria-hidden="true">
    <path d="M4 29 C4 18 6 12 12 7 C16 4 20 5 20 9 C20 13 16 14 13 12 C10 10 11 5 15 3"
      stroke="${stroke}" stroke-width="1.6" stroke-linecap="round"/>
  </svg>`;
}

/**
 * Five-petal bloom, drawn as strokes so it can self-draw via
 * stroke-dashoffset. Every path carries class="bloom-path".
 */
export function motifBloom(cls = 'bloom'): string {
  const petals = [0, 72, 144, 216, 288]
    .map(
      (a) => `<path class="bloom-path" transform="rotate(${a} 60 60)"
        d="M60 60 C 48 46, 48 24, 60 14 C 72 24, 72 46, 60 60 Z"
        fill="none" stroke="${SAGE}" stroke-width="1.5" stroke-linejoin="round"/>`,
    )
    .join('');
  return `<svg class="${cls}" viewBox="0 0 120 120" fill="none" aria-hidden="true">
    ${petals}
    <circle class="bloom-path" cx="60" cy="60" r="4.5" stroke="${SAGE}" stroke-width="1.5"/>
    <path class="bloom-path" d="M60 64 C 60 84, 56 96, 50 108" stroke="${SAGE}" stroke-width="1.5" stroke-linecap="round"/>
    <path class="bloom-path" d="M56 88 C 46 84, 40 84, 34 88 C 40 94, 48 94, 56 90" stroke="${SAGE}" stroke-width="1.3" stroke-linecap="round"/>
  </svg>`;
}

/* — Building blocks ------------------------------------------------------ */

function shadow(cx: number, cy: number, rx: number): string {
  return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${rx * 0.16}" fill="${ESPRESSO}" opacity="0.07"/>`;
}

function fivePetal(cx: number, cy: number, r: number, rot: number, tint = 'var(--tint, #F3EDDF)'): string {
  const petals = [0, 72, 144, 216, 288]
    .map(
      (a) =>
        `<ellipse transform="rotate(${a + rot} ${cx} ${cy})" cx="${cx}" cy="${cy - r * 0.55}"
          rx="${r * 0.34}" ry="${r * 0.58}" fill="${tint}" stroke="${ESPRESSO}" stroke-opacity="0.14" stroke-width="0.8"/>`,
    )
    .join('');
  return `<g>${petals}<circle cx="${cx}" cy="${cy}" r="${r * 0.16}" fill="${SAGE}" opacity="0.75"/></g>`;
}

function bud(cx: number, cy: number, r: number, rot: number): string {
  return `<ellipse transform="rotate(${rot} ${cx} ${cy})" cx="${cx}" cy="${cy}" rx="${r * 0.5}" ry="${r}"
    fill="${SAGE}" opacity="0.55"/>`;
}

/** An arching orchid stem with blooms; drop=true renders the wilted version. */
function orchidStem(baseX: number, baseY: number, lean: number, scale: number, tint: string, drop = false): string {
  const s = scale;
  if (drop) {
    const stem = `M ${baseX} ${baseY} C ${baseX + 10 * s} ${baseY - 90 * s}, ${baseX + lean * 40} ${baseY - 150 * s}, ${baseX + lean * 70} ${baseY - 120 * s}`;
    return `<g>
      <path d="${stem}" fill="none" stroke="${WILT}" stroke-width="${2.4 * s}" stroke-linecap="round"/>
      ${fivePetal(baseX + lean * 62, baseY - 118 * s, 15 * s, 160, tint)}
      ${fivePetal(baseX + lean * 34, baseY - 142 * s, 12 * s, 200, tint)}
      <ellipse cx="${baseX + lean * 20}" cy="${baseY - 8}" rx="${9 * s}" ry="${4 * s}" fill="${tint}" opacity="0.8"/>
      <ellipse cx="${baseX - lean * 14}" cy="${baseY - 4}" rx="${8 * s}" ry="${3.5 * s}" fill="${tint}" opacity="0.6"/>
    </g>`;
  }
  const stem = `M ${baseX} ${baseY} C ${baseX - 6 * s} ${baseY - 110 * s}, ${baseX + lean * 30} ${baseY - 190 * s}, ${baseX + lean * 78} ${baseY - 232 * s}`;
  const pts: Array<[number, number, number, number]> = [
    [baseX + lean * 8, baseY - 148 * s, 17 * s, 10],
    [baseX + lean * 26, baseY - 178 * s, 15.5 * s, -14],
    [baseX + lean * 47, baseY - 203 * s, 14 * s, 22],
    [baseX + lean * 66, baseY - 222 * s, 12 * s, -8],
  ];
  return `<g>
    <path d="${stem}" fill="none" stroke="${SAGE}" stroke-width="${2.4 * s}" stroke-linecap="round"/>
    <path d="M ${baseX} ${baseY} C ${baseX - 26 * s} ${baseY - 30 * s}, ${baseX - 40 * s} ${baseY - 34 * s}, ${baseX - 52 * s} ${baseY - 26 * s}"
      fill="none" stroke="${SAGE}" stroke-width="${2 * s}" stroke-linecap="round" opacity="0.8"/>
    ${pts.map(([x, y, r, rot]) => fivePetal(x, y, r, rot, tint)).join('')}
    ${bud(baseX + lean * 76, baseY - 230 * s, 7 * s, lean * 30)}
    ${bud(baseX + lean * 82, baseY - 238 * s, 5 * s, lean * 45)}
  </g>`;
}

/** A single calla: sculptural spathe + spadix; drop=true wilts it. */
function calla(baseX: number, baseY: number, lean: number, scale: number, tint: string, drop = false): string {
  const s = scale;
  if (drop) {
    const tipX = baseX + lean * 46 * s;
    const tipY = baseY - 96 * s;
    return `<g>
      <path d="M ${baseX} ${baseY} C ${baseX + 4 * s} ${baseY - 70 * s}, ${tipX - lean * 20 * s} ${tipY - 26 * s}, ${tipX} ${tipY}"
        fill="none" stroke="${WILT}" stroke-width="${2.6 * s}" stroke-linecap="round"/>
      <path d="M ${tipX} ${tipY} C ${tipX - 12 * s} ${tipY + 16 * s}, ${tipX - 4 * s} ${tipY + 34 * s}, ${tipX + 8 * s} ${tipY + 40 * s}
               C ${tipX + 16 * s} ${tipY + 26 * s}, ${tipX + 12 * s} ${tipY + 8 * s}, ${tipX} ${tipY} Z"
        fill="${tint}" stroke="${ESPRESSO}" stroke-opacity="0.14" stroke-width="0.8"/>
    </g>`;
  }
  const tipX = baseX + lean * 26 * s;
  const tipY = baseY - 150 * s;
  return `<g>
    <path d="M ${baseX} ${baseY} C ${baseX - 3 * s} ${baseY - 60 * s}, ${tipX - lean * 12 * s} ${tipY + 70 * s}, ${tipX} ${tipY + 34 * s}"
      fill="none" stroke="${SAGE}" stroke-width="${2.6 * s}" stroke-linecap="round"/>
    <path d="M ${tipX} ${tipY + 34 * s}
             C ${tipX - 16 * s} ${tipY + 20 * s}, ${tipX - 14 * s} ${tipY - 6 * s}, ${tipX + 2 * s} ${tipY - 14 * s}
             C ${tipX + 6 * s} ${tipY - 16 * s}, ${tipX + 10 * s} ${tipY - 12 * s}, ${tipX + 8 * s} ${tipY - 6 * s}
             C ${tipX + 18 * s} ${tipY + 6 * s}, ${tipX + 14 * s} ${tipY + 26 * s}, ${tipX} ${tipY + 34 * s} Z"
      fill="${tint}" stroke="${ESPRESSO}" stroke-opacity="0.16" stroke-width="0.9"/>
    <path d="M ${tipX} ${tipY + 30 * s} L ${tipX + 1 * s} ${tipY + 6 * s}"
      stroke="#D9B25F" stroke-width="${2.2 * s}" stroke-linecap="round" opacity="0.85"/>
  </g>`;
}

/* — Vases ----------------------------------------------------------------- */

function vaseShape(id: string, cx: number, baseY: number, scale = 1): string {
  const s = scale;
  switch (id) {
    case 'vase-tall':
      return `<g>
        <path d="M ${cx - 22 * s} ${baseY} L ${cx - 20 * s} ${baseY - 128 * s} Q ${cx} ${baseY - 134 * s} ${cx + 20 * s} ${baseY - 128 * s} L ${cx + 22 * s} ${baseY} Z"
          fill="${BONE}" stroke="${COCOA}" stroke-opacity="0.35" stroke-width="1.2"/>
        <ellipse cx="${cx}" cy="${baseY - 128 * s}" rx="${20 * s}" ry="${4 * s}" fill="none" stroke="${COCOA}" stroke-opacity="0.3" stroke-width="1"/>
      </g>`;
    case 'vase-round':
      return `<g>
        <path d="M ${cx - 14 * s} ${baseY - 88 * s} C ${cx - 52 * s} ${baseY - 78 * s}, ${cx - 52 * s} ${baseY - 10 * s}, ${cx} ${baseY}
                 C ${cx + 52 * s} ${baseY - 10 * s}, ${cx + 52 * s} ${baseY - 78 * s}, ${cx + 14 * s} ${baseY - 88 * s} Z"
          fill="${PORCELAIN}" stroke="${COCOA}" stroke-opacity="0.35" stroke-width="1.2"/>
        <ellipse cx="${cx}" cy="${baseY - 88 * s}" rx="${14 * s}" ry="${3.4 * s}" fill="none" stroke="${COCOA}" stroke-opacity="0.3" stroke-width="1"/>
      </g>`;
    case 'vase-travertine':
      return `<g>
        <path d="M ${cx - 30 * s} ${baseY} L ${cx - 24 * s} ${baseY - 96 * s} L ${cx + 24 * s} ${baseY - 96 * s} L ${cx + 30 * s} ${baseY} Z"
          fill="#E7DECE" stroke="${COCOA}" stroke-opacity="0.4" stroke-width="1.2"/>
        <path d="M ${cx - 24 * s} ${baseY - 70 * s} q ${18 * s} ${5 * s} ${48 * s} ${1 * s}" stroke="${STONE}" stroke-width="0.9" fill="none" opacity="0.5"/>
        <path d="M ${cx - 26 * s} ${baseY - 40 * s} q ${24 * s} ${-4 * s} ${52 * s} ${2 * s}" stroke="${STONE}" stroke-width="0.9" fill="none" opacity="0.4"/>
        <path d="M ${cx - 27 * s} ${baseY - 16 * s} q ${20 * s} ${5 * s} ${55 * s} ${0}" stroke="${STONE}" stroke-width="0.9" fill="none" opacity="0.45"/>
        <ellipse cx="${cx}" cy="${baseY - 96 * s}" rx="${24 * s}" ry="${4.4 * s}" fill="#DDD2BE" stroke="${COCOA}" stroke-opacity="0.35" stroke-width="1"/>
      </g>`;
    default: // vase-glass (Velo)
      return `<g>
        <path d="M ${cx - 14 * s} ${baseY} L ${cx - 12 * s} ${baseY - 100 * s} L ${cx + 12 * s} ${baseY - 100 * s} L ${cx + 14 * s} ${baseY} Z"
          fill="${STONE}" fill-opacity="0.13" stroke="${COCOA}" stroke-opacity="0.45" stroke-width="1"/>
        <path d="M ${cx - 8 * s} ${baseY - 12 * s} L ${cx - 7 * s} ${baseY - 88 * s}" stroke="#fff" stroke-width="1.6" opacity="0.55"/>
      </g>`;
  }
}

/* — Scene assembly -------------------------------------------------------- */

function sceneFor(p: Product, tint: string, drop = false): string {
  const cx = 200;
  const baseY = 420;
  switch (p.id) {
    case 'orchid-arrangement':
      return `${shadow(cx, baseY + 4, 92)}
        ${vaseShape('vase-travertine', cx, baseY)}
        ${orchidStem(cx - 12, baseY - 94, 1, 1, tint, drop)}
        ${orchidStem(cx + 12, baseY - 94, -1, 0.88, tint, drop)}
        <path d="M ${cx - 22} ${baseY - 96} q 22 8 46 0" stroke="${SAGE}" stroke-width="5" opacity="0.5" fill="none"/>`;
    case 'calla-arrangement':
      return `${shadow(cx, baseY + 4, 80)}
        ${vaseShape('vase-tall', cx, baseY)}
        ${calla(cx - 8, baseY - 128, -1, 1.02, tint, drop)}
        ${calla(cx, baseY - 128, 1, 1.12, tint, drop)}
        ${calla(cx + 8, baseY - 128, 1.8, 0.9, tint, drop)}
        ${calla(cx - 4, baseY - 128, -1.9, 0.82, tint, drop)}`;
    case 'orchid-stem':
      return `${shadow(cx, baseY + 4, 60)}
        ${vaseShape('vase-glass', cx, baseY)}
        ${orchidStem(cx, baseY - 98, 1, 1.05, tint, drop)}`;
    case 'calla-stem':
      return `${shadow(cx, baseY + 4, 56)}
        ${vaseShape('vase-glass', cx, baseY)}
        ${calla(cx, baseY - 98, 1, 1.25, tint, drop)}`;
    case 'vase-tall':
      return `${shadow(cx, baseY + 4, 66)}${vaseShape('vase-tall', cx, baseY, 1.35)}`;
    case 'vase-round':
      return `${shadow(cx, baseY + 4, 88)}${vaseShape('vase-round', cx, baseY, 1.35)}`;
    case 'vase-travertine':
      return `${shadow(cx, baseY + 4, 70)}${vaseShape('vase-travertine', cx, baseY, 1.35)}`;
    case 'vase-glass':
      return `${shadow(cx, baseY + 4, 52)}${vaseShape('vase-glass', cx, baseY, 1.45)}`;
    default:
      return shadow(cx, baseY, 60);
  }
}

function roomBackdrop(): string {
  return `
    <rect x="0" y="0" width="400" height="500" fill="${PORCELAIN}"/>
    <line x1="0" y1="330" x2="400" y2="330" stroke="${STONE}" stroke-width="0.8" opacity="0.35"/>
    <rect x="36" y="70" width="104" height="132" fill="none" stroke="${STONE}" stroke-width="1" opacity="0.4"/>
    <path d="M60 176 C 76 140, 104 140, 118 176" fill="none" stroke="${SAGE}" stroke-width="1" opacity="0.4"/>
    <rect x="60" y="330" width="280" height="14" fill="#E4DAC8" stroke="${COCOA}" stroke-opacity="0.25"/>
    <line x1="86" y1="344" x2="86" y2="452" stroke="${COCOA}" stroke-width="2.4" opacity="0.3"/>
    <line x1="314" y1="344" x2="314" y2="452" stroke="${COCOA}" stroke-width="2.4" opacity="0.3"/>
  `;
}

const wrap = (inner: string, tintHex?: string, viewBox = '0 0 400 500'): string =>
  `<svg class="art" viewBox="${viewBox}" preserveAspectRatio="xMidYMid slice"
     ${tintHex ? `style="--tint:${tintHex}"` : ''} aria-hidden="true" focusable="false">
     <rect width="100%" height="100%" fill="${PORCELAIN}"/>${inner}</svg>`;

export interface ArtOptions {
  variant?: ArtVariant;
  colorHex?: string;
  labels?: { fresh: string; merel: string };
}

export function productArt(p: Product, opts: ArtOptions = {}): string {
  const { variant = 'front', colorHex, labels } = opts;
  const tint = 'var(--tint, #F3EDDF)';
  const scene = sceneFor(p, tint);

  switch (variant) {
    case 'detail':
      return wrap(
        `<g transform="translate(-320 -220) scale(1.9)">${scene}</g>
         <circle cx="330" cy="80" r="26" fill="none" stroke="${SAGE}" stroke-width="1" opacity="0.5"/>
         <line x1="348" y1="98" x2="366" y2="116" stroke="${SAGE}" stroke-width="1" opacity="0.5"/>`,
        colorHex,
      );
    case 'room':
      return wrap(
        `${roomBackdrop()}<g transform="translate(120 118) scale(0.52)">${scene}</g>`,
        colorHex,
      );
    case 'video':
      return wrap(
        `${roomBackdrop()}<g transform="translate(120 118) scale(0.52)" opacity="0.85">${scene}</g>
         <circle cx="200" cy="250" r="34" fill="${ESPRESSO}" opacity="0.82"/>
         <path d="M192 236 L216 250 L192 264 Z" fill="${BONE}"/>`,
        colorHex,
      );
    case 'compare': {
      const wilted = sceneFor(p, WILT, true);
      return wrap(
        `<clipPath id="cmp-l"><rect x="0" y="0" width="200" height="500"/></clipPath>
         <clipPath id="cmp-r"><rect x="200" y="0" width="200" height="500"/></clipPath>
         <g clip-path="url(#cmp-l)"><g transform="translate(-95 30) scale(0.92)">${wilted}</g></g>
         <g clip-path="url(#cmp-r)"><g transform="translate(105 30) scale(0.92)">${scene}</g></g>
         <line x1="200" y1="0" x2="200" y2="500" stroke="${COCOA}" stroke-width="1" opacity="0.4"/>
         <text x="100" y="36" text-anchor="middle" font-family="Jost, sans-serif" font-size="12"
           letter-spacing="1.5" fill="${STONE}">${labels?.fresh ?? ''}</text>
         <text x="300" y="36" text-anchor="middle" font-family="Jost, sans-serif" font-size="12"
           letter-spacing="1.5" fill="${SAGE}">${labels?.merel ?? ''}</text>`,
        colorHex,
      );
    }
    default:
      return wrap(scene, colorHex);
  }
}

/** Flower + vase composed side by side — looks band, configurator preview. */
export function pairArt(flowerId: string, vaseId: string, colorHex?: string): string {
  const flower = productById(flowerId);
  const vase = productById(vaseId);
  if (!flower || !vase) return wrap('');
  const tint = 'var(--tint, #F3EDDF)';
  const isOrchid = flower.id === 'orchid-arrangement' || flower.id === 'orchid-stem';
  const full = flower.category === 'bouquets';
  const flowerScene = isOrchid
    ? `${orchidStem(200, 424, 1, 1.05, tint)}${full ? orchidStem(212, 424, -1, 0.9, tint) : ''}`
    : `${calla(200, 424, 1, 1.3, tint)}${full ? `${calla(192, 424, -1.6, 1.05, tint)}${calla(208, 424, 2, 0.9, tint)}` : ''}`;
  return wrap(
    `${shadow(200, 428, 96)}
     <g transform="translate(0 -6)">${flowerScene}</g>
     ${vaseShape(vaseId, 200, 424, 1.05)}`,
    colorHex,
  );
}

/** Square UGC vignettes — three distinct rooms. */
export function ugcArt(index: number, productId: string, colorHex?: string): string {
  const p = productById(productId);
  const tint = 'var(--tint, #F3EDDF)';
  const scene = p ? sceneFor(p, tint) : '';
  const rooms = [
    `<rect width="400" height="400" fill="${PORCELAIN}"/>
     <rect x="250" y="40" width="120" height="180" fill="#EAE2D2" opacity="0.8"/>
     <line x1="250" y1="40" x2="250" y2="220" stroke="${STONE}" opacity="0.4"/>
     <line x1="0" y1="286" x2="400" y2="286" stroke="${STONE}" stroke-width="0.8" opacity="0.35"/>`,
    `<rect width="400" height="400" fill="#EFE8DB"/>
     <circle cx="90" cy="90" r="52" fill="none" stroke="${STONE}" opacity="0.4"/>
     <line x1="0" y1="292" x2="400" y2="292" stroke="${STONE}" stroke-width="0.8" opacity="0.35"/>
     <rect x="230" y="292" width="150" height="10" fill="#E2D8C4"/>`,
    `<rect width="400" height="400" fill="${PORCELAIN}"/>
     <path d="M0 120 L400 96" stroke="${STONE}" opacity="0.3"/>
     <rect x="40" y="60" width="80" height="110" fill="none" stroke="${STONE}" opacity="0.4"/>
     <line x1="0" y1="298" x2="400" y2="298" stroke="${STONE}" stroke-width="0.8" opacity="0.35"/>`,
  ];
  return wrap(
    `${rooms[index % 3]}<g transform="translate(116 22) scale(0.62)">${scene}</g>`,
    colorHex,
    '0 0 400 400',
  );
}

/** Home hero composition: the signature orchid in travertine. */
export function heroArt(colorHex?: string): string {
  const p = productById('orchid-arrangement');
  if (!p) return wrap('');
  return wrap(
    `${sceneFor(p, 'var(--tint, #F3EDDF)')}
     <path d="M 40 468 q 160 18 320 0" stroke="${STONE}" stroke-width="0.8" fill="none" opacity="0.3"/>`,
    colorHex,
  );
}

/** Editorial split image: a petal in close-up, half drawn, half painted. */
export function editorialArt(): string {
  return wrap(
    `<g transform="translate(200 260)">
      <path d="M0 130 C -95 60, -95 -80, 0 -150 C 95 -80, 95 60, 0 130 Z"
        fill="var(--tint, #F3EDDF)" stroke="${COCOA}" stroke-opacity="0.25"/>
      <path d="M0 118 C -66 52, -70 -62, 0 -132" fill="none" stroke="${COCOA}" stroke-width="0.8" opacity="0.35"/>
      <path d="M0 118 C 66 52, 70 -62, 0 -132" fill="none" stroke="${COCOA}" stroke-width="0.8" opacity="0.35"/>
      <path d="M0 124 L 0 -140" stroke="${COCOA}" stroke-width="0.9" opacity="0.4"/>
      <path d="M0 40 C -30 24, -46 4, -56 -30 M 0 40 C 30 24, 46 4, 56 -30 M 0 -20 C -22 -34, -34 -52, -40 -80 M 0 -20 C 22 -34, 34 -52, 40 -80"
        stroke="${COCOA}" stroke-width="0.6" fill="none" opacity="0.3"/>
    </g>
    <line x1="200" y1="30" x2="200" y2="470" stroke="${SAGE}" stroke-width="0.6" opacity="0.25"/>`,
  );
}
