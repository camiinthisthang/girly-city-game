import * as THREE from 'three';

const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, ...o });
export const WATER_Y = -0.7;
export const CAR_TYPES = [
  { name: 'Pink Convertible', color: '#f6bccb' },
  { name: 'Barbie GT', color: '#f19bb0' },
  { name: 'Peach Sorbet', color: '#ffb38a' },
  { name: 'Pearl', color: '#fff4fa' },
  { name: 'Lavender Haze', color: '#d9c9ee' },
];
export const SKI_COLORS = ['#a9d3b9', '#ff2d8a', '#a7d3ea', '#ffd98a'];

function shapeOf(points) {
  const s = new THREE.Shape();
  s.moveTo(points[0][0], points[0][1]);
  for (const p of points.slice(1)) s.lineTo(p[0], p[1]);
  s.closePath();
  return s;
}
function sideGeo(points, depth, bevel = 0.06) {
  const g = new THREE.ExtrudeGeometry(shapeOf(points), { depth, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 3 });
  g.rotateY(-Math.PI / 2);
  g.translate(depth / 2, 0, 0);
  g.computeVertexNormals();
  return g;
}
function topGeo(points, h, bevel = 0.08) {
  const g = new THREE.ExtrudeGeometry(shapeOf(points), { depth: h, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 3 });
  g.rotateX(-Math.PI / 2);
  g.computeVertexNormals();
  return g;
}

export function makeCar(color) {
  const g = new THREE.Group();
  g.rotation.order = 'YXZ';
  const paint = M(color, { metalness: 0.7, roughness: 0.18, envMapIntensity: 1.8 });
  const carbon = M('#101114', { metalness: 0.4, roughness: 0.35 });
  const black = M('#08080a', { roughness: 0.6 });
  const body = new THREE.Mesh(sideGeo([[-2.38, 0.3], [-2.42, 0.7], [-2.25, 0.86], [-1.55, 0.92], [-0.9, 0.95], [0.6, 0.9], [1.5, 0.66], [2.28, 0.46], [2.42, 0.36], [2.38, 0.3]], 1.96, 0.07), paint);
  body.castShadow = true;
  g.add(body);
  const glass = M('#06090d', { metalness: 0.95, roughness: 0.04, envMapIntensity: 2.2 });
  const cab = new THREE.Mesh(sideGeo([[-1.35, 0.9], [-0.6, 1.16], [0.2, 1.18], [1.05, 0.88]], 1.38, 0.05), glass);
  cab.castShadow = true;
  g.add(cab);
  const skirtG = new THREE.BoxGeometry(0.08, 0.14, 2.6);
  for (const x of [-1, 1]) {
    const skirt = new THREE.Mesh(skirtG, carbon); skirt.position.set(x * 1.04, 0.3, 0); g.add(skirt);
    const intake = new THREE.Mesh(sideGeo([[-0.5, 0.4], [-0.2, 0.78], [0.25, 0.8], [0.1, 0.42]], 0.1, 0.02), black);
    intake.position.set(x * 1.0, 0, -0.85); g.add(intake);
  }
  const splitter = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.05, 0.35), carbon); splitter.position.set(0, 0.28, 2.35); g.add(splitter);
  const diffuser = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.18, 0.3), carbon); diffuser.position.set(0, 0.36, -2.3); diffuser.rotation.x = -0.35; g.add(diffuser);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.05, 0.42), carbon); wing.position.set(0, 1.28, -2.05); wing.rotation.x = 0.1; g.add(wing);
  for (const x of [-1, 1]) {
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.2, 0.5), carbon); plate.position.set(x, 1.24, -2.05); g.add(plate);
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.36, 0.12), carbon); post.position.set(x * 0.55, 1.05, -2.0); g.add(post);
  }
  const stripeM = M('#0d0d0f', { metalness: 0.3, roughness: 0.3 });
  for (const x of [-0.18, 0.18]) {
    const s1 = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.02, 1.5), stripeM); s1.position.set(x, 0.9, 1.25); s1.rotation.x = 0.17; g.add(s1);
  }
  const head = M('#ffffff', { emissive: '#e8f4ff', emissiveIntensity: 3 });
  for (const x of [-1, 1]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.035, 0.06), head);
    h.position.set(x * 0.6, 0.6, 2.28); h.rotation.y = -x * 0.32; g.add(h);
    const drl = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 0.3), head);
    drl.position.set(x * 0.86, 0.56, 2.08); g.add(drl);
  }
  const tailM = M('#ff1030', { emissive: '#ff1030', emissiveIntensity: 3 });
  const tail = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.045, 0.05), tailM); tail.position.set(0, 0.78, -2.43); g.add(tail);
  const exM = M('#2a2a2e', { metalness: 1, roughness: 0.3 }), flame = M('#ff8a2a', { emissive: '#ff6a00', emissiveIntensity: 2 });
  for (const x of [-0.25, 0.25]) {
    const ex = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.2, 12).rotateX(Math.PI / 2), exM); ex.position.set(x, 0.42, -2.45); g.add(ex);
    const fl = new THREE.Mesh(new THREE.CircleGeometry(0.05, 12), flame); fl.position.set(x, 0.42, -2.56); fl.rotation.y = Math.PI; g.add(fl);
  }
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 4.6), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false }));
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 0.04;
  g.add(glow);
  const tireG = new THREE.CylinderGeometry(0.38, 0.38, 0.34, 24).rotateZ(Math.PI / 2);
  const rimG = new THREE.CylinderGeometry(0.27, 0.27, 0.35, 16).rotateZ(Math.PI / 2);
  const spokeG = new THREE.BoxGeometry(0.36, 0.05, 0.05);
  const tireM = M('#121212', { roughness: 0.85 }), rimM = M('#1c1d21', { metalness: 1, roughness: 0.2 }), spokeM = M('#d9dce2', { metalness: 1, roughness: 0.15 });
  const caliper = M(color === '#f2f2f2' ? '#ff2d8a' : '#ffd98a', { roughness: 0.4 });
  const wheels = [];
  for (const [x, z] of [[-0.95, 1.5], [0.95, 1.5], [-0.95, -1.45], [0.95, -1.45]]) {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.38, z);
    const w = new THREE.Group();
    w.add(new THREE.Mesh(tireG, tireM), new THREE.Mesh(rimG, rimM));
    for (let k = 0; k < 5; k++) {
      const sp = new THREE.Mesh(spokeG, spokeM);
      sp.rotation.x = (k / 5) * Math.PI;
      sp.rotation.y = Math.PI / 2;
      sp.position.x = Math.sign(x) * 0.18;
      sp.scale.set(1, 1, 1);
      w.add(sp);
    }
    pivot.add(w);
    const cal = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.14), caliper); cal.position.set(Math.sign(x) * 0.1, 0.12, 0); pivot.add(cal);
    g.add(pivot);
    wheels.push({ pivot, w, front: z > 0 });
  }
  g.userData.wheels = wheels;
  return g;
}

