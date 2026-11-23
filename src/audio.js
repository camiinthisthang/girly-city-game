let ctx = null;
let muted = localStorage.getItem('rm_muted') === '1';

function ac() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, start, dur, type = 'square', vol = 0.08) {
  const c = ac();
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, c.currentTime + start);
  g.gain.linearRampToValueAtTime(vol, c.currentTime + start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur);
  o.connect(g).connect(c.destination);
  o.start(c.currentTime + start);
  o.stop(c.currentTime + start + dur + 0.05);
}

let noiseBuf = null;
function noiseSrc(c) {
  if (!noiseBuf) { noiseBuf = c.createBuffer(1, c.sampleRate * 0.3, c.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const s = c.createBufferSource(); s.buffer = noiseBuf; return s;
}
function voice(c, bus, type, f, t, dur, vol) {
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.value = f;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(bus); o.start(t); o.stop(t + dur + 0.05);
}
function kick(c, bus, t) {
  const o = c.createOscillator(), g = c.createGain();
  o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
  g.gain.setValueAtTime(0.8, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
  o.connect(g).connect(bus); o.start(t); o.stop(t + 0.35);
}
function hit(c, bus, t, hp, vol, dur) {
  const s = noiseSrc(c), f = c.createBiquadFilter(), g = c.createGain();
  f.type = 'highpass'; f.frequency.value = hp;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f).connect(g).connect(bus); s.start(t); s.stop(t + dur + 0.02);
}
const STATIONS = [
  { name: 'NEON FM · Synthwave', bpm: 100, play(c, bus, step, t, dt) {
    const s = step % 16, bar = Math.floor(step / 16) % 4;
    const root = [110, 87.31, 130.81, 98][bar], minor = bar === 0;
    if (s % 4 === 0) kick(c, bus, t);
    if (s === 4 || s === 12) hit(c, bus, t, 1500, 0.35, 0.16);
    if (s % 2 === 1) hit(c, bus, t, 7000, 0.08, 0.04);
    if (s % 2 === 0) voice(c, bus, 'sawtooth', root / 2, t, dt * 1.8, 0.07);
    const iv = (minor ? [0, 3, 7, 12] : [0, 4, 7, 12])[s % 4];
    voice(c, bus, 'square', root * 2 * 2 ** (iv / 12), t, dt * 0.9, 0.025);
    if (s === 0) for (const k of minor ? [0, 3, 7] : [0, 4, 7]) voice(c, bus, 'sawtooth', root * 2 ** (k / 12), t, dt * 15, 0.012);
  } },
  { name: 'VICE 305 · Reggaeton', bpm: 96, play(c, bus, step, t, dt) {
    const s = step % 16, bar = Math.floor(step / 16) % 4;
    const root = [110, 87.31, 98, 82.41][bar];
    if (s % 4 === 0) { kick(c, bus, t); voice(c, bus, 'sine', root / 2, t, dt * 3, 0.22); }
    if ([3, 6, 11, 14].includes(s)) hit(c, bus, t, 1200, 0.32, 0.12);
    if (s % 2 === 0) hit(c, bus, t, 8000, 0.05, 0.03);
    if (s % 2 === 0) voice(c, bus, 'triangle', root * 4 * 2 ** ([0, 7, 12, 7, 3, 7, 12, 15][s / 2] / 12), t, dt * 1.6, 0.04);
  } },
];
const radio = {
  on: -1, timer: null, step: 0, next: 0, bus: null,
  cycle() {
    this.on = this.on + 1 >= STATIONS.length ? -1 : this.on + 1;
    this.halt();
    if (this.on >= 0) {
      const c = ac();
      this.bus = c.createGain(); this.bus.gain.value = muted ? 0 : 0.5; this.bus.connect(c.destination);
      this.step = 0; this.next = c.currentTime + 0.1;
      this.timer = setInterval(() => this.tick(), 50);
    }
    return this.on >= 0 ? STATIONS[this.on].name : 'Radio off';
  },
  halt() {
    clearInterval(this.timer); this.timer = null;
    if (this.bus) { const b = this.bus; b.gain.setTargetAtTime(0, ac().currentTime, 0.05); setTimeout(() => b.disconnect(), 400); this.bus = null; }
  },
  tick() {
    const c = ac(), S = STATIONS[this.on], dt = 60 / S.bpm / 4;
    while (this.next < c.currentTime + 0.2) { S.play(c, this.bus, this.step, this.next, dt); this.step++; this.next += dt; }
  },
};

export const sfx = {
  radio,
  get muted() { return muted; },
  toggle() { muted = !muted; localStorage.setItem('rm_muted', muted ? '1' : '0'); if (radio.bus) radio.bus.gain.value = muted ? 0 : 0.5; return muted; },
  unlock() { try { ac(); } catch {} },
  click() { if (!muted) tone(660, 0, 0.06, 'triangle', 0.05); },
  talk() { if (!muted) { tone(520, 0, 0.05, 'triangle', 0.04); tone(780, 0.05, 0.05, 'triangle', 0.04); } },
  collect() { if (!muted) [784, 988, 1175, 1568].forEach((f, i) => tone(f, i * 0.07, 0.18, 'square', 0.05)); },
  mission() {
    if (muted) return;
    [[392, 0], [523, 0.18], [659, 0.36], [784, 0.54], [1047, 0.8]].forEach(([f, t]) => { tone(f, t, 0.5, 'sawtooth', 0.04); tone(f / 2, t, 0.5, 'triangle', 0.05); });
  },
  chat() { if (!muted) tone(880, 0, 0.05, 'sine', 0.04); },
};
