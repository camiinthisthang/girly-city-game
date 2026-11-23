window.__defaultName = 'Main Character';
import './style.css';
import '@fontsource/anton/400.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/inter/800.css';
import '@fontsource/inter/900.css';
import '@fontsource/bowlby-one/400.css';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { buildWorld, SWAG_SPOTS, REBECCA_SPOT, BOOTH_SPOT, YACHT } from './world.js';
import { Character, sanitizeLook } from './character.js';
import { Creator } from './creator.js';
import { Hud } from './hud.js';
import { Net } from './net.js';
import { createNpcs, rebeccaDialogue } from './npc.js';
import { sfx } from './audio.js';
import { loadHumans } from './humans.js';
import { createVehicles, CAR_TYPES } from './vehicles.js';
import { createRaces } from './races.js';
import { createMissions } from './missions.js';
import { BESTIE, MISSIONS, showEnd } from './girly.js';
let missions = null;
import { drawNeonLogo } from './textures.js';

const $ = (s) => document.querySelector(s);
const load = (k, d) => { try { return { ...d, ...JSON.parse(localStorage.getItem(k) || '{}') }; } catch { return d; } };
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const angleLerp = (a, b, t) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;

const isTouch = matchMedia('(pointer: coarse)').matches;
const canvas = $('#c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isTouch, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, isTouch ? 1.25 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;

const GradeShader = {
  uniforms: { tDiffuse: { value: null }, time: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float time; varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      float l = dot(c, vec3(0.299,0.587,0.114));
      c = mix(vec3(l), c, 1.05);
      c = c * 0.86 + 0.11;
      c += mix(vec3(0.06,0.0,0.05), vec3(0.07,0.02,0.04), smoothstep(0.1,0.8,l));
      vec2 d = vUv - 0.5;
      c *= 1.0 - dot(d,d) * 0.85;
      c += (hash(vUv * 1000.0 + time) - 0.5) * 0.035;
      gl_FragColor = vec4(clamp(c,0.0,1.0), 1.0);
    }`,
};

const profile = load('rm_profile', { name: '', look: null });
const progress = load('rm_progress', { swag: [], missionStarted: false, metRebecca: false, unlocked: false, props: 0, talked: [] });
const TOTAL = SWAG_SPOTS.length;

let mode = 'splash';
let world, scene, camera, composer, hud, npcs, player, me, net, grade;
const remotes = new Map();
const keys = new Set();
const joy = { x: 0, y: 0 };
const cam = { yaw: 0, pitch: 0.2, dist: 4.6 };
let dialogueNpc = null;
let vehicles, races, driving = null;
let neonChat = null;
let ticketMesh = null, danceT = 0, lastRank = 0, shake = 0, skiT = 0, photo = false, photoUi = null;
const CHALLENGES = [
  { id: 'speed', text: 'Hit 120 MPH in a supercar', xp: 300 },
  { id: 'stunt', text: 'Land a stunt jump', xp: 250 },
  { id: 'race', text: 'Finish any race', xp: 400 },
  { id: 'ski', text: 'Ride a jet ski for 60 seconds', n: 60, xp: 250 },
  { id: 'dance', text: 'Dance on the party yacht', xp: 200 },
  { id: 'npc', text: 'Talk to 3 attendees', n: 3, xp: 150 },
];
function todaysChallenges() {
  const date = new Date().toISOString().slice(0, 10);
  if (!progress.daily || progress.daily.date !== date) progress.daily = { date, p: {}, done: [] };
  let seed = [...date].reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7) >>> 0;
  const pool = [...CHALLENGES], out = [];
  while (out.length < 3) { seed = (seed * 1103515245 + 12345) >>> 0; out.push(pool.splice(seed % pool.length, 1)[0]); }
  return out;
}
function showDaily() {
  hud.setDaily(todaysChallenges().map((c) => ({ ...c, p: Math.floor(progress.daily.p[c.id] || 0), done: progress.daily.done.includes(c.id) })));
}
function challenge(id, amt = 1) {
  const c = todaysChallenges().find((x) => x.id === id);
  if (!c || progress.daily.done.includes(id)) return;
  progress.daily.p[id] = (progress.daily.p[id] || 0) + amt;
  if (progress.daily.p[id] >= (c.n || 1)) {
    progress.daily.done.push(id);
    hud.banner('CHALLENGE COMPLETE', `${c.text} · +${c.xp} XP`, '#29d3ff', 3500);
    addCash(c.xp);
  }
  save('rm_progress', progress);
  showDaily();
}
function togglePhoto() {
  photo = !photo;
  document.body.classList.toggle('photo', photo);
  if (photo) {
    photoUi = document.createElement('div');
    photoUi.className = 'photo-ui';
    photoUi.innerHTML = 'PHOTO MODE · drag to frame · <b>Space</b> or tap here to save · <b>P</b> to exit';
    photoUi.onclick = snapPhoto;
    $('#hud').appendChild(photoUi);
  } else { photoUi?.remove(); photoUi = null; }
}
function snapPhoto() {
  composer.render();
  const src = renderer.domElement, c = document.createElement('canvas');
  c.width = src.width; c.height = src.height;
  const g = c.getContext('2d');
  g.drawImage(src, 0, 0);
  const k = c.height / 720;
  g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(0, c.height - 70 * k, c.width, 70 * k);
  g.fillStyle = '#fff'; g.font = `${30 * k}px Anton, sans-serif`; g.textBaseline = 'middle';
  g.fillText('GIRLY CITY  ·  MAIN CHARACTER', 24 * k, c.height - 35 * k);
  drawNeonLogo(g, c.width - 190 * k, c.height - 56 * k, 160 * k);
  const a = document.createElement('a');
  a.href = c.toDataURL('image/png'); a.download = `girly-city-${Date.now()}.png`; a.click();
  hud.toast('Photo saved', 1500);
}
const RANKS = [0, 400, 1200, 2500, 4500, 7500, 12000, 18000, 26000, 36000];
const UNLOCKS = {};
function rankOf(xp) {
  let r = 1;
  while (r < RANKS.length && xp >= RANKS[r]) r++;
  const lo = RANKS[r - 1], hi = RANKS[r] ?? lo + 15000;
  return { rank: r, xp, into: xp - lo, need: hi - lo };
}
const TICKETS = {};
const EGG_TITLES = { 1: 'Stunt King', 2: 'Secret Island' };
const fmtTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toFixed(2).padStart(5, '0')}`;
let t = 0;

const creator = new Creator(renderer, $('#creator'), (look, name, m) => {
  profile.look = look;
  profile.name = name;
  save('rm_profile', profile);
  creator.hide();
  if (m === 'wardrobe') {
    me.setLook(look);
    me.setName(name, null, '#29d3ff');
    net.setLook(name, look);
    mode = 'game';
    $('#hud').classList.remove('hidden');
    hud.toast('Fit updated. Looking good.');
  } else startGame();
});

async function main() {
  await Promise.all([document.fonts.load('64px Anton'), document.fonts.load('800 32px Inter'), document.fonts.load('600 32px Inter')]).catch(() => {});
  $('#loading').textContent = 'Loading characters...';
  await loadHumans().catch((e) => console.error('humans', e));
  initWorld();
  $('#loading').textContent = '';
  $('#start').disabled = false;
  $('#start').addEventListener('click', () => {
    sfx.unlock();
    sfx.click();
    $('#splash').classList.add('hidden');
    mode = 'creator';
    creator.show({ look: profile.look, name: profile.name, mode: 'create', unlocked: progress.unlocked });
  });
  renderer.setAnimationLoop(frame);
}

function initWorld() {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(52, innerWidth / innerHeight, 0.1, 2000);
  world = buildWorld(scene, renderer);
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  if (!isTouch) composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.3, 0.4, 0.97));
  composer.addPass(new OutputPass());
  grade = new ShaderPass(GradeShader);
  composer.addPass(grade);
  npcs = createNpcs(scene, world, { giverName: BESTIE, giverTag: 'YOUR BESTIE', wave: 'Bestie! Over here!' });
  vehicles = createVehicles(scene, world);
  hud = new Hud($('#hud'), { onChat: sendChat, mapShapes: world.mapShapes, isTouch });
  world.crates.forEach((c) => { c.g.visible = false; });
  races = createRaces(scene, hud, { onFinish: finishRace });
  showDaily();
  missions = createMissions({ scene, hud, sfx, giver: () => npcs.rebecca, cfg: {
    missions: MISSIONS, color: '#ff8fc8', rageName: 'DRAMA', bagColors: ['#ff8fc8', '#c9a7ff', '#7fd8d4', '#ffc36b'],
    giverName: () => BESTIE, acceptLine: 'Say less, bestie', declineLine: 'Maybe later...', declineReply: '"Maybe later?" The group chat is talking. Drama +1',
    wrongLine: 'Bestie... no.', passedLine: 'Your bestie is so proud of you.',
    nagLines: ['Why are you still here? Go go go!', 'The timer is RIGHT there, babe.', 'I love you but MOVE.'],
    lateLines: ['The group chat noticed. Drama +1', 'Running late again? Drama +1', 'Your bestie sent a voice note. Drama +1'],
    bustedTitle: 'TOO MUCH DRAMA', bustedLine: 'Deleting the group chat. Try again tomorrow.', onFinish: () => showEnd(profile?.name),
  } });
  ticketMesh = makeTicketMesh();
  ticketMesh.position.set(226, 1.3, 104);
  scene.add(ticketMesh);
  ticketMesh.visible = false;
  setupInput();
  net = new Net({
    board: (b) => hud.setBoard(b),
    tickets: (list) => { for (const tk of list) TICKETS[tk.id] = tk; ticketMesh.visible = !TICKETS[2]?.claimedBy; },
    ticket: (m) => { TICKETS[m.id] = { id: m.id, claimedBy: m.name }; ticketMesh.visible = !TICKETS[2]?.claimedBy; hud.ticket(m); sfx.mission?.(); },
    ticketTaken: (m) => hud.toast(`Golden Ticket #${m.id} (${EGG_TITLES[m.id]}) was already claimed by ${m.by}. Keep exploring!`, 4500),
    status: (ok) => { hud.setOnline(remotes.size + 1, ok); if (ok) hud.log(null, 'Connected to global chat. Everyone in Miami sees your messages.'); },
    reset: () => { for (const id of [...remotes.keys()]) removeRemote(id); },
    join: (p) => {
      if (p.id === net.id || remotes.has(p.id)) return;
      const c = new Character(p.look, { name: p.name });
      const [x, y, z, r] = p.s || [-10, 0, -18, 0];
      c.root.position.set(x, y, z);
      scene.add(c.root);
      remotes.set(p.id, { c, name: p.name, x, y, z, r, tx: x, ty: y, tz: z, tr: r, a: 0 });
      hud.setOnline(remotes.size + 1, true);
      if (p.t === 'joined') hud.log(null, `${p.name} arrived in Miami`);
    },
    leave: (id) => { const r = remotes.get(id); if (r) hud.log(null, `${r.name} left`); removeRemote(id); },
    look: (m) => { const r = remotes.get(m.id); if (r) { r.c.setLook(m.look); r.c.setName(m.name); r.name = m.name; } },
    snap: (list) => {
      for (const [id, x, y, z, rr, a, veh] of list) {
        const r = remotes.get(id);
        if (!r) continue;
        r.tx = x; r.ty = y; r.tz = z; r.tr = rr; r.a = a; r.veh = veh || 0;
      }
    },
    history: (m) => { if (!neonChat) hud.log(m.name, m.text, '#ffb3e0', true); },
    chat: (m) => {
      if (neonChat) return;
      const isMe = m.id === net.id;
      const c = isMe ? me : remotes.get(m.id)?.c;
      if (c) c.say(m.text);
      hud.log(m.name, m.text, isMe ? '#29d3ff' : '#ff9ad5');
      if (!isMe) sfx.chat();
    },
  });
}

