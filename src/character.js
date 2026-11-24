import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import * as THREE from 'three';
import { NEON, neonLogo, hawaiianTexture, tattooTexture, canvasTexture, drawNeonMark } from './textures.js';
import { HUMANS, makeHuman, ensureHuman } from './humans.js';

export const OPTIONS = {
  outfit: [['signature', 'Signature look']],
  body: [['m', 'Marco'], ['f', 'Sofia'], ['m2', 'Dre'], ['m3', 'Kenji'], ['m4', 'Vic'], ['f2', 'Nia'], ['f3', 'Mei']],
  skin: ['#ffe0cc', '#f5c9a6', '#e0ac69', '#c68642', '#8d5524', '#5a3418'],
  hairStyle: [['short', 'Short'], ['long', 'Long waves'], ['bun', 'Top bun'], ['curly', 'Curls'], ['mohawk', 'Mohawk'], ['buzz', 'Buzz'], ['bald', 'Bald']],
  hairColor: ['#f4e7c5', '#e8c07a', '#b5651d', '#5a3825', '#1b1b1b', '#f19bb0', '#a9d3b9', '#cdb9e6', '#d9d9d9'],
  top: [['hawaiian', 'Hawaiian shirt'], ['blazer', 'Pastel blazer'], ['track', 'Track jacket'], ['tee', 'Plain tee'], ['tank', 'Tank top']],
  topColor: ['#f19bb0', '#a7d3ea', '#ffd98a', '#ffffff', '#1b1b1b', '#cdb9e6', '#ff7a3d', '#9be7c4'],
  bottom: [['jeans', 'Jeans'], ['shorts', 'Board shorts'], ['cargo', 'Cargo pants'], ['track', 'Track pants'], ['linen', 'Linen pants']],
  bottomColor: ['#2f4a7a', '#1b1b1b', '#e9dcc3', '#6b7a3a', '#f19bb0', '#a7d3ea', '#ffffff'],
  shoes: ['#ffffff', '#1b1b1b', '#a9d3b9', '#f19bb0', '#ffd98a', '#a7d3ea'],
  hat: [['none', 'None'], ['bucket', 'Bucket hat']],
  accent: ['#1b1b1b', '#ffffff', '#f19bb0', '#a7d3ea', '#ffd98a', '#cdb9e6'],
  glasses: [['none', 'None'], ['shades', 'Shades'], ['aviators', 'Aviators']],
  chain: [['none', 'None']],
  bag: [['none', 'None']],
};

export const DEFAULT_LOOK = {
  body: 'm', outfit: 'signature',
  skin: '#f5c9a6', hairStyle: 'short', hairColor: '#5a3825', top: 'hawaiian', topColor: '#f19bb0',
  bottom: 'jeans', bottomColor: '#2f4a7a', shoes: '#ffffff', hat: 'none', accent: '#1b1b1b',
  glasses: 'none', chain: 'none', bag: 'none', tattoo: false, piercing: false,
};

const COLOR_RE = /^#[0-9a-fA-F]{6}$/;
export function sanitizeLook(look) {
  const out = { ...DEFAULT_LOOK };
  if (!look || typeof look !== 'object') return out;
  for (const k of Object.keys(DEFAULT_LOOK)) {
    const v = look[k];
    if (typeof DEFAULT_LOOK[k] === 'boolean') { out[k] = v === true; continue; }
    if (typeof v !== 'string') continue;
    const opts = OPTIONS[k];
    if (!opts) continue;
    if (typeof opts[0] === 'string' ? COLOR_RE.test(v) : opts.some((o) => o[0] === v)) out[k] = v;
  }
  return out;
}

export function randomLook() {
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const L = {};
  for (const [k, opts] of Object.entries(OPTIONS)) {
    const valid = typeof opts[0] === 'string' ? opts : opts.filter((o) => o[2] !== 'locked').map((o) => o[0]);
    L[k] = pick(valid);
  }
  return sanitizeLook(L);
}

