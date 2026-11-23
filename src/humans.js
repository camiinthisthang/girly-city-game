import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';

export const HUMANS = { ready: false };
const GRAY = new Map();


function grayMap(tex) {
  if (!tex || !tex.image) return tex;
  const img = tex.image;
  const cv = document.createElement('canvas');
  cv.width = img.width; cv.height = img.height;
  const ctx = cv.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, cv.width, cv.height);
  for (let i = 0; i < d.data.length; i += 4) {
    const l = Math.min(255, (d.data[i] * 0.3 + d.data[i + 1] * 0.59 + d.data[i + 2] * 0.11) * 1.35 + 30);
    d.data[i] = d.data[i + 1] = d.data[i + 2] = l;
  }
  ctx.putImageData(d, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.flipY = tex.flipY;
  t.wrapS = tex.wrapS; t.wrapT = tex.wrapT;
  return t;
}

export function fixMaterials(root) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of [].concat(o.material)) {
      const cut = /hair|brow|lash|short0|long0|bob0|afro|braid|ponytail|high-poly|low-poly/i.test(m.name);
      m.transparent = false;
      m.depthWrite = true;
      m.opacity = 1;
      m.alphaTest = cut ? 0.45 : 0;
      if (cut) m.side = THREE.DoubleSide;
      m.needsUpdate = true;
    }
  });
}

function prepBase(gltf) {
  fixMaterials(gltf.scene);
  const scene = gltf.scene;
  scene.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.frustumCulled = false;
      if (o.material) {
        o.material.envMapIntensity = 0.6;
        if (o.material.map && (HAIR_RE.test(o.material.name) || SHOE_RE.test(o.material.name)) && !GRAY.has(o.material.name)) GRAY.set(o.material.name, grayMap(o.material.map));
      }
    }
  });
  scene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(scene);
  return { scene, height: box.max.y - box.min.y, minY: box.min.y };
}

function bonesByName(scene) {
  const m = {};
  scene.traverse((o) => { if (o.isBone) m[o.name.replace(/^mixamorig:?/, '')] = o; });
  return m;
}

const REST = new WeakMap();
function restWorld(scene) {
  if (!REST.has(scene)) {
    scene.updateMatrixWorld(true);
    const m = new Map();
    scene.traverse((o) => { if (o.isBone) m.set(o, { w: o.getWorldQuaternion(new THREE.Quaternion()), wp: o.getWorldPosition(new THREE.Vector3()), q: o.quaternion.clone(), p: o.position.clone() }); });
    REST.set(scene, m);
  }
  return REST.get(scene);
}
function resetPose(scene) {
  for (const [b, r] of restWorld(scene)) { b.quaternion.copy(r.q); b.position.copy(r.p); }
  scene.updateMatrixWorld(true);
}

function alignedRest(dstScene, srcScene, srcRest) {
  const dst = cloneSkinned(dstScene);
  const S = bonesByName(srcScene), D = bonesByName(dst);
  const bones = [];
  dst.traverse((o) => { if (o.isBone) bones.push(o); });
  const a = new THREE.Vector3(), b = new THREE.Vector3(), q = new THREE.Quaternion(), w = new THREE.Quaternion(), pw = new THREE.Quaternion();
  for (const bone of bones) {
    const n = bone.name.replace(/^mixamorig:?/, '');
    const child = bone.children.find((c) => c.isBone && S[c.name.replace(/^mixamorig:?/, '')]);
    if (!S[n] || !child) continue;
    dst.updateMatrixWorld(true);
    const sc = S[child.name.replace(/^mixamorig:?/, '')];
    const sp = srcRest.get(S[n]), scp = srcRest.get(sc);
    b.copy(scp.wp).sub(sp.wp).normalize();
    child.getWorldPosition(a); a.sub(bone.getWorldPosition(new THREE.Vector3())).normalize();
    if (a.lengthSq() < 1e-6 || b.lengthSq() < 1e-6) continue;
    q.setFromUnitVectors(a, b);
    bone.getWorldQuaternion(w).premultiply(q);
    bone.parent.getWorldQuaternion(pw).invert();
    bone.quaternion.copy(pw.multiply(w));
  }
  dst.updateMatrixWorld(true);
  const out = {};
  for (const bone of bones) out[bone.name.replace(/^mixamorig:?/, '')] = bone.getWorldQuaternion(new THREE.Quaternion());
  return out;
}