function removeRemote(id) {
  const r = remotes.get(id);
  if (!r) return;
  scene.remove(r.c.root);
  if (r.vehMesh) scene.remove(r.vehMesh);
  remotes.delete(id);
  hud.setOnline(remotes.size + 1, net.online);
}

function startGame() {
  const first = !me;
  if (me) scene.remove(me.root);
  me = new Character(profile.look, { name: profile.name, tagColor: '#29d3ff' });
  me.setName(profile.name, null, '#29d3ff');
  scene.add(me.root);
  player = { x: -10 + (Math.random() - 0.5) * 8, y: 0, z: -19 + (Math.random() - 0.5) * 4, vx: 0, vz: 0, vy: 0, heading: Math.PI, grounded: true, emote: 0, speed: 0 };
  cam.yaw = 0;
  mode = 'game';
  $('#hud').classList.remove('hidden');
  updateStats();
  if (first) {
    hud.banner('WELCOME TO GIRLY CITY', `${BESTIE} needs you. Find her ✿`, '#ff8fc8', 4200);
  }
}

function updateStats() {
  const rk = rankOf(progress.props);
  if (lastRank && rk.rank > lastRank) { hud.banner('RANK UP', `Rank ${rk.rank}${UNLOCKS[rk.rank] ? ' · Unlocked ' + UNLOCKS[rk.rank] : ''}`, '#ffd23f', 4500); sfx.mission?.(); }
  lastRank = rk.rank;
  hud.setStats({ rank: rk, props: progress.props, found: progress.swag.length, total: TOTAL, missionStarted: progress.missionStarted });
}

