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

  const list = cfg.missions.map((m) => ({ ...m }));
  for (const m of list) if (m.stall) m.stallG = stall(m.at[0], m.at[1], m.at[2], m.stall, m.stallColor || cfg.color);
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
    return null;
  };

  function start() {
    cur = list[idx];
    if (!cur) return finish();
    timer = cur.time || 0;
    if (cur.type === 'quiz') return quiz();
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
    hud.banner('MISSION PASSED', cur.passed || cfg.passedLine, '#ffd23f', 3600);
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

  function finish() {
    if (done) return; done = true; phase = 'done'; objective('');
    cfg.onFinish?.();
  }

  return {
    get done() { return done; },
    get active() { return phase !== 'idle' && phase !== 'done'; },
    talk() {
      if (done) { cfg.onFinish?.(); return true; }
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
      const tg = target();
      marker.visible = !!tg;
      if (tg) { marker.position.set(tg[0], tg[1] || 0, tg[2]); ring.scale.setScalar(1 + Math.sin(t * 4) * 0.12); }
      if (!cur || phase === 'idle' || phase === 'done' || phase === 'quiz') return;
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
      if (tg) out.push({ x: tg[0], z: tg[2], color: '#ffd23f', shape: 'diamond', edge: true });
      return out;
    },
    progress: () => ({ n: idx, total: list.length }),
    skipAll() { idx = list.length; finish(); },
  };
}
