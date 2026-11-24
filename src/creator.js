import * as THREE from 'three';
import { Character, OPTIONS, randomLook, sanitizeLook } from './character.js';
import { NEON, canvasTexture } from './textures.js';
import { sfx } from './audio.js';

const SECTIONS = [
  ['Character', [['body', 'Pick your character'], ['outfit', 'Outfit']]],
  ['Extras', [['hat', 'Headwear'], ['glasses', 'Eyewear']]],
];
const NEON_FIT = { outfit: 'neon-tee', hat: 'neon-nights' };

export class Creator {
  constructor(renderer, panel, onDone) {
    this.renderer = renderer;
    this.panel = panel;
    this.onDone = onDone;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#f4d9d6');
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    this.camera.position.set(0, 1.15, 5.6);
    this.camera.lookAt(0, 1.0, 0);
    const s = this.scene;
    s.add(new THREE.HemisphereLight('#f1ede6', '#2b2b30', 0.9));
    const key = new THREE.SpotLight('#fff4e2', 60, 14, 0.6, 0.6);
    key.position.set(0.8, 5, 3.2);
    key.target.position.set(0, 1, 0);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    s.add(key, key.target);
    const fill = new THREE.DirectionalLight('#cfd8ff', 0.6); fill.position.set(-3, 2, 2); s.add(fill);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 10), new THREE.MeshStandardMaterial({ map: decoFloor(), roughness: 0.55 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    s.add(floor);
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(10, 5), new THREE.MeshBasicMaterial({ map: miamiBackdrop() }));
    wall.position.set(0, 2.05, -2.2);
    wall.receiveShadow = true;
    s.add(wall);
    this.char = new Character(randomLook());
    s.add(this.char.root);
    this.rot = -1.17;
    if (location.search.includes('debug')) window.__creator = this;
    this.dragging = false;
    this.unlocked = false;
    this.tab = 0;
    renderer.domElement.addEventListener('pointerdown', (e) => { if (this.active) { this.dragging = true; this.lastX = e.clientX; } });
    window.addEventListener('pointerup', () => { this.dragging = false; });
    window.addEventListener('pointermove', (e) => {
      if (!this.active || !this.dragging) return;
      this.rot += (e.clientX - this.lastX) * 0.01;
      this.lastX = e.clientX;
    });
  }

  show({ look, name, mode, unlocked }) {
    this.active = true;
    this.mode = mode;
    this.unlocked = unlocked;
    this.look = sanitizeLook(look || randomLook());
    
    this.name = name || window.__defaultName || '';
    this.char.setLook(this.look);
    this.panel.classList.remove('hidden');
    this.renderPanel();
    this.resize();
  }

  hide() { this.active = false; this.panel.classList.add('hidden'); }

  set(k, v) {
    this.look = sanitizeLook({ ...this.look, [k]: v });
    this.char.setLook(this.look);
    this.char.pose = 1.2;
    sfx.click();
    this.renderPanel();
  }

