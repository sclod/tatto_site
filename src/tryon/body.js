// Загружает тело, собранное tools/build-body.mjs из базового меша MakeHuman (CC0),
// и один раз сглаживает его подразделением Loop — силуэт без «граней», файл остаётся лёгким.
export async function loadBody(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`body model: ${res.status}`);
  const buf = await res.arrayBuffer();
  const [verts, indexCount, bodyIndexCount, q] = new Uint32Array(buf, 0, 4);
  let off = 16;
  const unpack = () => {
    const src = new Int16Array(buf, off, verts * 3);
    off += verts * 6;
    const out = new Float32Array(verts * 3);
    for (let i = 0; i < out.length; i++) out[i] = src[i] / q;
    return out;
  };
  const female = unpack();
  const male = unpack();
  const index = new Uint16Array(buf, off, indexCount);

  const plan = loopPlan(index, verts);
  return {
    female: plan.apply(female),
    male: plan.apply(male),
    index: plan.index,
    bodyIndexCount: bodyIndexCount * 4,
  };
}

// Топология подразделения считается один раз и применяется к обеим фигурам.
function loopPlan(index, vc) {
  const triCount = index.length / 3;
  const edgeId = new Map();
  const edges = []; // [a, b, opp1, opp2]
  const key = (a, b) => (a < b ? a * vc + b : b * vc + a);
  for (let f = 0; f < triCount; f++) {
    for (let k = 0; k < 3; k++) {
      const a = index[f * 3 + k];
      const b = index[f * 3 + ((k + 1) % 3)];
      const c = index[f * 3 + ((k + 2) % 3)];
      const id = key(a, b);
      let e = edgeId.get(id);
      if (e === undefined) {
        e = edges.length;
        edgeId.set(id, e);
        edges.push([a, b, c, -1]);
      } else edges[e][3] = c;
    }
  }

  // соседи вершин и граничные вершины
  const nbr = Array.from({ length: vc }, () => []);
  const boundary = new Uint8Array(vc);
  const bnbr = Array.from({ length: vc }, () => []);
  for (const [a, b, , d] of edges) {
    nbr[a].push(b);
    nbr[b].push(a);
    if (d < 0) {
      boundary[a] = boundary[b] = 1;
      bnbr[a].push(b);
      bnbr[b].push(a);
    }
  }

  const Idx = vc + edges.length > 65535 ? Uint32Array : Uint16Array;
  const out = new Idx(triCount * 12);
  const ev = (a, b) => vc + edgeId.get(key(a, b));
  for (let f = 0; f < triCount; f++) {
    const a = index[f * 3];
    const b = index[f * 3 + 1];
    const c = index[f * 3 + 2];
    const ab = ev(a, b);
    const bc = ev(b, c);
    const ca = ev(c, a);
    out.set([a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca], f * 12);
  }

  return {
    index: out,
    apply(p) {
      const n = vc + edges.length;
      const r = new Float32Array(n * 3);
      for (let v = 0; v < vc; v++) {
        const o = v * 3;
        if (boundary[v] && bnbr[v].length === 2) {
          const [x, y] = bnbr[v];
          for (let k = 0; k < 3; k++) r[o + k] = 0.75 * p[o + k] + 0.125 * (p[x * 3 + k] + p[y * 3 + k]);
          continue;
        }
        const nb = nbr[v];
        const m = nb.length;
        if (!m || boundary[v]) {
          r.set(p.subarray(o, o + 3), o);
          continue;
        }
        const beta = m > 3 ? 3 / (8 * m) : 3 / 16;
        for (let k = 0; k < 3; k++) {
          let s = 0;
          for (const u of nb) s += p[u * 3 + k];
          r[o + k] = (1 - m * beta) * p[o + k] + beta * s;
        }
      }
      edges.forEach(([a, b, c, d], i) => {
        const o = (vc + i) * 3;
        for (let k = 0; k < 3; k++) {
          r[o + k] =
            d < 0
              ? 0.5 * (p[a * 3 + k] + p[b * 3 + k])
              : 0.375 * (p[a * 3 + k] + p[b * 3 + k]) + 0.125 * (p[c * 3 + k] + p[d * 3 + k]);
        }
      });
      return r;
    },
  };
}