export function makeSki(color) {
  const g = new THREE.Group();
  g.rotation.order = 'YXZ';
  const paint = M(color, { metalness: 0.5, roughness: 0.2, envMapIntensity: 1.7 });
  const white = M('#f4f6f8', { metalness: 0.2, roughness: 0.25, envMapIntensity: 1.4 });
  const dark = M('#121317', { roughness: 0.6 });
  const hull = new THREE.Mesh(topGeo([[-0.48, 1.15], [0.48, 1.15], [0.58, 0.3], [0.5, -0.6], [0.22, -1.25], [0, -1.6], [-0.22, -1.25], [-0.5, -0.6], [-0.58, 0.3]], 0.26), white);
  hull.castShadow = true;
  g.add(hull);
  const top = new THREE.Mesh(topGeo([[-0.44, 1.05], [0.44, 1.05], [0.52, 0.3], [0.44, -0.55], [0.18, -1.15], [0, -1.45], [-0.18, -1.15], [-0.44, -0.55], [-0.52, 0.3]], 0.12, 0.05), paint);
  top.position.y = 0.3;
  g.add(top);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 1.9), dark); stripe.position.set(0, 0.49, -0.2); g.add(stripe);
  const cowl = new THREE.Mesh(sideGeo([[-1.45, 0.42], [-0.9, 0.62], [-0.45, 0.7], [-0.3, 0.45]], 0.7, 0.05), paint);
  cowl.position.z = 0; cowl.scale.z = -1; g.add(cowl);
  const shield = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.25), M('#0a0f16', { metalness: 0.9, roughness: 0.05, transparent: true, opacity: 0.85 }));
  shield.position.set(0, 0.85, 0.62); shield.rotation.x = -0.6; g.add(shield);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.16, 1.05), dark); seat.position.set(0, 0.56, -0.35); g.add(seat);
  const seatTrim = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.03, 1.07), paint); seatTrim.position.set(0, 0.5, -0.35); g.add(seatTrim);
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.78, 8).rotateZ(Math.PI / 2), dark); bar.position.set(0, 0.92, 0.32); g.add(bar);
  for (const x of [-0.36, 0.36]) { const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.14, 8).rotateZ(Math.PI / 2), M(color)); grip.position.set(x, 0.92, 0.32); g.add(grip); }
  const glowStrip = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.03, 0.03), M(color, { emissive: color, emissiveIntensity: 2 }));
  glowStrip.position.set(0, 0.2, 1.17); g.add(glowStrip);
  return g;
}

