// Собирает компактную модель тела для 3D-примерочной из базового меша MakeHuman (CC0).
//
//   git clone --depth 1 --filter=blob:none --sparse https://github.com/makehumancommunity/makehuman.git mh
//   (cd mh && git sparse-checkout set makehuman/data/3dobjs makehuman/data/targets/macrodetails)
//   node tools/build-body.mjs mh/makehuman/data
//
// Результат: src/tryon/body.bin
//   Uint32[4]  vertCount, indexCount, bodyIndexCount, quantScale
//   Int16[vertCount*3]  женская фигура (метры * quantScale)
//   Int16[vertCount*3]  мужская фигура
//   Uint16[indexCount]  треугольники (сначала тело, потом глаза)

import fs from 'node:fs';
import path from 'node:path';

const data = process.argv[2];
if (!data) throw new Error('usage: node tools/build-body.mjs <makehuman/data>');

const obj = fs.readFileSync(path.join(data, '3dobjs/base.obj'), 'utf8').split('\n');
const verts = [];
const faces = { body: [], eyes: [] };
let group = '';
for (const line of obj) {
  if (line.startsWith('v ')) verts.push(line.slice(2).trim().split(/\s+/).map(Number));
  else if (line.startsWith('g ')) group = line.slice(2).trim();
  else if (line.startsWith('f ')) {
    const key = group === 'body' ? 'body' : /^helper-[lr]-eye$/.test(group) ? 'eyes' : null;
    if (!key) continue;
    const idx = line.slice(2).trim().split(/\s+/).map((t) => parseInt(t, 10) - 1);
    for (let k = 1; k < idx.length - 1; k++) faces[key].push(idx[0], idx[k], idx[k + 1]);
  }
}

const readTarget = (name) => {
  const out = new Map();
  for (const line of fs.readFileSync(path.join(data, 'targets/macrodetails', name), 'utf8').split('\n')) {
    if (!line || line.startsWith('#')) continue;
    const [i, x, y, z] = line.trim().split(/\s+/).map(Number);
    out.set(i, [x, y, z]);
  }
  return out;
};

// В MakeHuman «универсальные» молодые цели пустые, пол задают расовые цели —
// берём их среднее (как при равных долях трёх рас по умолчанию).
const shape = (sex) => {
  const ts = ['african', 'asian', 'caucasian'].map((r) => readTarget(`${r}-${sex}-young.target`));
  return verts.map((v, i) => {
    const p = v.slice();
    for (const t of ts) {
      const d = t.get(i);
      if (d) for (let k = 0; k < 3; k++) p[k] += d[k] / 3;
    }
    return p;
  });
};

const all = [...faces.body, ...faces.eyes];
const remap = new Map();
for (const i of all) if (!remap.has(i)) remap.set(i, remap.size);
const indices = new Uint16Array(all.map((i) => remap.get(i)));
const used = [...remap.keys()];

const SCALE = 0.1; // единицы MakeHuman — дециметры
const Q = 16000;
const pack = (pts) => {
  const sel = used.map((i) => pts[i]);
  const minY = Math.min(...sel.map((p) => p[1]));
  const cx = (Math.min(...sel.map((p) => p[0])) + Math.max(...sel.map((p) => p[0]))) / 2;
  const cz = (Math.min(...sel.map((p) => p[2])) + Math.max(...sel.map((p) => p[2]))) / 2;
  const out = new Int16Array(sel.length * 3);
  sel.forEach((p, i) => {
    out[i * 3] = Math.round((p[0] - cx) * SCALE * Q);
    out[i * 3 + 1] = Math.round((p[1] - minY) * SCALE * Q);
    out[i * 3 + 2] = Math.round((p[2] - cz) * SCALE * Q);
  });
  return out;
};

const female = pack(shape('female'));
const male = pack(shape('male'));
const header = new Uint32Array([used.length, indices.length, faces.body.length, Q]);
const outDir = path.resolve('src/tryon');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(
  path.join(outDir, 'body.bin'),
  Buffer.concat([header, female, male, indices].map((a) => Buffer.from(a.buffer, a.byteOffset, a.byteLength))),
);
console.log(`verts ${used.length}, tris ${indices.length / 3}, body tris ${faces.body.length / 3}`);
