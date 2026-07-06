/**
 * Placeholder art system v2: layered SVG scenes per product with soft
 * gradients, petal shading and grain. Petals fill from the --tint CSS
 * variable so colourways retint in place. Real photography (p.images[])
 * overrides these when present.
 */
import type { Product } from '../data/products';
import { productById } from '../data/products';

const BONE = '#F2ECE3';
const ESPRESSO = '#2A2521';
const COCOA = '#5C5248';
const STONE = '#8D8478';
const SAGE = '#6E7A66';
const SAGE_DEEP = '#5C6856';
const WILT = '#C4AD8F';
const TINT = 'var(--tint, #F3EDDF)';

let uidCounter = 0;
const uid = () => `a${(uidCounter++).toString(36)}`;

export type ArtVariant = 'front' | 'detail' | 'room' | 'video' | 'compare';

/* — Signature motifs (hand-drawn line art) ------------------------------- */

/** Curled sprout mark — loader, cursor, empty states. */
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

/* — Shared building blocks ------------------------------------------------ */

function shadow(cx: number, cy: number, rx: number): string {
  return `<ellipse cx="${cx}" cy="${cy}" rx="${rx * 1.35}" ry="${rx * 0.2}" fill="${ESPRESSO}" opacity="0.045"/>
    <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${rx * 0.13}" fill="${ESPRESSO}" opacity="0.08"/>`;
}

/** Deterministic jitter so scenes are organic but stable between renders. */
const jit = (seed: number, spread: number) =>
  (((Math.sin(seed * 127.1) * 43758.5453) % 1) - 0.5) * spread;

/** One shaded orchid bloom: five petals + highlight + lip. */
function orchidBloom(cx: number, cy: number, r: number, rot: number, seed = 1): string {
  const petals = [0, 72, 144, 216, 288]
    .map((a, i) => {
      const angle = a + rot + jit(seed + i, 10);
      return `<g transform="rotate(${angle} ${cx} ${cy})">
        <ellipse cx="${cx}" cy="${cy - r * 0.56}" rx="${r * 0.36}" ry="${r * 0.6}"
          fill="${TINT}" stroke="${ESPRESSO}" stroke-opacity="0.12" stroke-width="0.7"/>
        <ellipse cx="${cx}" cy="${cy - r * 0.48}" rx="${r * 0.18}" ry="${r * 0.4}" fill="#FFFFFF" opacity="0.3"/>
        <path d="M ${cx} ${cy - r * 0.2} L ${cx} ${cy - r * 1.05}" stroke="${ESPRESSO}" stroke-opacity="0.08" stroke-width="0.7"/>
      </g>`;
    })
    .join('');
  return `<g>
    ${petals}
    <circle cx="${cx}" cy="${cy}" r="${r * 0.2}" fill="${TINT}" stroke="${ESPRESSO}" stroke-opacity="0.18" stroke-width="0.7"/>
    <circle cx="${cx}" cy="${cy}" r="${r * 0.09}" fill="#C89A4B" opacity="0.85"/>
  </g>`;
}

function bud(cx: number, cy: number, r: number, rot: number): string {
  return `<g transform="rotate(${rot} ${cx} ${cy})">
    <ellipse cx="${cx}" cy="${cy}" rx="${r * 0.52}" ry="${r}" fill="${SAGE}" opacity="0.6"/>
    <ellipse cx="${cx - r * 0.15}" cy="${cy - r * 0.15}" rx="${r * 0.22}" ry="${r * 0.55}" fill="#FFFFFF" opacity="0.18"/>
  </g>`;
}

function leaf(x: number, y: number, len: number, lean: number, tone = SAGE): string {
  const tipX = x + lean * len * 0.7;
  const tipY = y - len * 0.35;
  return `<path d="M ${x} ${y}
      C ${x + lean * len * 0.15} ${y - len * 0.4}, ${tipX - lean * len * 0.2} ${tipY - len * 0.1}, ${tipX} ${tipY}
      C ${tipX - lean * len * 0.05} ${tipY + len * 0.16}, ${x + lean * len * 0.3} ${y - len * 0.05}, ${x} ${y} Z"
    fill="${tone}" opacity="0.5" stroke="${SAGE_DEEP}" stroke-opacity="0.3" stroke-width="0.7"/>`;
}