  renderPanel() {
    const L = this.look;
    const [title, rows] = SECTIONS[this.tab];
    const rowHtml = rows.map(([k, label]) => {
      const opts = OPTIONS[k];
      const items = typeof opts[0] === 'string'
        ? opts.map((c) => `<button class="sw ${L[k] === c ? 'sel' : ''}" data-k="${k}" data-v="${c}" style="background:${c}" aria-label="${label} ${c}"></button>`).join('')
        : opts.filter((o) => o[2] !== 'neon').map(([v, lab, tag]) => {
          const locked = tag === 'locked' && !this.unlocked;
          return `<button class="chip ${L[k] === v ? 'sel' : ''} ${tag === 'neon' ? 'neon' : ''} ${tag === 'locked' ? 'diamond' : ''}" data-k="${k}" data-v="${v}" ${locked ? 'disabled title="Find all 8 Neon swag crates to unlock"' : ''}>${lab}${tag === 'neon' ? '<em>NEON</em>' : ''}${locked ? '<em class="lock">LOCKED</em>' : tag === 'locked' ? '<em>RARE</em>' : ''}</button>`;
        }).join('');
      return `<div class="row"><div class="row-label">${label}</div><div class="row-items">${items}</div></div>`;
    }).join('');
    this.panel.innerHTML = `
      <div class="c-head">
        <div class="c-kicker">${this.mode === 'wardrobe' ? 'WARDROBE' : 'CREATE YOUR CHARACTER'}</div>
        <div class="c-title">GIRLY <span>CITY</span></div>
      </div>
      <div class="tabs">${SECTIONS.map(([t], i) => `<button class="tab ${i === this.tab ? 'sel' : ''}" data-tab="${i}">${t}</button>`).join('')}</div>
      <div class="rows">${rowHtml}</div>
      <div class="c-actions">
        <button class="ghost" id="c-rand">Randomize</button>
        <button class="ghost neonbtn" id="c-neon">Full Neon fit</button>
      </div>
      <div class="c-foot">
        <label>Your name<input id="c-name" maxlength="16" placeholder="e.g. Bella" value="${(this.name || '').replace(/"/g, '&quot;')}" /></label>
        <button class="primary" id="c-go">${this.mode === 'wardrobe' ? 'Back to Miami' : 'Let\'s go'}</button>
      </div>`;
    this.panel.querySelectorAll('[data-k]').forEach((b) => b.addEventListener('click', () => this.set(b.dataset.k, b.dataset.v)));
    this.panel.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { this.tab = Number(b.dataset.tab); sfx.click(); this.renderPanel(); }));
    this.panel.querySelector('#c-rand').addEventListener('click', () => {
      this.look = randomLook();
      this.char.setLook(this.look);
      sfx.click();
      this.renderPanel();
    });
    this.panel.querySelector('#c-neon').addEventListener('click', () => {
      this.look = sanitizeLook({ ...this.look, ...NEON_FIT });
      this.char.setLook(this.look);
      this.char.pose = 2;
      sfx.collect();
      this.renderPanel();
    });
    const nameIn = this.panel.querySelector('#c-name');
    nameIn.addEventListener('input', () => { this.name = nameIn.value; });
    nameIn.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') this.done(); });
    this.panel.querySelector('#c-go').addEventListener('click', () => this.done());
  }

  done() {
    const name = (this.name || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 16) || window.__defaultName || "Player";
    sfx.unlock();
    sfx.click();
    this.onDone(this.look, name, this.mode);
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.camera.aspect = w / h;
    const narrow = w < 820;
    if (narrow) this.camera.setViewOffset(w, h, 0, h * 0.27, w, h);
    else this.camera.setViewOffset(w, h, -Math.min(440, w * 0.45) / 2, 0, w, h);
    this.camera.fov = narrow ? 30 : 32;
    this.camera.position.z = narrow ? 6.6 : 5.4;
    this.camera.updateProjectionMatrix();
  }

  render(dt) {
    if (!this.dragging) this.rot += dt * 0.35;
    this.char.root.rotation.y = this.rot;
    this.char.pose = Math.max(0, (this.char.pose || 0) - dt);
    this.char.update(dt, 0, false, this.char.pose > 0 ? 1 : 0);
    this.renderer.render(this.scene, this.camera);
  }
}

