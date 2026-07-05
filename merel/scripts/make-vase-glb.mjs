/**
 * Generates the placeholder vase GLB (public/assets/models/vase.glb) so the
 * 3D pipeline is provable end-to-end without real photogrammetry assets.
 * Builds a lathe-profile vase (indexed triangles + smooth normals) and
 * writes a minimal, valid binary glTF. No dependencies.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/* — Lathe profile: (radius, y) pairs, bottom → rim, metres — */
const profile = [
  [0.0, 0.0],
  [0.052, 0.0],
  [0.06, 0.008],
  [0.064, 0.05],
  [0.058, 0.11],
  [0.046, 0.16],
  [0.04, 0.2],
  [0.042, 0.23],
  [0.05, 0.25],
  [0.052, 0.26],
  [0.046, 0.262], // inner rim
  [0.04, 0.24],
  [0.036, 0.2],
  [0.036, 0.06],
  [0.0, 0.05], // inner floor
];

const SEGMENTS = 48;
const positions = [];
const indices = [];

const ringCount = profile.length;
for (let i = 0; i < ringCount; i++) {
  const [r, y] = profile[i];
  for (let s = 0; s <= SEGMENTS; s++) {
    const a = (s / SEGMENTS) * Math.PI * 2;
    positions.push(r * Math.cos(a), y, r * Math.sin(a));
  }
}
const ringStride = SEGMENTS + 1;
for (let i = 0; i < ringCount - 1; i++) {
  for (let s = 0; s < SEGMENTS; s++) {
    const a = i * ringStride + s;
    const b = a + ringStride;
    indices.push(a, b, a + 1, a + 1, b, b + 1);
  }
}

/* — Smooth normals (area-weighted accumulation) — */
const normals = new Float32Array(positions.length);
for (let i = 0; i < indices.length; i += 3) {
  const [ia, ib, ic] = [indices[i] * 3, indices[i + 1] * 3, indices[i + 2] * 3];
  const ax = positions[ib] - positions[ia];
  const ay = positions[ib + 1] - positions[ia + 1];
  const az = positions[ib + 2] - positions[ia + 2];
  const bx = positions[ic] - positions[ia];
  const by = positions[ic + 1] - positions[ia + 1];
  const bz = positions[ic + 2] - positions[ia + 2];
  const nx = ay * bz - az * by;
  const ny = az * bx - ax * bz;
  const nz = ax * by - ay * bx;
  for (const idx of [ia, ib, ic]) {
    normals[idx] += nx;
    normals[idx + 1] += ny;
    normals[idx + 2] += nz;
  }
}
for (let i = 0; i < normals.length; i += 3) {
  const len = Math.hypot(normals[i], normals[i + 1], normals[i + 2]) || 1;
  normals[i] /= len;
  normals[i + 1] /= len;
  normals[i + 2] /= len;
}

/* — Buffers — */
const posArray = new Float32Array(positions);
const idxArray = new Uint16Array(indices);

const pad4 = (n) => Math.ceil(n / 4) * 4;
const posBytes = posArray.byteLength;
const nrmBytes = normals.byteLength;
const idxBytes = pad4(idxArray.byteLength);
const bin = Buffer.alloc(posBytes + nrmBytes + idxBytes);
Buffer.from(posArray.buffer).copy(bin, 0);
Buffer.from(normals.buffer).copy(bin, posBytes);
Buffer.from(idxArray.buffer).copy(bin, posBytes + nrmBytes);

const mins = [Infinity, Infinity, Infinity];
const maxs = [-Infinity, -Infinity, -Infinity];
for (let i = 0; i < posArray.length; i += 3) {
  for (let c = 0; c < 3; c++) {
    mins[c] = Math.min(mins[c], posArray[i + c]);
    maxs[c] = Math.max(maxs[c], posArray[i + c]);
  }
}

const gltf = {
  asset: { version: '2.0', generator: 'merel-make-vase' },
  scene: 0,
  scenes: [{ nodes: [0] }],
  nodes: [{ mesh: 0, name: 'MerelVase' }],
  meshes: [
    {
      name: 'vase',
      primitives: [{ attributes: { POSITION: 0, NORMAL: 1 }, indices: 2, material: 0 }],
    },
  ],
  materials: [
    {
      name: 'porcelain-bone',
      pbrMetallicRoughness: {
        baseColorFactor: [0.937, 0.906, 0.855, 1], // bone #EFE7DA-ish, linearised roughly
        metallicFactor: 0.0,
        roughnessFactor: 0.55,
      },
    },
  ],
  buffers: [{ byteLength: bin.byteLength }],
  bufferViews: [
    { buffer: 0, byteOffset: 0, byteLength: posBytes, target: 34962 },
    { buffer: 0, byteOffset: posBytes, byteLength: nrmBytes, target: 34962 },
    { buffer: 0, byteOffset: posBytes + nrmBytes, byteLength: idxArray.byteLength, target: 34963 },
  ],
  accessors: [
    { bufferView: 0, componentType: 5126, count: posArray.length / 3, type: 'VEC3', min: mins, max: maxs },
    { bufferView: 1, componentType: 5126, count: normals.length / 3, type: 'VEC3' },
    { bufferView: 2, componentType: 5123, count: idxArray.length, type: 'SCALAR' },
  ],
};

/* — GLB container — */
let json = Buffer.from(JSON.stringify(gltf));
if (json.byteLength % 4) json = Buffer.concat([json, Buffer.alloc(4 - (json.byteLength % 4), 0x20)]);

const header = Buffer.alloc(12);
header.writeUInt32LE(0x46546c67, 0); // 'glTF'
header.writeUInt32LE(2, 4);
header.writeUInt32LE(12 + 8 + json.byteLength + 8 + bin.byteLength, 8);

const jsonChunkHeader = Buffer.alloc(8);
jsonChunkHeader.writeUInt32LE(json.byteLength, 0);
jsonChunkHeader.writeUInt32LE(0x4e4f534a, 4); // 'JSON'

const binChunkHeader = Buffer.alloc(8);
binChunkHeader.writeUInt32LE(bin.byteLength, 0);
binChunkHeader.writeUInt32LE(0x004e4942, 4); // 'BIN'

const out = Buffer.concat([header, jsonChunkHeader, json, binChunkHeader, bin]);
const dest = join(__dirname, '../public/assets/models/vase.glb');
mkdirSync(dirname(dest), { recursive: true });
writeFileSync(dest, out);
console.log(`Wrote ${dest} (${(out.byteLength / 1024).toFixed(1)} KiB, ${idxArray.length / 3} triangles)`);