function sendChat(text) {
  if (text === '/dance') { player.emote = 2; return; }
  if (text === '/wave') { player.emote = 1; return; }
  if (text === '/stuck') { if (driving) exitVehicle(); Object.assign(player, { x: -10, y: 0, z: -19, vx: 0, vy: 0, vz: 0 }); hud.toast('Back on the plaza', 1500); return; }
  if (neonChat) { neonChat.send(profile.name, text).then((ok) => { if (!ok && net.online) net.chat(text); }, () => net.online && net.chat(text)); challenge('chat'); }
  else if (net.online) { net.chat(text); challenge('chat'); }
  else { me.say(text); hud.log(profile.name, text, '#29d3ff'); }
}

// ---------- input ----------
function setupInput() {
  addEventListener('keydown', (e) => {
    if (mode !== 'game' || hud.typing) return;
    if (hud.dialogueOpen) {
      const n = Number(e.key);
      if (n >= 1 && n <= 9) hud.pick(n - 1);
      if (e.key === 'Escape') endDialogue();
      return;
    }
    if (photo) { if (e.code === 'Space') { e.preventDefault(); snapPhoto(); } if (e.code === 'KeyP' || e.code === 'Escape') togglePhoto(); return; }
    keys.add(e.code);
    if (e.code === 'Space') { e.preventDefault(); jump(); }
    if (e.code === 'Enter' || e.code === 'KeyT') { e.preventDefault(); keys.clear(); hud.openChat(); }
    if (e.code === 'KeyE') interact();
    if (e.code === 'Digit1') player.emote = 1;
    if (e.code === 'Digit2') player.emote = 2;
    if (e.code === 'KeyH') hud.toggleHelp();
    if (e.code === 'KeyR') hud.toast(sfx.radio.cycle(), 2000);
    if (e.code === 'KeyP') { keys.clear(); togglePhoto(); }
    if (e.code === 'KeyM') hud.toast(sfx.toggle() ? 'Sound off' : 'Sound on', 1500);
  });
  addEventListener('keyup', (e) => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());

  let drag = null;
  canvas.addEventListener('pointerdown', (e) => {
    if (mode !== 'game') return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
  });
  addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    cam.yaw -= (e.clientX - drag.x) * 0.006;
    cam.dragAt = performance.now();
    cam.pitch = THREE.MathUtils.clamp(cam.pitch + (e.clientY - drag.y) * 0.004, -0.05, 1.2);
    drag.x = e.clientX; drag.y = e.clientY;
  });
  addEventListener('pointerup', (e) => { if (drag && e.pointerId === drag.id) drag = null; });
  canvas.addEventListener('wheel', (e) => { cam.dist = THREE.MathUtils.clamp(cam.dist + e.deltaY * 0.01, 3, 16); }, { passive: true });

  if (isTouch) {
    const base = $('#h-joy'), knob = $('#h-knob');
    let jid = null;
    const move = (e) => {
      const r = base.getBoundingClientRect();
      let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      const d = Math.hypot(dx, dy), m = r.width / 2;
      if (d > m) { dx = (dx / d) * m; dy = (dy / d) * m; }
      joy.x = dx / m; joy.y = -dy / m;
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
    };
    base.addEventListener('pointerdown', (e) => { jid = e.pointerId; base.setPointerCapture(jid); move(e); });
    base.addEventListener('pointermove', (e) => { if (e.pointerId === jid) move(e); });
    const end = (e) => { if (e.pointerId === jid) { jid = null; joy.x = joy.y = 0; knob.style.transform = ''; } };
    base.addEventListener('pointerup', end);
    base.addEventListener('pointercancel', end);
    $('#t-e').addEventListener('click', interact);
    $('#t-jump').addEventListener('pointerdown', () => { touchBrake = true; jump(); });
    $('#t-jump').addEventListener('pointerup', () => { touchBrake = false; });
    $('#t-chat').addEventListener('click', () => hud.openChat());
    $('#t-dance').addEventListener('click', () => { player.emote = player.emote === 2 ? 0 : 2; });
    const tb = $('#t-boost');
    tb.addEventListener('pointerdown', () => { touchBoost = true; tb.classList.add('on'); });
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) tb.addEventListener(ev, () => { touchBoost = false; tb.classList.remove('on'); });
  }
  addEventListener('resize', onResize);
}