export function retarget(srcScene, clip, dstScene) {
  const S = bonesByName(srcScene), D = bonesByName(dstScene);
  const srcRest = restWorld(srcScene);
  restWorld(dstScene);
  resetPose(srcScene);
  dstScene.updateMatrixWorld(true);
  const aligned = alignedRest(dstScene, srcScene, srcRest);
  const dst = [];
  dstScene.traverse((o) => { if (o.isBone) dst.push(o); });
  const offset = new Map(), restParent = new Map();
  for (const bone of dst) {
    const n = bone.name.replace(/^mixamorig:?/, '');
    restParent.set(bone, bone.parent.getWorldQuaternion(new THREE.Quaternion()));
    if (S[n]) offset.set(bone, srcRest.get(S[n]).w.clone().invert().multiply(aligned[n]));
  }
  const mixer = new THREE.AnimationMixer(srcScene);
  const act = mixer.clipAction(clip);
  act.play();
  const fps = 30, frames = Math.max(2, Math.ceil(clip.duration * fps) + 1);
  const times = [], vals = new Map(dst.map((b) => [b, []]));
  const world = new Map(), q = new THREE.Quaternion(), inv = new THREE.Quaternion();
  for (let i = 0; i < frames; i++) {
    const t = Math.min(i / fps, clip.duration);
    times.push(t);
    mixer.setTime(t);
    srcScene.updateMatrixWorld(true);
    for (const bone of dst) {
      const n = bone.name.replace(/^mixamorig:?/, '');
      const pw = world.get(bone.parent) || restParent.get(bone);
      const w = new THREE.Quaternion();
      if (S[n]) S[n].getWorldQuaternion(w).multiply(offset.get(bone));
      else w.copy(pw).multiply(bone.quaternion);
      world.set(bone, w);
      inv.copy(pw).invert();
      q.copy(inv).multiply(w);
      vals.get(bone).push(q.x, q.y, q.z, q.w);
    }
  }
  act.stop();
  mixer.uncacheRoot(srcScene);
  resetPose(srcScene);
  const tracks = dst.map((b) => new THREE.QuaternionKeyframeTrack(`${b.name}.quaternion`, times, vals.get(b)));
  return new THREE.AnimationClip(clip.name, clip.duration, tracks);
}

export const CAST = { m: 'mh_m', f: 'mh_f', rebecca: 'mh_rebecca', m2: 'mh_m2', m3: 'mh_m3', m4: 'mh_m4', f2: 'mh_f2', f3: 'mh_f3' };
const HAIR_RE = /short0|long0|bob0|afro|braid|ponytail/i;
const SHOE_RE = /shoes0/i;
const OUTFIT_RE = /casualsuit|elegantsuit|sportsuit|worksuit/i;
const LAYOUTS = {
  male_casualsuit06: (u, v) => v < 0.42,
  female_casualsuit01: (u, v) => v < 0.42 || (u > 0.7 && v > 0.62)
};
const OUTFIT_CACHE = new Map();
const hex = (c) => new THREE.Color(c);

function floral(S, base) {
  const c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d'); g.fillStyle = base; g.fillRect(0, 0, S, S);
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 260; i++) {
    const x = rnd() * S, y = rnd() * S, r = 10 + rnd() * 18;
    g.fillStyle = rnd() > 0.5 ? '#1f7a4d' : '#2e9e5b';
    g.beginPath(); g.ellipse(x + r, y, r * 1.4, r * 0.5, rnd() * 3, 0, Math.PI * 2); g.fill();
    g.fillStyle = ['#ffffff', '#ffe066', '#ff8fb8'][i % 3];
    for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; g.beginPath(); g.arc(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.45, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#ffb703'; g.beginPath(); g.arc(x, y, r * 0.3, 0, Math.PI * 2); g.fill();
  }
  return g.getImageData(0, 0, S, S).data;
}