function rampMesh(scene, cx, cz, dir, run, rise, width) {
  const grp = new THREE.Group();
  const a = Math.atan2(rise, run), L = Math.hypot(run, rise);
  const top = new THREE.Mesh(new THREE.BoxGeometry(width, 0.16, L), M('#ffbf9b', { roughness: 0.5, emissive: '#ff4f00', emissiveIntensity: 0.15 }));
  top.rotation.x = -a;
  top.position.y = rise / 2;
  top.castShadow = top.receiveShadow = true;
  grp.add(top);
  const stripeM = M('#1b1b1b');
  for (let i = -2; i <= 2; i++) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.02, L * 0.92), stripeM);
    s.position.set(i * (width / 5), rise / 2 + 0.09, 0);
    s.rotation.x = -a;
    grp.add(s);
  }
  const sup = new THREE.Mesh(new THREE.BoxGeometry(width, rise, 0.4), M('#3a3a40'));
  sup.position.set(0, rise / 2, run / 2 - 0.2);
  grp.add(sup);
  grp.position.set(cx, 0, cz);
  grp.rotation.y = { '+z': 0, '-z': Math.PI, '+x': Math.PI / 2, '-x': -Math.PI / 2 }[dir];
  scene.add(grp);
}

export function createVehicles(scene, world) {
  const list = [];
  const fx = [];
  const puffG = new THREE.CircleGeometry(0.5, 10).rotateX(-Math.PI / 2);
  for (let i = 0; i < 70; i++) {
    const m = new THREE.Mesh(puffG, new THREE.MeshBasicMaterial({ color: '#fff', transparent: true, opacity: 0, depthWrite: false }));
    m.visible = false;
    scene.add(m);
    fx.push({ m, life: 0, max: 1 });
  }
  let fxi = 0, fxTimer = 0;
  const puff = (x, y, z, color, size, life) => {
    const p = fx[fxi++ % fx.length];
    p.m.position.set(x, y, z);
    p.m.material.color.set(color);
    p.m.scale.setScalar(size);
    p.m.visible = true;
    p.life = p.max = life;
  };

  const add = (kind, type, x, z, h) => {
    const g = kind === 'car' ? makeCar(CAR_TYPES[type].color) : makeSki(SKI_COLORS[type]);
    scene.add(g);
    const v = { kind, type, g, x, z, h, y: kind === 'car' ? 0 : WATER_Y, vx: 0, vz: 0, vy: 0, fwd: 0, steer: 0, air: false, airT: 0, name: kind === 'car' ? CAR_TYPES[type].name : 'Jet Ski' };
    pose(v, 0);
    list.push(v);
    return v;
  };

  const ramp = (cx, cz, dir, run = 12, rise = 2.4, width = 7) => {
    const ax = dir[1];
    const up = dir[0] === '+';
    const r = ax === 'x'
      ? { x0: cx - run / 2, x1: cx + run / 2, z0: cz - width / 2, z1: cz + width / 2 }
      : { x0: cx - width / 2, x1: cx + width / 2, z0: cz - run / 2, z1: cz + run / 2 };
    world.regions.push({ ...r, h: 0, ramp: { axis: ax, h0: up ? 0 : rise, h1: up ? rise : 0 } });
    rampMesh(scene, cx, cz, dir, run, rise, width);
  };

  CAR_TYPES.forEach((_, i) => add('car', i, -22 + i * 9, -80, Math.PI / 2));
  SKI_COLORS.forEach((_, i) => add('ski', i, 38 + i * 5, 24, Math.PI / 2));
  ramp(10, -135, '-z');
  ramp(40, -150, '-x', 14, 3);
  ramp(-10, -175, '+x');

  function pose(v, t) {
    v.g.position.set(v.x, v.kind === 'ski' && !v.air ? v.y + Math.sin(t * 2.2 + v.x * 0.3) * 0.05 : v.y, v.z);
    const pitch = v.kind === 'car' ? THREE.MathUtils.clamp(-Math.atan2(v.vy, Math.max(4, Math.abs(v.fwd))), -0.35, 0.35) : THREE.MathUtils.clamp(-v.vy * 0.05, -0.3, 0.3) - Math.min(0.12, Math.abs(v.fwd) * 0.004);
    v.g.rotation.set(pitch, v.h, -v.steer * Math.min(1, Math.abs(v.fwd) / 20) * (v.kind === 'car' ? 0.06 : 0.3));
  }

  const onWater = (x, z) => Math.abs(x) < 700 && Math.abs(z) < 700 && world.heightAt(x, z, 10) === null;

  function drive(v, dt, t, inp, onLand) {
    const isCar = v.kind === 'car';
    const fx0 = Math.sin(v.h), fz0 = Math.cos(v.h);
    const rx = -fz0, rz = fx0;
    let fwd = v.vx * fx0 + v.vz * fz0;
    let lat = v.vx * rx + v.vz * rz;
    const top = isCar ? (inp.boost ? 62 : 44) : (inp.boost ? 38 : 30);
    v.steer += (inp.steer - v.steer) * Math.min(1, dt * 8);
    if (!v.air) {
      if (inp.thr > 0) fwd += inp.thr * dt * (fwd < 0 ? 28 : (isCar ? (inp.boost ? 26 : 17) : (inp.boost ? 16 : 12)) * Math.max(0, 1 - fwd / top));
      else if (inp.thr < 0) fwd += inp.thr * dt * (fwd > 0 ? 30 : 9 * Math.max(0, 1 + fwd / (isCar ? 14 : 8)));
      else fwd *= Math.exp(-dt * (isCar ? 0.5 : 0.9));
      if (inp.brake && isCar) fwd *= Math.exp(-dt * 0.9);
      const turn = (isCar ? 2.1 : 2.6) / (1 + Math.abs(fwd) * (isCar ? 0.028 : 0.02));
      v.h -= v.steer * THREE.MathUtils.clamp(fwd / 5, -1, 1) * turn * (inp.brake ? 1.6 : 1) * dt;
      lat *= Math.exp(-dt * (isCar ? (inp.brake ? 1.1 : 7) : 2.5));
    }
    const fx1 = Math.sin(v.h), fz1 = Math.cos(v.h);
    v.vx = fx1 * fwd + -fz1 * lat;
    v.vz = fz1 * fwd + fx1 * lat;
    v.fwd = fwd;
    const nx = v.x + v.vx * dt, nz = v.z + v.vz * dt;
    if (isCar) {
      const gh = world.heightAt(nx, nz, v.y + 0.6);
      if (gh === null) { v.vx *= -0.3; v.vz *= -0.3; }
      else {
        const p = { x: nx, y: v.y, z: nz };
        world.collide(p, 1.15, world.carSolids());
        const pushed = Math.hypot(p.x - nx, p.z - nz);
        if (pushed > 0.02) { v.vx *= 0.55; v.vz *= 0.55; }
        if (world.heightAt(p.x, p.z, v.y + 0.6) !== null) { v.x = p.x; v.z = p.z; }
      }
      const g2 = world.heightAt(v.x, v.z, v.y + 0.6) ?? 0;
      if (!v.air) {
        if (g2 >= v.y - 0.45) { v.vy += ((g2 - v.y) / dt - v.vy) * 0.5; v.y = g2; }
        else { v.air = true; v.airT = 0; }
      }
      if (v.air) {
        v.airT += dt;
        v.vy -= 22 * dt;
        v.y += v.vy * dt;
        if (v.y <= g2) { v.y = g2; v.vy = 0; v.air = false; onLand?.(v.airT); }
      }
      if (Math.abs(lat) > 5 && !v.air) {
        fxTimer += dt;
        if (fxTimer > 0.04) { fxTimer = 0; for (const s of [-0.9, 0.9]) puff(v.x - fx1 * 1.5 + -fz1 * s, v.y + 0.2, v.z - fz1 * 1.5 + fx1 * s, '#d9d9d9', 1.2, 1.1); }
      }
      for (const w of v.g.userData.wheels) {
        w.w.rotation.x += (fwd * dt) / 0.36;
        if (w.front) w.pivot.rotation.y = -v.steer * 0.4;
      }
    } else {
      if (onWater(nx, nz)) { v.x = nx; v.z = nz; } else { v.vx *= -0.4; v.vz *= -0.4; }
      if (v.air) {
        v.airT += dt;
        v.vy -= 16 * dt;
        v.y += v.vy * dt;
        if (v.y <= WATER_Y) { v.y = WATER_Y; v.vy = 0; v.air = false; onLand?.(v.airT); for (let i = 0; i < 6; i++) puff(v.x + (Math.random() - 0.5) * 2, WATER_Y + 0.12, v.z + (Math.random() - 0.5) * 2, '#ffffff', 1.4, 0.9); }
      }
      if (Math.abs(fwd) > 4 && !v.air) {
        fxTimer += dt;
        if (fxTimer > 0.035) { fxTimer = 0; puff(v.x - fx1 * 1.4, WATER_Y + 0.08, v.z - fz1 * 1.4, '#ffffff', 0.8 + Math.abs(fwd) * 0.03, 1.4); }
      }
    }
    pose(v, t);
  }

  function hop(v) {
    if (v.kind === 'ski' && !v.air && Math.abs(v.fwd) > 6) { v.air = true; v.airT = 0; v.vy = 6.5; }
  }

  function update(dt, t) {
    for (const p of fx) {
      if (!p.m.visible) continue;
      p.life -= dt;
      if (p.life <= 0) { p.m.visible = false; continue; }
      const k = p.life / p.max;
      p.m.material.opacity = 0.55 * k;
      p.m.scale.multiplyScalar(1 + dt * 1.2);
      p.m.position.y += dt * 0.15;
    }
    for (const v of list) if (!v.driver && v.kind === 'ski') pose(v, t);
  }

  function nearest(p) {
    let best = null;
    for (const v of list) {
      if (v.driver) continue;
      const d = Math.hypot(p.x - v.x, p.z - v.z);
      const reach = v.kind === 'car' ? 3.4 : 7;
      if (d < reach && Math.abs(p.y - v.y) < 2.5 && (!best || d < best.d)) best = { v, d };
    }
    for (const c of world.cars) {
      const d = Math.hypot(p.x - c.g.position.x, p.z - c.g.position.z);
      if (d < 3.6 && p.y < 2 && (!best || d < best.d)) best = { traffic: c, d };
    }
    return best;
  }

  function hijack(c) {
    const i = world.cars.indexOf(c);
    if (i < 0) return null;
    world.cars.splice(i, 1);
    c.g.removeFromParent();
    const h = c.axis === 'z' ? (c.dir > 0 ? 0 : Math.PI) : (c.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    const v = add('car', Math.floor(Math.random() * CAR_TYPES.length), c.g.position.x, c.g.position.z, h);
    v.fwd = c.speed * 0.5;
    return v;
  }

  function exitSpot(v) {
    if (v.kind === 'car') {
      const fx1 = Math.sin(v.h), fz1 = Math.cos(v.h);
      for (const s of [1, -1]) {
        const x = v.x + fz1 * 2 * s, z = v.z - fx1 * 2 * s;
        const y = world.heightAt(x, z, v.y + 0.6);
        if (y !== null) return { x, y, z };
      }
      return { x: v.x, y: v.y + 1.2, z: v.z };
    }
    let best = null;
    for (let r = 1.5; r <= 9; r += 1.5) {
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        const x = v.x + Math.sin(a) * r, z = v.z + Math.cos(a) * r;
        const y = world.heightAt(x, z, 2.5);
        if (y !== null) { best = { x, y, z }; break; }
      }
      if (best) break;
    }
    return best;
  }

  const code = (v) => (v.kind === 'car' ? 10 : 20) + v.type;
  function remoteModel(c) {
    if (c >= 10 && c < 10 + CAR_TYPES.length) return makeCar(CAR_TYPES[c - 10].color);
    if (c >= 20 && c < 20 + SKI_COLORS.length) return makeSki(SKI_COLORS[c - 20]);
    return null;
  }

  return { list, drive, hop, update, nearest, hijack, exitSpot, code, remoteModel };
}