function onResize() {
  renderer.setSize(innerWidth, innerHeight);
  if (camera) { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); composer.setSize(innerWidth, innerHeight); }
  creator.resize();
}
addEventListener('resize', () => { if (!world) onResize(); });

function jump() {
  if (driving) { vehicles.hop(driving); return; }
  if (mode === 'game' && player.grounded && !hud.dialogueOpen) { player.vy = 7.2; player.grounded = false; player.emote = 0; }
}

// ---------- interaction ----------
function nearestInteractable() {
  let best = null, bd = Infinity;
  for (const n of npcs.list) {
    const d = Math.hypot(n.x - player.x, n.z - player.z) + Math.abs(n.y - player.y);
    const range = n.kind === 'rebecca' ? 3.2 : 2.4;
    if (d < range && d < bd) { best = { type: 'npc', n }; bd = d; }
  }
  return best;
}

function promptFor(it) {
  if (driving) return player.speed < 3 ? (driving.kind === 'car' ? 'Press E to get out' : 'Press E to hop off') : null;
  const nv = vehicles.nearest(player);
  if (nv && (!it || nv.d < 2)) return !nv.v ? 'Press E to take this car' : nv.v.kind === 'car' ? `Press E to drive the ${nv.v.name}` : 'Press E to ride the Jet Ski';
  if (!it) return null;
  if (it.type === 'booth') return 'Press E to open the Neon wardrobe';
  const n = it.n;
  if (n.kind === 'rebecca') return `Press E to talk to ${BESTIE}`;
  if (n.kind === 'neon') return 'Press E to change your outfit';
  return `Press E to talk to ${n.name}`;
}

function addProps(key, amount) {
  if (progress.talked.includes(key)) return;
  progress.talked.push(key);
  progress.props += amount;
  save('rm_progress', progress);
  updateStats();
}

function addCash(n) {
  progress.props += n;
  save('rm_progress', progress);
  updateStats();
}

function makeTicketMesh() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 512, 256); gr.addColorStop(0, '#fff3b0'); gr.addColorStop(0.5, '#ffcf3f'); gr.addColorStop(1, '#d99a00');
  g.fillStyle = gr; g.fillRect(0, 0, 512, 256);
  g.strokeStyle = '#7a4d00'; g.lineWidth = 8; g.setLineDash([16, 10]); g.strokeRect(14, 14, 484, 228);
  g.fillStyle = '#5a3600'; g.textAlign = 'center';
  g.font = '900 60px Inter, sans-serif'; g.fillText('GOLDEN TICKET', 256, 110);
  g.font = '800 30px Inter, sans-serif'; g.fillText('REACT MIAMI 2027 · ADMIT ONE', 256, 170);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.8), new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, emissive: '#ffb000', emissiveIntensity: 0.35, metalness: 0.4, roughness: 0.3 }));
  m.castShadow = true;
  return m;
}

function egg() {}
function eggUnused(id) {
  progress.eggs = progress.eggs || [];
  if (progress.eggs.includes(id) || TICKETS[id]?.claimedBy) return;
  if (!net.online) { hud.toast('You found a Golden Ticket spot! Connect online to claim it.', 4000); return; }
  progress.eggs.push(id);
  save('rm_progress', progress);
  net.send({ t: 'egg', id });
}

