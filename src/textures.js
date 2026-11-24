import * as THREE from 'three';

export const NEON = '#f6bccb';
const cache = new Map();

export function canvasTexture(key, w, h, draw) {
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  cache.set(key, t);
  return t;
}

export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

const MARK_D = 'M63 0.0177909V63.5526L38.4178 42.2501V63.5526H0V0L63 0.0177909ZM7.72251 55.8389H30.6953V25.3238L55.2779 47.0476V7.72922L7.72251 7.71559V55.8389Z';
const LOGO_MARK_D = 'M43.9855 0.0123174V44L26.9857 29.2514V44H0.417969V0L43.9855 0.0123174ZM5.75846 38.6595H21.6452V17.5326L38.6453 32.5729V5.35124L5.75846 5.34181V38.6595Z';
const LOGO_WORD_D = 'M79.0696 35.7042L62.1559 20.7349V35.4106H56.8359V9.06775L73.7497 24.037V9.36126H79.0696V35.7042ZM84.9261 35.4106V9.36126H100.849V14.6078H90.2461V19.7443H98.6479V24.8808H90.2461V30.1641H100.849V35.4106H84.9261ZM117.319 35.7042C109.944 35.7042 104 29.7605 104 22.386C104 15.0114 109.944 9.06775 117.319 9.06775C124.693 9.06775 130.637 15.0114 130.637 22.386C130.637 29.7605 124.693 35.7042 117.319 35.7042ZM117.319 30.5677C121.868 30.5677 125.28 26.8987 125.28 22.386C125.28 17.8732 121.868 14.2042 117.319 14.2042C112.769 14.2042 109.357 17.8732 109.357 22.386C109.357 26.8987 112.769 30.5677 117.319 30.5677ZM156.492 35.7042L139.578 20.7349V35.4106H134.258V9.06775L151.172 24.037V9.36126H156.492V35.7042Z';
let paths = null;
const P = () => (paths ||= { mark: new Path2D(MARK_D), lmark: new Path2D(LOGO_MARK_D), word: new Path2D(LOGO_WORD_D) });

// Official Neon logomark (neon.com/brand), drawn in a s x s box.
export function drawNeonMark(ctx, x, y, s, color = NEON) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s / 64, s / 64);
  ctx.fillStyle = color;
  ctx.fill(P().mark);
  ctx.restore();
}

// Official Neon logo (mark + wordmark). Green mark with white word on dark, or a single mono colour.
export function drawNeonLogo(ctx, x, y, w, fg = NEON) {
  ctx.save(); ctx.fillStyle = fg; ctx.textBaseline = 'top';
  ctx.font = `900 ${w * 0.2}px Inter, sans-serif`; ctx.fillText('✿ GIRLY CITY', x, y, w);
  ctx.restore();
}
function drawNeonLogoUnused(ctx, x, y, w, fg = NEON) {
  const k = w / 157;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  ctx.fillStyle = fg === NEON ? NEON : fg;
  ctx.fill(P().lmark);
  ctx.fillStyle = fg === NEON ? '#ffffff' : fg;
  ctx.fill(P().word);
  ctx.restore();
}

export function neonLogo(fg = NEON, bg = null) {
  return canvasTexture(`logo${fg}${bg}`, 512, 192, (ctx, w, h) => {
    if (bg) { ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h); }
    drawNeonLogo(ctx, 36, 33, 440, fg);
  });
}

export function textTexture(key, { text, w = 1024, h = 256, font = '120px Anton', color = '#fff', bg = null, glow = null, stroke = null, align = 'center' }) {
  return canvasTexture(key, w, h, (ctx) => {
    if (bg) { ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h); }
    ctx.font = font;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    const lines = String(text).split('\n');
    const lh = h / lines.length;
    lines.forEach((ln, i) => {
      const x = align === 'center' ? w / 2 : 24;
      const y = lh * i + lh / 2;
      if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = 30; }
      if (stroke) { ctx.lineWidth = 10; ctx.strokeStyle = stroke; ctx.strokeText(ln, x, y); }
      ctx.fillStyle = color;
      ctx.fillText(ln, x, y);
      ctx.shadowBlur = 0;
    });
  });
}

export function windowTexture(base, glass, variant = 0) {
  return canvasTexture(`win${base}${glass}${variant}`, 256, 256, (ctx, w, h) => {
    const r = rng(variant * 97 + 13);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    if (variant === 2) {
      // horizontal glass bands (Hyatt style)
      for (let y = 0; y < 8; y++) {
        ctx.fillStyle = glass;
        ctx.fillRect(0, y * 32 + 10, w, 16);
        for (let x = 0; x < 8; x++) {
          if (r() < 0.08) { ctx.fillStyle = '#f5d6a0'; ctx.fillRect(x * 32 + 3, y * 32 + 11, 26, 14); }
        }
      }
      return;
    }
    if (variant === 0) {
      // glass curtain wall with thin mullions
      ctx.fillStyle = glass; ctx.fillRect(0, 0, w, h);
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, 'rgba(255,255,255,0.10)'); g.addColorStop(0.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,0.06)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if (r() < 0.05) { ctx.fillStyle = 'rgba(255,214,150,0.55)'; ctx.fillRect(x * 32 + 2, y * 32 + 2, 28, 28); }
      ctx.fillStyle = base;
      for (let i = 0; i <= 8; i++) { ctx.fillRect(i * 32 - 1, 0, 2, h); ctx.fillRect(0, i * 32 - 2, w, 4); }
      return;
    }
    const cols = 4;
    const cw = w / cols, rh = h / 8;
    for (let y = 0; y < 8; y++) for (let x = 0; x < cols; x++) {
      const lit = r();
      ctx.fillStyle = lit < 0.07 ? '#f5d6a0' : glass;
      ctx.fillRect(x * cw + cw * 0.14, y * rh + rh * 0.18, cw * 0.72, rh * 0.62);
    }
  });
}