/** An arching orchid stem with blooms; drop=true renders the wilted version. */
function orchidStem(baseX: number, baseY: number, lean: number, scale: number, drop = false, seed = 1): string {
  const s = scale;
  if (drop) {
    const stem = `M ${baseX} ${baseY} C ${baseX + 10 * s} ${baseY - 90 * s}, ${baseX + lean * 40} ${baseY - 150 * s}, ${baseX + lean * 70} ${baseY - 118 * s}`;
    return `<g style="--tint:${WILT}">
      <path d="${stem}" fill="none" stroke="${WILT}" stroke-width="${2.4 * s}" stroke-linecap="round"/>
      ${orchidBloom(baseX + lean * 62, baseY - 116 * s, 15 * s, 160, seed)}
      ${orchidBloom(baseX + lean * 34, baseY - 142 * s, 12 * s, 200, seed + 3)}
      <ellipse cx="${baseX + lean * 20}" cy="${baseY - 8}" rx="${9 * s}" ry="${4 * s}" fill="${WILT}" opacity="0.8"/>
      <ellipse cx="${baseX - lean * 14}" cy="${baseY - 4}" rx="${8 * s}" ry="${3.5 * s}" fill="${WILT}" opacity="0.6"/>
    </g>`;
  }
  const stem = `M ${baseX} ${baseY} C ${baseX - 6 * s} ${baseY - 110 * s}, ${baseX + lean * 30} ${baseY - 190 * s}, ${baseX + lean * 82} ${baseY - 234 * s}`;
  const blooms: Array<[number, number, number, number]> = [
    [baseX + lean * 2, baseY - 128 * s, 16.5 * s, 8],
    [baseX + lean * 16, baseY - 160 * s, 17.5 * s, -12],
    [baseX + lean * 34, baseY - 188 * s, 15.5 * s, 20],
    [baseX + lean * 54, baseY - 210 * s, 14 * s, -6],
    [baseX + lean * 70, baseY - 226 * s, 12 * s, 14],
  ];
  return `<g>
    <path d="${stem}" fill="none" stroke="${SAGE_DEEP}" stroke-width="${2.6 * s}" stroke-linecap="round"/>
    ${leaf(baseX - 2 * s, baseY - 6 * s, 60 * s, -1)}
    ${leaf(baseX + 2 * s, baseY - 2 * s, 46 * s, 1)}
    ${blooms.map(([x, y, r, rot], i) => orchidBloom(x, y, r, rot, seed + i)).join('')}
    ${bud(baseX + lean * 80, baseY - 232 * s, 7 * s, lean * 30)}
    ${bud(baseX + lean * 86, baseY - 240 * s, 5 * s, lean * 45)}
  </g>`;
}