function finishRace(id, R, ms) {
  challenge('race');
  progress.best = progress.best || {};
  const pb = !progress.best[id] || ms < progress.best[id];
  if (pb) progress.best[id] = ms;
  addCash(R.reward);
  hud.banner('RACE COMPLETE', `${fmtTime(ms / 1000)}${pb ? ' · PERSONAL BEST' : ''} · +${R.reward} XP`, '#34D59A', 5000);
  sfx.mission?.();
  if (net.online) net.send({ t: 'score', race: id, ms });
}

function onLand(airT) {
  shake = Math.min(1, airT * 0.6);
  if (airT >= 0.7) challenge('stunt');
  if (airT >= 1.3 && driving?.kind === 'car') egg(1);
  if (airT < 0.7) return;
  const xp = Math.round(airT * 15) * 10;
  hud.banner('STUNT JUMP', `${airT.toFixed(1)}s airtime · +${xp} XP`, '#ff4fa3', 2600);
  addCash(xp);
}

function enterVehicle(v) {
  driving = v;
  v.driver = true;
  player.emote = 0;
  if (v.kind === 'car') me.root.visible = false;
  sfx.talk();
  hud.toast(`${v.name} · W/S drive · A/D steer · Shift boost · Space ${v.kind === 'car' ? 'handbrake drift' : 'jump'} · E exit`, 5000);
}

function exitVehicle() {
  const v = driving;
  const spot = vehicles.exitSpot(v);
  if (!spot) { hud.toast('Get closer to the shore or a dock to hop off', 2500); return; }
  driving = null;
  v.driver = false;
  v.vx = v.vz = v.fwd = v.steer = 0;
  player.x = spot.x; player.y = spot.y; player.z = spot.z;
  player.vx = player.vz = player.vy = 0;
  player.grounded = true;
  me.root.visible = true;
  hud.speedo(null);
  hud.speedFx(0);
}

function updateDriving(dt) {
  const v = driving;
  const ok = !hud.typing && !hud.dialogueOpen;
  const k = (c) => ok && keys.has(c);
  const inp = {
    thr: THREE.MathUtils.clamp((k('KeyW') || k('ArrowUp') ? 1 : 0) - (k('KeyS') || k('ArrowDown') ? 1 : 0) + (ok ? joy.y : 0), -1, 1),
    steer: THREE.MathUtils.clamp((k('KeyD') || k('ArrowRight') ? 1 : 0) - (k('KeyA') || k('ArrowLeft') ? 1 : 0) + (ok ? joy.x : 0), -1, 1),
    boost: k('ShiftLeft') || k('ShiftRight') || touchBoost,
    brake: k('Space') || touchBrake,
  };
  vehicles.drive(v, dt, t, inp, onLand);
  player.x = v.x; player.y = v.y; player.z = v.z; player.heading = v.h;
  player.speed = Math.abs(v.fwd);
  player.grounded = true;
  if (v.kind === 'ski') {
    me.root.position.set(v.x, v.g.position.y + 0.42, v.z);
    me.root.rotation.y = v.h;
    me.update(dt, 0, false, 0);
  }
  const mph = Math.abs(v.fwd) * 2.237;
  hud.speedo({ mph, name: v.name, boost: inp.boost });
  hud.speedFx((mph - 60) / 60);
  if (v.kind === 'car' && mph >= 120) challenge('speed');
  if (v.kind === 'ski' && mph > 5) { skiT += dt; if (skiT >= 1) { skiT -= 1; challenge('ski'); } }
}
let touchBrake = false, touchBoost = false;

function interact() {
  if (mode !== 'game' || hud.dialogueOpen) return;
  if (driving) return exitVehicle();
  const nv = vehicles.nearest(player);
  const it = nearestInteractable();
  if (nv && (!it || nv.d < 2)) { const v = nv.v || vehicles.hijack(nv.traffic); if (v) enterVehicle(v); return; }
  if (!it) return;
  sfx.talk();
  if (it.type === 'booth') return openNeon(npcs.neonRep);
  const n = it.n;
  if (n.kind === 'rebecca') return missions.talk();
  if (n.kind === 'neon') return openWardrobe();
  const line = n.lines[Math.floor(Math.random() * n.lines.length)];
  n.c.say(line);
  n.talkUntil = n.c.t + 4;
  hud.subtitle(n.name, line);
  addProps(n.name, 50);
  challenge('npc');
}

function openRebecca(n) {
  dialogueNpc = n;
  player.emote = 0;
  const show = (key) => {
    const nodes = rebeccaDialogue({ name: profile.name, swag: progress.swag, total: TOTAL, missionStarted: progress.missionStarted, metRebecca: progress.metRebecca });
    if (key === 'link') { window.open('https://www.reactmiami.com', '_blank', 'noopener'); key = 'start'; }
    const node = nodes[key];
    if (node.effect === 'startMission' && !progress.missionStarted) {
      progress.missionStarted = true;
      save('rm_progress', progress);
      updateStats();
      hud.toast('MISSION STARTED: NEON SWAG HUNT');
      sfx.collect();
    }
    if (node.effect === 'reward') progress.unlocked = true;
    hud.openDialogue('REBECCA BAKELS · ORGANIZER', node.text, node.options, (i) => { sfx.click(); show(node.options[i][1]); });
    if (key === 'bye') setTimeout(endDialogue, 1600);
  };
  show('start');
  if (!progress.metRebecca) {
    progress.metRebecca = true;
    addProps('rebecca', 500);
  }
}