function outfitTexture(mat, L) {
  const key = `${mat.name}|${L.top}|${L.topColorResolved}|${L.bottom}|${L.bottomColorResolved}`;
  if (OUTFIT_CACHE.has(key)) return OUTFIT_CACHE.get(key);
  const layout = Object.entries(LAYOUTS).find(([k]) => mat.name.includes(k))?.[1];
  const img = mat.map?.image;
  if (!layout || !img) return null;
  const S = 1024, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0, S, S);
  const id = g.getImageData(0, 0, S, S), d = id.data;
  const lum = new Float32Array(S * S); let tSum = 0, tN = 0, bSum = 0, bN = 0;
  const isTop = new Uint8Array(S * S);
  for (let i = 0, p = 0; p < S * S; p++, i += 4) {
    const l = (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11) / 255; lum[p] = l;
    if (layout((p % S) / S, Math.floor(p / S) / S)) { isTop[p] = 1; tSum += l; tN++; } else { bSum += l; bN++; }
  }
  const tAvg = tSum / Math.max(tN, 1), bAvg = bSum / Math.max(bN, 1);
  const tc = hex(L.topColorResolved || '#ffffff'), bc = hex(L.bottomColorResolved || '#2f4a7a');
  const pat = L.top === 'hawaiian' ? floral(S, '#' + tc.getHexString()) : null;
  const keepJeans = L.bottom === 'jeans' && (L.bottomColor || '').toLowerCase() === '#2f4a7a';
  for (let i = 0, p = 0; p < S * S; p++, i += 4) {
    if (isTop[p]) {
      const k = Math.min(1.25, (lum[p] / tAvg) * 0.92);
      const r = pat ? pat[i] : tc.r * 255, gg = pat ? pat[i + 1] : tc.g * 255, b = pat ? pat[i + 2] : tc.b * 255;
      d[i] = Math.min(255, r * k); d[i + 1] = Math.min(255, gg * k); d[i + 2] = Math.min(255, b * k);
    } else if (!keepJeans) {
      const k = Math.min(1.3, (lum[p] / bAvg) * 0.85);
      d[i] = Math.min(255, bc.r * 255 * k); d[i + 1] = Math.min(255, bc.g * 255 * k); d[i + 2] = Math.min(255, bc.b * 255 * k);
    }
  }
  g.putImageData(id, 0, 0);
  const t = new THREE.CanvasTexture(c); t.flipY = false; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  OUTFIT_CACHE.set(key, t);
  return t;
}