function decoFloor() {
  const t = canvasTexture('deco-floor', 512, 512, (ctx, w, h) => {
    const n = 8, s = w / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { ctx.fillStyle = (i + j) % 2 ? '#fbeee4' : '#bfdcc8'; ctx.fillRect(i * s, j * s, s, s); }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(5, 2.5);
  return t;
}

function miamiBackdrop() {
  return canvasTexture('miami-backdrop', 2048, 1024, (ctx, w, h) => {
    const hz = h * 0.66;
    const sky = ctx.createLinearGradient(0, 0, 0, hz);
    sky.addColorStop(0, '#c9b7e3'); sky.addColorStop(0.45, '#f4b9c6'); sky.addColorStop(0.8, '#ffc9a3'); sky.addColorStop(1, '#ffe3b0');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, w, hz);
    const cx = w / 2, cy = hz - 40, R = 230;
    const sun = ctx.createLinearGradient(0, cy - R, 0, cy + R);
    sun.addColorStop(0, '#fff6d6'); sun.addColorStop(1, '#f7a7a0');
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = sun; ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
    ctx.fillStyle = 'rgba(214,51,108,0.95)';
    for (let i = 0; i < 7; i++) { const y = cy + 10 + i * 30; ctx.fillRect(cx - R, y, R * 2, 4 + i * 2.2); }
    ctx.restore();
    const sea = ctx.createLinearGradient(0, hz, 0, h);
    sea.addColorStop(0, '#9fd0e3'); sea.addColorStop(1, '#5f9fc0');
    ctx.fillStyle = sea; ctx.fillRect(0, hz, w, h - hz);
    ctx.fillStyle = 'rgba(255,200,120,0.5)';
    for (let i = 0; i < 26; i++) { const y = hz + 8 + i * 13, ww = 300 - i * 9; ctx.fillRect(cx - ww / 2 + Math.sin(i * 1.7) * 30, y, ww, 3); }
    ctx.fillStyle = '#7a5a60';
    const towers = [[60, 260], [170, 200], [260, 330], [370, 240], [1560, 280], [1660, 220], [1760, 350], [1880, 250], [1960, 300]];
    for (const [x, th] of towers) ctx.fillRect(x, hz - th, 90, th);
    ctx.fillStyle = 'rgba(255,214,110,0.55)';
    for (const [x, th] of towers) for (let y = hz - th + 16; y < hz - 10; y += 22) for (let k = 0; k < 3; k++) if ((x + y + k) % 3) ctx.fillRect(x + 12 + k * 26, y, 12, 8);
    const palm = (bx, by, H, lean, k) => {
      ctx.strokeStyle = '#6b4b52'; ctx.lineWidth = 22 * k; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo(bx + lean * 0.2, by - H * 0.55, bx + lean, by - H); ctx.stroke();
      const tx = bx + lean, ty = by - H;
      ctx.fillStyle = '#6b4b52';
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI * 0.95 + (i / 9) * Math.PI * 0.9 + (i % 2 ? 0.12 : -0.08), L = (230 + (i % 3) * 50) * k;
        const ex = tx + Math.cos(a) * L, ey = ty + Math.sin(a) * L * 0.45 + L * 0.42;
        ctx.beginPath(); ctx.moveTo(tx, ty); ctx.quadraticCurveTo((tx + ex) / 2, ty - 70 * k, ex, ey); ctx.quadraticCurveTo((tx + ex) / 2, ty - 14 * k, tx, ty + 10 * k); ctx.fill();
      }
    };
    palm(330, h, 820, 120, 1); palm(560, h, 600, -60, 0.75); palm(1720, h, 860, -140, 1.05); palm(1500, h, 560, 70, 0.7);
    ctx.font = '700 150px "Brush Script MT", "Pacifico", cursive';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#f19bb0'; ctx.shadowBlur = 40; ctx.fillStyle = '#ffe1f0';
    ctx.fillText('Miami', cx, 190);
    ctx.shadowBlur = 0;
  });
}

function lineupTexture() {
  return canvasTexture('lineup', 1024, 512, (ctx, w, h) => {
    ctx.fillStyle = '#8d9097'; ctx.fillRect(0, 0, w, h);
    const ppm = h / 6;
    ctx.fillStyle = '#1d1d20'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    for (let i = 0; i <= 24; i++) {
      const y = h - (i * 0.25) * ppm;
      const major = i % 4 === 0;
      ctx.fillRect(major ? 0 : w * 0.06, y - (major ? 2 : 1), major ? w : w * 0.88, major ? 4 : 2);
      if (major) {
        ctx.font = '700 22px Inter, sans-serif';
        ctx.fillText(`${(i * 0.25 * 3.281).toFixed(0)}'`, 14, y - 16);
        ctx.fillText(`${(i * 0.25 * 3.281).toFixed(0)}'`, w - 50, y - 16);
      }
    }
    ctx.globalAlpha = 0.16; ctx.fillStyle = '#000';
    ctx.font = '400 54px "Bowlby One", sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('GIRLY CITY · VICE BEACH', w / 2, 60);
    ctx.globalAlpha = 1;
  });
}