function openNeon(n) {
  dialogueNpc = n;
  const show = (key) => {
    const nodes = {
      start: { text: 'Welcome to the Neon booth! We are the Diamond Sponsor of React Miami. Want to try on some swag?', options: [['Open the wardrobe', 'wardrobe'], ['How does Neon power this game?', 'powers'], ['What does Neon do?', 'what'], ['Any tips?', 'tip'], ['Just looking, thanks', 'bye']] },
      what: { text: 'Neon is serverless Postgres. You get a database in seconds, it autoscales, it scales to zero when idle, and you can branch it like Git. A full copy of your data for every preview deploy.', options: [['Open the wardrobe', 'wardrobe'], ['Back', 'start']] },
      tip: { text: progress.swag.length >= TOTAL ? 'You found every crate. Respect. The Diamond Hoodie is in the wardrobe now.' : `We hid ${TOTAL} swag crates around the venue. Follow the green light beams. Find them all and Rebecca unlocks the Diamond Hoodie.`, options: [['Open the wardrobe', 'wardrobe'], ['Back', 'start']] },
      bye: { text: 'Come back anytime. Go branch something!', options: [] },
      powers: { text: 'This whole global chat runs on Neon. Every message you send is a row in Neon Postgres, and Neon Realtime pushes it to every player in Miami the instant it commits. Ask me anything about it.', options: [['Neon Realtime?', 'realtime'], ['The database?', 'pg'], ['Is it secure?', 'secure'], ['Back', 'start']] },
      realtime: { text: 'Neon Realtime makes any SQL query live. Your browser subscribes to one query, the latest 40 chat messages, and Neon streams each new row over a WebSocket the moment it lands. No polling, no extra message broker. Just Postgres.', options: [['The database?', 'pg'], ['Is it secure?', 'secure'], ['Back', 'start']] },
      pg: { text: 'Underneath is Neon serverless Postgres 18. Chat, race results and golden ticket shout-outs all land in the same table, so the history is just SQL. It autoscales with the crowd and can scale to zero when Miami goes to sleep.', options: [['Neon Realtime?', 'realtime'], ['Is it secure?', 'secure'], ['Back', 'start']] },
      secure: { text: 'Your browser never sees a database password. A Vercel function seals the live query with a secret, so players can only subscribe to exactly that query. Sending a message is a plain INSERT through another function. And to test a new feature we branch the database in a second.', options: [['Neon Realtime?', 'realtime'], ['Open the wardrobe', 'wardrobe'], ['Back', 'start']] },
    };
    if (key === 'wardrobe') { endDialogue(); openWardrobe(); return; }
    hud.openDialogue('NEON CREW · DIAMOND SPONSOR', nodes[key].text, nodes[key].options, (i) => { sfx.click(); show(nodes[key].options[i][1]); });
    if (key === 'bye') setTimeout(endDialogue, 1400);
  };
  show('start');
  addProps('neon', 250);
}

function openWardrobe() {
  mode = 'creator';
  keys.clear();
  $('#hud').classList.add('hidden');
  creator.show({ look: profile.look, name: profile.name, mode: 'wardrobe', unlocked: progress.unlocked });
}

function endDialogue() {
  hud.closeDialogue();
  dialogueNpc = null;
}

function collectSwag() {
  for (const cr of world.crates) {
    if (!cr.g.visible) continue;
    const d = Math.hypot(cr.x - player.x, cr.z - player.z);
    if (d < 1.4 && Math.abs(cr.y - player.y) < 1.5) {
      cr.g.visible = false;
      progress.swag.push(cr.i);
      progress.props += 1000;
      if (!progress.missionStarted) progress.missionStarted = true;
      const found = progress.swag.length;
      if (found >= TOTAL) {
        progress.unlocked = true;
        hud.banner('MISSION PASSED', 'Diamond Hoodie unlocked · +RESPECT', '#ffd23f', 5500);
        sfx.mission();
        hud.log(null, 'Rebecca wants to see you. The Diamond Hoodie is now in the Neon wardrobe.');
      } else {
        hud.toast(`NEON SWAG ${found}/${TOTAL} · +1,000 XP`);
        challenge('swag');
        sfx.collect();
      }
      save('rm_progress', progress);
      updateStats();
    }
  }
}

// ---------- simulation ----------
const tmpV = new THREE.Vector3();
const camTarget = new THREE.Vector3();
const lookAt = new THREE.Vector3();
const ray = new THREE.Raycaster();
let netTimer = 0;