/** A single calla: sculptural shaded spathe + spadix; drop=true wilts it. */
function calla(baseX: number, baseY: number, lean: number, scale: number, drop = false): string {
  const s = scale;
  if (drop) {
    const tipX = baseX + lean * 46 * s;
    const tipY = baseY - 96 * s;
    return `<g>
      <path d="M ${baseX} ${baseY} C ${baseX + 4 * s} ${baseY - 70 * s}, ${tipX - lean * 20 * s} ${tipY - 26 * s}, ${tipX} ${tipY}"
        fill="none" stroke="${WILT}" stroke-width="${2.6 * s}" stroke-linecap="round"/>
      <path d="M ${tipX} ${tipY} C ${tipX - 12 * s} ${tipY + 16 * s}, ${tipX - 4 * s} ${tipY + 34 * s}, ${tipX + 8 * s} ${tipY + 40 * s}
               C ${tipX + 16 * s} ${tipY + 26 * s}, ${tipX + 12 * s} ${tipY + 8 * s}, ${tipX} ${tipY} Z"
        fill="${WILT}" stroke="${ESPRESSO}" stroke-opacity="0.14" stroke-width="0.8"/>
    </g>`;
  }
  const tipX = baseX + lean * 26 * s;
  const tipY = baseY - 150 * s;
  return `<g>
    <path d="M ${baseX} ${baseY} C ${baseX - 3 * s} ${baseY - 60 * s}, ${tipX - lean * 12 * s} ${tipY + 70 * s}, ${tipX} ${tipY + 34 * s}"
      fill="none" stroke="${SAGE_DEEP}" stroke-width="${2.8 * s}" stroke-linecap="round"/>
    <path d="M ${tipX} ${tipY + 34 * s}
             C ${tipX - 17 * s} ${tipY + 20 * s}, ${tipX - 15 * s} ${tipY - 6 * s}, ${tipX + 2 * s} ${tipY - 15 * s}
             C ${tipX + 6 * s} ${tipY - 17 * s}, ${tipX + 11 * s} ${tipY - 13 * s}, ${tipX + 9 * s} ${tipY - 6 * s}
             C ${tipX + 19 * s} ${tipY + 6 * s}, ${tipX + 15 * s} ${tipY + 26 * s}, ${tipX} ${tipY + 34 * s} Z"
      fill="${TINT}" stroke="${ESPRESSO}" stroke-opacity="0.16" stroke-width="0.9"/>
    <path d="M ${tipX - 8 * s} ${tipY + 18 * s} C ${tipX - 9 * s} ${tipY + 2 * s}, ${tipX - 4 * s} ${tipY - 8 * s}, ${tipX + 2 * s} ${tipY - 12 * s}"
      fill="none" stroke="#FFFFFF" stroke-opacity="0.5" stroke-width="${2.2 * s}" stroke-linecap="round"/>
    <path d="M ${tipX + 4 * s} ${tipY + 30 * s} C ${tipX + 9 * s} ${tipY + 22 * s}, ${tipX + 11 * s} ${tipY + 12 * s}, ${tipX + 10 * s} ${tipY + 2 * s}"
      fill="none" stroke="${ESPRESSO}" stroke-opacity="0.08" stroke-width="${3 * s}" stroke-linecap="round"/>
    <path d="M ${tipX} ${tipY + 30 * s} L ${tipX + 1 * s} ${tipY + 4 * s}"
      stroke="#D9B25F" stroke-width="${2.2 * s}" stroke-linecap="round" opacity="0.9"/>
  </g>`;
}

/* — Vases ----------------------------------------------------------------- */

/** Ceramic sheen: a vertical gradient unique to this svg instance. */
function ceramicDefs(id: string, light: string, dark: string): string {
  return `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="${light}"/>
    <stop offset="0.45" stop-color="${light}"/>
    <stop offset="1" stop-color="${dark}"/>
  </linearGradient>`;
}