// Meshy bakes a small mint square where the tee logo goes; find it in the texture so a decal can cover it.
function findLogoUV(map) {
  const img = map?.image;
  if (!img || !img.width) return null;
  const N = 512, c = document.createElement('canvas');
  c.width = c.height = N;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, N, N);
  const d = ctx.getImageData(0, 0, N, N).data;
  const hit = new Uint8Array(N * N);
  for (let i = 0; i < N * N; i++) {
    const r = d[i * 4] / 255, g = d[i * 4 + 1] / 255, b = d[i * 4 + 2] / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if (mx < 0.5 || mx - mn < 0.12 || g !== mx) continue;
    const h = (((b - r) / (mx - mn) + 2) / 6);
    if (h > 0.36 && h < 0.52) hit[i] = 1;
  }
  let best = null;
  const seen = new Uint8Array(N * N);
  for (let i = 0; i < N * N; i++) {
    if (!hit[i] || seen[i]) continue;
    const st = [i]; seen[i] = 1;
    let n = 0, sx = 0, sy = 0;
    while (st.length) {
      const j = st.pop(); n++; sx += j % N; sy += (j / N) | 0;
      for (const k of [j - 1, j + 1, j - N, j + N]) if (k >= 0 && k < N * N && hit[k] && !seen[k]) { seen[k] = 1; st.push(k); }
    }
    if (n >= 8 && (!best || n > best.n)) best = { n, u: (sx / n + 0.5) / N, v: (sy / n + 0.5) / N };
  }
  if (!best) return null;
  const W = img.width, H = img.height, full = document.createElement('canvas');
  full.width = W; full.height = H;
  const fctx = full.getContext('2d', { willReadFrequently: true });
  fctx.drawImage(img, 0, 0);
  const fd = fctx.getImageData(0, 0, W, H);
  const k = W / N;
  for (let i = 0; i < N * N; i++) {
    if (!hit[i]) continue;
    const x0 = Math.max(0, Math.floor(((i % N) - 1) * k)), y0 = Math.max(0, Math.floor((((i / N) | 0) - 1) * k));
    for (let y = y0; y < Math.min(H, y0 + 3 * k); y++) for (let x = x0; x < Math.min(W, x0 + 3 * k); x++) { const j = (y * W + x) * 4; fd.data[j] = 14; fd.data[j + 1] = 14; fd.data[j + 2] = 16; }
  }
  fctx.putImageData(fd, 0, 0);
  const tex = new THREE.CanvasTexture(full);
  tex.flipY = map.flipY; tex.colorSpace = map.colorSpace; tex.wrapS = map.wrapS; tex.wrapT = map.wrapT;
  return { u: best.u, v: map.flipY ? 1 - best.v : best.v, tex };
}

function surfaceAtUV(o, uv) {
  const g = o.geometry, U = g.attributes.uv, P = g.attributes.position, idx = g.index;
  if (!U) return null;
  const tri = idx ? idx.count / 3 : P.count / 3;
  const ia = (t, k) => (idx ? idx.getX(t * 3 + k) : t * 3 + k);
  for (let t = 0; t < tri; t++) {
    const a = ia(t, 0), b = ia(t, 1), c = ia(t, 2);
    const ax = U.getX(a), ay = U.getY(a), bx = U.getX(b), by = U.getY(b), cx = U.getX(c), cy = U.getY(c);
    const den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
    if (Math.abs(den) < 1e-12) continue;
    const w1 = ((by - cy) * (uv.u - cx) + (cx - bx) * (uv.v - cy)) / den;
    const w2 = ((cy - ay) * (uv.u - cx) + (ax - cx) * (uv.v - cy)) / den;
    const w3 = 1 - w1 - w2;
    if (w1 < 0 || w2 < 0 || w3 < 0) continue;
    const pts = [a, b, c].map((i) => { const v = new THREE.Vector3().fromBufferAttribute(P, i); o.applyBoneTransform(i, v); return o.localToWorld(v); });
    const p = pts[0].clone().multiplyScalar(w1).addScaledVector(pts[1], w2).addScaledVector(pts[2], w3);
    const n = pts[1].clone().sub(pts[0]).cross(pts[2].clone().sub(pts[0])).normalize();
    return { p, n };
  }
  return null;
}