function updatePlayer(dt) {
  let ix = 0, iy = 0;
  if (!hud.typing && !hud.dialogueOpen) {
    if (keys.has('KeyW') || keys.has('ArrowUp')) iy += 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) iy -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) ix += 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) ix -= 1;
    ix += joy.x; iy += joy.y;
  }
  const len = Math.hypot(ix, iy);
  if (len > 1) { ix /= len; iy /= len; }
  const sprint = keys.has('ShiftLeft') || keys.has('ShiftRight') || touchBoost || Math.hypot(joy.x, joy.y) > 0.95;
  const sy = Math.sin(cam.yaw), cy = Math.cos(cam.yaw);
  const mx = -sy * iy + cy * ix, mz = -cy * iy - sy * ix;
  const top = Math.min(len, 1) * (sprint ? 8.5 : 4.5);
  const k = 1 - Math.exp(-dt * 12);
  const ml = Math.hypot(mx, mz) || 1;
  player.vx += ((mx / ml) * top - player.vx) * k;
  player.vz += ((mz / ml) * top - player.vz) * k;
  if (len > 0.05) { player.heading = angleLerp(player.heading, Math.atan2(mx, mz), Math.min(1, dt * 12)); player.emote = 0; }

  const ox = player.x, oz = player.z;
  const tryAt = (x, z) => world.heightAt(x, z, player.y) !== null;
  let nx = player.x + player.vx * dt, nz = player.z + player.vz * dt;
  if (tryAt(nx, nz)) { player.x = nx; player.z = nz; }
  else if (tryAt(nx, player.z)) { player.x = nx; player.vz *= 0.5; }
  else if (tryAt(player.x, nz)) { player.z = nz; player.vx *= 0.5; }
  world.collide(player, 0.35, world.carSolids());
  if (!tryAt(player.x, player.z)) { player.x = ox; player.z = oz; }

  const ground = world.heightAt(player.x, player.z, player.y) ?? 0;
  if (player.grounded && player.y - ground < 0.35 && player.vy <= 0) { player.y = ground; player.vy = 0; }
  else {
    player.vy -= 22 * dt;
    player.y += player.vy * dt;
    player.grounded = false;
    if (player.y <= ground) { player.y = ground; player.vy = 0; player.grounded = true; }
  }
  player.speed = Math.hypot(player.vx, player.vz);
  me.root.position.set(player.x, player.y, player.z);
  me.root.rotation.y = player.heading;
  me.update(dt, player.speed, !player.grounded, player.emote);
}

function updateCamera(dt) {
  if (dialogueNpc) {
    const n = dialogueNpc;
    const dx = player.x - n.x, dz = player.z - n.z;
    const dl = Math.hypot(dx, dz) || 1;
    const ux = dx / dl, uz = dz / dl;
    tmpV.set(n.x + ux * 2.6 + uz * 1.1, n.y + 1.8, n.z + uz * 2.6 - ux * 1.1);
    camera.position.lerp(tmpV, 1 - Math.exp(-dt * 4));
    lookAt.lerp(tmpV.set(n.x + ux * 0.6, n.y + 1.55, n.z + uz * 0.6), 1 - Math.exp(-dt * 6));
    camera.lookAt(lookAt);
    return;
  }
  if (driving && performance.now() - (cam.dragAt || 0) > 1500 && Math.abs(driving.fwd) > 1) cam.yaw = angleLerp(cam.yaw, driving.h + Math.PI, Math.min(1, dt * 3));
  const fov = driving ? 56 + Math.min(18, Math.abs(driving.fwd) * 0.3) : 52;
  if (Math.abs(camera.fov - fov) > 0.05) { camera.fov += (fov - camera.fov) * Math.min(1, dt * 3); camera.updateProjectionMatrix(); }
  if (driving) camTarget.set(player.x, player.y + (driving.kind === 'car' ? 1.6 : 1.8), player.z);
  else camTarget.set(player.x + Math.cos(cam.yaw) * 0.45, player.y + 1.5, player.z - Math.sin(cam.yaw) * 0.45);
  const cp = Math.cos(cam.pitch);
  tmpV.set(Math.sin(cam.yaw) * cp, Math.sin(cam.pitch), Math.cos(cam.yaw) * cp);
  let dist = driving ? (driving.kind === 'car' ? 7.5 : 6) : cam.dist;
  ray.set(camTarget, tmpV);
  ray.far = dist;
  const hit = ray.intersectObjects(world.buildingMeshes, false)[0];
  if (hit) dist = Math.max(1.2, hit.distance - 0.3);
  const desired = camTarget.clone().addScaledVector(tmpV, dist);
  if (shake > 0.01) { desired.x += (Math.random() - 0.5) * shake * 0.5; desired.y += (Math.random() - 0.5) * shake * 0.5; shake *= Math.exp(-dt * 6); }
  desired.y = Math.max(desired.y, player.y + 0.4);
  camera.position.lerp(desired, 1 - Math.exp(-dt * 18));
  lookAt.lerp(camTarget, 1 - Math.exp(-dt * 18));
  camera.lookAt(lookAt);
}