function vaseShape(id: string, cx: number, baseY: number, scale = 1): { defs: string; body: string } {
  const s = scale;
  const g = uid();
  switch (id) {
    case 'vase-tall':
      return {
        defs: ceramicDefs(g, '#F6F1E6', '#DFD5C2'),
        body: `<g>
          <path d="M ${cx - 22 * s} ${baseY} L ${cx - 20 * s} ${baseY - 128 * s} Q ${cx} ${baseY - 134 * s} ${cx + 20 * s} ${baseY - 128 * s} L ${cx + 22 * s} ${baseY} Z"
            fill="url(#${g})" stroke="${COCOA}" stroke-opacity="0.32" stroke-width="1.1"/>
          <path d="M ${cx - 13 * s} ${baseY - 14 * s} L ${cx - 12 * s} ${baseY - 118 * s}" stroke="#FFFFFF" stroke-width="${3 * s}" opacity="0.4" stroke-linecap="round"/>
          <ellipse cx="${cx}" cy="${baseY - 128 * s}" rx="${20 * s}" ry="${4 * s}" fill="none" stroke="${COCOA}" stroke-opacity="0.3" stroke-width="1"/>
        </g>`,
      };
    case 'vase-round':
      return {
        defs: ceramicDefs(g, '#FBF8F1', '#E3DACA'),
        body: `<g>
          <path d="M ${cx - 14 * s} ${baseY - 88 * s} C ${cx - 52 * s} ${baseY - 78 * s}, ${cx - 52 * s} ${baseY - 10 * s}, ${cx} ${baseY}
                   C ${cx + 52 * s} ${baseY - 10 * s}, ${cx + 52 * s} ${baseY - 78 * s}, ${cx + 14 * s} ${baseY - 88 * s} Z"
            fill="url(#${g})" stroke="${COCOA}" stroke-opacity="0.32" stroke-width="1.1"/>
          <path d="M ${cx - 30 * s} ${baseY - 62 * s} C ${cx - 36 * s} ${baseY - 46 * s}, ${cx - 34 * s} ${baseY - 26 * s}, ${cx - 26 * s} ${baseY - 14 * s}"
            stroke="#FFFFFF" stroke-width="${4 * s}" opacity="0.45" fill="none" stroke-linecap="round"/>
          <ellipse cx="${cx}" cy="${baseY - 88 * s}" rx="${14 * s}" ry="${3.4 * s}" fill="none" stroke="${COCOA}" stroke-opacity="0.3" stroke-width="1"/>
        </g>`,
      };
    case 'vase-travertine':
      return {
        defs: ceramicDefs(g, '#EBE2D0', '#D8CCB4'),
        body: `<g>
          <path d="M ${cx - 30 * s} ${baseY} L ${cx - 24 * s} ${baseY - 96 * s} L ${cx + 24 * s} ${baseY - 96 * s} L ${cx + 30 * s} ${baseY} Z"
            fill="url(#${g})" stroke="${COCOA}" stroke-opacity="0.38" stroke-width="1.1"/>
          <path d="M ${cx - 24 * s} ${baseY - 70 * s} q ${18 * s} ${5 * s} ${48 * s} ${1 * s}" stroke="${STONE}" stroke-width="0.9" fill="none" opacity="0.5"/>
          <path d="M ${cx - 26 * s} ${baseY - 40 * s} q ${24 * s} ${-4 * s} ${52 * s} ${2 * s}" stroke="${STONE}" stroke-width="0.9" fill="none" opacity="0.4"/>
          <path d="M ${cx - 27 * s} ${baseY - 16 * s} q ${20 * s} ${5 * s} ${55 * s} ${0}" stroke="${STONE}" stroke-width="0.9" fill="none" opacity="0.45"/>
          <path d="M ${cx - 20 * s} ${baseY - 84 * s} q ${14 * s} ${3 * s} ${40 * s} ${-1 * s}" stroke="${STONE}" stroke-width="0.7" fill="none" opacity="0.35"/>
          <circle cx="${cx - 10 * s}" cy="${baseY - 56 * s}" r="${1.1 * s}" fill="${STONE}" opacity="0.35"/>
          <circle cx="${cx + 14 * s}" cy="${baseY - 28 * s}" r="${0.9 * s}" fill="${STONE}" opacity="0.3"/>
          <ellipse cx="${cx}" cy="${baseY - 96 * s}" rx="${24 * s}" ry="${4.4 * s}" fill="#DDD2BE" stroke="${COCOA}" stroke-opacity="0.35" stroke-width="1"/>
        </g>`,
      };
    default: // vase-glass (Velo)
      return {
        defs: '',
        body: `<g>
          <path d="M ${cx - 14 * s} ${baseY} L ${cx - 12 * s} ${baseY - 100 * s} L ${cx + 12 * s} ${baseY - 100 * s} L ${cx + 14 * s} ${baseY} Z"
            fill="${STONE}" fill-opacity="0.12" stroke="${COCOA}" stroke-opacity="0.42" stroke-width="1"/>
          <path d="M ${cx - 8 * s} ${baseY - 12 * s} L ${cx - 7 * s} ${baseY - 88 * s}" stroke="#FFFFFF" stroke-width="1.8" opacity="0.6"/>
          <path d="M ${cx + 9 * s} ${baseY - 16 * s} L ${cx + 10 * s} ${baseY - 80 * s}" stroke="${ESPRESSO}" stroke-width="1" opacity="0.1"/>
        </g>`,
      };
  }
}

/* — Scene assembly -------------------------------------------------------- */

