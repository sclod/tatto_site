import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { DecalGeometry } from 'three/examples/jsm/geometries/DecalGeometry.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { inkify, loadImage } from './ink.js';
import { loadBody } from './body.js';

export const SKINS = [
  { id: 'plaster', label: 'Гипс', color: '#ECE6DC', plaster: true },
  { id: 's1', label: 'Фарфор', color: '#F1D3BF' },
  { id: 's2', label: 'Персик', color: '#E2B193' },
  { id: 's3', label: 'Олива', color: '#C48A63' },
  { id: 's4', label: 'Карамель', color: '#9A623F' },
  { id: 's5', label: 'Какао', color: '#6B4029' },
  { id: 's6', label: 'Эбони', color: '#3E261A' },
];

// Ракурсы камеры: куда смотрим, с какого угла (азимут, ° от фронта), с какой дистанции.
// x > 0 — левая рука/нога фигуры (справа для зрителя).
export const VIEWS = {
  full: { label: 'Целиком', target: [0, 0.8, 0], az: 12, el: 4, dist: null },
  arm: { label: 'Рука', target: [0.34, 1.04, 0.02], az: -32, el: 10, dist: 0.8 },
  back: { label: 'Спина', target: [0, 1.17, 0], az: 180, el: 4, dist: 1.05 },
  chest: { label: 'Грудь', target: [0, 1.24, 0.04], az: -10, el: 2, dist: 0.85 },
  leg: { label: 'Нога', target: [0.1, 0.5, 0.02], az: 24, el: 6, dist: 1.0 },
  neck: { label: 'Шея', target: [0, 1.42, 0], az: 40, el: 4, dist: 0.6 },
};

// Точки «по умолчанию» для новой тату: луч из origin в сторону target.
const SPOTS = [
  { origin: [-0.2, 1.08, 0.9], target: [0.37, 1.0, 0.02] }, // внутренняя сторона предплечья
  { origin: [0.28, 1.17, 1], target: [0.28, 1.17, 0] }, // плечо
  { origin: [0.09, 0.62, 1], target: [0.09, 0.62, 0] }, // бедро
  { origin: [0, 1.17, -1], target: [0, 1.17, 0] }, // спина
  { origin: [-0.37, 1.0, 1], target: [-0.37, 1.0, 0] }, // другое предплечье
];

const UP = new THREE.Vector3(0, 1, 0);
const tmpV = new THREE.Vector3();
const tri = new THREE.Triangle();

export class TryOn {
  static async create(host, opts) {
    const body = await loadBody(new URL('models/body.bin', document.baseURI).href);
    return new TryOn(host, body, opts);
  }

  constructor(host, body, { onChange = () => {} } = {}) {
    this.host = host;
    this.data = body;
    this.onChange = onChange;
    this.tattoos = [];
    this.selected = null;
    this.skin = SKINS[0];
    this.sex = 'female';
    this.view = 'arm';
    this.visible = true;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.setClearColor(0x000000, 0);
    host.appendChild(renderer.domElement);
    this.renderer = renderer;

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.5;
    this.scene = scene;

    this.camera = new THREE.PerspectiveCamera(30, 1, 0.02, 30);
    this.controls = new OrbitControls(this.camera, renderer.domElement);
    Object.assign(this.controls, {
      enableDamping: true,
      dampingFactor: 0.08,
      enablePan: false,
      enableZoom: false,
      rotateSpeed: 0.7,
      minPolarAngle: 0.3,
      maxPolarAngle: Math.PI - 0.5,
    });

    scene.add(new THREE.HemisphereLight(0xfff4e6, 0x6b5a4a, 0.85));
    const key = new THREE.DirectionalLight(0xfff1e0, 2.3);
    key.position.set(1.6, 3.2, 2.4);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = key.shadow.camera.bottom = -1.1;
    key.shadow.camera.right = key.shadow.camera.top = 1.1;
    key.shadow.bias = -0.0005;
    key.shadow.normalBias = 0.035;
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xc9d6ff, 1.3);
    rim.position.set(-2.5, 1.8, -2.2);
    scene.add(rim);
    // мягкий свет, который «идёт» за курсором
    this.cursorLight = new THREE.PointLight(0xffe2c8, 0.5, 3, 1.5);
    scene.add(this.cursorLight);