function updateRemotes(dt) {
  const k = 1 - Math.exp(-dt * 10);
  for (const r of remotes.values()) {
    const px = r.x, pz = r.z;
    r.x += (r.tx - r.x) * k; r.y += (r.ty - r.y) * k; r.z += (r.tz - r.z) * k;
    r.r = angleLerp(r.r, r.tr, k);
    const sp = r.a === 2 ? 8 : r.a === 1 ? 4.5 : Math.hypot(r.x - px, r.z - pz) / dt > 0.5 ? 3 : 0;
    r.c.root.position.set(r.x, r.y, r.z);
    r.c.root.rotation.y = r.r;
    if ((r.veh || 0) !== (r.vehCode || 0)) {
      if (r.vehMesh) scene.remove(r.vehMesh);
      r.vehMesh = r.veh ? vehicles.remoteModel(r.veh) : null;
      if (r.vehMesh) scene.add(r.vehMesh);
      r.vehCode = r.veh || 0;
      r.c.root.visible = !(r.vehMesh && r.veh < 20);
    }
    if (r.vehMesh) {
      r.vehMesh.position.set(r.x, r.y, r.z);
      r.vehMesh.rotation.y = r.r;
      if (r.veh >= 20) r.c.root.position.y = r.y + 0.42;
      r.c.update(dt, 0, false, 0);
      continue;
    }
    r.c.update(dt, sp, r.a === 3, r.a === 4 ? 1 : r.a === 5 ? 2 : 0);
  }
}

function blips() {
  const list = [...missions.blips()];
  for (const r of remotes.values()) list.push({ x: r.x, z: r.z, color: '#29d3ff', shape: 'dot' });
  list.push(...races.blips());
  let near = null, nd = Infinity;
  for (const v of vehicles.list) {
    if (v.driver || v === driving) continue;
    const d = Math.hypot(v.x - player.x, v.z - player.z);
    const b = { x: v.x, z: v.z, color: v.kind === 'car' ? CAR_TYPES[v.type].color : '#29d3ff', shape: v.kind, edge: false };
    if (v.kind === 'car' && d < nd) { nd = d; near = b; }
    list.push(b);
  }
  if (near) near.edge = true;
  return list;
}

const FLY = [[-11, -30, 30, 18, 4], [60, 30, 120, 10, 2.5], [100, 0, 125, 6, 30], [-44, 38, -90, 40, 6]];
function renderSplash(dt) {
  const shot = FLY[Math.floor(t / 9) % FLY.length];
  const k = (t % 9) / 9;
  const [lx, lz, cx, cy, cz] = shot;
  const a = k * 0.5 - 0.25;
  const dx = cx - lx, dz = cz - lz;
  camera.position.set(lx + dx * Math.cos(a) - dz * Math.sin(a), cy + k * 3, lz + dx * Math.sin(a) + dz * Math.cos(a));
  camera.lookAt(lx, 6 + k * 2, lz);
  npcs.update(dt, SPLASH_PLAYER);
  world.update(t, dt, SPLASH_PLAYER);
  grade.uniforms.time.value = t;
  composer.render();
}
const SPLASH_PLAYER = { x: 9999, y: 0, z: 9999 };

function frame() {
  const now = performance.now();
  const dt = Math.min(1 / 20, (now - lastNow) / 1000);
  lastNow = now;
  t += dt;
  if (mode === 'creator' || mode === 'splash') {
    if (mode === 'creator') creator.render(dt);
    else if (world) renderSplash(dt);
    return;
  }
  if (mode !== 'game') return;
  if (driving) updateDriving(dt); else updatePlayer(dt);
  vehicles.update(dt, t);
  if (ticketMesh.visible) {
    ticketMesh.rotation.y += dt * 1.5;
    ticketMesh.position.y = 1.3 + Math.sin(t * 2) * 0.15;
    if (!driving && Math.hypot(player.x - 226, player.z - 104) < 2.5) egg(2);
  }
  if (!driving && player.emote === 2 && player.y > 3.8 && Math.abs(player.x - YACHT.x) < 6.5 && player.z > YACHT.z - 14.5 && player.z < YACHT.z + 4.5) { danceT += dt; if (danceT > 3) challenge('dance'); } else danceT = 0;
  missions.update(dt, t, player);
  races.update(dt, t, driving, player);
  npcs.update(dt, player);
  updateRemotes(dt);
  world.update(t, dt, player);
  collectSwag();
  updateCamera(dt);
  hud.prompt(hud.dialogueOpen ? null : promptFor(nearestInteractable()));
  if (dialogueNpc && Math.hypot(dialogueNpc.x - player.x, dialogueNpc.z - player.z) > 6) endDialogue();
  hud.drawMap(player, cam.yaw, player.heading, blips());
  netTimer += dt;
  if (netTimer > 0.1 && net.online) {
    netTimer = 0;
    const a = driving ? 0 : !player.grounded ? 3 : player.speed > 6 ? 2 : player.speed > 0.4 ? 1 : player.emote === 1 ? 4 : player.emote === 2 ? 5 : 0;
    net.state([player.x, player.y, player.z, player.heading, a, driving ? vehicles.code(driving) : 0]);
  }
  grade.uniforms.time.value = t;
  composer.render();
}

let lastNow = performance.now();
if (new URLSearchParams(location.search).has('debug')) window.__rm = { get missions() { return missions; }, get npcs() { return npcs; }, get player() { return player; }, get world() { return world; }, get scene() { return scene; }, get composer() { return composer; }, get vehicles() { return vehicles; }, get driving() { return driving; }, get races() { return races; }, get t() { return t; }, renderer, progress, cam, interact, keys };
main();

if (isTouch) document.getElementById('start')?.addEventListener('click', () => {
  document.documentElement.requestFullscreen?.({ navigationUI: 'hide' }).then(() => screen.orientation?.lock?.('landscape')).catch(() => {});
}, { once: true });