function sceneFor(p: Product, drop = false): { defs: string; body: string } {
  const cx = 200;
  const baseY = 420;
  switch (p.id) {
    case 'orchid-arrangement': {
      const vase = vaseShape('vase-travertine', cx, baseY);
      return {
        defs: vase.defs,
        body: `${shadow(cx, baseY + 4, 92)}
          ${orchidStem(cx - 14, baseY - 94, 1, 1, drop, 1)}
          ${orchidStem(cx + 14, baseY - 94, -1, 0.9, drop, 7)}
          ${vase.body}
          <path d="M ${cx - 22} ${baseY - 98} q 12 -8 22 -2 q 10 -7 22 2 q -22 10 -44 0" fill="${SAGE_DEEP}" opacity="0.55"/>`,
      };
    }
    case 'calla-arrangement': {
      const vase = vaseShape('vase-tall', cx, baseY);
      return {
        defs: vase.defs,
        body: `${shadow(cx, baseY + 4, 80)}
          ${calla(cx - 8, baseY - 120, -1, 1.02, drop)}
          ${calla(cx, baseY - 120, 1, 1.14, drop)}
          ${calla(cx + 8, baseY - 120, 1.8, 0.9, drop)}
          ${calla(cx - 4, baseY - 120, -1.9, 0.8, drop)}
          ${calla(cx + 3, baseY - 120, 0.4, 1.24, drop)}
          ${vase.body}`,
      };
    }
    case 'orchid-stem': {
      const vase = vaseShape('vase-glass', cx, baseY);
      return {
        defs: vase.defs,
        body: `${shadow(cx, baseY + 4, 60)}
          ${orchidStem(cx, baseY - 12, 1, 1.08, drop, 3)}
          ${vase.body}`,
      };
    }
    case 'calla-stem': {
      const vase = vaseShape('vase-glass', cx, baseY);
      return {
        defs: vase.defs,
        body: `${shadow(cx, baseY + 4, 56)}
          ${calla(cx, baseY - 10, 1, 1.32, drop)}
          ${vase.body}`,
      };
    }
    case 'vase-tall': {
      const vase = vaseShape('vase-tall', cx, baseY, 1.35);
      return { defs: vase.defs, body: `${shadow(cx, baseY + 4, 66)}${vase.body}` };
    }
    case 'vase-round': {
      const vase = vaseShape('vase-round', cx, baseY, 1.35);
      return { defs: vase.defs, body: `${shadow(cx, baseY + 4, 88)}${vase.body}` };
    }
    case 'vase-travertine': {
      const vase = vaseShape('vase-travertine', cx, baseY, 1.35);
      return { defs: vase.defs, body: `${shadow(cx, baseY + 4, 70)}${vase.body}` };
    }
    case 'vase-glass': {
      const vase = vaseShape('vase-glass', cx, baseY, 1.45);
      return { defs: vase.defs, body: `${shadow(cx, baseY + 4, 52)}${vase.body}` };
    }
    default:
      return { defs: '', body: shadow(cx, baseY, 60) };
  }
}

/** Warm window light + furniture line art shared by room/video/UGC scenes. */
function roomBackdrop(): string {
  return `
    <path d="M300 30 L392 10 L392 250 L300 250 Z" fill="#F8F0DC" opacity="0.55"/>
    <line x1="0" y1="330" x2="400" y2="330" stroke="${STONE}" stroke-width="0.8" opacity="0.3"/>
    <rect x="36" y="70" width="104" height="132" fill="none" stroke="${STONE}" stroke-width="1" opacity="0.4"/>
    <path d="M62 178 C 74 148, 100 146, 114 176" fill="none" stroke="${SAGE}" stroke-width="1" opacity="0.45"/>
    <circle cx="88" cy="140" r="10" fill="none" stroke="${SAGE}" stroke-width="0.8" opacity="0.35"/>
    <rect x="58" y="328" width="284" height="15" fill="#E7DDCA" stroke="${COCOA}" stroke-opacity="0.25"/>
    <line x1="86" y1="343" x2="86" y2="452" stroke="${COCOA}" stroke-width="2.6" opacity="0.3"/>
    <line x1="314" y1="343" x2="314" y2="452" stroke="${COCOA}" stroke-width="2.6" opacity="0.3"/>
    <rect x="256" y="306" width="44" height="6" rx="1" fill="#E0D5BF"/>
    <rect x="262" y="298" width="32" height="6" rx="1" fill="#D8CBB2"/>`;
}

interface WrapOpts {
  tintHex?: string;
  viewBox?: string;
  grain?: boolean;
  defs?: string;
  bg?: 'flat' | 'radial';
}

