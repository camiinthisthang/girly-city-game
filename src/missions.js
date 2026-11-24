import * as THREE from 'three';
import { textTexture } from './textures.js';

// Config-driven GTA-style mission chain: a "giver" NPC hands out missions, a rage meter fills on failure.
export function createMissions({ scene, hud, sfx, cfg, giver }) {
  const root = document.getElementById('hud');
  const obj = document.createElement('div');
  obj.className = 'objective hidden';
  root.appendChild(obj);
  const stars = document.getElementById('h-stars');
  const rageLabel = document.createElement('div');
  rageLabel.className = 'rage-label';
  rageLabel.textContent = cfg.rageName;
  stars?.after(rageLabel);

  const marker = new THREE.Group();
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 50, 16, 1, true), new THREE.MeshBasicMaterial({ color: cfg.color, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  beam.position.y = 25;
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.3, 1.9, 40), new THREE.MeshBasicMaterial({ color: cfg.color, transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.08;
  marker.add(beam, ring); marker.visible = false; scene.add(marker);

  const stall = (x, y, z, label, color) => {
    const g = new THREE.Group();
    const m = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 });
    const counter = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.1, 1.1), m('#ffffff')); counter.position.y = 0.55;
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(3, 0.18, 1.8), m(color)); canopy.position.y = 2.5;
    for (const sx of [-1.35, 1.35]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.5), m('#dddddd')); p.position.set(sx, 1.25, 0.7); g.add(p); }
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.75), new THREE.MeshBasicMaterial({ map: textTexture('stall-' + label, { text: label, font: '900 80px Inter, sans-serif', color: '#ffffff', bg: color }), side: THREE.DoubleSide }));
    sign.position.set(0, 3, 0.92);
    g.add(counter, canopy, sign); g.position.set(x, y, z);
    g.lookAt(x, y, z + 1);
    scene.add(g);
    return g;
  };

  const mkMarker = (color) => {
    const g = new THREE.Group();
    const b = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 50, 16, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide }));
    b.position.y = 25;
    const r = new THREE.Mesh(new THREE.RingGeometry(2.6, 3.4, 40), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
    r.rotation.x = -Math.PI / 2; r.position.y = 0.1;
    g.add(b, r); g.visible = false; g.userData.ring = r; scene.add(g);
    return g;
  };
  const chk = document.createElement('div');
  chk.className = 'checklist hidden';
  root.appendChild(chk);
  const fx = [];
  const dot = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 32;
    const g = c.getContext('2d'), gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,240,230,0.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
    return new THREE.CanvasTexture(c);
  })();
  let lastSt = null;
  const sparkle = (at) => {
    const n = 46, pos = new Float32Array(n * 3), vel = [];
    for (let i = 0; i < n; i++) { pos.set([at[0], (at[1] || 0) + 1.2, at[2]], i * 3); vel.push([(Math.random() - 0.5) * 7, 3 + Math.random() * 5, (Math.random() - 0.5) * 7]); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: '#ffffff', map: dot, size: 0.35, transparent: true, depthWrite: false }));
    scene.add(pts); fx.push({ pts, vel, t: 0 });
  };

  const list = cfg.missions.map((m) => ({ ...m }));
  for (const m of list) if (m.stall) m.stallG = stall(m.at[0], m.at[1], m.at[2], m.stall, m.stallColor || cfg.color);
  for (const m of list) if (m.type === 'rush') for (const st of m.stops) {
    st.stallG = stall(st.at[0] + 4.5, st.at[1], st.at[2], st.stall, st.color);
    st.mk = mkMarker(st.color); st.mk.position.set(st.at[0], st.at[1] || 0, st.at[2]);
  }
  const bags = [];
  let idx = 0, phase = 'idle', timer = 0, rage = 0, cur = null, done = false, picked = 0;

  const setRage = (r) => {
    rage = Math.max(0, Math.min(5, r));
    if (stars) stars.innerHTML = Array.from({ length: 5 }, (_, i) => `<span class="${i < rage ? 'on' : ''}">★</span>`).join('');
    stars?.classList.toggle('angry', rage > 0);
  };
  setRage(0);
  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const objective = (text) => { obj.innerHTML = text; obj.classList.toggle('hidden', !text); };
  const target = () => {
    if (!cur) return null;
    if (phase === 'go') return cur.at;
    if (phase === 'collect') return bags.find((b) => !b.got)?.at;
    if (phase === 'return') return [giver().x, 0, giver().z];
    if (phase === 'party') return cur.party.at;
    return null;
  };

  function start() {
    cur = list[idx];
    if (!cur) return finish();
    timer = cur.time || 0;
    if (cur.type === 'quiz') return quiz();
    if (cur.type === 'rush') {
      phase = 'rush';
      for (const st of cur.stops) { st.prog = 0; st.done = false; st.mk.visible = true; }
      renderList();
      hud.banner(cur.title.toUpperCase(), cur.brief, cfg.color, 3800);
      sfx.mission?.();
      setTimeout(() => { if (phase === 'rush') hud.toast(cfg.tip?.() || '', 5500); }, 4000);
      return;
    }
    if (cur.type === 'collect') {
      phase = 'collect'; picked = 0; bags.length = 0;
      for (const at of cur.spots) {
        const g = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.7, 0.3), new THREE.MeshStandardMaterial({ color: cfg.bagColors[bags.length % cfg.bagColors.length], roughness: 0.5 }));
        g.position.set(at[0], (at[1] || 0) + 0.6, at[2]); scene.add(g);
        bags.push({ at, g, got: false });
      }
    } else phase = 'go';
    hud.banner(cur.title.toUpperCase(), cur.brief, cfg.color, 3800);
    sfx.mission?.();
  }

  function quiz() {
    phase = 'quiz';
    const opts = cur.options.map((o, i) => [o, String(i)]);
    hud.openDialogue(cfg.giverName(), cur.question, opts, (i) => {
      sfx.click?.();
      hud.closeDialogue();
      if (i === cur.correct) complete();
      else { setRage(rage + 1); hud.toast(cur.wrong || cfg.wrongLine, 3200); if (rage >= 5) busted(); else setTimeout(quiz, 900); }
    });
  }

  function complete() {
    phase = 'idle'; marker.visible = false; objective('');
    hud.banner('MISSION PASSED', cur.passed || cfg.passedLine, '#ffd98a', 3600);
    sfx.mission?.();
    idx += 1;
    setRage(rage - 1);
    if (idx >= list.length) setTimeout(finish, 2500);
    else setTimeout(() => hud.toast(`${cfg.giverName()} has another mission for you. Go talk to her.`, 4000), 3200);
  }

  function busted() {
    hud.banner(cfg.bustedTitle, cfg.bustedLine, '#ff3b5c', 4200);
    for (const b of bags) scene.remove(b.g);
    bags.length = 0; phase = 'idle'; marker.visible = false; objective(''); setRage(0);
    setTimeout(() => hud.toast(`Go talk to ${cfg.giverName()} to try again.`, 3500), 4300);
  }

  function renderList() {
    if (!cur || cur.type !== 'rush' || (phase !== 'rush' && phase !== 'party')) { chk.classList.add('hidden'); return; }
    chk.classList.remove('hidden');
    chk.innerHTML = `<div class="chk-h">${cur.listTitle}</div>` + cur.stops.map((st) => `<div class="chk ${st.done ? 'done' : ''}"><span style="background:${st.color}">${st.done ? '✓' : ''}</span>${st.label}</div>`).join('')
      + `<div class="chk ${phase === 'party' ? 'next' : ''}"><span style="background:#fff"></span>${cur.party.label}</div>`;
  }

  function resetRush() {
    for (const st of cur.stops) { st.prog = 0; st.done = false; st.mk.visible = false; }
    phase = 'idle'; marker.visible = false; objective(''); setRage(0); renderList();
  }

  function rushUpdate(dt, t, player) {
    timer -= dt;
    setRage(Math.floor((1 - Math.max(0, timer) / cur.time) * 5));
    for (const st of cur.stops) if (st.mk.visible) st.mk.userData.ring.scale.setScalar(1 + Math.sin(t * 4) * 0.1);
    if (timer <= 0) {
      resetRush();
      hud.banner(cfg.lateTitle || 'TOO LATE', cfg.lateFailLine || '', '#e7849c', 4200);
      setTimeout(() => hud.toast(`Go talk to ${cfg.giverName()} to try again.`, 3500), 4300);
      return;
    }
    const clock = ` <i>${fmt(Math.max(0, timer))}</i>`;
    if (phase === 'party') {
      if (Math.hypot(player.x - cur.party.at[0], player.z - cur.party.at[2]) < 4.6 && Math.abs(player.y - cur.party.at[1]) < 2.5) {
        const left = timer;
        resetRush();
        sparkle([player.x, player.y, player.z]);
        hud.banner('MISSION PASSED', `Made it with ${fmt(left)} to spare`, '#ffd98a', 3600);
        sfx.mission?.();
        idx += 1;
        if (idx >= list.length) setTimeout(() => finish({ left }), 2600);
        return;
      }
      objective(`Get to the <b>${cur.party.label}</b> (top deck)${clock}`);
      return;
    }
    const here = cur.stops.find((st) => !st.done && Math.hypot(player.x - st.at[0], player.z - st.at[2]) < 5 && Math.abs(player.y - (st.at[1] || 0)) < 2.5);
    if (!here) {
      const left = cur.stops.filter((st) => !st.done).length;
      return objective(`Get ready: <b>${left} stop${left === 1 ? '' : 's'} left</b>${clock}`);
    }
    if (player.speed > 4) return objective(`Stop at the <b>${here.stall.toLowerCase()}</b>!${clock}`);
    here.prog += dt;
    const pct = Math.min(100, (here.prog / here.hold) * 100);
    objective(`${here.doing}<span class="pbar"><span style="width:${pct}%"></span></span>${clock}`);
    if (here.prog >= here.hold) {
      here.done = true; here.mk.visible = false;
      sparkle(here.at); sfx.collect?.();
      hud.toast(here.doneText, 2600);
      if (cur.stops.every((st) => st.done)) { phase = 'party'; hud.banner('READY!', cur.partyBrief, cfg.color, 3000); sfx.mission?.(); }
      renderList();
    }
  }

  function finish(st) {
    if (done) return; done = true; phase = 'done'; objective('');
    lastSt = st || lastSt;
    cfg.onFinish?.(lastSt);
  }

  return {
    get done() { return done; },
    get active() { return phase !== 'idle' && phase !== 'done'; },
    talk() {
      if (done) { cfg.onFinish?.(lastSt); return true; }
      if (phase === 'idle') {
        const m = list[idx];
        hud.openDialogue(cfg.giverName(), m.ask, [[cfg.acceptLine, 'go'], [cfg.declineLine, 'no']], (i) => {
          hud.closeDialogue();
          if (i === 0) start(); else { setRage(rage + 1); hud.toast(cfg.declineReply, 3000); }
        });
        return true;
      }
      if (phase === 'return') { complete(); return true; }
      hud.subtitle(cfg.giverName(), cfg.nagLines[Math.floor(Math.random() * cfg.nagLines.length)]);
      return true;
    },
    update(dt, t, player) {
      for (let i = fx.length - 1; i >= 0; i--) {
        const f = fx[i]; f.t += dt;
        const a = f.pts.geometry.attributes.position;
        for (let k = 0; k < f.vel.length; k++) { f.vel[k][1] -= 6 * dt; a.setXYZ(k, a.getX(k) + f.vel[k][0] * dt, a.getY(k) + f.vel[k][1] * dt, a.getZ(k) + f.vel[k][2] * dt); }
        a.needsUpdate = true; f.pts.material.opacity = Math.max(0, 1 - f.t / 1.4);
        if (f.t > 1.4) { scene.remove(f.pts); f.pts.geometry.dispose(); fx.splice(i, 1); }
      }
      const tg = target();
      marker.visible = !!tg;
      if (tg) { marker.position.set(tg[0], tg[1] || 0, tg[2]); ring.scale.setScalar(1 + Math.sin(t * 4) * 0.12); }
      if (!cur || phase === 'idle' || phase === 'done' || phase === 'quiz') return;
      if (cur.type === 'rush') return rushUpdate(dt, t, player);
      if (phase === 'go' && Math.hypot(player.x - cur.at[0], player.z - cur.at[2]) < 3.2 && Math.abs(player.y - (cur.at[1] || 0)) < 2.5) {
        phase = 'return'; sfx.pickup?.(); hud.toast(cur.got || `Got it! Now bring it to ${cfg.giverName()}.`, 3200);
      }
      if (phase === 'collect') {
        for (const b of bags) {
          if (b.got) { continue; }
          b.g.rotation.y += dt * 2;
          if (Math.hypot(player.x - b.at[0], player.z - b.at[2]) < 2.2 && Math.abs(player.y - (b.at[1] || 0)) < 2.5) { b.got = true; scene.remove(b.g); picked++; sfx.pickup?.(); hud.toast(`${picked} of ${bags.length}`, 1500); }
        }
        if (picked >= bags.length) { phase = 'return'; hud.toast(cur.got || `All of them! Back to ${cfg.giverName()}.`, 3200); }
      }
      if (cur.time) {
        timer -= dt;
        if (timer <= 0) { timer = cur.time; setRage(rage + 1); hud.toast(cfg.lateLines[Math.floor(Math.random() * cfg.lateLines.length)], 3500); if (rage >= 5) return busted(); }
      }
      const what = phase === 'go' ? cur.goText : phase === 'collect' ? `${cur.goText} <b>${picked}/${bags.length}</b>` : `Bring it back to <b>${cfg.giverName()}</b>`;
      objective(`${what}${cur.time ? ` <i>${fmt(Math.max(0, timer))}</i>` : ''}`);
    },
    blips() {
      const g = giver();
      const out = [{ x: g.x, z: g.z, color: cfg.color, label: '♥', edge: true }];
      const tg = target();
      if (tg) out.push({ x: tg[0], z: tg[2], color: '#ffd98a', shape: 'diamond', edge: true });
      if (cur?.type === 'rush' && phase === 'rush') for (const st of cur.stops) if (!st.done) out.push({ x: st.at[0], z: st.at[2], color: st.color, shape: 'diamond', edge: true });
      return out;
    },
    progress: () => ({ n: idx, total: list.length }),
    skipStops() { if (phase !== 'rush') return; for (const st of cur.stops) { st.done = true; st.mk.visible = false; } phase = 'party'; renderList(); },
    skipAll() { idx = list.length; finish(); },
  };
}