const mats = new Map();
export function mat(color, extra = {}) {
  const key = color + JSON.stringify(extra);
  if (!mats.has(key)) mats.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.75, ...extra }));
  return mats.get(key);
}
function texMat(tex, extra = {}) {
  const key = tex.uuid + JSON.stringify(extra);
  if (!mats.has(key)) mats.set(key, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75, ...extra }));
  return mats.get(key);
}
function neonMarkTex() {
  return canvasTexture('neon-mark-tee', 128, 128, (ctx) => { ctx.fillStyle = '#0c0c0e'; ctx.fillRect(0, 0, 128, 128); drawNeonMark(ctx, 14, 14, 100); });
}
function neonNightsPrint() {
  return canvasTexture('neon-nights-print', 512, 512, (ctx) => {
    const x0 = 56, y0 = 20, S = 400;
    const g = ctx.createLinearGradient(x0, 0, x0 + S, 0);
    g.addColorStop(0, '#5fe0a8'); g.addColorStop(1, '#2fae78');
    ctx.fillStyle = g; ctx.fillRect(x0, y0, S, S - 60);
    const palm = (bx, by, h, lean, k) => {
      ctx.strokeStyle = '#0d0d0d'; ctx.lineWidth = 9 * k; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo(bx + lean * 0.3, by - h * 0.5, bx + lean, by - h); ctx.stroke();
      const tx = bx + lean, ty = by - h;
      ctx.fillStyle = '#0d0d0d';
      for (let i = 0; i < 9; i++) {
        const a = -Math.PI + (i / 8) * Math.PI + (i % 2 ? 0.15 : -0.1), L = (90 + (i % 3) * 18) * k;
        const ex = tx + Math.cos(a) * L, ey = ty + Math.sin(a) * L * 0.55 + L * 0.35;
        ctx.beginPath(); ctx.moveTo(tx, ty);
        ctx.quadraticCurveTo((tx + ex) / 2, ty - 30 * k, ex, ey);
        ctx.quadraticCurveTo((tx + ex) / 2, ty - 6 * k, tx, ty + 6 * k);
        ctx.fill();
      }
    };
    palm(250, 360, 250, -30, 1.05);
    palm(330, 360, 190, 25, 0.8);
    ctx.fillStyle = '#0d0d0d';
    for (let y = y0 + 12; y < y0 + S - 60; y += 16) {
      const w = 6 * Math.max(0, (y - y0 - 40) / (S - 100));
      ctx.fillRect(x0 + S * 0.62, y, S * 0.38, w * 0.9 + 1);
    }
    ctx.clearRect(x0 + S - 4, y0, 8, S);
    drawNeonMark(ctx, x0 + 10, 410, 48);
    ctx.fillStyle = '#ffffff'; ctx.font = '600 50px ui-monospace, Menlo, monospace'; ctx.textBaseline = 'middle';
    ctx.fillText('NEON NIGHTS', x0 + 74, 436);
  });
}

function decalMat(tex) {
  const key = 'decal' + tex.uuid;
  if (!mats.has(key)) mats.set(key, new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.3, roughness: 0.6 }));
  return mats.get(key);
}

const G = {
  capsule: (r, l) => cachedGeo(`cap${r}${l}`, () => new THREE.CapsuleGeometry(r, l, 6, 12)),
  sphere: (r) => cachedGeo(`sph${r}`, () => new THREE.SphereGeometry(r, 18, 14)),
  box: (x, y, z) => cachedGeo(`box${x}${y}${z}`, () => new THREE.BoxGeometry(x, y, z)),
  plane: (x, y) => cachedGeo(`pl${x}${y}`, () => new THREE.PlaneGeometry(x, y)),
};
const geos = new Map();
function cachedGeo(k, f) { if (!geos.has(k)) geos.set(k, f()); return geos.get(k); }

function mesh(geo, material, x = 0, y = 0, z = 0, parent) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  if (parent) parent.add(m);
  return m;
}

const HEAD_Y = 1.66;

export class Character {
  constructor(look, opts = {}) {
    this.root = new THREE.Group();
    this.body = new THREE.Group();
    this.root.add(this.body);
    this.phase = 0;
    this.t = Math.random() * 10;
    this.opts = opts;
    this.setLook(look);
    if (opts.name) this.setName(opts.name, opts.subtitle, opts.tagColor);
  }