function wrap(inner: string, opts: WrapOpts = {}): string {
  const { tintHex, viewBox = '0 0 400 500', grain = false, defs = '', bg = 'radial' } = opts;
  const bgId = uid();
  const grainId = uid();
  const [, , w, h] = viewBox.split(' ');
  return `<svg class="art" viewBox="${viewBox}" preserveAspectRatio="xMidYMid slice"
     ${tintHex ? `style="--tint:${tintHex}"` : ''} aria-hidden="true" focusable="false">
     <defs>
       <radialGradient id="${bgId}" cx="50%" cy="36%" r="80%">
         <stop offset="0" stop-color="#FBF8F2"/>
         <stop offset="0.72" stop-color="#F6F1E8"/>
         <stop offset="1" stop-color="#EEE6D6"/>
       </radialGradient>
       ${grain ? `<filter id="${grainId}"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter>` : ''}
       ${defs}
     </defs>
     <rect width="100%" height="100%" fill="${bg === 'radial' ? `url(#${bgId})` : '#F7F3EC'}"/>
     ${inner}
     ${grain ? `<rect width="${w}" height="${h}" filter="url(#${grainId})" opacity="0.05"/>` : ''}
   </svg>`;
}

export interface ArtOptions {
  variant?: ArtVariant;
  colorHex?: string;
  labels?: { fresh: string; merel: string };
}

export function productArt(p: Product, opts: ArtOptions = {}): string {
  const { variant = 'front', colorHex, labels } = opts;
  const scene = sceneFor(p);

  switch (variant) {
    case 'detail':
      return wrap(
        `<g transform="translate(-320 -220) scale(1.9)">${scene.body}</g>
         <circle cx="330" cy="80" r="26" fill="none" stroke="${SAGE}" stroke-width="1" opacity="0.5"/>
         <line x1="348" y1="98" x2="366" y2="116" stroke="${SAGE}" stroke-width="1" opacity="0.5"/>`,
        { tintHex: colorHex, defs: scene.defs },
      );
    case 'room':
      return wrap(
        `${roomBackdrop()}<g transform="translate(120 118) scale(0.52)">${scene.body}</g>`,
        { tintHex: colorHex, defs: scene.defs, grain: true },
      );
    case 'video':
      return wrap(
        `${roomBackdrop()}<g transform="translate(120 118) scale(0.52)" opacity="0.85">${scene.body}</g>
         <circle cx="200" cy="250" r="34" fill="${ESPRESSO}" opacity="0.82"/>
         <path d="M192 236 L216 250 L192 264 Z" fill="${BONE}"/>`,
        { tintHex: colorHex, defs: scene.defs },
      );
    case 'compare': {
      const wilted = sceneFor(p, true);
      const clipL = uid();
      const clipR = uid();
      return wrap(
        `<g clip-path="url(#${clipL})"><g transform="translate(-95 30) scale(0.92)">${wilted.body}</g></g>
         <g clip-path="url(#${clipR})"><g transform="translate(105 30) scale(0.92)">${scene.body}</g></g>
         <line x1="200" y1="0" x2="200" y2="500" stroke="${COCOA}" stroke-width="1" opacity="0.4"/>
         <text x="100" y="36" text-anchor="middle" font-family="Jost, sans-serif" font-size="12"
           letter-spacing="1.5" fill="${STONE}">${labels?.fresh ?? ''}</text>
         <text x="300" y="36" text-anchor="middle" font-family="Jost, sans-serif" font-size="12"
           letter-spacing="1.5" fill="${SAGE}">${labels?.merel ?? ''}</text>`,
        {
          tintHex: colorHex,
          defs: `${scene.defs}${wilted.defs}
            <clipPath id="${clipL}"><rect x="0" y="0" width="200" height="500"/></clipPath>
            <clipPath id="${clipR}"><rect x="200" y="0" width="200" height="500"/></clipPath>`,
        },
      );
    }
    default:
      return wrap(scene.body, { tintHex: colorHex, defs: scene.defs });
  }
}

/** Flower + vase composed — looks band, configurator preview, bundle thumbs. */
export function pairArt(flowerId: string, vaseId: string, colorHex?: string): string {
  const flower = productById(flowerId);
  const vase = productById(vaseId);
  if (!flower || !vase) return wrap('');
  const isOrchid = flower.id === 'orchid-arrangement' || flower.id === 'orchid-stem';
  const full = flower.category === 'bouquets';
  const flowerScene = isOrchid
    ? `${orchidStem(200, 424, 1, 1.05, false, 2)}${full ? orchidStem(212, 424, -1, 0.9, false, 9) : ''}`
    : `${calla(200, 424, 1, 1.3)}${full ? `${calla(192, 424, -1.6, 1.05)}${calla(208, 424, 2, 0.9)}` : ''}`;
  const vaseArt = vaseShape(vaseId, 200, 424, 1.05);
  return wrap(
    `${shadow(200, 428, 96)}
     <g transform="translate(0 -6)">${flowerScene}</g>
     ${vaseArt.body}`,
    { tintHex: colorHex, defs: vaseArt.defs },
  );
}

/** Square UGC vignettes — three distinct rooms with window light. */
export function ugcArt(index: number, productId: string, colorHex?: string): string {
  const p = productById(productId);
  const scene = p ? sceneFor(p) : { defs: '', body: '' };
  const rooms = [
    `<path d="M250 20 L370 4 L370 210 L250 210 Z" fill="#F8F0DC" opacity="0.6"/>
     <rect x="250" y="40" width="120" height="180" fill="none" stroke="${STONE}" opacity="0.35"/>
     <line x1="0" y1="286" x2="400" y2="286" stroke="${STONE}" stroke-width="0.8" opacity="0.35"/>
     <rect x="24" y="286" width="140" height="10" fill="#E4DAC6"/>`,
    `<rect width="400" height="400" fill="#EFE8DB"/>
     <circle cx="90" cy="90" r="52" fill="none" stroke="${STONE}" opacity="0.4"/>
     <path d="M70 106 C 80 84, 100 84, 110 104" fill="none" stroke="${SAGE}" stroke-width="0.9" opacity="0.4"/>
     <line x1="0" y1="292" x2="400" y2="292" stroke="${STONE}" stroke-width="0.8" opacity="0.35"/>
     <rect x="230" y="292" width="150" height="10" fill="#E2D8C4"/>`,
    `<path d="M0 120 L400 96" stroke="${STONE}" opacity="0.3"/>
     <rect x="40" y="60" width="80" height="110" fill="none" stroke="${STONE}" opacity="0.4"/>
     <path d="M58 152 C 68 128, 92 128, 102 150" fill="none" stroke="${SAGE}" stroke-width="0.9" opacity="0.45"/>
     <line x1="0" y1="298" x2="400" y2="298" stroke="${STONE}" stroke-width="0.8" opacity="0.35"/>`,
  ];
  return wrap(`${rooms[index % 3]}<g transform="translate(116 22) scale(0.62)">${scene.body}</g>`, {
    tintHex: colorHex,
    viewBox: '0 0 400 400',
    defs: scene.defs,
    grain: true,
  });
}

/** Home hero: the signature orchid in travertine under a soft arch. */
export function heroArt(colorHex?: string): string {
  const p = productById('orchid-arrangement');
  if (!p) return wrap('');
  const scene = sceneFor(p);
  return wrap(
    `<path d="M 70 470 L 70 190 A 130 130 0 0 1 330 190 L 330 470 Z" fill="#EDE5D4" opacity="0.55"/>
     <path d="M 70 470 L 70 190 A 130 130 0 0 1 330 190 L 330 470" fill="none" stroke="${COCOA}" stroke-opacity="0.14"/>
     ${scene.body}
     <path d="M 40 468 q 160 18 320 0" stroke="${STONE}" stroke-width="0.8" fill="none" opacity="0.3"/>`,
    { tintHex: colorHex, defs: scene.defs, grain: true },
  );
}

/** Editorial split image: a petal in close-up, half drawn, half painted. */
export function editorialArt(): string {
  return wrap(
    `<g transform="translate(200 260)">
      <path d="M0 130 C -95 60, -95 -80, 0 -150 C 95 -80, 95 60, 0 130 Z"
        fill="${TINT}" stroke="${COCOA}" stroke-opacity="0.25"/>
      <path d="M0 130 C -95 60, -95 -80, 0 -150 C -40 -80, -40 60, 0 130 Z" fill="#FFFFFF" opacity="0.22"/>
      <path d="M0 118 C -66 52, -70 -62, 0 -132" fill="none" stroke="${COCOA}" stroke-width="0.8" opacity="0.35"/>
      <path d="M0 118 C 66 52, 70 -62, 0 -132" fill="none" stroke="${COCOA}" stroke-width="0.8" opacity="0.35"/>
      <path d="M0 124 L 0 -140" stroke="${COCOA}" stroke-width="0.9" opacity="0.4"/>
      <path d="M0 40 C -30 24, -46 4, -56 -30 M 0 40 C 30 24, 46 4, 56 -30 M 0 -20 C -22 -34, -34 -52, -40 -80 M 0 -20 C 22 -34, 34 -52, 40 -80"
        stroke="${COCOA}" stroke-width="0.6" fill="none" opacity="0.3"/>
    </g>
    <line x1="200" y1="30" x2="200" y2="470" stroke="${SAGE}" stroke-width="0.6" opacity="0.25"/>`,
    { grain: true },
  );
}