function computeFit(root, tee) {
  root.updateMatrixWorld(true);
  const head = [], chest = [];
  let headBone = null, chestBone = null, logoHit = null;
  const v = new THREE.Vector3();
  root.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    const sk = o.skeleton, g = o.geometry, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, pos = g.attributes.position;
    if (tee && !logoHit) { const uv = findLogoUV(o.material?.map); if (uv) { logoHit = surfaceAtUV(o, uv); o.material.map = uv.tex; } }
    const hb = new Set(), cb = new Set();
    sk.bones.forEach((b, i) => {
      if (/Head(Top_End)?$/.test(b.name)) hb.add(i);
      if (/Spine2$/.test(b.name)) cb.add(i);
      if (/Head$/.test(b.name)) headBone = b;
      if (/Spine2$/.test(b.name)) chestBone = b;
    });
    for (let i = 0; i < pos.count; i++) {
      let wh = 0, wc = 0;
      for (let k = 0; k < 4; k++) { const bi = si.getComponent(i, k), w = sw.getComponent(i, k); if (hb.has(bi)) wh += w; if (cb.has(bi)) wc += w; }
      if (wh < 0.8 && wc < 0.8) continue;
      v.fromBufferAttribute(pos, i);
      o.applyBoneTransform(i, v);
      o.localToWorld(v);
      (wh >= 0.8 ? head : chest).push(v.clone());
    }
  });
  if (!headBone || head.length < 50) return null;
  const toLocal = (bone, pts) => {
    const p = new THREE.Vector3(), q = new THREE.Quaternion();
    bone.getWorldPosition(p); bone.getWorldQuaternion(q); q.invert();
    return pts.map((x) => x.sub(p).applyQuaternion(q));
  };
  const pct = (arr, f) => { const s = arr.slice().sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.max(0, Math.floor(s.length * f)))]; };
  const H = toLocal(headBone, head);
  const xs = H.map((p) => p.x), ys = H.map((p) => p.y), zs = H.map((p) => p.z);
  const x0 = pct(xs, 0.03), x1 = pct(xs, 0.97), top = pct(ys, 0.99), bot = pct(ys, 0.02);
  const fit = { cx: (x0 + x1) / 2, halfW: (x1 - x0) / 2, top, eyeY: top - 0.56 * (top - bot), cz: (pct(zs, 0.03) + pct(zs, 0.97)) / 2 };
  const band = H.filter((p) => Math.abs(p.y - fit.eyeY) < 0.02 && Math.abs(p.x - fit.cx) < 0.025);
  fit.frontZ = band.length > 3 ? Math.max(...band.map((p) => p.z)) - 0.012 : pct(zs, 0.95);
  if (tee && chestBone) {
    const cp = new THREE.Vector3(), cq = new THREE.Quaternion();
    chestBone.getWorldPosition(cp); chestBone.getWorldQuaternion(cq);
    const inv = cq.clone().invert();
    if (!logoHit) {
      const rc = new THREE.Raycaster(new THREE.Vector3(0.09, 0.03, 0.6).applyQuaternion(cq).add(cp), new THREE.Vector3(0, 0, -1).applyQuaternion(cq));
      const hit = rc.intersectObject(root, true).find((x) => x.object.isMesh);
      if (hit) logoHit = { p: hit.point, n: hit.face.normal.clone().transformDirection(hit.object.matrixWorld) };
    }
    if (logoHit) {
      const lp = logoHit.p.clone().sub(cp).applyQuaternion(inv), ln = logoHit.n.clone().applyQuaternion(inv).normalize();
      if (ln.z < 0) ln.negate();
      fit.logo = { x: lp.x, y: lp.y, z: lp.z, nx: ln.x, ny: ln.y, nz: ln.z };
    }
  }
  return fit;
}

const LOADING = {};
function loadKind(k) {
  if (!LOADING[k]) {
    const L = new GLTFLoader();
    LOADING[k] = Promise.all([L.loadAsync(`/models/meshy/${k}.glb`), L.loadAsync(`/models/meshy/${k}_anim.glb`)]).then(([g, a]) => {
      const clips = {};
      for (const c of a.animations) {
        c.tracks = c.tracks.filter((t) => !/headfront|_End\./.test(t.name));
        clips[c.name] = c;
      }
      if (clips.walk) clips.idle = neutralIdle(clips.walk);
      clips.wave ||= clips.idle;
      clips.dance ||= clips.idle;
      g.scene.traverse((o) => {
        if (!o.isMesh) return;
        o.castShadow = true;
        o.frustumCulled = false;
        const m = o.material;
        if (m) { m.envMapIntensity = 0.6; m.metalness = Math.min(m.metalness ?? 0, 0.1); m.roughness = Math.max(m.roughness ?? 1, 0.55); }
      });
      g.scene.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(g.scene);
      HUMANS[k] = { scene: g.scene, height: box.max.y - box.min.y, minY: box.min.y, clips, fit: computeFit(g.scene, k.endsWith('_tee')) };
    });
  }
  return LOADING[k];
}
export const ensureHuman = (k) => loadKind(k);