  setName(name, subtitle, color = '#ffffff') {
    if (this.tag) this.root.remove(this.tag);
    const tex = canvasTexture(`tag${name}|${subtitle}|${color}|${Math.random()}`, 512, 160, (ctx, w, h) => {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '700 54px Inter, sans-serif';
      ctx.lineWidth = 10;
      ctx.strokeStyle = 'rgba(0,0,0,0.85)';
      ctx.strokeText(name, w / 2, subtitle ? 56 : 80);
      ctx.fillStyle = color;
      ctx.fillText(name, w / 2, subtitle ? 56 : 80);
      if (subtitle) {
        ctx.font = '400 40px Anton, sans-serif';
        ctx.strokeText(subtitle, w / 2, 118);
        ctx.fillStyle = NEON;
        ctx.fillText(subtitle, w / 2, 118);
      }
    });
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false, transparent: true }));
    s.scale.set(1.9, 0.6, 1);
    s.position.y = 2.35;
    s.renderOrder = 10;
    this.tag = s;
    this.root.add(s);
  }

  say(text) {
    if (this.bubble) { this.root.remove(this.bubble); this.bubble.material.map.dispose(); this.bubble.material.dispose(); }
    const c = document.createElement('canvas');
    c.width = 512; c.height = 192;
    const ctx = c.getContext('2d');
    ctx.font = '600 30px Inter, sans-serif';
    const words = text.split(' ');
    const lines = [];
    let cur = '';
    for (const w of words) {
      const test = cur ? cur + ' ' + w : w;
      if (ctx.measureText(test).width > 440 && cur) { lines.push(cur); cur = w; } else cur = test;
    }
    lines.push(cur);
    const shown = lines.slice(0, 4);
    const bh = shown.length * 36 + 28;
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath();
    ctx.roundRect(16, 192 - bh - 16, 480, bh, 18);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(240, 176); ctx.lineTo(272, 176); ctx.lineTo(256, 192);
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    shown.forEach((l, i) => ctx.fillText(l, 256, 192 - bh - 16 + 32 + i * 36));
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false, transparent: true }));
    s.scale.set(2.6, 0.975, 1);
    s.position.y = 3.05;
    s.renderOrder = 11;
    this.bubble = s;
    this.bubbleUntil = this.t + 7;
    this.root.add(s);
  }

  setLook(look) {
    this.look = sanitizeLook(look);
    this.body.clear();
    this.human = null;
    this.build(this.look);
  }

  build(L) {
    if (HUMANS.ready) return this.buildHuman(L);
    const b = this.body;
    const skin = mat(L.skin);
    let torsoMat, upperMat, lowerMat, decal = null, hood = false, stripes = null, inner = null;
    switch (L.top) {
      case 'neon-hoodie': torsoMat = upperMat = lowerMat = mat('#1a1a1a'); decal = neonLogo(NEON); hood = true; break;
      case 'neon-tee': torsoMat = upperMat = mat(NEON); lowerMat = skin; decal = neonLogo('#0b0b0b'); break;
      case 'hawaiian': torsoMat = upperMat = texMat(hawaiianTexture(L.topColor)); lowerMat = skin; break;
      case 'blazer': torsoMat = upperMat = lowerMat = mat(L.topColor); inner = mat('#ffffff'); break;
      case 'track': torsoMat = upperMat = lowerMat = mat(L.topColor); stripes = mat('#ffffff'); break;
      case 'tank': torsoMat = mat(L.topColor); upperMat = lowerMat = skin; break;
      case 'diamond': torsoMat = upperMat = lowerMat = mat('#e8fbff', { metalness: 0.7, roughness: 0.15, emissive: '#1b4d5c', emissiveIntensity: 0.4 }); decal = neonLogo(NEON); hood = true; break;
      default: torsoMat = upperMat = mat(L.topColor); lowerMat = skin;
    }
    if (L.tattoo && upperMat === skin) upperMat = texMat(tattooTexture(L.skin));

    // torso
    const torso = mesh(G.capsule(0.2, 0.26), torsoMat, 0, 1.24, 0, b);
    torso.scale.set(1.22, 1.05, 0.64);
    if (decal) {
      const d = mesh(G.plane(0.26, 0.1), decalMat(decal), 0, 1.33, 0.137, b);
      d.castShadow = false;
    }
    if (inner) {
      const s = mesh(G.box(0.12, 0.4, 0.02), inner, 0, 1.28, 0.125, b);
      s.castShadow = false;
    }
    if (hood) {
      const h = mesh(new THREE.TorusGeometry(0.13, 0.05, 8, 16), torsoMat, 0, 1.5, -0.06, b);
      h.rotation.x = Math.PI / 2.4;
    }
    // pelvis
    const pantsCol = L.bottom === 'neon-joggers' ? '#1a1a1a' : L.bottom === 'linen' && L.bottomColor === '#2f4a7a' ? '#efe6d6' : L.bottomColor;
    const pants = mat(pantsCol);
    mesh(G.box(0.36, 0.16, 0.22), pants, 0, 0.94, 0, b);
    // neck & head
    mesh(G.capsule(0.052, 0.08), skin, 0, 1.54, 0, b);
    const head = new THREE.Group();
    head.position.y = HEAD_Y;
    head.scale.setScalar(0.78);
    b.add(head);
    this.head = head;
    const skull = mesh(G.sphere(0.15), skin, 0, 0, 0, head);
    skull.scale.set(1, 1.13, 1.02);
    const eyeM = mat('#141414');
    mesh(G.sphere(0.013), eyeM, -0.05, 0.02, 0.138, head);
    mesh(G.sphere(0.013), eyeM, 0.05, 0.02, 0.138, head);
    mesh(G.box(0.05, 0.008, 0.01), mat('#3a2a20'), -0.05, 0.05, 0.142, head);
    mesh(G.box(0.05, 0.008, 0.01), mat('#3a2a20'), 0.05, 0.05, 0.142, head);
    mesh(G.sphere(0.022), skin, 0, -0.02, 0.152, head);
    const mouth = mesh(new THREE.TorusGeometry(0.03, 0.007, 4, 10, Math.PI), mat('#7a2a2a'), 0, -0.07, 0.136, head);
    mouth.rotation.z = Math.PI;
    if (L.piercing) {
      const ring = mesh(new THREE.TorusGeometry(0.014, 0.003, 4, 10), mat('#d9d9d9', { metalness: 1, roughness: 0.2 }), 0, -0.042, 0.158, head);
      ring.rotation.x = 0.3;
    }
    this.buildHair(head, L);
    this.buildHat(head, L);
    this.buildGlasses(head, L);

    // arms
    const mkArm = (side) => {
      const p = new THREE.Group();
      p.position.set(side * 0.27, 1.43, 0);
      b.add(p);
      mesh(G.capsule(0.068, 0.2), upperMat, 0, -0.14, 0, p);
      mesh(G.capsule(0.058, 0.2), lowerMat, 0, -0.4, 0, p);
      mesh(G.sphere(0.06), skin, 0, -0.58, 0.01, p);
      if (stripes) {
        mesh(G.box(0.02, 0.48, 0.02), stripes, side * 0.065, -0.27, 0, p).castShadow = false;
      }
      return p;
    };
    this.armL = mkArm(1);
    this.armR = mkArm(-1);
    // legs
    const shorts = L.bottom === 'shorts';
    const mkLeg = (side) => {
      const p = new THREE.Group();
      p.position.set(side * 0.1, 0.92, 0);
      b.add(p);
      mesh(G.capsule(0.088, 0.28), pants, 0, -0.2, 0, p);
      mesh(G.capsule(0.074, 0.3), shorts ? skin : pants, 0, -0.56, 0, p);
      if (L.bottom === 'cargo') mesh(G.box(0.05, 0.12, 0.12), pants, side * 0.09, -0.26, 0, p);
      if (L.bottom === 'track' || L.bottom === 'neon-joggers') {
        mesh(G.box(0.02, 0.7, 0.02), mat(L.bottom === 'track' ? '#ffffff' : NEON), side * 0.086, -0.38, 0, p).castShadow = false;
      }
      const shoe = mesh(G.capsule(0.06, 0.15), mat(L.shoes), 0, -0.855, 0.04, p); shoe.rotation.x = Math.PI / 2; shoe.scale.set(1.05, 1, 0.8);
      mesh(G.box(0.12, 0.025, 0.27), mat('#f2f2f2'), 0, -0.9, 0.04, p);
      return p;
    };
    this.legL = mkLeg(1);
    this.legR = mkLeg(-1);

    // accessories
    if (L.chain === 'gold') {
      const c = mesh(new THREE.TorusGeometry(0.11, 0.012, 6, 24), mat('#e6b422', { metalness: 1, roughness: 0.25 }), 0, 1.46, 0.04, b);
      c.rotation.x = Math.PI / 2.3;
    } else if (L.chain === 'neon') {
      const strap = mat(NEON, { emissive: NEON, emissiveIntensity: 0.25 });
      const l1 = mesh(G.box(0.025, 0.3, 0.01), strap, -0.07, 1.39, 0.135, b); l1.rotation.z = -0.25;
      const l2 = mesh(G.box(0.025, 0.3, 0.01), strap, 0.07, 1.39, 0.135, b); l2.rotation.z = 0.25;
      const badge = mesh(G.box(0.12, 0.16, 0.01), texMat(badgeTex()), 0, 1.18, 0.145, b);
      badge.castShadow = false;
    }
    if (L.bag === 'neon') {
      mesh(G.box(0.3, 0.38, 0.14), mat('#1a1a1a'), 0, 1.26, -0.2, b);
      const d = mesh(G.plane(0.24, 0.09), decalMat(neonLogo(NEON)), 0, 1.3, -0.272, b);
      d.rotation.y = Math.PI;
      d.castShadow = false;
    }
  }

  buildHair(head, L) {
    const hm = mat(L.hairColor, { roughness: 0.9 });
    const style = L.hairStyle;
    if (style === 'bald') return;
    const capR = style === 'buzz' ? 0.153 : 0.162;
    const cap = mesh(new THREE.SphereGeometry(capR, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.56), hm, 0, 0.01, -0.005, head);
    cap.scale.set(1, 1.13, 1.04);
    cap.rotation.x = -0.32;
    if (style === 'long') {
      const back = mesh(G.capsule(0.15, 0.26), hm, 0, -0.17, -0.06, head);
      back.scale.set(1.08, 1, 0.55);
      mesh(G.capsule(0.05, 0.26), hm, -0.14, -0.16, 0.03, head);
      mesh(G.capsule(0.05, 0.26), hm, 0.14, -0.16, 0.03, head);
    } else if (style === 'bun') {
      mesh(G.sphere(0.08), hm, 0, 0.19, -0.06, head);
    } else if (style === 'curly') {
      for (let i = 0; i < 22; i++) {
        const a = (i / 22) * Math.PI * 2;
        const ring = i % 2;
        mesh(G.sphere(0.06), hm, Math.cos(a) * 0.15, 0.06 + ring * 0.08 - (Math.sin(a) > 0.4 ? 0.06 : 0), Math.sin(a) * 0.14 - 0.02, head);
      }
      mesh(G.sphere(0.1), hm, 0, 0.15, -0.02, head);
    } else if (style === 'mohawk') {
      cap.visible = false;
      for (let i = 0; i < 5; i++) mesh(G.box(0.04, 0.1, 0.06), hm, 0, 0.17 - Math.abs(i - 1.5) * 0.02, 0.1 - i * 0.055, head);
    }
  }

  buildHat(head, L) {
    if (L.hat === 'none') return;
    if (L.hat === 'neon-nights') {
      const g = new THREE.Group();
      head.add(g);
      const black = mat('#141414', { roughness: 0.65 });
      const crown = mesh(new THREE.SphereGeometry(0.168, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), black, 0, 0.045, 0, g);
      crown.scale.set(1, 0.92, 1.08);
      const print = mesh(new THREE.SphereGeometry(0.1712, 18, 10, Math.PI / 2 - 0.5, 1.0, 0.42, 0.95), decalMat(neonNightsPrint()), 0, 0.045, 0, g);
      print.scale.copy(crown.scale);
      print.castShadow = false;
      const brim = mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.016, 24, 1, false, -Math.PI / 2, Math.PI), black, 0, 0.05, 0.145, g);
      brim.scale.set(1.15, 1, 0.95);
      brim.rotation.x = 0.14;
      const btn = mesh(new THREE.SphereGeometry(0.014, 8, 6), black, 0, 0.045 + 0.168 * 0.92, 0, g);
      btn.castShadow = false;
    } else if (L.hat === 'neon-cap' || L.hat === 'backwards') {
      const g = new THREE.Group();
      head.add(g);
      const neon = L.hat === 'neon-cap';
      const crownM = neon ? mat('#1a1a1a') : mat(L.accent);
      const crown = mesh(new THREE.SphereGeometry(0.168, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), crownM, 0, 0.06, 0, g);
      crown.scale.set(1, 0.8, 1.05);
      const brim = mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.014, 20, 1, false, -Math.PI / 2, Math.PI), neon ? mat(NEON) : crownM, 0, 0.065, 0.13, g);
      brim.scale.set(1.2, 1, 1);
      if (neon) {
        const d = mesh(G.plane(0.14, 0.055), decalMat(neonLogo(NEON)), 0, 0.15, 0.155, g);
        d.rotation.x = -0.45;
        d.castShadow = false;
      }
      if (L.hat === 'backwards') g.rotation.y = Math.PI;
    } else if (L.hat === 'bucket') {
      const m = mat(L.accent);
      mesh(new THREE.CylinderGeometry(0.15, 0.172, 0.13, 20), m, 0, 0.14, 0, head);
      mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.04, 24), m, 0, 0.07, 0, head);
    } else if (L.hat === 'visor') {
      const m = mat(NEON, { emissive: NEON, emissiveIntensity: 0.2 });
      const band = mesh(new THREE.TorusGeometry(0.162, 0.018, 6, 24), m, 0, 0.09, 0, head);
      band.rotation.x = Math.PI / 2;
      const brim = mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.012, 20, 1, false, -Math.PI / 2, Math.PI), m, 0, 0.08, 0.14, head);
      brim.scale.set(1.2, 1, 1);
    }
  }

  buildGlasses(head, L) {
    if (L.glasses === 'none') return;
    const av = L.glasses === 'aviators';
    const frame = av ? mat('#d4af37', { metalness: 1, roughness: 0.3 }) : mat('#101010', { roughness: 0.4 });
    const lens = av ? mat('#4a3424', { metalness: 0.7, roughness: 0.08 }) : mat('#050505', { metalness: 0.8, roughness: 0.06 });
    const w = av ? 0.1 : 0.104, h = av ? 0.072 : 0.056, r = av ? 0.03 : 0.018;
    const sh = new THREE.Shape();
    sh.moveTo(-w / 2 + r, h / 2); sh.lineTo(w / 2 - r, h / 2); sh.quadraticCurveTo(w / 2, h / 2, w / 2, h / 2 - r);
    sh.lineTo(w / 2, -h / 2 + r * (av ? 1.4 : 1)); sh.quadraticCurveTo(w / 2, -h / 2, w / 2 - r * 1.2, -h / 2);
    sh.lineTo(-w / 2 + r * 1.2, -h / 2); sh.quadraticCurveTo(-w / 2, -h / 2, -w / 2, -h / 2 + r); sh.lineTo(-w / 2, h / 2 - r); sh.quadraticCurveTo(-w / 2, h / 2, -w / 2 + r, h / 2);
    const lensG = cachedGeo('lens' + L.glasses, () => new THREE.ExtrudeGeometry(sh, { depth: 0.006, bevelEnabled: av, bevelSize: 0.004, bevelThickness: 0.002, bevelSegments: 1 }));
    for (const sx of [-1, 1]) {
      const l = mesh(lensG, lens, sx * 0.061, 0.02, 0.146, head);
      l.rotation.y = sx * 0.14;
      l.castShadow = false;
    }
    mesh(G.box(0.03, 0.008, 0.008), frame, 0, 0.038, 0.152, head);
    if (!av) mesh(G.box(0.235, 0.012, 0.01), frame, 0, 0.045, 0.148, head);
    for (const sx of [-1, 1]) {
      const t = mesh(G.box(0.007, 0.008, 0.17), frame, sx * 0.116, 0.04, 0.06, head);
      t.rotation.y = -sx * 0.06;
    }
  }

  buildHuman(L) {
    const top = { 'neon-hoodie': '#1c1c1c', 'neon-tee': NEON, diamond: '#bfefff' }[L.top] || L.topColor;
    const bottom = L.bottom === 'neon-joggers' ? '#1c1c1c' : L.bottom === 'jeans' && L.bottomColor === '#2f4a7a' ? '#3d5a8a' : L.bottomColor;
    const kind = L.outfit === 'neon-tee' ? L.body + '_tee' : L.body;
    if (!HUMANS[kind]) ensureHuman(kind).then(() => { if (this.look === L) this.setLook(L); }).catch(() => {});
    const h = makeHuman(kind, { ...L, topColorResolved: top, bottomColorResolved: bottom });
    this.human = h;
    this.state = null;
    this.body.add(h.obj);
    const mkAnchor = () => { const a = new THREE.Group(); const inner = new THREE.Group(); a.add(inner); this.body.add(a); return [a, inner]; };
    const [ha, hi] = mkAnchor();
    const fit = h.fit;
    const hatG = new THREE.Group(), glG = new THREE.Group();
    hi.add(hatG, glG);
    if (fit) {
      const s = (fit.halfW * 1.1) / 0.168;
      hatG.scale.setScalar(s);
      hatG.position.set(fit.cx, fit.top - 0.2 * s, fit.cz - 0.01 * s);
      glG.scale.setScalar(s);
      glG.position.set(fit.cx, fit.eyeY - 0.02 * s, fit.frontZ - 0.014 - 0.15 * s);
    } else {
      hi.position.set(0, 0.1, 0.015);
      hi.scale.setScalar(0.74);
    }
    this.headAnchor = ha;
    this.head = hi;
    this.buildHat(hatG, L);
    this.buildGlasses(glG, L);
    const [ca, ci] = mkAnchor();
    this.chestAnchor = ca;
    if (L.outfit === 'neon-tee' && HUMANS[kind] && fit?.logo) {
      const logo = new THREE.Mesh(new THREE.PlaneGeometry(0.075, 0.075), decalMat(neonMarkTex()));
      const n = new THREE.Vector3(fit.logo.nx, fit.logo.ny, fit.logo.nz);
      logo.position.set(fit.logo.x, fit.logo.y, fit.logo.z).addScaledVector(n, 0.005);
      logo.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
      ci.add(logo);
    }
  }

  updateHuman(dt, speed, airborne, emote) {
    const h = this.human;
    const next = airborne ? 'run' : speed > 5 ? 'run' : speed > 0.3 ? 'walk' : emote === 2 ? 'dance' : emote === 1 ? 'wave' : 'idle';
    const a = h.actions[next] || h.actions.idle;
    if (next !== this.state && a) {
      const prev = this.state && h.actions[this.state];
      a.reset().play();
      if (prev) prev.crossFadeTo(a, 0.25, false);
      this.state = next;
    }
    if (a) a.timeScale = next === 'walk' ? Math.max(0.6, speed / 1.7) : next === 'run' ? Math.max(0.8, speed / 6) : 1;
    h.mixer.update(dt);
    this.root.updateMatrixWorld(true);
    const inv = this.body.matrixWorld.clone().invert();
    const bq = new THREE.Quaternion();
    this.body.getWorldQuaternion(bq).invert();
    for (const [bone, anc] of [[h.head, this.headAnchor], [h.chest, this.chestAnchor]]) {
      if (!bone) continue;
      bone.getWorldPosition(anc.position).applyMatrix4(inv);
      bone.getWorldQuaternion(anc.quaternion).premultiply(bq);
    }
  }

  update(dt, speed = 0, airborne = false, emote = 0) {
    if (this.human) {
      this.t += dt;
      this.updateHuman(dt, speed, airborne, emote);
      if (this.bubble && this.t > this.bubbleUntil) {
        this.root.remove(this.bubble);
        this.bubble.material.map.dispose();
        this.bubble.material.dispose();
        this.bubble = null;
      }
      return;
    }
    this.t += dt;
    const t = this.t;
    const amt = Math.min(speed / 4, 1.4);
    this.phase += dt * (4 + speed * 1.6) * (speed > 0.1 ? 1 : 0);
    const s = Math.sin(this.phase);
    const reset = (g) => g.rotation.set(0, 0, 0);
    [this.armL, this.armR, this.legL, this.legR].forEach(reset);
    this.body.position.y = 0;
    this.body.rotation.set(0, 0, 0);
    this.head.rotation.set(0, 0, 0);
    if (airborne) {
      this.legL.rotation.x = -0.6; this.legR.rotation.x = 0.35;
      this.armL.rotation.z = 0.9; this.armR.rotation.z = -0.9;
    } else if (speed > 0.1) {
      this.legL.rotation.x = s * 0.75 * amt;
      this.legR.rotation.x = -s * 0.75 * amt;
      this.armL.rotation.x = -s * 0.7 * amt;
      this.armR.rotation.x = s * 0.7 * amt;
      this.armL.rotation.z = 0.08; this.armR.rotation.z = -0.08;
      this.body.position.y = Math.abs(Math.cos(this.phase)) * 0.05 * amt;
      this.body.rotation.x = 0.06 * amt;
    } else if (emote === 1) {
      this.armR.rotation.z = -2.7 + Math.sin(t * 9) * 0.35;
      this.armL.rotation.z = 0.1;
      this.head.rotation.z = Math.sin(t * 3) * 0.08;
    } else if (emote === 2) {
      const d = Math.sin(t * 7);
      this.body.position.y = Math.abs(d) * 0.08;
      this.body.rotation.y = Math.sin(t * 3.5) * 0.4;
      this.armL.rotation.z = 2.4 + d * 0.4;
      this.armR.rotation.z = -2.4 + d * 0.4;
      this.legL.rotation.x = Math.max(0, d) * 0.4;
      this.legR.rotation.x = Math.max(0, -d) * 0.4;
      this.head.rotation.x = Math.abs(d) * 0.2;
    } else {
      this.armL.rotation.z = 0.1 + Math.sin(t * 1.5) * 0.02;
      this.armR.rotation.z = -0.1 - Math.sin(t * 1.5) * 0.02;
      this.body.position.y = Math.sin(t * 1.5) * 0.008;
      this.head.rotation.y = Math.sin(t * 0.4) * 0.25;
    }
    if (this.bubble && t > this.bubbleUntil) {
      this.root.remove(this.bubble);
      this.bubble.material.map.dispose();
      this.bubble.material.dispose();
      this.bubble = null;
    }
  }
}

function badgeTex() {
  return canvasTexture('badge', 128, 170, (ctx, w, h) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#f19bb0';
    ctx.fillRect(0, 0, w, 50);
    ctx.fillStyle = '#fff';
    ctx.font = '30px Anton, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('REACT', w / 2, 24);
    ctx.font = '18px Anton, sans-serif';
    ctx.fillText('MIAMI', w / 2, 44);
    ctx.fillStyle = '#111';
    ctx.font = '700 16px Inter, sans-serif';
    ctx.fillText('ATTENDEE', w / 2, 100);
    ctx.fillStyle = NEON;
    ctx.fillRect(0, h - 34, w, 34);
    ctx.fillStyle = '#111';
    ctx.font = '800 20px Inter, sans-serif';
    ctx.fillText('neon', w / 2, h - 10);
  });
}