    this.buildStand();

    this.skinMat = new THREE.MeshPhysicalMaterial({ roughness: 0.6, sheen: 0.4, sheenRoughness: 0.55 });
    this.applySkin();

    const geo = new THREE.BufferGeometry();
    geo.setIndex(new THREE.BufferAttribute(body.index, 1));
    this.body = new THREE.Mesh(geo, this.skinMat);
    this.body.castShadow = true;
    this.body.receiveShadow = true;
    scene.add(this.body);
    this.setSex('female', { silent: true });

    this.bracket = this.makeBracket();
    scene.add(this.bracket);

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.bindPointer();

    this.fly = null;
    new ResizeObserver(() => this.resize()).observe(host);
    this.resize();
    this.setView('arm', { instant: true });

    this.renderer.setAnimationLoop(() => this.frame());
  }

  // ——— сцена ———

  buildStand() {
    const stone = new THREE.MeshStandardMaterial({ color: '#1C1B21', roughness: 0.42, metalness: 0.1 });
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.32, 0.07, 96), stone);
    plinth.position.y = -0.035;
    plinth.receiveShadow = true;
    plinth.castShadow = true;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), new THREE.ShadowMaterial({ opacity: 0.13 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.07;
    floor.receiveShadow = true;
    this.scene.add(plinth, floor);
  }

  setSex(sex, { silent = false } = {}) {
    this.sex = sex;
    const geo = this.body.geometry;
    geo.setAttribute('position', new THREE.BufferAttribute(this.data[sex], 3));
    geo.deleteAttribute('normal');
    geo.computeVertexNormals();
    geo.computeBoundingBox();
    geo.computeBoundingSphere();
    this.indexFaces(geo);
    // тату «приклеены» к треугольнику — после смены фигуры остаются на том же месте
    for (const t of this.tattoos) {
      this.pointFromAnchor(t);
      this.rebuild(t);
    }
    if (!silent) this.emit();
  }

  applySkin() {
    const s = this.skin;
    this.skinMat.color.set(s.color);
    this.skinMat.roughness = s.plaster ? 0.92 : 0.58;
    this.skinMat.sheen = s.plaster ? 0 : 0.45;
    this.skinMat.sheenColor.set(s.plaster ? '#ffffff' : '#ff9c7d');
  }

  setSkin(id) {
    this.skin = SKINS.find((s) => s.id === id) || SKINS[1];
    this.applySkin();
  }

  // Предрасчёт центров/нормалей треугольников и смежности —
  // чтобы быстро вырезать связный кусок кожи под декаль.
  indexFaces(geo) {
    const pos = geo.attributes.position.array;
    const nor = geo.attributes.normal.array;
    const idx = geo.index.array;
    const n = this.data.bodyIndexCount / 3; // глаза не татуируем
    const cen = new Float32Array(n * 3);
    const fn = new Float32Array(n * 3);
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const c = new THREE.Vector3();
    for (let f = 0; f < n; f++) {
      a.fromArray(pos, idx[f * 3] * 3);
      b.fromArray(pos, idx[f * 3 + 1] * 3);
      c.fromArray(pos, idx[f * 3 + 2] * 3);
      cen[f * 3] = (a.x + b.x + c.x) / 3;
      cen[f * 3 + 1] = (a.y + b.y + c.y) / 3;
      cen[f * 3 + 2] = (a.z + b.z + c.z) / 3;
      b.sub(a);
      c.sub(a);
      b.cross(c);
      fn[f * 3] = b.x;
      fn[f * 3 + 1] = b.y;
      fn[f * 3 + 2] = b.z;
    }
    if (!this.adj) {
      // вершина → треугольники (CSR)
      const vc = pos.length / 3;
      const cnt = new Uint32Array(vc + 1);
      for (let i = 0; i < n * 3; i++) cnt[idx[i] + 1]++;
      for (let i = 0; i < vc; i++) cnt[i + 1] += cnt[i];
      const list = new Uint32Array(n * 3);
      const fill = cnt.slice();
      for (let i = 0; i < n * 3; i++) list[fill[idx[i]]++] = (i / 3) | 0;
      this.adj = { start: cnt, list };
    }
    this.faces = { pos, nor, idx, cen, fn, n };
  }

  // ——— якоря тату ———

  anchorFromHit(t, hit) {
    if (hit.faceIndex >= this.faces.n) return false;
    const { pos, idx } = this.faces;
    const f = hit.faceIndex;
    tri.a.fromArray(pos, idx[f * 3] * 3);
    tri.b.fromArray(pos, idx[f * 3 + 1] * 3);
    tri.c.fromArray(pos, idx[f * 3 + 2] * 3);
    t.face = f;
    t.bary = tri.getBarycoord(hit.point, new THREE.Vector3());
    t.point.copy(hit.point);
    return true;
  }

  pointFromAnchor(t) {
    const { pos, idx } = this.faces;
    const f = t.face;
    tri.a.fromArray(pos, idx[f * 3] * 3);
    tri.b.fromArray(pos, idx[f * 3 + 1] * 3);
    tri.c.fromArray(pos, idx[f * 3 + 2] * 3);
    t.point
      .set(0, 0, 0)
      .addScaledVector(tri.a, t.bary.x)
      .addScaledVector(tri.b, t.bary.y)
      .addScaledVector(tri.c, t.bary.z);
  }

  spotHit(k) {
    const s = SPOTS[k % SPOTS.length];
    const o = new THREE.Vector3(...s.origin);
    this.raycaster.set(o, new THREE.Vector3(...s.target).sub(o).normalize());
    return this.raycaster.intersectObject(this.body, false)[0] || null;
  }

  // ——— тату ———

  async addTattoo(design, { replace = false } = {}) {
    const img = design.img || (await loadImage(design.src));
    let t = replace ? this.selected : null;
    if (!t) {
      t = { point: new THREE.Vector3(), sizeCm: design.size || 10, angle: 0, state: 'healed', mesh: null };
      const hit = this.spotHit(this.tattoos.length);
      if (!hit || !this.anchorFromHit(t, hit)) return null;
      this.tattoos.push(t);
    }
    Object.assign(t, { img, title: design.title || 'Ваш эскиз', mono: design.mono ?? t.mono ?? false });
    if (design.size && replace) t.sizeCm = design.size;
    this.selected = t;
    this.repaint(t);
    this.rebuild(t);
    this.emit();
    return t;
  }

  repaint(t) {
    const canvas = inkify(t.img, { mono: t.mono, state: t.state });
    if (t.texture) t.texture.dispose();
    t.texture = new THREE.CanvasTexture(canvas);
    t.texture.colorSpace = THREE.SRGBColorSpace;
    t.texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    if (t.mesh) {
      t.mesh.material.map = t.texture;
      t.mesh.material.needsUpdate = true;
    }
  }

  rebuild(t) {
    const F = this.faces;
    const { start, list } = this.adj;
    const size = t.sizeCm / 100;
    const R = size * 0.75 + 0.015;
    const R2 = R * R;
    const p = t.point;
    const d2 = (f) => {
      const dx = F.cen[f * 3] - p.x;
      const dy = F.cen[f * 3 + 1] - p.y;
      const dz = F.cen[f * 3 + 2] - p.z;
      return dx * dx + dy * dy + dz * dz;
    };

    // связный участок кожи вокруг точки (обход по соседям) —
    // так тату с руки не «перепрыгнет» на бок туловища
    const seen = new Uint8Array(F.n);
    const near = [t.face];
    seen[t.face] = 1;
    for (let q = 0; q < near.length; q++) {
      const f = near[q];
      for (let k = 0; k < 3; k++) {
        const v = F.idx[f * 3 + k];
        for (let j = start[v]; j < start[v + 1]; j++) {
          const g = list[j];
          if (seen[g]) continue;
          seen[g] = 1;
          if (d2(g) <= R2) near.push(g);
        }
      }
    }

    // средняя нормаль под центром тату — направление проекции
    const nAvg = new THREE.Vector3();
    const core = (size * 0.3) ** 2;
    for (const f of near) if (d2(f) < core) nAvg.add(tmpV.fromArray(F.fn, f * 3));
    if (nAvg.lengthSq() < 1e-14) nAvg.fromArray(F.fn, t.face * 3);
    nAvg.normalize();
    t.normal = nAvg;

    const posArr = [];
    const norArr = [];
    for (const f of near) {
      tmpV.fromArray(F.fn, f * 3).normalize();
      if (tmpV.dot(nAvg) < 0.05) continue;
      for (let k = 0; k < 3; k++) {
        const vi = F.idx[f * 3 + k] * 3;
        posArr.push(F.pos[vi], F.pos[vi + 1], F.pos[vi + 2]);
        norArr.push(F.nor[vi], F.nor[vi + 1], F.nor[vi + 2]);
      }
    }
    const patch = new THREE.BufferGeometry();
    patch.setAttribute('position', new THREE.Float32BufferAttribute(posArr, 3));
    patch.setAttribute('normal', new THREE.Float32BufferAttribute(norArr, 3));

    const basis = this.basis(nAvg, t.angle, this.limbAxis(near, nAvg, d2, R2));
    const euler = new THREE.Euler().setFromRotationMatrix(basis);
    const geo = new DecalGeometry(new THREE.Mesh(patch), p, euler, new THREE.Vector3(size, size, Math.max(size * 0.9, 0.1)));
    patch.dispose();

    if (!t.mesh) {
      t.mesh = new THREE.Mesh(
        geo,
        new THREE.MeshBasicMaterial({
          map: t.texture,
          transparent: true,
          premultipliedAlpha: true,
          blending: THREE.MultiplyBlending, // чернила «ложатся в кожу»
          toneMapped: false,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -4,
          polygonOffsetUnits: -4,
        }),
      );
      t.mesh.renderOrder = 2;
      t.mesh.userData.tattoo = t;
      this.scene.add(t.mesh);
    } else {
      t.mesh.geometry.dispose();
      t.mesh.geometry = geo;
    }
    t.basis = basis;
    if (t === this.selected) this.placeBracket(t);
  }

  // На вытянутых частях тела (рука, нога, шея) «верх» тату идёт вдоль кости:
  // главная ось разброса точек участка в касательной плоскости.
  limbAxis(near, n, d2, R2) {
    const F = this.faces;
    const u = new THREE.Vector3().crossVectors(Math.abs(n.y) < 0.9 ? UP : new THREE.Vector3(1, 0, 0), n).normalize();
    const v = new THREE.Vector3().crossVectors(n, u);
    const c = new THREE.Vector3();
    let m = 0;
    for (const f of near) if (d2(f) < R2) c.add(tmpV.fromArray(F.cen, f * 3)), m++;
    if (m < 12) return null;
    c.divideScalar(m);
    let suu = 0;
    let svv = 0;
    let suv = 0;
    for (const f of near) {
      if (d2(f) >= R2) continue;
      tmpV.fromArray(F.cen, f * 3).sub(c);
      const a = tmpV.dot(u);
      const b = tmpV.dot(v);
      suu += a * a;
      svv += b * b;
      suv += a * b;
    }
    const tr = suu + svv;
    const det = suu * svv - suv * suv;
    const disc = Math.sqrt(Math.max(0, (tr * tr) / 4 - det));
    const l1 = tr / 2 + disc;
    const l2 = tr / 2 - disc;
    if (l1 < 2.2 * Math.max(l2, 1e-12)) return null; // участок «круглый» — берём вертикаль мира
    const ang = 0.5 * Math.atan2(2 * suv, suu - svv);
    const axis = u.multiplyScalar(Math.cos(ang)).addScaledVector(v, Math.sin(ang)).normalize();
    if (axis.y < 0) axis.negate();
    return axis;
  }

  basis(n, angleDeg, axis = null) {
    const up = axis ? axis.clone() : UP.clone();
    if (!axis && Math.abs(n.dot(up)) > 0.95) up.set(0, 0, -1);
    const x = new THREE.Vector3().crossVectors(up, n).normalize();
    const y = new THREE.Vector3().crossVectors(n, x).normalize();
    const a = THREE.MathUtils.degToRad(angleDeg);
    const xr = x.clone().multiplyScalar(Math.cos(a)).addScaledVector(y, Math.sin(a));
    const yr = y.clone().multiplyScalar(Math.cos(a)).addScaledVector(x, -Math.sin(a));
    return new THREE.Matrix4().makeBasis(xr, yr, n);
  }

  makeBracket() {
    const s = 0.5;
    const l = 0.14;
    const pts = [];
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      pts.push(sx * s, sy * s, 0, sx * s - sx * l, sy * s, 0);
      pts.push(sx * s, sy * s, 0, sx * s, sy * s - sy * l, 0);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const m = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: '#D23A1E', transparent: true, opacity: 0.9, depthTest: false }));
    m.renderOrder = 5;
    m.visible = false;
    return m;
  }

  placeBracket(t) {
    const b = this.bracket;
    if (!t) return (b.visible = false);
    b.visible = true;
    b.position.copy(t.point).addScaledVector(t.normal, 0.004);
    b.quaternion.setFromRotationMatrix(t.basis);
    const s = t.sizeCm / 100;
    b.scale.set(s, s, s);
  }

  select(t) {
    this.selected = t;
    this.placeBracket(t);
    this.emit();
  }

  update(props) {
    const t = this.selected;
    if (!t) return;
    const needPaint = ('mono' in props && props.mono !== t.mono) || ('state' in props && props.state !== t.state);
    Object.assign(t, props);
    if (needPaint) this.repaint(t);
    this.rebuild(t);
    this.emit();
  }

  removeSelected() {
    const t = this.selected;
    if (!t) return;
    this.scene.remove(t.mesh);
    t.mesh.geometry.dispose();
    t.mesh.material.dispose();
    t.texture.dispose();
    this.tattoos = this.tattoos.filter((x) => x !== t);
    this.select(this.tattoos[this.tattoos.length - 1] || null);
  }

  emit() {
    const t = this.selected;
    this.onChange({
      count: this.tattoos.length,
      sex: this.sex,
      view: this.view,
      skin: this.skin.id,
      selected: t && { title: t.title, sizeCm: t.sizeCm, angle: t.angle, mono: t.mono, state: t.state },
    });
  }

  // ——— камера ———

  fullDist() {
    const tan = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    return Math.max(2.05 / 2 / tan, 1.2 / 2 / (tan * this.camera.aspect)) * 1.04;
  }

  setView(key, { instant = false } = {}) {
    const v = VIEWS[key] || VIEWS.full;
    this.view = key;
    const target = new THREE.Vector3(...v.target);
    const az = THREE.MathUtils.degToRad(v.az);
    const el = THREE.MathUtils.degToRad(v.el);
    // на узких экранах крупные планы чуть отодвигаем
    const d = v.dist ? v.dist * (this.camera.aspect < 0.8 ? 1.25 : 1) : this.fullDist();
    const dir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
    const pos = target.clone().addScaledVector(dir, d);
    if (instant) {
      this.controls.target.copy(target);
      this.camera.position.copy(pos);
      this.fly = null;
    } else {
      // облёт по сфере вокруг цели, а не по прямой — камера не проходит сквозь тело
      const from = new THREE.Spherical().setFromVector3(this.camera.position.clone().sub(this.controls.target));
      const to = new THREE.Spherical().setFromVector3(dir.multiplyScalar(d));
      let dTheta = to.theta - from.theta;
      dTheta -= Math.round(dTheta / (Math.PI * 2)) * Math.PI * 2;
      this.fly = { t: 0, start: performance.now(), fromT: this.controls.target.clone(), toT: target, from, to, dTheta };
    }
    this.emit();
  }

  zoomBy(f) {
    this.fly = null;
    const c = this.controls;
    const off = this.camera.position.clone().sub(c.target);
    const len = THREE.MathUtils.clamp(off.length() * f, 0.25, this.fullDist() * 1.2);
    this.camera.position.copy(c.target).addScaledVector(off.normalize(), len);
  }

  resetView() {
    this.setView(this.view);
  }

  bindPointer() {
    const el = this.renderer.domElement;
    let down = null;
    let drag = null;
    let raf = 0;

    const toNdc = (e) => {
      const r = el.getBoundingClientRect();
      this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      this.raycaster.setFromCamera(this.pointer, this.camera);
    };
    const hitTattoo = () => {
      const meshes = this.tattoos.map((t) => t.mesh).filter(Boolean);
      const h = this.raycaster.intersectObjects(meshes, false)[0];
      const b = this.raycaster.intersectObject(this.body, false)[0];
      if (h && (!b || h.distance <= b.distance + 0.003)) return h.object.userData.tattoo;
      return null;
    };
    const moveTo = (t) => {
      const b = this.raycaster.intersectObject(this.body, false)[0];
      if (!b || !this.anchorFromHit(t, b)) return;
      if (!raf) {
        raf = requestAnimationFrame(() => {
          raf = 0;
          this.rebuild(t);
        });
      }
    };

    // capture на контейнере — срабатывает раньше OrbitControls
    this.host.addEventListener(
      'pointerdown',
      (e) => {
        if (e.target !== el) return;
        toNdc(e);
        this.fly = null;
        down = { x: e.clientX, y: e.clientY };
        const t = hitTattoo();
        if (t) {
          drag = t;
          if (this.selected !== t) this.select(t);
          el.setPointerCapture(e.pointerId);
          el.style.cursor = 'grabbing';
          e.stopPropagation();
        }
      },
      { capture: true },
    );
    el.addEventListener('pointermove', (e) => {
      toNdc(e);
      tmpV.set(this.pointer.x * 0.6, this.pointer.y * 0.5 + 0.1, 0.6).applyMatrix4(this.camera.matrixWorld);
      this.cursorLight.position.copy(tmpV);
      if (drag) return moveTo(drag);
      if (e.pointerType === 'mouse') el.style.cursor = hitTattoo() ? 'grab' : 'crosshair';
    });
    const up = (e) => {
      if (drag) {
        drag = null;
        el.style.cursor = '';
        this.emit();
      } else if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 6 && this.selected) {
        // короткое нажатие по телу — перенести выбранную тату сюда
        toNdc(e);
        const t = hitTattoo();
        if (t) this.select(t);
        else moveTo(this.selected);
      }
      down = null;
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  }

  resize() {
    const { clientWidth: w, clientHeight: h } = this.host;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = w / h < 0.8 ? 38 : 30;
    this.camera.updateProjectionMatrix();
  }

  frame() {
    if (!this.visible) return;
    if (this.fly) {
      const f = this.fly;
      f.t = Math.min(1, (performance.now() - f.start) / 900);
      const k = f.t < 0.5 ? 4 * f.t ** 3 : 1 - (-2 * f.t + 2) ** 3 / 2;
      this.controls.target.lerpVectors(f.fromT, f.toT, k);
      const s = new THREE.Spherical(
        THREE.MathUtils.lerp(f.from.radius, f.to.radius, k),
        THREE.MathUtils.lerp(f.from.phi, f.to.phi, k),
        f.from.theta + f.dTheta * k,
      );
      this.camera.position.setFromSpherical(s).add(this.controls.target);
      if (f.t >= 1) this.fly = null;
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  setVisible(v) {
    this.visible = v;
  }

  // Снимок примерки на «бумаге» с подписью — для скачивания и заявки.
  snapshot() {
    const bv = this.bracket.visible;
    this.bracket.visible = false;
    this.renderer.render(this.scene, this.camera);
    const src = this.renderer.domElement;
    this.bracket.visible = bv;

    const W = 1080;
    const H = Math.round((W * src.height) / src.width);
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H + 120;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#EEE8DC';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(src, 0, 0, W, H);
    ctx.fillStyle = '#16151B';
    ctx.font = '700 44px "Unbounded Variable", sans-serif';
    ctx.fillText('VALOVA', 48, H + 70);
    ctx.font = '22px "JetBrains Mono", monospace';
    const t = this.selected;
    ctx.textAlign = 'right';
    ctx.fillText(t ? `${t.title} · ${t.sizeCm} см` : 'примерка', W - 48, H + 62);
    ctx.fillStyle = '#D23A1E';
    ctx.font = '30px Caveat, cursive';
    ctx.fillText('примерено на сайте ↗', W - 48, H + 98);
    return c.toDataURL('image/jpeg', 0.9);
  }
}