export async function loadHumans() {
  await Promise.all(Object.keys(CAST).map(loadKind));
  HUMANS.ready = true;
}

// Symmetric idle: the mean pose over a full walk cycle (left/right halves cancel), plus slow breathing.
function neutralIdle(walk) {
  const N = 32, tracks = [];
  const q = new THREE.Quaternion();
  for (const tr of walk.tracks) {
    if (/Hips\.position|Foot|Toe/.test(tr.name)) continue;
    const it = tr.createInterpolant(), d = tr.getValueSize();
    if (tr instanceof THREE.QuaternionKeyframeTrack) {
      const sum = [0, 0, 0, 0];
      let ref = null;
      for (let i = 0; i < N; i++) {
        const v = Array.from(it.evaluate((walk.duration * i) / N));
        if (ref && v[0] * ref[0] + v[1] * ref[1] + v[2] * ref[2] + v[3] * ref[3] < 0) for (let k = 0; k < 4; k++) v[k] = -v[k];
        ref ||= v;
        for (let k = 0; k < 4; k++) sum[k] += v[k];
      }
      q.fromArray(sum).normalize();
      const q2 = q.clone();
      if (/Spine[12]\.quaternion/.test(tr.name)) q2.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -0.03));
      tracks.push(new THREE.QuaternionKeyframeTrack(tr.name, [0, 2, 4], [...q.toArray(), ...q2.toArray(), ...q.toArray()]));
    } else {
      const s = new Array(d).fill(0);
      for (let i = 0; i < N; i++) { const v = it.evaluate((walk.duration * i) / N); for (let k = 0; k < d; k++) s[k] += v[k] / N; }
      tracks.push(new tr.constructor(tr.name, [0, 4], [...s, ...s]));
    }
  }
  return new THREE.AnimationClip('idle', 4, tracks);
}

export function makeHuman(kind, L, height) {
  const base = HUMANS[kind] || HUMANS[kind.split('_')[0]] || HUMANS.m;
  const obj = cloneSkinned(base.scene);
  const h = height || (kind.startsWith('f') || kind === 'rebecca' ? 1.68 : 1.82);
  const s = h / base.height;
  obj.scale.multiplyScalar(s);
  obj.position.y = -base.minY * s;
  let head = null, chest = null;
  obj.traverse((o) => {
    if (o.isBone) {
      const n = o.name.replace(/^mixamorig:?/, '');
      if (n === 'Head') head = o;
      if (n === 'Spine2') chest = o;
    }
    if (!o.isMesh) return;
    const m = o.material.clone();
    if (HAIR_RE.test(m.name) && L.hairColor && GRAY.has(o.material.name)) { m.map = GRAY.get(o.material.name); m.color.set(L.hairColor); }
    if (SHOE_RE.test(m.name) && L.shoes && GRAY.has(o.material.name)) { m.map = GRAY.get(o.material.name); m.color.set(L.shoes).lerp(new THREE.Color('#ffffff'), 0.15); }
    if (OUTFIT_RE.test(m.name)) { const t = outfitTexture(o.material, L); if (t) m.map = t; }
    o.material = m;
  });
  const mixer = new THREE.AnimationMixer(obj);
  const actions = {};
  for (const [k, c] of Object.entries(base.clips)) actions[k] = mixer.clipAction(c);
  const sc = (f) => { const o = {}; for (const [k2, v] of Object.entries(f)) o[k2] = typeof v === 'number' ? v * s : sc(v); return o; };
  return { obj, mixer, actions, head, chest, fit: base.fit ? sc(base.fit) : null };
}