export function hawaiianTexture(color) {
  return canvasTexture(`hawaii${color}`, 256, 256, (ctx, w, h) => {
    const r = rng(7);
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) {
      const x = r() * w, y = r() * h;
      ctx.fillStyle = '#1f7a4a';
      ctx.beginPath();
      ctx.ellipse(x + 10, y + 6, 16, 6, r() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    const petals = ['#ffffff', '#ff3d7f', '#ffd98a', '#ff7a3d'];
    for (let i = 0; i < 18; i++) {
      const x = r() * w, y = r() * h, s = 6 + r() * 6;
      ctx.fillStyle = petals[i % petals.length];
      for (let p = 0; p < 5; p++) {
        const a = (p / 5) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(x + Math.cos(a) * s, y + Math.sin(a) * s, s * 0.8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#ffe14d';
      ctx.beginPath();
      ctx.arc(x, y, s * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

export function tattooTexture(skin) {
  return canvasTexture(`tat${skin}`, 256, 256, (ctx, w, h) => {
    ctx.fillStyle = skin;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#2a2a2a';
    ctx.lineWidth = 5;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(60 + i * 40, 128, 28 + i * 6, 0, Math.PI * 1.4);
      ctx.stroke();
    }
    ctx.fillStyle = '#2a2a2a';
    ctx.beginPath();
    ctx.moveTo(150, 60); ctx.lineTo(200, 120); ctx.lineTo(150, 190); ctx.lineTo(170, 120);
    ctx.fill();
  });
}

export function noiseTexture(key, base, spots, n = 2500, size = 3) {
  const t = canvasTexture(key, 256, 256, (ctx, w, h) => {
    const r = rng(key.length * 31);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = spots[Math.floor(r() * spots.length)];
      ctx.fillRect(r() * w, r() * h, size, size);
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function paverTexture() {
  const t = canvasTexture('pavers', 256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#e9dccb';
    ctx.fillRect(0, 0, w, h);
    const r = rng(3);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const v = 215 + Math.floor(r() * 25);
      ctx.fillStyle = `rgb(${v + 10},${v},${v - 18})`;
      ctx.fillRect(x * 32 + 1, y * 32 + 1, 30, 30);
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function woodTexture() {
  const t = canvasTexture('wood', 256, 256, (ctx, w, h) => {
    const r = rng(5);
    for (let i = 0; i < 16; i++) {
      const v = 120 + Math.floor(r() * 40);
      ctx.fillStyle = `rgb(${v + 40},${v},${v - 50})`;
      ctx.fillRect(0, i * 16, w, 15);
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function roadTexture() {
  const t = canvasTexture('road', 256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#3a3a40';
    ctx.fillRect(0, 0, w, h);
    const r = rng(9);
    for (let i = 0; i < 1500; i++) {
      ctx.fillStyle = r() < 0.5 ? '#444449' : '#333338';
      ctx.fillRect(r() * w, r() * h, 2, 2);
    }
    ctx.fillStyle = '#f5d13b';
    ctx.fillRect(w / 2 - 6, 0, 4, h);
    ctx.fillRect(w / 2 + 2, 0, 4, h);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(10, 0, 4, h);
    ctx.fillRect(w - 14, 0, 4, h);
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function waterNormalTexture() {
  const N = 256;
  const t = canvasTexture('waternormal', N, N, (ctx) => {
    const r = rng(7);
    const waves = Array.from({ length: 14 }, () => ({ kx: Math.round((r() - 0.5) * 16), ky: Math.round((r() - 0.5) * 16), p: r() * 6.28, a: 0.4 + r() }));
    const h = (x, y) => waves.reduce((s, w) => s + w.a * Math.sin(((w.kx * x + w.ky * y) / N) * 6.2832 + w.p), 0);
    const img = ctx.createImageData(N, N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const dx = (h(x + 1, y) - h(x - 1, y)) * 0.9, dy = (h(x, y + 1) - h(x, y - 1)) * 0.9;
      const l = Math.hypot(dx, dy, 1);
      const i = (y * N + x) * 4;
      img.data[i] = (-dx / l * 0.5 + 0.5) * 255;
      img.data[i + 1] = (-dy / l * 0.5 + 0.5) * 255;
      img.data[i + 2] = (1 / l * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  });
  t.colorSpace = THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
