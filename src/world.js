import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { NEON, rng, neonLogo, textTexture, windowTexture, paverTexture, woodTexture, roadTexture, noiseTexture, canvasTexture, drawNeonMark, drawNeonLogo, waterNormalTexture } from './textures.js';
import { mat } from './character.js';

export const SWAG_SPOTS = [
  [62, 0, 13], [-38, 0, 38], [36, 1.2, -67], [-20, 0, 100], [-22, 0, -58], [100, 1.6, 16], [100, 4.2, -10], [30, 0, -80],
];
export const YACHT = { x: 100, z: 0 };
export const REBECCA_SPOT = [-10, -29];
export const BOOTH_SPOT = [35, -5];

function tameSky(sky, gain, disc) {
  const m = sky.material;
  m.fragmentShader = m.fragmentShader
    .replace('( 760.0 * sundisc )', `( ${disc.toFixed(1)} * sundisc )`)
    .replace('gl_FragColor = vec4( texColor, 1.0 );', `gl_FragColor = vec4( texColor * ${gain.toFixed(2)}, 1.0 );`);
  m.needsUpdate = true;
}

export function buildWorld(scene, renderer) {
  const regions = [];
  const solids = [];
  const updaters = [];
  const cars = [];
  const mapShapes = [];
  const exclusions = SWAG_SPOTS.map(([x, , z]) => [x, z, 10]);

  const addRegion = (x0, x1, z0, z1, h, ramp) => regions.push({ x0, x1, z0, z1, h, ramp });
  const addSolid = (x0, x1, z0, z1, y0, y1) => solids.push({ x0, x1, z0, z1, y0, y1 });

  const box = (w, h, d, m, x, y, z, { cast = true, receive = true } = {}) => {
    const g = new THREE.BoxGeometry(w, h, d);
    const mm = new THREE.Mesh(g, m);
    mm.position.set(x, y + h / 2, z);
    mm.castShadow = cast;
    mm.receiveShadow = receive;
    scene.add(mm);
    return mm;
  };
  const flat = (x0, x1, z0, z1, y, m, rep) => {
    const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0);
    g.rotateX(-Math.PI / 2);
    if (rep) {
      const uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (x1 - x0) / rep[0], uv.getY(i) * (z1 - z0) / rep[1]);
    }
    const mm = new THREE.Mesh(g, m);
    mm.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
    mm.receiveShadow = true;
    scene.add(mm);
    return mm;
  };

  // ---------- sky ----------
  const SUN_DIR = new THREE.Vector3(-0.86, 0.2, 0.46).normalize();
  const sky = new Sky();
  tameSky(sky, 0.42, 2.0);
  sky.scale.setScalar(1800);
  const su = sky.material.uniforms;
  su.turbidity.value = 9;
  su.rayleigh.value = 2.6;
  su.mieCoefficient.value = 0.008;
  su.mieDirectionalG.value = 0.86;
  su.sunPosition.value.copy(SUN_DIR).multiplyScalar(1000);
  scene.add(sky);
  if (renderer) {
    const pm = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();
    envScene.add(new THREE.Mesh(new THREE.SphereGeometry(500, 48, 24), new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: { sunDir: { value: SUN_DIR } },
      vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform vec3 sunDir; varying vec3 vD;
        void main(){
          float y = vD.y;
          vec3 zen = vec3(0.16, 0.26, 0.48), hor = vec3(1.0, 0.56, 0.36), gnd = vec3(0.16, 0.15, 0.17);
          vec3 c = y > 0.0 ? mix(hor, zen, pow(y, 0.5)) : mix(hor * 0.5, gnd, pow(-y, 0.4));
          float s = max(dot(vD, sunDir), 0.0);
          c += vec3(1.0, 0.55, 0.25) * (pow(s, 8.0) * 0.8 + pow(s, 400.0) * 6.0);
          gl_FragColor = vec4(c, 1.0);
        }`,
    })));
    scene.environment = pm.fromScene(envScene, 0, 1, 2000).texture;
    scene.environmentIntensity = 0.75;
    pm.dispose();
  }
  const FOG = '#e6a587';
  scene.fog = new THREE.FogExp2(FOG, 0.0026);

  // lights
  scene.add(new THREE.HemisphereLight('#ffd0b8', '#3d4a66', 0.55));
  const sun = new THREE.DirectionalLight('#ffbf86', 3.6);
  const SUN_OFF = SUN_DIR.clone().multiplyScalar(120);
  sun.position.copy(SUN_OFF);
  sun.castShadow = true;
  sun.shadow.mapSize.setScalar(matchMedia('(pointer: coarse)').matches ? 1024 : 2048);
  const sc = sun.shadow.camera;
  sc.left = -60; sc.right = 60; sc.top = 60; sc.bottom = -60; sc.near = 1; sc.far = 320;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(sun);
  scene.add(sun.target);

  // ---------- water ----------
  const wn = waterNormalTexture();
  wn.repeat.set(700, 700);
  const waterMat = new THREE.MeshStandardMaterial({ color: '#0d4f5e', roughness: 0.16, metalness: 0.15, normalMap: wn, normalScale: new THREE.Vector2(0.22, 0.22), envMapIntensity: 1.6 });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.y = -0.7;
  water.receiveShadow = true;
  scene.add(water);
  updaters.push((t) => { wn.offset.set(t * 0.004, t * 0.0025); });

  // ---------- land ----------
  const landSide = mat('#cfc3ad');
  const concrete = new THREE.MeshStandardMaterial({ map: noiseTexture('concrete', '#d8cdb8', ['#cfc3ad', '#e0d6c3', '#c9bca4']), roughness: 0.95 });
  concrete.map.repeat.set(1, 1);
  const land = (x0, x1, z0, z1, label) => {
    box(x1 - x0, 3, z1 - z0, landSide, (x0 + x1) / 2, -3, (z0 + z1) / 2, { cast: false });
    flat(x0, x1, z0, z1, 0.001, concrete, [12, 12]);
    addRegion(x0, x1, z0, z1, 0);
    mapShapes.push({ type: 'land', x0, x1, z0, z1, label });
  };
  land(-300, 70, -300, 18);
  land(-300, 70, 58, 300);
  land(170, 240, 40, 115);

  const grassMat = new THREE.MeshStandardMaterial({ map: noiseTexture('grass', '#5fae4f', ['#55a046', '#6cbc5a', '#4e9440']), roughness: 1 });
  const grass = (x0, x1, z0, z1) => { flat(x0, x1, z0, z1, 0.02, grassMat, [8, 8]); mapShapes.push({ type: 'grass', x0, x1, z0, z1 }); };
  grass(63, 69, -84, 6);
  grass(-300, -60, -40, 10);
  grass(175, 235, 45, 110);
  grass(-30, 68, 66, 80);

  // plaza & riverwalk
  const paver = new THREE.MeshStandardMaterial({ map: paverTexture(), roughness: 0.55, envMapIntensity: 0.9 });
  flat(-34, 64, -38, 10, 0.03, paver, [8, 8]);
  mapShapes.push({ type: 'plaza', x0: -34, x1: 64, z0: -38, z1: 10 });
  const wood = new THREE.MeshStandardMaterial({ map: woodTexture(), roughness: 0.85 });
  flat(-34, 70, 10, 18, 0.04, wood, [4, 4]);
  flat(-300, -54, 10, 18, 0.04, wood, [4, 4]);
  flat(-300, 70, 58, 66, 0.04, wood, [4, 4]);
  mapShapes.push({ type: 'walk', x0: -300, x1: 70, z0: 10, z1: 18 });
  mapShapes.push({ type: 'walk', x0: -300, x1: 70, z0: 58, z1: 66 });

  // railings
  const railM = mat('#f4f4f4', { metalness: 0.6, roughness: 0.3 });
  const posts = [];
  const rail = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const r = new THREE.Mesh(new THREE.BoxGeometry(len, 0.06, 0.06), railM);
    r.position.set((x0 + x1) / 2, 1.05, (z0 + z1) / 2);
    r.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
    scene.add(r);
    const n = Math.floor(len / 2.5);
    for (let i = 0; i <= n; i++) posts.push([x0 + ((x1 - x0) * i) / n, z0 + ((z1 - z0) * i) / n]);
  };
  rail(-300, 17.8, -54, 17.8); rail(-34, 17.8, 69.8, 17.8);
  rail(-300, 58.2, -54, 58.2); rail(-34, 58.2, 69.8, 58.2);
  rail(69.8, -300, 69.8, 8); rail(69.8, 12, 69.8, 17.8); rail(69.8, 58.2, 69.8, 300);
  const postMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.04, 0.04, 1.05, 6), railM, posts.length);
  const m4 = new THREE.Matrix4();
  posts.forEach(([x, z], i) => postMesh.setMatrixAt(i, m4.makeTranslation(x, 0.52, z)));
  scene.add(postMesh);

  // lamps
  const lampPositions = [];
  for (let x = -30; x < 68; x += 12) lampPositions.push([x, 16.8]);
  for (let x = -290; x < -56; x += 14) lampPositions.push([x, 16.8]);
  for (let x = -290; x < 68; x += 14) lampPositions.push([x, 59.2]);
  const lampPole = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.07, 0.09, 4, 6), mat('#2a2a2a'), lampPositions.length);
  const lampBulb = new THREE.InstancedMesh(new THREE.SphereGeometry(0.28, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffe6b0' }), lampPositions.length);
  lampPositions.forEach(([x, z], i) => {
    lampPole.setMatrixAt(i, m4.makeTranslation(x, 2, z));
    lampBulb.setMatrixAt(i, m4.makeTranslation(x, 4.1, z));
  });
  scene.add(lampPole, lampBulb);

  // ---------- roads ----------
  const roadMat = new THREE.MeshStandardMaterial({ map: roadTexture(), roughness: 0.38, metalness: 0.15, envMapIntensity: 1.3 });
  const roadZ = (x0, x1, z0, z1) => {
    const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0);
    g.rotateX(-Math.PI / 2);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * (z1 - z0) / 16);
    const m = new THREE.Mesh(g, roadMat);
    m.position.set((x0 + x1) / 2, 0.05, (z0 + z1) / 2);
    m.receiveShadow = true;
    scene.add(m);
    mapShapes.push({ type: 'road', x0, x1, z0, z1 });
  };
  const roadX = (x0, x1, z0, z1) => {
    const g = new THREE.PlaneGeometry(z1 - z0, x1 - x0);
    g.rotateX(-Math.PI / 2);
    g.rotateY(Math.PI / 2);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * (x1 - x0) / 16);
    const m = new THREE.Mesh(g, roadMat);
    m.position.set((x0 + x1) / 2, 0.06, (z0 + z1) / 2);
    m.receiveShadow = true;
    scene.add(m);
    mapShapes.push({ type: 'road', x0, x1, z0, z1 });
  };
  roadZ(-52, -36, -300, 300);
  roadX(-300, 70, -100, -86);

  // bridge (Brickell Ave Bridge)
  const bridgeM = mat('#e8e2d6');
  box(20, 1.2, 40, bridgeM, -44, -1.2, 38);
  addRegion(-54, -34, 18, 58, 0);
  mapShapes.push({ type: 'bridge', x0: -54, x1: -34, z0: 18, z1: 58 });
  for (const x of [-53.8, -34.2]) {
    box(0.4, 1.1, 40, bridgeM, x, 0, 38);
    addSolid(x - 0.2, x + 0.2, 18, 58, -1, 1.1);
    for (const z of [20, 56]) box(1.4, 3.2, 1.4, mat('#d9cdb4'), x, 0, z);
  }
  for (const z of [26, 38, 50]) {
    const arch = new THREE.Mesh(new THREE.TorusGeometry(9, 0.6, 8, 24, Math.PI), bridgeM);
    arch.position.set(-44, -9.4, z);
    arch.rotation.y = Math.PI / 2;
    scene.add(arch);
  }

  // cars
  const carColors = ['#f19bb0', '#a7d3ea', '#ffffff', '#ffd98a', '#1b1b1b', '#cdb9e6', '#ff7a3d', '#9be7c4'];
  const makeCar = (color) => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.7, 4.4), mat(color, { metalness: 0.7, roughness: 0.18, envMapIntensity: 1.5 }));
    body.position.y = 0.6; body.castShadow = true; g.add(body);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 2.2), mat('#1d2a3a', { metalness: 0.8, roughness: 0.1 }));
    cab.position.set(0, 1.2, -0.2); cab.castShadow = true; g.add(cab);
    const wheelG = new THREE.CylinderGeometry(0.35, 0.35, 0.3, 12);
    wheelG.rotateZ(Math.PI / 2);
    for (const [x, z] of [[-0.95, 1.4], [0.95, 1.4], [-0.95, -1.4], [0.95, -1.4]]) {
      const w = new THREE.Mesh(wheelG, mat('#111'));
      w.position.set(x, 0.35, z); g.add(w);
    }
    const hl = new THREE.MeshBasicMaterial({ color: '#fff6d0' });
    for (const x of [-0.6, 0.6]) { const h = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.15, 0.05), hl); h.position.set(x, 0.7, 2.21); g.add(h); }
    const tl = new THREE.MeshBasicMaterial({ color: '#ff2050' });
    for (const x of [-0.6, 0.6]) { const h = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.15, 0.05), tl); h.position.set(x, 0.7, -2.21); g.add(h); }
    scene.add(g);
    return g;
  };
  const r = rng(42);
  for (let i = 0; i < 14; i++) {
    const axis = i < 8 ? 'z' : 'x';
    const dir = i % 2 ? 1 : -1;
    const lane = axis === 'z' ? (dir > 0 ? -48 : -40) : (dir > 0 ? -89.5 : -96.5);
    const g = makeCar(carColors[i % carColors.length]);
    cars.push({ g, axis, dir, lane, s: -280 + r() * 560, speed: 9 + r() * 5, min: -290, max: axis === 'z' ? 290 : 62 });
  }
  updaters.push((t, dt, player) => {
    for (const c of cars) {
      // brake for player in front
      let blocked = false;
      if (player) {
        const px = c.axis === 'z' ? player.x : player.z;
        const ps = c.axis === 'z' ? player.z : player.x;
        const ahead = (ps - c.s) * c.dir;
        if (Math.abs(px - c.lane) < 1.8 && ahead > 0 && ahead < 7) blocked = true;
      }
      c.v = THREE.MathUtils.lerp(c.v ?? c.speed, blocked ? 0 : c.speed, Math.min(1, dt * 4));
      c.s += c.v * c.dir * dt;
      if (c.s > c.max) c.s = c.min;
      if (c.s < c.min) c.s = c.max;
      if (c.axis === 'z') { c.g.position.set(c.lane, 0, c.s); c.g.rotation.y = c.dir > 0 ? 0 : Math.PI; }
      else { c.g.position.set(c.s, 0, c.lane); c.g.rotation.y = c.dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
    }
  });

  // ---------- buildings ----------
  const buildingMeshes = [];
  const building = (x0, x1, z0, z1, h, base, glass, variant = 0, neonTrim = null, y0 = 0) => {
    const tex = windowTexture(base, glass, variant).clone();
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(Math.max(1, Math.round((x1 - x0 + z1 - z0) / 2 / 10)), Math.max(1, Math.round(h / 12)));
    tex.needsUpdate = true;
    const side = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.22, metalness: 0.55, envMapIntensity: 1.4 });
    const roof = mat(base);
    const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, h, z1 - z0), [side, side, roof, roof, side, side]);
    m.position.set((x0 + x1) / 2, y0 + h / 2, (z0 + z1) / 2);
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
    buildingMeshes.push(m);
    addSolid(x0, x1, z0, z1, y0 ? y0 : -5, y0 + h);
    mapShapes.push({ type: 'building', x0, x1, z0, z1, h });
    if (neonTrim) {
      const nm = new THREE.MeshBasicMaterial({ color: neonTrim });
      const w = x1 - x0, d = z1 - z0;
      for (const [bw, bd, bx, bz] of [[w + 0.4, 0.4, 0, d / 2], [w + 0.4, 0.4, 0, -d / 2], [0.4, d + 0.4, w / 2, 0], [0.4, d + 0.4, -w / 2, 0]]) {
        const s = new THREE.Mesh(new THREE.BoxGeometry(bw, 0.5, bd), nm);
        s.position.set((x0 + x1) / 2 + bx, y0 + h - 0.5, (z0 + z1) / 2 + bz);
        scene.add(s);
      }
    }
    return m;
  };

  // ---------- walkable interiors (modeled on the Threshold360 tour) ----------
  function hall(x0, x1, z0, z1, h, { doors = [], wall, glass = {}, label }) {
    const T = 0.4;
    const edges = {
      z0: { a0: x0, a1: x1, fixed: z0 + T / 2, axis: 'x' }, z1: { a0: x0, a1: x1, fixed: z1 - T / 2, axis: 'x' },
      x0: { a0: z0, a1: z1, fixed: x0 + T / 2, axis: 'z' }, x1: { a0: z0, a1: z1, fixed: x1 - T / 2, axis: 'z' },
    };
    for (const [name, e] of Object.entries(edges)) {
      const m = glass[name] || wall;
      const ds = doors.filter((d) => d.edge === name).sort((a, b) => a.c - b.c);
      const seg = (a0, a1, y0, y1) => {
        if (a1 - a0 < 0.01 || y1 - y0 < 0.01) return;
        const len = a1 - a0, mid = (a0 + a1) / 2;
        const mesh = e.axis === 'x' ? box(len, y1 - y0, T, m, mid, y0, e.fixed) : box(T, y1 - y0, len, m, e.fixed, y0, mid);
        buildingMeshes.push(mesh);
        if (e.axis === 'x') addSolid(a0, a1, e.fixed - T / 2, e.fixed + T / 2, y0 > 0 ? y0 : -1, y1);
        else addSolid(e.fixed - T / 2, e.fixed + T / 2, a0, a1, y0 > 0 ? y0 : -1, y1);
      };
      let a = e.a0;
      for (const d of ds) { seg(a, d.c - d.w / 2, 0, h); seg(d.c - d.w / 2, d.c + d.w / 2, d.h, h); a = d.c + d.w / 2; }
      seg(a, e.a1, 0, h);
    }
    const ceil = box(x1 - x0, 0.4, z1 - z0, wall, (x0 + x1) / 2, h, (z0 + z1) / 2);
    buildingMeshes.push(ceil);
    mapShapes.push({ type: 'building', x0, x1, z0, z1, h, label });
  }
  const cove = (w, d, color, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, d), new THREE.MeshBasicMaterial({ color })); m.position.set(x, y, z); scene.add(m); return m; };
  const sign = (tex, w, h, x, y, z, ry = 0, basic = true) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), basic ? new THREE.MeshBasicMaterial({ map: tex, transparent: true }) : new THREE.MeshStandardMaterial({ map: tex }));
    m.position.set(x, y, z); m.rotation.y = ry; scene.add(m); return m;
  };
  const lamp = (color, intensity, dist, x, y, z) => { const l = new THREE.PointLight(color, intensity, dist, 1.4); l.position.set(x, y, z); scene.add(l); };
  const plant = (x, z, s = 1) => {
    box(0.9 * s, 0.9 * s, 0.9 * s, mat('#2b2b2e', { roughness: 0.6 }), x, 0, z);
    const leaves = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9 * s, 0), mat('#2f7a3a', { roughness: 0.9 }));
    leaves.position.set(x, 1.6 * s, z); leaves.scale.y = 1.4; leaves.castShadow = true; scene.add(leaves);
    addSolid(x - 0.5 * s, x + 0.5 * s, z - 0.5 * s, z + 0.5 * s, -1, 1);
  };
  const lounge = (x, z, rot = 0) => {
    const tw = mat('#9a6b43', { roughness: 0.5 });
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.06, 20), tw); top.position.set(x, 0.55, z); top.castShadow = true; scene.add(top);
    box(0.12, 0.52, 0.12, mat('#222'), x, 0, z);
    const chairM = mat('#efeae2', { roughness: 0.8 });
    for (let i = 0; i < 4; i++) {
      const a = rot + i * Math.PI / 2, cx = x + Math.cos(a) * 1.25, cz = z + Math.sin(a) * 1.25;
      const g = new THREE.Group();
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.42, 0.8), chairM); seat.position.y = 0.21;
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.5, 0.18), chairM); back.position.set(0, 0.6, 0.36);
      const cush = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.12), mat('#2f8fa3')); cush.position.set(0, 0.55, 0.24);
      for (const m of [seat, back, cush]) { m.castShadow = true; g.add(m); }
      g.position.set(cx, 0, cz); g.rotation.y = -a + Math.PI / 2 + Math.PI; scene.add(g);
      addSolid(cx - 0.45, cx + 0.45, cz - 0.45, cz + 0.45, -1, 0.7);
    }
    addSolid(x - 0.5, x + 0.5, z - 0.5, z + 0.5, -1, 0.6);
  };
  const tileTex = canvasTexture('lobbytile', 256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#e9dcc4'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 400; i++) { ctx.fillStyle = `rgba(${150 + Math.random() * 60},${130 + Math.random() * 50},100,0.08)`; ctx.fillRect(Math.random() * w, Math.random() * h, 6, 6); }
    ctx.strokeStyle = '#cbbd a3'.replace(' ', ''); ctx.lineWidth = 3; ctx.strokeRect(0, 0, w, h);
  });
  tileTex.wrapS = tileTex.wrapT = THREE.RepeatWrapping;
  const carpetTex = canvasTexture('carpet', 256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#2a1f3d'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#4b3570'; ctx.lineWidth = 6;
    for (let i = -1; i < 3; i++) for (let j = -1; j < 3; j++) { ctx.beginPath(); ctx.arc(i * 128 + 64, j * 128 + 64, 48, 0, Math.PI * 2); ctx.stroke(); }
    ctx.fillStyle = '#c9a24a'; for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) ctx.fillRect(i * 128 + 60, j * 128 + 60, 8, 8);
  });
  carpetTex.wrapS = carpetTex.wrapT = THREE.RepeatWrapping;
  const floorTile = new THREE.MeshStandardMaterial({ map: tileTex, roughness: 0.25, metalness: 0.05, envMapIntensity: 0.8 });
  const floorCarpet = new THREE.MeshStandardMaterial({ map: carpetTex, roughness: 0.95 });
  const wallM = mat('#efe7da', { roughness: 0.9 });
  const glassM = new THREE.MeshStandardMaterial({ color: '#a9c4d6', transparent: true, opacity: 0.28, roughness: 0.05, metalness: 0.7, envMapIntensity: 1.5 });
  const woodDark = mat('#5a3b26', { roughness: 0.55 });

  // ---------- Startup HQ: walk-in tower with themed rooms ----------
  function buildStartupHQ() {
    const X0 = -112, X1 = -74, Z0 = -80, Z1 = -46, H = 6.2, T = 0.25, MX = -93;
    const cv = (key, w, h, fn, rep) => { const t = canvasTexture(key, w, h, fn); if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; } return t; };
    const glow = (color, k = 1.6) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: k });
    const basicTex = (tex, extra = {}) => new THREE.MeshBasicMaterial({ map: tex, ...extra });
    const solidBox = (w, h, d, m, x, y, z) => { const b = box(w, h, d, m, x, y, z); addSolid(x - w / 2, x + w / 2, z - d / 2, z + d / 2, -1, y + h); return b; };
    const darkWall = mat('#1f2229', { roughness: 0.85 });
    hall(X0, X1, Z0, Z1, H, { wall: darkWall, glass: { x1: glassM }, label: 'Startup HQ', doors: [{ edge: 'x1', c: -63, w: 5, h: 3.8 }] });
    building(X0, X1, Z0, Z1, 52, '#e4e6ea', '#24364d', 1, '#f19bb0', H + 0.4);
    const wallX = (z, xa, xb, m, gaps = []) => {
      const seg = (s, e) => { if (e - s < 0.05) return; box(e - s, H, T, m, (s + e) / 2, 0, z); addSolid(s, e, z - T / 2, z + T / 2, -1, H); };
      let a = xa;
      for (const [c, w] of gaps) { seg(a, c - w / 2); a = c + w / 2; }
      seg(a, xb);
    };
    const wallZ = (x, za, zb, m, gaps = []) => {
      const seg = (s, e) => { if (e - s < 0.05) return; box(T, H, e - s, m, x, 0, (s + e) / 2); addSolid(x - T / 2, x + T / 2, s, e, -1, H); };
      let a = za;
      for (const [c, w] of gaps) { seg(a, c - w / 2); a = c + w / 2; }
      seg(a, zb);
    };
    // materials
    const woodPanel = new THREE.MeshStandardMaterial({ roughness: 0.7, map: cv('hq-wood', 256, 256, (c, w, h) => { c.fillStyle = '#6b4325'; c.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 32) { c.fillStyle = x % 64 ? '#5a361d' : '#7a4e2c'; c.fillRect(x, 0, 30, h); c.fillStyle = '#3a2311'; c.fillRect(x + 30, 0, 2, h); } }, true) });
    woodPanel.map.repeat.set(4, 1);
    const whitePanel = mat('#f3f6f9', { roughness: 0.25, metalness: 0.1 });
    const futureGlass = new THREE.MeshStandardMaterial({ color: '#bfefff', transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0.6, emissive: '#a7d3ea', emissiveIntensity: 0.15 });
    const gameWall = mat('#15121f', { roughness: 0.8 });
    const brick = new THREE.MeshStandardMaterial({ roughness: 0.9, map: cv('hq-brick', 256, 128, (c, w, h) => { c.fillStyle = '#8a4b35'; c.fillRect(0, 0, w, h); c.fillStyle = '#d9c7b4'; for (let y = 0; y < h; y += 32) { c.fillRect(0, y, w, 3); for (let x = (y / 32) % 2 ? 32 : 0; x < w; x += 64) c.fillRect(x, y, 3, 32); } }, true) });
    brick.map.repeat.set(4, 2);
    // partitions: corridor runs east-west at z -65..-61
    wallX(-61, X0 + 0.4, MX, woodPanel, [[-102.5, 3]]);
    wallX(-61, MX, X1 - 0.4, futureGlass, [[-83.5, 3.2]]);
    wallX(-65, X0 + 0.4, MX, gameWall, [[-102.5, 3]]);
    wallX(-65, MX, X1 - 0.4, brick, [[-83.5, 7]]);
    wallZ(MX, -61, Z1 - 0.4, whitePanel);
    wallZ(MX, Z0 + 0.4, -65, brick);
    // corridor
    flat(X0 + 0.4, X1 - 0.4, -65, -61, 0.03, mat('#9aa0a6', { roughness: 0.35, metalness: 0.2 }));
    cove(X1 - X0 - 1, 0.12, '#f19bb0', (X0 + X1) / 2, 0.06, -63);
    sign(textTexture('hq-name', { text: 'STARTUP HQ', font: '900 150px Inter, sans-serif', color: '#ffffff', glow: '#f19bb0' }), 5, 1.25, X0 + 0.45, 3.4, -63, Math.PI / 2);
    sign(textTexture('hq-out', { text: 'STARTUP HQ', font: '900 150px Inter, sans-serif', color: '#ffe1f0', glow: '#f19bb0' }), 9, 2.2, X1 + 0.3, 5, -63, Math.PI / 2);
    sign(textTexture('hq-sub', { text: 'retro lab · future lab · game room · cafecito lounge', font: '600 52px Inter, sans-serif', color: '#ffffff', bg: '#1f2229' }), 6, 0.6, X1 + 0.3, 4.1 - 0.2, -63, Math.PI / 2);
    // room labels over doorways (corridor side)
    const label = (key, text, color, x, z, ry) => sign(textTexture(key, { text, font: '800 120px Inter, sans-serif', color: '#ffffff', glow: color }), 3, 0.75, x, 4.6, z, ry);
    label('hq-l1', 'RETRO LAB', '#ffbf9b', -102.5, -61.2, Math.PI);
    label('hq-l2', 'FUTURE LAB', '#a7d3ea', -83.5, -61.2, Math.PI);
    label('hq-l3', 'GAME ROOM', '#f19bb0', -102.5, -64.8, 0);
    label('hq-l4', 'CAFECITO LOUNGE', '#ffd98a', -83.5, -64.8, 0);

    // ===== RETRO LAB (80s) =====
    const shag = new THREE.MeshStandardMaterial({ roughness: 1, map: cv('hq-shag', 256, 256, (c, w, h) => { c.fillStyle = '#7a3b12'; c.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 64) for (let x = 0; x < w; x += 64) { c.fillStyle = (x + y) % 128 ? '#c8641e' : '#e9a23b'; c.beginPath(); c.arc(x + 32, y + 32, 22, 0, Math.PI * 2); c.fill(); c.fillStyle = '#5a2a0c'; c.beginPath(); c.arc(x + 32, y + 32, 9, 0, Math.PI * 2); c.fill(); } }, true) });
    flat(X0 + 0.4, MX - 0.12, -60.9, Z1 - 0.4, 0.03, shag, [3, 3]);
    box(MX - X0 - 0.6, H - 0.2, 0.06, woodPanel, (X0 + MX) / 2, 0, Z1 - 0.44);
    box(0.06, H - 0.2, Z1 - (-61) - 0.6, woodPanel, X0 + 0.44, 0, (Z1 - 61) / 2);
    const beige = mat('#d8cdb0', { roughness: 0.6 }), orange = mat('#c46a2a', { roughness: 0.5 });
    const crtTex = cv('hq-crt', 256, 192, (c, w, h) => { c.fillStyle = '#031a07'; c.fillRect(0, 0, w, h); c.fillStyle = '#a9d3b9'; c.font = '20px monospace'; ['C:\\> npm run dev', 'READY on :3000', '> git push --force', '> deploy prod', 'ALL SYSTEMS GO_'].forEach((s, i) => c.fillText(s, 12, 32 + i * 32)); });
    const crtM = basicTex(crtTex);
    const desk = (x, z) => {
      solidBox(2.4, 0.08, 1.1, orange, x, 0.72, z);
      for (const dx of [-1.1, 1.1]) box(0.08, 0.72, 1.0, orange, x + dx, 0, z);
      box(0.62, 0.52, 0.55, beige, x, 0.8, z - 0.15);
      const s = new THREE.Mesh(new THREE.PlaneGeometry(0.48, 0.36), crtM); s.position.set(x, 1.07, z + 0.131); scene.add(s);
      box(0.7, 0.04, 0.24, beige, x, 0.8, z + 0.32);
      const lava = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.36, 10), glow('#ff5a1f', 1.4)); lava.position.set(x + 0.95, 0.98, z - 0.2); scene.add(lava);
      const phone = box(0.22, 0.09, 0.18, mat('#c0262d'), x - 0.85, 0.8, z + 0.1);
      const chair = box(0.55, 0.45, 0.55, mat('#3a2a20'), x, 0, z + 0.95); chair.castShadow = true;
    };
    desk(-108, -55); desk(-104, -55); desk(-100, -55); desk(-108, -51); desk(-104, -51); desk(-100, -51);
    const arcade = (x, z, ry, color, title) => {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.9, 0.8), mat('#121218', { roughness: 0.5 })); body.position.y = 0.95; g.add(body);
      for (const sx of [-1, 1]) { const side = new THREE.Mesh(new THREE.BoxGeometry(0.03, 1.92, 0.04), glow(color, 1.2)); side.position.set(sx * 0.44, 0.96, 0.41); g.add(side); }
      const marquee = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.26), basicTex(textTexture('arc-' + title, { text: title, w: 512, h: 160, font: '900 92px Inter, sans-serif', color: '#ffffff', bg: color }))); marquee.position.set(0, 1.74, 0.41); g.add(marquee);
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.5), basicTex(cv('arc-scr-' + title, 128, 100, (c, w, h) => { c.fillStyle = '#05051a'; c.fillRect(0, 0, w, h); for (let i = 0; i < 18; i++) { c.fillStyle = ['#f19bb0', '#a7d3ea', '#ffd98a', '#a9d3b9'][i % 4]; c.fillRect((i * 37) % 110, 10 + ((i * 23) % 70), 10, 8); } c.fillStyle = '#fff'; c.font = '12px monospace'; c.fillText('HI 99999', 30, 95); }))); scr.position.set(0, 1.28, 0.405); scr.rotation.x = -0.12; g.add(scr);
      const panel = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.08, 0.35), mat('#222')); panel.position.set(0, 0.95, 0.5); panel.rotation.x = 0.3; g.add(panel);
      for (const [bx, bc] of [[-0.2, '#ff2d55'], [0.08, '#ffd98a'], [0.2, '#a7d3ea']]) { const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.03, 10), glow(bc, 1)); btn.position.set(bx, 1.0, 0.52); g.add(btn); }
      g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g);
      addSolid(x - 0.5, x + 0.5, z - 0.5, z + 0.5, -1, 1.9);
    };
    arcade(-110.6, -48.2, Math.PI / 2, '#ff2d8a', 'HEART RUN'); arcade(-110.6, -50, Math.PI / 2, '#a7d3ea', 'BUG BLASTER');
    sign(textTexture('hq-1985', { text: 'RAD SINCE 1985', font: '900 120px Inter, sans-serif', color: '#ffe1f0', glow: '#f19bb0' }), 4, 1, -101, 4, Z1 - 0.5, Math.PI);
    const poster = (key, x, z, ry, a, b) => sign(cv(key, 256, 360, (c, w, h) => { const g2 = c.createLinearGradient(0, 0, 0, h); g2.addColorStop(0, a); g2.addColorStop(1, b); c.fillStyle = g2; c.fillRect(0, 0, w, h); c.fillStyle = '#ffd98a'; c.beginPath(); c.arc(w / 2, h * 0.55, 70, Math.PI, 0); c.fill(); c.strokeStyle = '#f19bb0'; c.lineWidth = 3; for (let y = h * 0.6; y < h; y += 14) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); } c.fillStyle = '#fff'; c.font = '900 34px Inter'; c.textAlign = 'center'; c.fillText(key.includes('a') ? 'SHIP IT' : 'MIAMI 85', w / 2, 60); }), 1.2, 1.7, x, 2.6, z, ry, false);
    poster('hq-pa', X0 + 0.5, -57, Math.PI / 2, '#2b1055', '#e7849c'); poster('hq-pb', X0 + 0.5, -53, Math.PI / 2, '#0b3d91', '#a7d3ea');
    cove(MX - X0 - 1, 0.1, '#ffbf9b', (X0 + MX) / 2, H - 0.3, Z1 - 0.6);
    lamp('#ffb070', 10, 16, -103, 4.5, -53);

    // ===== FUTURE LAB =====
    const gridTex = cv('hq-grid', 256, 256, (c, w, h) => { c.fillStyle = '#eef3f7'; c.fillRect(0, 0, w, h); c.strokeStyle = '#a7d3ea'; c.lineWidth = 3; c.strokeRect(0, 0, w, h); }, true);
    flat(MX + 0.12, X1 - 0.4, -60.9, Z1 - 0.4, 0.03, new THREE.MeshStandardMaterial({ map: gridTex, emissiveMap: gridTex, emissive: '#a7d3ea', emissiveIntensity: 0.25, roughness: 0.15, metalness: 0.2 }), [2, 2]);
    box(X1 - MX - 0.6, H - 0.2, 0.06, whitePanel, (MX + X1) / 2, 0, Z1 - 0.44);
    const white = mat('#f7f9fb', { roughness: 0.2, metalness: 0.1 });
    const holoTex = (key, draw) => cv(key, 256, 160, (c, w, h) => { c.fillStyle = 'rgba(41,211,255,0.12)'; c.fillRect(0, 0, w, h); c.strokeStyle = '#7fe7ff'; c.lineWidth = 2; c.strokeRect(2, 2, w - 4, h - 4); draw(c, w, h); });
    const holo = (tex, w, h, x, y, z, ry) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.9, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })); m.position.set(x, y, z); m.rotation.y = ry; scene.add(m); const y0 = y, ph = x * 0.7; updaters.push((t) => { m.position.y = y0 + Math.sin(t * 1.4 + ph) * 0.04; }); return m; };
    const chart = holoTex('hq-holo1', (c, w, h) => { c.strokeStyle = '#a9d3b9'; c.lineWidth = 4; c.beginPath(); c.moveTo(16, 130); [[60, 110], [100, 118], [140, 80], [180, 70], [230, 24]].forEach(([x, y]) => c.lineTo(x, y)); c.stroke(); c.fillStyle = '#ffffff'; c.font = '700 18px Inter'; c.fillText('MRR ↑ 420%', 16, 26); });
    const code = holoTex('hq-holo2', (c) => { c.fillStyle = '#bff6ff'; c.font = '15px monospace'; ['const db = neon(env.DATABASE_URL)', 'await db`select * from users`', '// branch per preview deploy', 'export default App'].forEach((s, i) => c.fillText(s, 12, 36 + i * 30)); });
    const neonHolo = holoTex('hq-holo3', (c, w, h) => { drawNeonLogo(c, 40, 40, 176); c.fillStyle = '#ffffff'; c.font = '600 16px Inter'; c.fillText('Main character energy only', 30, 130); });
    const fdesk = (x, z) => {
      const top = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.16, 8, 28, Math.PI), white); top.rotation.x = -Math.PI / 2; top.scale.z = 0.35; top.position.set(x, 0.78, z); top.castShadow = true; scene.add(top);
      const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 0.76, 12), white); ped.position.set(x, 0.38, z + 0.3); scene.add(ped);
      const strip = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.02, 4, 28, Math.PI), glow('#a7d3ea', 2)); strip.rotation.x = -Math.PI / 2; strip.position.set(x, 0.72, z); scene.add(strip);
      addSolid(x - 1.15, x + 1.15, z - 0.2, z + 1.15, -1, 0.85);
    };
    fdesk(-88.5, -57.5); fdesk(-79, -57.5);
    holo(chart, 1.4, 0.88, -88.5, 1.55, -57.2, 0); holo(code, 1.4, 0.88, -79, 1.55, -57.2, 0); holo(neonHolo, 2.4, 1.5, -83.7, 3.1, Z1 - 0.7, Math.PI);
    const ped = box(1, 0.9, 1, white, -83.7, 0, -51); addSolid(-84.2, -83.2, -51.5, -50.5, -1, 0.9);
    const globe = new THREE.Mesh(new THREE.IcosahedronGeometry(0.75, 2), new THREE.MeshBasicMaterial({ color: '#a7d3ea', wireframe: true, transparent: true, opacity: 0.8 }));
    globe.position.set(-83.7, 2.0, -51); scene.add(globe);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.02, 6, 48), glow('#f19bb0', 2)); ring.position.copy(globe.position); scene.add(ring);
    updaters.push((t) => { globe.rotation.y = t * 0.5; ring.rotation.x = Math.PI / 2 + Math.sin(t) * 0.3; ring.rotation.y = t * 0.8; });
    const pod = (x, z, ry) => {
      const shell = new THREE.Mesh(new THREE.SphereGeometry(0.7, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.62), white); shell.rotation.x = -Math.PI / 2 + 0.25; shell.position.set(x, 0.75, z); shell.rotation.z = ry; shell.castShadow = true;
      const cush = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 10), mat('#a7d3ea', { roughness: 0.8 })); cush.scale.set(1, 0.35, 1); cush.position.set(x, 0.45, z);
      scene.add(shell, cush); addSolid(x - 0.6, x + 0.6, z - 0.6, z + 0.6, -1, 1.2);
    };
    pod(-90, -48.5, 0); pod(-77.5, -48.5, 0);
    const rack = box(0.9, 2.2, 0.8, mat('#0d0f14', { metalness: 0.6, roughness: 0.3 }), X1 - 0.95, 0, -53); addSolid(X1 - 1.4, X1 - 0.5, -53.4, -52.6, -1, 2.2);
    const leds = [];
    for (let i = 0; i < 14; i++) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.03, 0.05), glow(i % 3 ? '#a9d3b9' : '#a7d3ea', 2)); l.material = l.material.clone(); l.position.set(X1 - 1.41, 0.2 + i * 0.14, -53.2 + (i % 2) * 0.3); scene.add(l); leds.push(l); }
    updaters.push((t) => { leds.forEach((l, i) => { l.material.emissiveIntensity = (Math.sin(t * 7 + i * 2.3) > 0.2) ? 2.5 : 0.2; }); });
    sign(textTexture('hq-future', { text: 'FUTURE LAB', font: '900 130px Inter, sans-serif', color: '#e6fbff', glow: '#a7d3ea' }), 3.6, 0.9, MX + 0.2, 4.4, -53.5, Math.PI / 2);
    cove(0.1, Z1 + 61 - 1, '#a7d3ea', X1 - 0.55, H - 0.3, (Z1 - 61) / 2);
    lamp('#9fe9ff', 9, 15, -83.5, 4.5, -53.5);

    // ===== GAME ROOM =====
    flat(X0 + 0.4, MX - 0.12, Z0 + 0.4, -65.1, 0.03, new THREE.MeshStandardMaterial({ roughness: 0.6, map: cv('hq-rubber', 256, 256, (c, w, h) => { c.fillStyle = '#1b1b24'; c.fillRect(0, 0, w, h); c.fillStyle = '#f19bb0'; c.fillRect(0, 120, w, 6); c.fillStyle = '#a7d3ea'; c.fillRect(120, 0, 6, h); }, true) }), [6, 6]);
    const pingPong = (x, z) => {
      const tm = mat('#1d4f9a', { roughness: 0.4 }), wm = mat('#ffffff');
      box(2.74, 0.05, 1.52, tm, x, 0.71, z);
      box(2.74, 0.006, 0.03, wm, x, 0.76, z - 0.745); box(2.74, 0.006, 0.03, wm, x, 0.76, z + 0.745);
      box(0.03, 0.006, 1.52, wm, x - 1.355, 0.76, z); box(0.03, 0.006, 1.52, wm, x + 1.355, 0.76, z); box(2.74, 0.006, 0.01, wm, x, 0.761, z);
      box(0.02, 0.16, 1.7, new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.55 }), x, 0.76, z);
      for (const [dx, dz] of [[-1.2, -0.6], [1.2, -0.6], [-1.2, 0.6], [1.2, 0.6]]) box(0.06, 0.71, 0.06, mat('#222'), x + dx, 0, z + dz);
      for (const dx of [-0.9, 0.9]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.015, 16), mat('#d62828')); p.position.set(x + dx, 0.77, z + 0.3); scene.add(p); }
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), mat('#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.3 })); scene.add(ball);
      const ph = x;
      updaters.push((t) => { const k = Math.sin(t * 2.4 + ph); ball.position.set(x + k * 1.2, 0.78 + Math.abs(Math.cos(t * 4.8 + ph)) * 0.35, z + Math.sin(t * 1.3) * 0.4); });
      addSolid(x - 1.4, x + 1.4, z - 0.78, z + 0.78, -1, 0.8);
    };
    pingPong(-106, -75.5); pingPong(-99, -75.5);
    const foos = (x, z) => {
      box(1.2, 0.8, 0.7, woodDark, x, 0, z);
      box(1.1, 0.02, 0.6, mat('#2e8b57'), x, 0.81, z);
      for (let i = 0; i < 6; i++) {
        const rx = x - 0.45 + i * 0.18;
        const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.0, 6).rotateX(Math.PI / 2), mat('#c9ccd2', { metalness: 1, roughness: 0.3 })); rod.position.set(rx, 0.92, z); scene.add(rod);
        for (let j = -1; j <= 1; j++) box(0.04, 0.12, 0.05, mat(i % 2 ? '#d62828' : '#1d4f9a'), rx, 0.84, z + j * 0.18);
      }
      addSolid(x - 0.65, x + 0.65, z - 0.5, z + 0.5, -1, 1);
    };
    foos(-108, -68.5);
    arcade(-96, -67.6, Math.PI, '#ffd98a', 'DATA RACER'); arcade(-97.2, -67.6, Math.PI, '#a9d3b9', 'QUERY QUEST');
    const dart = new THREE.Mesh(new THREE.CircleGeometry(0.45, 32), basicTex(cv('hq-dart', 256, 256, (c, w, h) => { const cols = ['#111', '#e9dcc4', '#d62828', '#2e8b57']; for (let r = 6; r > 0; r--) { c.fillStyle = cols[r % 4]; c.beginPath(); c.arc(128, 128, r * 20, 0, Math.PI * 2); c.fill(); } c.fillStyle = '#d62828'; c.beginPath(); c.arc(128, 128, 8, 0, Math.PI * 2); c.fill(); })));
    dart.position.set(X0 + 0.46, 1.8, -71); dart.rotation.y = Math.PI / 2; scene.add(dart);
    sign(textTexture('hq-play', { text: 'PLAY HARD · SHIP HARDER', font: '900 96px Inter, sans-serif', color: '#ffe1f0', glow: '#f19bb0' }), 5.5, 1, -102.5, 4.2, Z0 + 0.5, 0);
    cove(MX - X0 - 1, 0.1, '#f19bb0', (X0 + MX) / 2, H - 0.3, Z0 + 0.6); cove(0.1, 13.5, '#a7d3ea', X0 + 0.55, H - 0.3, -72.5);
    const beanbag = (x, z, color) => { const b = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 10), mat(color, { roughness: 0.9 })); b.scale.set(1, 0.6, 1); b.position.set(x, 0.33, z); b.castShadow = true; scene.add(b); addSolid(x - 0.45, x + 0.45, z - 0.45, z + 0.45, -1, 0.6); };
    beanbag(-110, -71, '#f19bb0'); beanbag(-110, -73, '#a7d3ea');
    lamp('#ffd6ee', 16, 18, -102.5, 4.5, -72.5);

    // ===== CAFECITO LOUNGE =====
    flat(MX + 0.12, X1 - 0.4, Z0 + 0.4, -65.1, 0.03, new THREE.MeshStandardMaterial({ roughness: 0.6, map: cv('hq-planks', 256, 256, (c, w, h) => { for (let y = 0; y < h; y += 32) { c.fillStyle = (y / 32) % 2 ? '#a0703f' : '#8c5e33'; c.fillRect(0, y, w, 32); c.fillStyle = '#5a3b26'; c.fillRect(0, y + 30, w, 2); c.fillRect(((y * 7) % w), y, 2, 32); } }, true) }), [3, 3]);
    solidBox(9, 1.05, 0.9, mat('#2b2b2e', { roughness: 0.4 }), -83.5, 0, Z0 + 1.1);
    box(9.1, 0.07, 1.0, mat('#e9e4da', { roughness: 0.2 }), -83.5, 1.05, Z0 + 1.1);
    box(0.7, 0.6, 0.5, mat('#c9ccd2', { metalness: 1, roughness: 0.2 }), -86, 1.12, Z0 + 1.1);
    const esp = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.12), glow('#ffbf9b', 1.5)); esp.position.set(-86, 1.55, Z0 + 1.36); scene.add(esp);
    for (let i = 0; i < 5; i++) { const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.1, 10), mat('#ffffff')); cup.position.set(-84.5 + i * 0.3, 1.17, Z0 + 1.1); scene.add(cup); }
    sign(textTexture('hq-menu', { text: 'CAFECITO · CORTADITO · COLADA · COLD BREW', w: 1600, font: '700 80px Inter, sans-serif', color: '#ffd98a', bg: '#1b1410' }), 6.5, 0.8, -83.5, 3.1, Z0 + 0.45, 0);
    sign(textTexture('hq-shipit', { text: 'ship it ☕', font: 'italic 900 150px Inter, sans-serif', color: '#fff4c2', glow: '#ffb000' }), 3.6, 1, -83.5, 4.6, Z0 + 0.45, 0);
    lounge(-88, -72, 0.3); lounge(-79, -72, 0);
    beanbag(-90.5, -67.8, '#ffd98a'); beanbag(-77, -67.8, '#cdb9e6');
    const rug = new THREE.Mesh(new THREE.CircleGeometry(2.6, 40), mat('#e7849c', { roughness: 1 })); rug.rotation.x = -Math.PI / 2; rug.position.set(-83.5, 0.04, -72); scene.add(rug);
    for (const [x, z] of [[MX + 0.9, Z0 + 1.1], [X1 - 0.9, Z0 + 1.1], [X1 - 0.9, -66.2], [MX + 0.9, -66.2]]) plant(x, z, 0.8);
    const shelf = box(0.4, 2.4, 3.2, woodDark, X1 - 0.65, 0, -71); addSolid(X1 - 0.9, X1 - 0.4, -72.6, -69.4, -1, 2.4);
    for (let s = 0; s < 4; s++) for (let b = 0; b < 9; b++) box(0.25, 0.32 + ((b * 7) % 3) * 0.04, 0.12, mat(['#d62828', '#a7d3ea', '#ffd98a', '#a9d3b9', '#cdb9e6', '#ffbf9b'][(b + s) % 6]), X1 - 0.9, 0.15 + s * 0.6, -72.4 + b * 0.32);
    lamp('#ffd9a0', 9, 15, -83.5, 4.5, -72.5);

    // entrance beacon so people find the offices
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 60, 20, 1, true), new THREE.MeshBasicMaterial({ color: '#ffbf9b', transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    beam.position.set(X1 + 4, 30, -63); scene.add(beam);
    const ringE = new THREE.Mesh(new THREE.RingGeometry(1.5, 2.1, 40), new THREE.MeshBasicMaterial({ color: '#ffbf9b', transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
    ringE.rotation.x = -Math.PI / 2; ringE.position.set(X1 + 4, 0.06, -63); scene.add(ringE);
    const enter = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.5), new THREE.MeshBasicMaterial({ map: textTexture('hq-enter', { text: 'OFFICES · GAME ROOM · CAFÉ  →', font: '900 84px Inter, sans-serif', color: '#ffffff', bg: '#ffbf9b' }), side: THREE.DoubleSide }));
    enter.position.set(X1 + 4, 3.6, -63); scene.add(enter);
    updaters.push((t, dt, player) => {
      enter.position.y = 3.6 + Math.sin(t * 2) * 0.15;
      if (player) enter.rotation.y = Math.atan2(player.x - enter.position.x, player.z - enter.position.z);
      ringE.scale.setScalar(1 + (t % 1.5) / 3);
      ringE.material.opacity = 0.8 * (1 - (t % 1.5) / 1.5);
    });
    exclusions.push([(X0 + X1) / 2, (Z0 + Z1) / 2, 17]);
  }

  function buildInteriors(rmTex) {
    // Hyatt lobby (ground floor of the tower)
    hall(-26, 4, -62, -38, 9, { wall: wallM, glass: { z1: glassM }, label: 'Lobby', doors: [{ edge: 'z1', c: -11, w: 10, h: 4 }, { edge: 'x1', c: -49, w: 4, h: 3.5 }] });
    flat(-25.6, 3.6, -61.6, -38.4, 0.03, floorTile, [3, 3]);
    for (const [w, d, x, z] of [[29, 0.25, -11, -61.3], [29, 0.25, -11, -38.7], [0.25, 23, -25.3, -50], [0.25, 23, 3.3, -50]]) cove(w, d, '#cdb9e6', x, 8.4, z);
    cove(12, 0.25, '#cdb9e6', -11, 8.7, -55); cove(12, 0.25, '#cdb9e6', -11, 8.7, -45); cove(0.25, 10, '#cdb9e6', -17, 8.7, -50); cove(0.25, 10, '#cdb9e6', -5, 8.7, -50);
    lamp('#ffe2c0', 14, 22, -18, 7.5, -50); lamp('#ffe2c0', 14, 22, -3, 7.5, -50); lamp('#cdb9e6', 10, 16, -11, 8, -42);
    const col = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 8.6, 32), new THREE.MeshStandardMaterial({ color: '#d9dde2', metalness: 1, roughness: 0.06 }));
    col.position.set(-11, 4.3, -50); col.castShadow = true; scene.add(col);
    for (let y = 0.6; y < 8.6; y += 1.1) { const r = new THREE.Mesh(new THREE.TorusGeometry(1.12, 0.05, 6, 32), mat('#222')); r.rotation.x = Math.PI / 2; r.position.set(-11, y, -50); scene.add(r); }
    addSolid(-12.1, -9.9, -51.1, -48.9, -1, 9);
    // reception desk + sign
    box(12, 1.1, 1.3, woodDark, -11, 0, -59.3); addSolid(-17, -5, -60, -58.6, -1, 1.1);
    box(12.2, 0.08, 1.5, mat('#f4f1ea', { roughness: 0.3 }), -11, 1.1, -59.3);
    sign(textTexture('hyattwall', { text: 'THE PINK PALACE', font: '600 110px Inter, sans-serif', color: '#e9d9b8' }), 9, 2.2, -11, 4, -61.75);
    // Neon screen on the back wall
    const neonScreen = canvasTexture('neonscreen', 1024, 576, (ctx, w, h) => {
      ctx.fillStyle = '#0b0b0b'; ctx.fillRect(0, 0, w, h);
      ctx.drawImage(neonLogo(NEON).image, w / 2 - 300, 60, 600, 160);
      ctx.textAlign = 'center'; ctx.fillStyle = '#ffffff'; ctx.font = '600 54px Inter, sans-serif';
      ctx.fillText('Main character energy only', w / 2, 320);
      ctx.fillStyle = NEON; ctx.font = '700 40px Inter, sans-serif';
      ctx.fillText('HOT GIRL SUMMER', w / 2, 400);
      ctx.fillStyle = '#9aa0a6'; ctx.font = '32px Inter, sans-serif';
      ctx.fillText('Brunch is a love language', w / 2, 470);
    });
    box(6.4, 3.8, 0.2, mat('#111'), -21.5, 2.2, -61.6);
    sign(neonScreen, 6, 3.4, -21.5, 4.1, -61.45);
    // lounges + plants
    lounge(-21, -44); lounge(-21, -52, 0.4); lounge(-2, -44, 0.2);
    for (const [x, z] of [[-24.5, -39.6], [2.5, -39.6], [-24.5, -60.5], [-15, -46], [-7, -46]]) plant(x, z);
    // Pure Verde lounge bar (east side)
    box(1.1, 1.15, 8, mat('#6f6a60', { roughness: 0.35 }), 0.6, 0, -57); addSolid(0, 1.2, -61, -53, -1, 1.2);
    box(1.15, 0.08, 8.1, mat('#1c1c1c', { roughness: 0.2 }), 0.6, 1.15, -57);
    box(0.5, 3, 8, woodDark, 3.3, 0, -57);
    for (let i = 0; i < 5; i++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.35, 8), mat(['#2e8b57', '#d4a017', '#8b0000', '#f5f5f5', '#a9d3b9'][i], { roughness: 0.1 })); b.position.set(3.3, 1.6, -60 + i * 1.4); scene.add(b); }
    sign(textTexture('verde', { text: 'PURE VERDE', font: '700 120px Inter, sans-serif', color: '#7ed957', glow: '#7ed957' }), 6, 1.5, 3.55, 5, -57, -Math.PI / 2);
    // Market + Riverwalk Cafe (west side)
    box(1.2, 1.1, 6, mat('#f2efe9', { roughness: 0.4 }), -23.6, 0, -43); addSolid(-24.2, -23, -46, -40, -1, 1.1);
    box(1.0, 0.6, 5.6, new THREE.MeshStandardMaterial({ color: '#cfe3ee', transparent: true, opacity: 0.35, roughness: 0.05 }), -23.6, 1.1, -43);
    for (let i = 0; i < 6; i++) { const pz = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.12, 12), mat(['#e7b26b', '#c0743a', '#f3d9a4'][i % 3])); pz.position.set(-23.6, 1.25, -45.4 + i * 0.9); scene.add(pz); }
    sign(textTexture('market', { text: 'MARKET · RIVERWALK CAFÉ', font: '700 92px Inter, sans-serif', color: '#2b2b2b' }), 7, 1.4, -25.55, 4, -43, Math.PI / 2);
    // connector to the Knight Center / ballroom
    hall(4, 10, -56, -42, 5, { wall: wallM, doors: [{ edge: 'x0', c: -49, w: 4, h: 3.5 }, { edge: 'x1', c: -49, w: 4, h: 3.5 }] });
    flat(4.4, 9.6, -55.6, -42.4, 0.03, floorCarpet, [3, 3]);
    sign(textTexture('ballroomsign', { text: 'REGENCY BALLROOM →', font: '700 96px Inter, sans-serif', color: '#ffffff', bg: '#3a2a55' }), 4, 1, 7, 3.2, -55.55);
    lamp('#ffe2c0', 20, 10, 7, 4.5, -49);
    // Regency Ballroom inside the James L. Knight Center
    hall(10, 62, -72, -32, 15, { wall: mat('#f1ece2', { roughness: 0.9 }), label: 'Ballroom', doors: [{ edge: 'x0', c: -49, w: 4, h: 3.5 }, { edge: 'z1', c: 36, w: 10, h: 3.4 }] });
    flat(10.4, 61.6, -71.6, -32.4, 0.03, floorCarpet, [4, 4]);
    box(32, 1.2, 9.6, mat('#151515', { roughness: 0.6 }), 36, 0, -66.8);
    addRegion(20, 52, -71.6, -62, 1.2); addSolid(20, 52, -71.6, -62, -1, 1.2);
    addRegion(33, 39, -62, -58.5, 0, { axis: 'z', h0: 1.2, h1: 0 });
    for (let i = 0; i < 4; i++) box(6, 0.3 * (i + 1), 0.875, mat('#1f1f1f'), 36, 0, -58.9 - i * 0.875);
    box(28, 10, 0.3, mat('#050505'), 36, 2.6, -71.3);
    sign(rmTex, 26, 9.3, 36, 7.6, -71.1);
    for (const x of [16, 56]) { box(4.4, 9.4, 0.2, mat('#0b0b0b'), x, 2.6, -71.3); sign(neonLogo(NEON), 4, 1.2, x, 9, -71.15); sign(textTexture('ds' + x, { text: 'HOT GIRL SUMMER', font: '700 80px Inter, sans-serif', color: '#ffffff' }), 4, 0.8, x, 7.6, -71.15); }
    box(1, 1.2, 0.8, mat('#1a1a1a'), 46, 1.2, -64); sign(neonLogo(NEON), 0.9, 0.3, 46, 2.1, -63.58);
    const seatG = new THREE.BoxGeometry(0.55, 0.9, 0.55);
    const seats = [];
    for (let z = -56; z <= -41; z += 1.5) for (let x = 15; x <= 57; x += 1.05) if (x < 33.5 || x > 38.5) seats.push([x, z]);
    const seatMesh = new THREE.InstancedMesh(seatG, mat('#3d2b5c', { roughness: 0.9 }), seats.length);
    const dm = new THREE.Object3D();
    seats.forEach(([x, z], i) => { dm.position.set(x, 0.45, z); dm.updateMatrix(); seatMesh.setMatrixAt(i, dm.matrix); });
    seatMesh.castShadow = true; scene.add(seatMesh);
    addSolid(14.6, 33.4, -56.4, -40.6, -1, 0.9); addSolid(38.6, 57.4, -56.4, -40.6, -1, 0.9);
    for (let x = 14; x <= 58; x += 8) for (const z of [-71.5, -32.5]) { const u = cove(0.5, 0.2, '#cdb9e6', x, 0.3, z); u.scale.y = 1; }
    for (let z = -68; z <= -36; z += 8) for (const x of [10.5, 61.5]) { const up = new THREE.Mesh(new THREE.BoxGeometry(0.15, 10, 0.6), new THREE.MeshBasicMaterial({ color: '#9b4dff', transparent: true, opacity: 0.55 })); up.position.set(x, 5, z); scene.add(up); }
    lamp('#f19bb0', 120, 40, 24, 12, -50); lamp('#a7d3ea', 120, 40, 48, 12, -50); lamp('#fff1d6', 60, 30, 36, 11, -64);
  }

  // Hyatt Regency Miami
  building(-26, 4, -62, -38, 63, '#e7dcc8', '#33465e', 2, null, 9);
  box(32, 3, 26, mat('#d9ccb5'), -11, 72, -50);
  const hyattSign = new THREE.Mesh(new THREE.PlaneGeometry(26, 4), new THREE.MeshBasicMaterial({ map: textTexture('hyatt', { text: 'THE PINK PALACE', font: '600 92px Inter, sans-serif', color: '#ffffff', glow: '#ffffff' }), transparent: true }));
  hyattSign.position.set(-11, 66, -37.8);
  scene.add(hyattSign);
  // podium + entrance canopy
  const canopyM = mat('#f4efe6');
  box(16, 0.5, 6, canopyM, -11, 4.4, -35.5);
  for (const [x, z] of [[-18.5, -32.8], [-3.5, -32.8]]) { box(0.5, 4.4, 0.5, canopyM, x, 0, z); addSolid(x - 0.3, x + 0.3, z - 0.3, z + 0.3, -1, 4.4); }
  // welcome sign under canopy
  const welcome = new THREE.Mesh(new THREE.PlaneGeometry(9, 1.3), new THREE.MeshBasicMaterial({ map: textTexture('welcome', { text: 'WELCOME TO GIRLY CITY', font: '96px Anton', color: '#ffffff', bg: '#f19bb0' }) }));
  welcome.position.set(-11, 5.25, -32.45);
  scene.add(welcome);

  // James L. Knight Center
  // React Miami banner on Knight Center
  const rmTex = textTexture('rmbanner', { text: 'GIRLY CITY ✿', font: '900 150px Inter, sans-serif', color: '#ffffff', bg: '#f6bccb' });
  const rmBanner = new THREE.Mesh(new THREE.PlaneGeometry(24, 9), new THREE.MeshBasicMaterial({ map: rmTex }));
  rmBanner.position.set(36, 8.6, -31.75);
  scene.add(rmBanner);
  buildInteriors(rmTex);
  buildStartupHQ();
  const sponsorTex = canvasTexture('diamond', 1024, 256, (ctx, w, h) => {
    ctx.fillStyle = '#0b0b0b'; ctx.fillRect(0, 0, w, h);
    ctx.font = '60px Anton'; ctx.fillStyle = '#ffffff'; ctx.textBaseline = 'middle';
    ctx.fillText('HOT GIRL SUMMER', 40, h / 2);
    drawNeonLogo(ctx, 560, 50, 420);
  });
  const sponsor = new THREE.Mesh(new THREE.PlaneGeometry(16, 4), new THREE.MeshBasicMaterial({ map: sponsorTex }));
  sponsor.position.set(36, 13, -31.75);
  scene.add(sponsor);

  // Neon billboard across the river (Brickell side)
  const bbTex = canvasTexture('billboard', 1024, 512, (ctx, w, h) => {
    ctx.fillStyle = '#0b0b0b'; ctx.fillRect(0, 0, w, h);
    drawNeonLogo(ctx, 74, 90, 640);
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff'; ctx.font = '600 58px Inter, sans-serif';
    ctx.fillText('Main character energy only', 74, 370);
    ctx.fillStyle = '#bdbdbd'; ctx.font = '400 44px Inter, sans-serif';
    ctx.fillText('Branch your database like your code.', 74, 440);
  });

  // ---------- towers ----------
  const palettes = [['#c9ccd1', '#1d3a52'], ['#d7dcd8', '#24505a'], ['#b8b2a8', '#3b3a3c'], ['#e4e6ea', '#2a4766'], ['#cdbfa8', '#4a3d2c'], ['#aeb6bf', '#1c2a38']];
  const trims = [NEON, null, null, null, null, null];
  const tr = rng(1234);
  const free = (x0, x1, z0, z1) => exclusions.every(([x, z, rad]) => x < x0 - rad || x > x1 + rad || z < z0 - rad || z > z1 + rad);
  const tower = (x0, x1, z0, z1, h) => {
    if (!free(x0, x1, z0, z1)) return null;
    const p = palettes[Math.floor(tr() * palettes.length)];
    return building(x0, x1, z0, z1, h, p[0], p[1], tr() < 0.3 ? 1 : 0, trims[Math.floor(tr() * trims.length)]);
  };
  for (let x = -280; x < 100; x += 34) for (let z = -290; z < -110; z += 34) {
    if (x + 26 > -62 && x < -26) continue;
    tower(x, x + 22 + tr() * 6, z, z + 22 + tr() * 6, 25 + tr() * 90);
  }
  for (const [x0, x1, z0, z1, h] of [[-140, -112, -78, -50, 82], [-190, -160, -78, -48, 60], [-240, -214, -78, -50, 40], [-280, -254, -78, -50, 70]]) tower(x0, x1, z0, z1, h);
  for (let x = -280; x < 100; x += 36) for (let z = 84; z < 290; z += 36) {
    if (x + 28 > -62 && x < -26) continue;
    const m = tower(x, x + 22 + tr() * 6, z, z + 22 + tr() * 6, 30 + tr() * 110);
    if (m && x > -30 && x < 40 && z < 100 && !m.userData.bb) {
      const bb = new THREE.Mesh(new THREE.PlaneGeometry(18, 9), new THREE.MeshBasicMaterial({ map: bbTex }));
      bb.position.set(m.position.x, 30, z - 0.3);
      bb.rotation.y = Math.PI;
      scene.add(bb);
      m.userData.bb = true;
    }
  }
  // Brickell Key
  tower(182, 200, 52, 72, 80); tower(206, 226, 60, 80, 95); tower(186, 206, 86, 106, 60);

  // ---------- palms ----------
  const palmTrunk = (() => {
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.3, 3, 0), new THREE.Vector3(0.9, 6, 0), new THREE.Vector3(1.6, 8.5, 0)]);
    return new THREE.TubeGeometry(curve, 10, 0.2, 6);
  })();
  const palmLeaves = (() => {
    const parts = [];
    for (let i = 0; i < 9; i++) {
      const g = new THREE.PlaneGeometry(0.9, 3.6, 1, 6);
      const pos = g.attributes.position;
      for (let v = 0; v < pos.count; v++) {
        const y = pos.getY(v) + 1.8;
        pos.setXYZ(v, pos.getX(v) * (1 - y / 4.2), y, -0.12 * y * y);
      }
      g.rotateX(-1.0);
      g.rotateY((i / 9) * Math.PI * 2);
      g.translate(1.6, 8.4, 0);
      parts.push(g);
    }
    return mergeGeometries(parts);
  })();
  const palmSpots = [];
  for (let x = -28; x < 68; x += 9) palmSpots.push([x, 9]);
  for (let x = -280; x < -60; x += 13) palmSpots.push([x, 9]);
  for (let x = -280; x < 68; x += 15) palmSpots.push([x, 67]);
  for (let i = 0; i < 30; i++) palmSpots.push([64 + tr() * 4, -82 + tr() * 86]);
  for (let i = 0; i < 18; i++) palmSpots.push([176 + tr() * 56, 44 + tr() * 4]);
  for (let z = -280; z < 300; z += 16) { palmSpots.push([-56, z]); palmSpots.push([-32, z]); }
  const palmsFiltered = palmSpots.filter(([x, z]) => !(z > 16 && z < 60 && x > -60 && x < -28) && !(x > -60 && x < -28 && z > -102 && z < -84));
  const trunkMesh = new THREE.InstancedMesh(palmTrunk, mat('#8a7560', { roughness: 1 }), palmsFiltered.length);
  const leafMesh = new THREE.InstancedMesh(palmLeaves, new THREE.MeshStandardMaterial({ color: '#4c7f2e', side: THREE.DoubleSide, roughness: 0.9 }), palmsFiltered.length);
  trunkMesh.castShadow = leafMesh.castShadow = true;
  const q = new THREE.Quaternion(), sv = new THREE.Vector3(), pv = new THREE.Vector3();
  palmsFiltered.forEach(([x, z], i) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), tr() * Math.PI * 2);
    const s = 0.8 + tr() * 0.5;
    m4.compose(pv.set(x, 0, z), q, sv.set(s, s, s));
    trunkMesh.setMatrixAt(i, m4);
    leafMesh.setMatrixAt(i, m4);
  });
  scene.add(trunkMesh, leafMesh);
  updaters.push((t) => { leafMesh.rotation.z = Math.sin(t * 0.8) * 0.003; });

  // ---------- Neon booth ----------
  const [bx, bz] = BOOTH_SPOT;
  box(12, 0.15, 8, mat('#111'), bx, 0, bz - 4);
  box(12, 4.5, 0.4, mat('#0b0b0b'), bx, 0, bz - 7.8);
  addSolid(bx - 6, bx + 6, bz - 8.1, bz - 7.5, -1, 4.5);
  const boothSign = new THREE.Mesh(new THREE.PlaneGeometry(7, 2.6), new THREE.MeshBasicMaterial({ map: neonLogo(NEON), transparent: true }));
  boothSign.position.set(bx, 3, bz - 7.55);
  scene.add(boothSign);
  const strip = new THREE.MeshBasicMaterial({ color: NEON });
  for (const x of [-6, 6]) box(0.15, 4.5, 0.15, strip, bx + x, 0, bz - 7.6);
  box(12, 0.15, 0.15, strip, bx, 4.5, bz - 7.6);
  box(8, 1, 1.1, mat('#1a1a1a'), bx, 0, bz - 3.4);
  box(8, 0.06, 1.15, strip, bx, 1, bz - 3.4);
  addSolid(bx - 4, bx + 4, bz - 3.95, bz - 2.85, -1, 1);
  // swag on table
  for (let i = 0; i < 6; i++) {
    const item = new THREE.Mesh(i % 2 ? new THREE.CylinderGeometry(0.12, 0.1, 0.24, 12) : new THREE.BoxGeometry(0.5, 0.08, 0.4), mat(i % 3 === 0 ? NEON : '#1a1a1a'));
    item.position.set(bx - 3 + i * 1.2, 1.1 + (i % 2 ? 0.08 : 0.02), bz - 3.4);
    scene.add(item);
  }
  const boothLight = new THREE.PointLight(NEON, 30, 14);
  boothLight.position.set(bx, 3, bz - 5);
  scene.add(boothLight);

  // registration desk
  const [rx, rz] = REBECCA_SPOT;
  box(4, 1.1, 1.2, mat('#ffffff'), rx - 5, 0, rz - 1);
  addSolid(rx - 7, rx - 3, rz - 1.6, rz - 0.4, -1, 1.1);
  const regSign = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.8), new THREE.MeshBasicMaterial({ map: textTexture('reg', { text: 'REGISTRATION', font: '110px Anton', color: '#ffffff', bg: '#4a3138' }) }));
  regSign.position.set(rx - 5, 1.6, rz - 0.38);
  scene.add(regSign);

  // ---------- dock & yacht ----------
  const DOCK_X1 = YACHT.x - 11;
  box(DOCK_X1 - 70, 0.3, 4, wood, (70 + DOCK_X1) / 2, 0, 10);
  addRegion(70, DOCK_X1, 8, 12, 0.3);
  mapShapes.push({ type: 'dock', x0: 70, x1: DOCK_X1, z0: 8, z1: 12 });
  for (let x = 72; x < DOCK_X1; x += 4) for (const z of [8.1, 11.9]) box(0.3, 1.6, 0.3, mat('#6b4f35'), x, -1.2, z);
  const yacht = buildYacht(scene, wood, updaters);
  const { x: yx, z: yz } = YACHT;
  addRegion(DOCK_X1, yx - 8.5, 8.8, 11.2, 0, { axis: 'x', h0: 0.3, h1: 1.6 });
  addRegion(yx - 8.5, yx + 8.5, yz - 13, yz + 21, 1.6);
  addRegion(yx - 5, yx + 5, yz - 19, yz - 13, 1.6);
  // stairs from the stern platform up to the party deck, so nobody gets trapped back there
  addRegion(yx - 1.6, yx + 1.6, yz - 18.6, yz - 14, 0, { axis: 'z', h0: 1.6, h1: 4.2 });
  for (let i = 0; i < 8; i++) box(3.2, 0.33 * (i + 1), 0.58, wood, yx, 1.6, yz - 18.3 + i * 0.575);
  addSolid(yx - 6, yx + 6, yz - 14, yz + 4, 1.0, 3.9);
  addRegion(yx - 6, yx + 6, yz - 14, yz + 4, 4.2);
  addRegion(yx - 1.6, yx + 1.6, yz + 4, yz + 12, 0, { axis: 'z', h0: 4.2, h1: 1.6 });
  mapShapes.push({ type: 'yacht', x0: yx - 9, x1: yx + 9, z0: yz - 23, z1: yz + 23 });

  // moored yacht on the river right outside the Hyatt
  const ry = new THREE.Group();
  const hullW = mat('#f4f4f2', { roughness: 0.35, envMapIntensity: 0.8 });
  const rh = new THREE.Mesh(new THREE.BoxGeometry(18, 2, 5.4), hullW); rh.position.y = 0.2; ry.add(rh);
  const bow = new THREE.Mesh(new THREE.CylinderGeometry(2.7, 2.7, 2, 3, 1, false, 0, Math.PI), hullW); bow.rotation.y = Math.PI / 2; bow.scale.set(1, 1, 1.6); bow.position.set(9, 0.2, 0); ry.add(bow);
  const band = new THREE.Mesh(new THREE.BoxGeometry(18.1, 0.25, 5.5), mat(NEON)); band.position.y = -0.55; ry.add(band);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(9, 1.8, 4.2), hullW); cab.position.set(-1, 2.1, 0); ry.add(cab);
  const win = new THREE.Mesh(new THREE.BoxGeometry(9.05, 0.7, 4.25), mat('#14202b', { roughness: 0.05, metalness: 0.8 })); win.position.set(-1, 2.3, 0); ry.add(win);
  const fly = new THREE.Mesh(new THREE.BoxGeometry(5, 0.9, 3.6), hullW); fly.position.set(-2, 3.4, 0); ry.add(fly);
  const ryName = new THREE.Mesh(new THREE.PlaneGeometry(5, 0.8), new THREE.MeshBasicMaterial({ map: textTexture('ryname', { text: 'BRANCH & BOUJEE', font: '700 90px Inter, sans-serif', color: '#0b0b0b' }), transparent: true }));
  ryName.position.set(-5, 0.5, -2.72); ryName.rotation.y = Math.PI; ry.add(ryName);
  ry.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  ry.position.set(-11, -0.3, 23);
  scene.add(ry);
  updaters.push((t) => { ry.position.y = -0.3 + Math.sin(t * 0.8) * 0.06; ry.rotation.z = Math.sin(t * 0.6) * 0.012; });
  mapShapes.push({ type: 'yacht', x0: -20, x1: -2, z0: 20.3, z1: 25.7 });

  // little river boat
  const boat = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.8, 6), mat('#ffffff'));
  hull.position.y = -0.3; boat.add(hull);
  const stripeB = new THREE.Mesh(new THREE.BoxGeometry(2.25, 0.2, 6.05), mat('#f19bb0'));
  stripeB.position.y = -0.1; boat.add(stripeB);
  scene.add(boat);
  updaters.push((t) => {
    const s = ((t * 10) % 520) - 260;
    boat.position.set(s, -0.3 + Math.sin(t * 2) * 0.05, 30);
    boat.rotation.y = Math.PI / 2;
  });

  // ---------- swag crates ----------
  const crateMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a', emissive: NEON, emissiveIntensity: 0.35, map: canvasTexture('crate', 256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#121212'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = NEON; ctx.lineWidth = 14; ctx.strokeRect(7, 7, w - 14, h - 14);
    drawNeonMark(ctx, 68, 68, 120, NEON);
  }) });
  const beamMat = new THREE.MeshBasicMaterial({ color: NEON, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending });
  const crates = SWAG_SPOTS.map(([x, y, z], i) => {
    const g = new THREE.Group();
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), crateMat);
    c.castShadow = true;
    g.add(c);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 40, 12, 1, true), beamMat);
    beam.position.y = 20;
    g.add(beam);
    g.position.set(x, y + 0.8, z);
    scene.add(g);
    return { g, c, i, x, y, z };
  });
  updaters.push((t) => {
    for (const cr of crates) {
      cr.c.rotation.y = t * 1.5 + cr.i;
      cr.c.position.y = Math.sin(t * 2 + cr.i) * 0.15;
    }
  });

  // ---------- physics helpers ----------
  const STEP = 0.75;
  function heightAt(x, z, y) {
    let best = null;
    for (const r of regions) {
      if (x < r.x0 || x > r.x1 || z < r.z0 || z > r.z1) continue;
      let h = r.h;
      if (r.ramp) {
        const t = r.ramp.axis === 'x' ? (x - r.x0) / (r.x1 - r.x0) : (z - r.z0) / (r.z1 - r.z0);
        h = r.ramp.h0 + (r.ramp.h1 - r.ramp.h0) * t;
      }
      if (h <= y + STEP && (best === null || h > best)) best = h;
    }
    return best;
  }
  function collide(p, radius, extra = []) {
    const list = solids.concat(extra);
    for (const s of list) {
      if (p.y + 1.7 < s.y0 || p.y > s.y1 - 0.05) continue;
      const cx = Math.max(s.x0, Math.min(p.x, s.x1));
      const cz = Math.max(s.z0, Math.min(p.z, s.z1));
      const dx = p.x - cx, dz = p.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= radius * radius) continue;
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2);
        p.x = cx + (dx / d) * radius;
        p.z = cz + (dz / d) * radius;
      } else {
        const pen = [p.x - s.x0, s.x1 - p.x, p.z - s.z0, s.z1 - p.z];
        const m = Math.min(...pen);
        if (m === pen[0]) p.x = s.x0 - radius; else if (m === pen[1]) p.x = s.x1 + radius;
        else if (m === pen[2]) p.z = s.z0 - radius; else p.z = s.z1 + radius;
      }
    }
  }
  function carSolids() {
    return cars.map((c) => {
      const hw = c.axis === 'z' ? 1.05 : 2.25, hd = c.axis === 'z' ? 2.25 : 1.05;
      const x = c.g.position.x, z = c.g.position.z;
      return { x0: x - hw, x1: x + hw, z0: z - hd, z1: z + hd, y0: -1, y1: 1.6 };
    });
  }

  return {
    sun, regions, solids, mapShapes, crates, cars, yacht, buildingMeshes,
    heightAt, collide, carSolids,
    update(t, dt, player) {
      for (const u of updaters) u(t, dt, player);
      if (player) {
        sun.position.set(player.x + SUN_OFF.x, player.y + SUN_OFF.y, player.z + SUN_OFF.z);
        sun.target.position.set(player.x, player.y, player.z);
      }
    },
  };
}

function buildYacht(scene, wood, updaters) {
  const { x: yx, z: yz } = YACHT;
  const g = new THREE.Group();
  g.position.set(yx, 0, yz);
  scene.add(g);
  const shape = new THREE.Shape();
  shape.moveTo(-9, -23);
  shape.lineTo(9, -23);
  shape.lineTo(9, 10);
  shape.quadraticCurveTo(8.5, 18, 0, 25);
  shape.quadraticCurveTo(-8.5, 18, -9, 10);
  shape.closePath();
  const hullGeo = (depth, y, scale = 1) => {
    const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
    geo.rotateX(-Math.PI / 2);
    geo.scale(scale, 1, scale);
    geo.translate(0, y, 0);
    return geo;
  };
  // shape y -> world -z, so bow (+25) is at z = -25
  const hull = new THREE.Mesh(hullGeo(2.6, -1.0), mat('#e9e9ea', { roughness: 0.45, envMapIntensity: 0.5 }));
  hull.castShadow = hull.receiveShadow = true;
  g.add(hull);
  g.add(new THREE.Mesh(hullGeo(0.35, 0.6, 1.004), mat('#4a3138')));
  g.add(new THREE.Mesh(hullGeo(0.25, -0.55, 1.008), new THREE.MeshBasicMaterial({ color: NEON })));
  const deck = new THREE.Mesh(hullGeo(0.08, 1.55, 0.97), new THREE.MeshStandardMaterial({ map: wood.map, roughness: 0.8 }));
  deck.receiveShadow = true;
  g.add(deck);
  // cabin
  const glassM = mat('#1d2a3a', { metalness: 0.8, roughness: 0.1 });
  const cab = new THREE.Mesh(new THREE.BoxGeometry(12, 2.6, 18), mat('#ffffff', { roughness: 0.3 }));
  cab.position.set(0, 1.6 + 1.3, -5);
  cab.castShadow = true;
  g.add(cab);
  for (const x of [-6.02, 6.02]) {
    const w = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.1, 15), glassM);
    w.position.set(x, 3.1, -5);
    g.add(w);
  }
  const aftGlass = new THREE.Mesh(new THREE.BoxGeometry(8, 1.8, 0.05), glassM);
  aftGlass.position.set(-2, 2.7, 4.02);
  g.add(aftGlass);
  // upper deck floor
  const ud = new THREE.Mesh(new THREE.BoxGeometry(12.4, 0.12, 18.4), new THREE.MeshStandardMaterial({ map: wood.map }));
  ud.position.set(0, 4.2, -5);
  ud.receiveShadow = true;
  g.add(ud);
  // stairs
  for (let i = 0; i < 10; i++) {
    const st = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.12, 0.8), mat('#ffffff'));
    st.position.set(0, 1.6 + (2.6 * (10 - i)) / 10, 4 + i * 0.8 + 0.4);
    g.add(st);
  }
  // hardtop
  const top = new THREE.Mesh(new THREE.BoxGeometry(11, 0.25, 8), mat('#ffffff'));
  top.position.set(0, 6.8, -10);
  top.castShadow = true;
  g.add(top);
  for (const [x, z] of [[-5, -13.5], [5, -13.5], [-5, -6.5], [5, -6.5]]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.6, 6), mat('#dddddd', { metalness: 0.8 }));
    p.position.set(x, 5.5, z);
    g.add(p);
  }
  const radar = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.1, 0.3), mat('#ffffff'));
  radar.position.set(0, 7.3, -10);
  g.add(radar);
  updaters.push((t) => { radar.rotation.y = t * 2; });
  // DJ booth
  const dj = new THREE.Mesh(new THREE.BoxGeometry(3, 1.1, 1), mat('#111'));
  dj.position.set(0, 4.8, -12.5);
  g.add(dj);
  const djFront = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 0.9), new THREE.MeshBasicMaterial({ map: neonLogo(NEON, '#111') }));
  djFront.position.set(0, 4.8, -11.99);
  g.add(djFront);
  // hull text
  const nameTex = textTexture('yachtname', { text: 'BESTIE BOAT', font: '150px Anton', color: '#4a3138' });
  for (const side of [-1, 1]) {
    const n = new THREE.Mesh(new THREE.PlaneGeometry(10, 2.5), new THREE.MeshBasicMaterial({ map: nameTex, transparent: true }));
    n.position.set(side * 9.03, 0.0, -2);
    n.rotation.y = side * Math.PI / 2;
    g.add(n);
  }
  // dance floor on aft deck
  const tiles = new THREE.InstancedMesh(new THREE.BoxGeometry(1.6, 0.05, 1.6), new THREE.MeshBasicMaterial({ color: '#ffffff' }), 6 * 6);
  const m4 = new THREE.Matrix4();
  let k = 0;
  for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) tiles.setMatrixAt(k++, m4.makeTranslation(-4.8 + i * 1.7 + 0.85, 1.62, 8 + j * 1.7));
  g.add(tiles);
  const dcols = ['#f19bb0', '#a7d3ea', NEON, '#ffd98a', '#cdb9e6', '#4a3138'].map((c) => new THREE.Color(c));
  let last = -1;
  updaters.push((t) => {
    const beat = Math.floor(t * 2.5);
    if (beat === last) return;
    last = beat;
    for (let i = 0; i < 36; i++) tiles.setColorAt(i, dcols[(i * 7 + beat * (i % 3 + 1)) % dcols.length]);
    tiles.instanceColor.needsUpdate = true;
  });
  // party lights
  const pl1 = new THREE.PointLight('#f19bb0', 40, 20);
  pl1.position.set(0, 4, 12);
  g.add(pl1);
  const pl2 = new THREE.PointLight('#a7d3ea', 40, 20);
  pl2.position.set(0, 4, 16);
  g.add(pl2);
  updaters.push((t) => {
    pl1.position.x = Math.sin(t * 2) * 5;
    pl2.position.x = Math.cos(t * 2.3) * 5;
  });
  // rails
  const railM = mat('#e8e8e8', { metalness: 0.9, roughness: 0.2 });
  for (const x of [-8.7, 8.7]) {
    const r = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 32), railM);
    r.position.set(x, 2.6, 5);
    g.add(r);
  }
  for (const x of [-6.1, 6.1]) {
    const r = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 18), railM);
    r.position.set(x, 5.2, -5);
    g.add(r);
  }
  // flag
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.4), new THREE.MeshBasicMaterial({ map: textTexture('flag', { text: 'REACT\nMIAMI', w: 256, h: 160, font: '60px Anton', color: '#fff', bg: '#f19bb0' }), side: THREE.DoubleSide }));
  flag.position.set(1.3, 9.2, 21);
  g.add(flag);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 7.6, 6), railM);
  mast.position.set(0, 5.8, 21);
  g.add(mast);
  updaters.push((t) => { flag.rotation.y = Math.sin(t * 3) * 0.2; });
  return g;
}
