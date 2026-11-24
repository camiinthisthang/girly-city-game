import * as THREE from 'three';
import { WATER_Y } from './vehicles.js';

export const RACES = {
  street: { name: 'Brickell Street Race', kind: 'car', reward: 750, start: [64, -93], cps: [[20, -93], [-44, -93], [-44, -20], [-44, 38], [-44, 120], [-44, 220]] },
  bay: { name: 'Biscayne Bay Jet Ski Run', kind: 'ski', reward: 750, start: [40, 34], cps: [[85, 40], [130, 30], [150, 140], [262, 130], [265, 20], [140, -40], [118, 30], [62, 34]] },
};

export function createRaces(scene, hud, { onFinish }) {
  const ringGeo = new THREE.CylinderGeometry(1, 1, 1, 40, 1, true);
  const mk = (color, r, h, op) => {
    const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    m.scale.set(r, h, r);
    scene.add(m);
    return m;
  };
  const baseY = (R) => (R.kind === 'ski' ? WATER_Y : 0);
  const starts = Object.entries(RACES).map(([id, R]) => {
    const m = mk(R.kind === 'car' ? '#a7d3ea' : '#f19bb0', 5, 8, 0.3);
    m.position.set(R.start[0], baseY(R) + 4, R.start[1]);
    return { id, R, m };
  });
  const cp = mk('#ffd98a', 8, 12, 0.45);
  const next = mk('#ffd98a', 8, 12, 0.12);
  cp.visible = next.visible = false;
  let cur = null, cooldown = 0;

  const show = () => {
    const R = cur.R, y = baseY(R) + 6, [x, z] = R.cps[cur.i], n = R.cps[cur.i + 1];
    cp.position.set(x, y, z);
    cp.visible = true;
    next.visible = !!n;
    if (n) next.position.set(n[0], y, n[1]);
  };
  const end = () => { cur = null; cp.visible = next.visible = false; hud.race(null); };

  function update(dt, t, vehicle, pos) {
    for (const s of starts) { s.m.material.opacity = 0.25 + Math.sin(t * 3) * 0.1; s.m.visible = !cur; }
    cp.material.opacity = 0.4 + Math.sin(t * 6) * 0.1;
    cooldown -= dt;
    if (!cur) {
      if (!vehicle || cooldown > 0) return;
      for (const s of starts) {
        if (s.R.kind !== vehicle.kind) continue;
        if (Math.hypot(pos.x - s.R.start[0], pos.z - s.R.start[1]) < 5.5) {
          cur = { id: s.id, R: s.R, i: 0, t0: t };
          hud.banner('GO!', s.R.name, '#a7d3ea', 1800);
          show();
          break;
        }
      }
      return;
    }
    if (!vehicle || vehicle.kind !== cur.R.kind) { hud.toast('Race abandoned'); end(); cooldown = 3; return; }
    const [cx, cz] = cur.R.cps[cur.i];
    if (Math.hypot(pos.x - cx, pos.z - cz) < 8.5) {
      cur.i++;
      if (cur.i >= cur.R.cps.length) {
        const ms = Math.round((t - cur.t0) * 1000), id = cur.id, R = cur.R;
        end();
        cooldown = 6;
        onFinish(id, R, ms);
        return;
      }
      show();
    }
    hud.race({ name: cur.R.name, time: t - cur.t0, cp: cur.i, total: cur.R.cps.length });
  }

  function blips() {
    if (cur) return [{ x: cur.R.cps[cur.i][0], z: cur.R.cps[cur.i][1], color: '#ffd98a', shape: 'diamond', edge: true }];
    return starts.map((s) => ({ x: s.R.start[0], z: s.R.start[1], color: s.R.kind === 'car' ? '#a7d3ea' : '#f19bb0', label: s.R.kind === 'car' ? 'S' : 'J', edge: false }));
  }

  return { update, blips, get active() { return cur; } };
}
