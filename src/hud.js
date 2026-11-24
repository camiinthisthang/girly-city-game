import { drawNeonMark } from './textures.js';
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const MAP_COLORS = { land: '#e3d7bf', grass: '#86c873', plaza: '#f3e8d5', walk: '#c99f6e', road: '#55555e', bridge: '#efe9dd', dock: '#a57b52', yacht: '#ffffff', building: '#a9a0c4' };

export class Hud {
  constructor(root, { onChat, mapShapes, isTouch }) {
    this.root = root;
    this.onChat = onChat;
    this.isTouch = isTouch;
    root.innerHTML = `
      <div class="hud-top-right">
        <div class="props" id="h-props">RANK 1</div><div class="xpbar"><b id="h-xp"></b></div><div class="xptext" id="h-xptext"></div>
        <div class="stars" id="h-stars"></div>
        <div class="mission hidden" id="h-mission"><span class="m-title">NEON SWAG HUNT</span><span id="h-mcount"></span></div>
        <div class="online" id="h-online">Connecting...</div>
      </div>
      <div class="hud-top-left">
        <button class="help-btn" id="h-helpbtn">${isTouch ? 'Help' : 'H · Controls'}</button>
        <div class="help hidden" id="h-help">
          <div><b>WASD / Arrows</b> move</div><div><b>Shift</b> sprint</div><div><b>Space</b> jump</div>
          <div><b>Drag</b> look around · <b>Scroll</b> zoom</div><div><b>E</b> talk / interact</div>
          <div><b>Enter</b> chat with everyone</div><div><b>1</b> wave · <b>2</b> dance</div><div><b>M</b> mute · <b>H</b> hide this</div><div><b>E</b> take any car or jet ski (car icons on the map) · <b>R</b> radio · <b>P</b> photo mode · type <b>/stuck</b> if trapped</div>
        </div>
      </div>
      <div class="radar"><canvas class="minimap" id="h-map" width="300" height="190"></canvas><div class="bars"><i class="hp"><b></b></i><i class="ar"><b id="h-armor"></b></i></div></div>
      <div class="chat" id="h-chat">
        <div class="chat-head"><span>GLOBAL CHAT</span><em id="h-chatcount">offline</em><button id="h-chatmin" title="Minimise">–</button></div>
        <div class="chat-log" id="h-log"></div>
        <form class="chat-form" id="h-chatform"><input id="h-chatin" maxlength="140" autocomplete="off" placeholder="${isTouch ? 'Tap to chat with everyone…' : 'Press Enter to chat with everyone…'}" /></form>
      </div>
      <div class="prompt hidden" id="h-prompt"></div>
      <div class="speedo hidden" id="h-speedo"><b id="h-mph">0</b><span>MPH</span><i id="h-vname"></i></div>
      <div class="racebox hidden" id="h-race"><div id="h-rname"></div><b id="h-rtime">0:00.00</b><span id="h-rcp"></span></div>
      <div class="board hidden" id="h-board"></div>
      <div class="daily" id="h-daily"></div>
      <div class="speedfx" id="h-speedfx"></div>
      <div class="ticket hidden" id="h-ticket"><div class="tk-card"><div class="tk-top">GOLDEN TICKET <span id="h-tknum"></span></div><div class="tk-title">FREE TICKET TO REACT MIAMI 2027</div><div class="tk-name" id="h-tkname"></div><div class="tk-code" id="h-tkcode"></div><div class="tk-how">Screenshot this and DM <b>@ReactMiami</b> to claim it.</div><button class="primary" id="h-tkclose">NICE</button></div></div>
      <div class="subtitle hidden" id="h-sub"></div>
      <div class="toast hidden" id="h-toast"></div>
      <div class="banner hidden" id="h-banner"><div class="b-title" id="h-btitle"></div><div class="b-sub" id="h-bsub"></div></div>
      <div class="dialogue hidden" id="h-dialogue">
        <div class="d-name" id="h-dname"></div>
        <div class="d-text" id="h-dtext"></div>
        <div class="d-options" id="h-dopts"></div>
      </div>
      <div class="touch ${isTouch ? '' : 'hidden'}">
        <div class="joy" id="h-joy"><div class="knob" id="h-knob"></div></div>
        <div class="tbtns">
          <button id="t-e">E</button><button id="t-jump">JUMP</button><button id="t-chat">CHAT</button><button id="t-dance">DANCE</button><button id="t-boost">BOOST</button>
        </div>
      </div>`;
    this.$ = (id) => root.querySelector('#' + id);
    this.typing = false;
    this.dialogueOpen = false;
    this.buildMap(mapShapes);
    const form = this.$('h-chatform');
    const input = this.$('h-chatin');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const v = input.value.trim();
      if (v) this.onChat(v);
      this.closeChat();
    });
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') this.closeChat();
    });
    input.addEventListener('blur', () => setTimeout(() => this.closeChat(), 50));
    input.addEventListener('focus', () => { if (!this.typing) this.openChat(); });
    this.$('h-chatmin').addEventListener('click', () => this.$('h-chat').classList.toggle('min'));
    this.$('h-helpbtn').addEventListener('click', () => this.toggleHelp());
    if (!isTouch && !localStorage.getItem('rm_seenhelp')) { this.toggleHelp(true); localStorage.setItem('rm_seenhelp', '1'); setTimeout(() => this.toggleHelp(false), 12000); }
  }

  toggleHelp(force) { this.$('h-help').classList.toggle('hidden', force === undefined ? undefined : !force); }

  buildMap(shapes) {
    const S = 2;
    const c = document.createElement('canvas');
    c.width = 1200; c.height = 1200;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#3fb3c6';
    ctx.fillRect(0, 0, c.width, c.height);
    const order = ['land', 'grass', 'plaza', 'walk', 'road', 'bridge', 'dock', 'building', 'yacht'];
    for (const type of order) {
      for (const s of shapes.filter((x) => x.type === type)) {
        ctx.fillStyle = MAP_COLORS[type];
        if (type === 'building') ctx.fillStyle = s.h > 60 ? '#8f85b3' : '#aaa1c6';
        const x = (s.x0 + 300) * S, y = (s.z0 + 300) * S, w = (s.x1 - s.x0) * S, h = (s.z1 - s.z0) * S;
        if (type === 'yacht') {
          ctx.beginPath();
          ctx.moveTo(x, y + h); ctx.lineTo(x, y + h * 0.3); ctx.lineTo(x + w / 2, y); ctx.lineTo(x + w, y + h * 0.3); ctx.lineTo(x + w, y + h);
          ctx.fill();
        } else ctx.fillRect(x, y, w, h);
      }
    }
    this.mapImg = c;
    this.mapScale = S;
  }

  drawMap(player, yaw, heading, blips) {
    const cv = this.$('h-map');
    const ctx = cv.getContext('2d');
    const W = cv.width, H = cv.height, CX = W / 2, CY = H * 0.62;
    const zoom = 1.25;
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.clip();
    ctx.fillStyle = '#1d3d4a'; ctx.fillRect(0, 0, W, H);
    ctx.translate(CX, CY);
    ctx.rotate(yaw);
    ctx.scale(zoom / this.mapScale, zoom / this.mapScale);
    ctx.drawImage(this.mapImg, -(player.x + 300) * this.mapScale, -(player.z + 300) * this.mapScale);
    ctx.restore();
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(0, 0, W, H);
    const cos = Math.cos(yaw), sin = Math.sin(yaw);
    for (const b of blips) {
      const rx = b.x - player.x, rz = b.z - player.z;
      let mx = (rx * cos - rz * sin) * zoom, my = (rx * sin + rz * cos) * zoom;
      const lx = CX - 12, ly0 = CY - 12, ly1 = H - CY - 12;
      const out = Math.abs(mx) > lx || my < -ly0 || my > ly1;
      if (out) {
        if (!b.edge) continue;
        const k = Math.min(lx / Math.abs(mx || 1e-6), (my < 0 ? ly0 : ly1) / Math.abs(my || 1e-6));
        mx *= k; my *= k;
      }
      ctx.save();
      ctx.translate(CX + mx, CY + my);
      ctx.fillStyle = b.color;
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      if (b.shape === 'hq') {
        const ph = (performance.now() / 1000) % 1.2 / 1.2;
        ctx.strokeStyle = `rgba(255,122,26,${1 - ph})`; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(0, 0, 12 + ph * 12, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = '#ffbf9b'; ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.roundRect(-16, -10, 32, 20, 5); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.font = '900 13px Inter, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('HQ', 0, 1);
        ctx.restore();
        continue;
      } else if (b.shape === 'car') {
        ctx.beginPath(); ctx.roundRect(-7, -4.5, 14, 9, 3); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#111'; ctx.fillRect(1, -3, 3, 6);
      } else if (b.shape === 'ski') {
        ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(4, 5); ctx.lineTo(-4, 5); ctx.closePath(); ctx.fill(); ctx.stroke();
      } else if (b.shape === 'diamond') {
        ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(6, 0); ctx.lineTo(0, 7); ctx.lineTo(-6, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      } else if (b.shape === 'dot') {
        ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      } else {
        ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        if (b.label === 'neon') { ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill(); drawNeonMark(ctx, -5.5, -5.5, 11); ctx.restore(); continue; }
        ctx.fillStyle = '#000';
        ctx.font = '13px Anton, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(b.label, 0, 1);
      }
      ctx.restore();
    }
    ctx.save();
    ctx.translate(CX, CY);
    ctx.rotate(Math.PI - heading + yaw);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(7, 7); ctx.lineTo(0, 3); ctx.lineTo(-7, 7); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
    const nAng = -yaw - Math.PI / 2;
    const k = Math.min((CX - 12) / Math.abs(Math.cos(nAng) || 1e-6), (CY - 12) / Math.abs(Math.sin(nAng) || 1e-6));
    const px = CX + Math.cos(nAng) * k, py = CY + Math.sin(nAng) * k;
    ctx.fillStyle = '#fff';
    ctx.font = '15px Anton, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
    ctx.strokeText('N', px, py); ctx.fillText('N', px, py);
  }

  setStats({ rank, props, found, total, missionStarted }) {
    this.$('h-props').textContent = `RANK ${rank.rank}`;
    this.$('h-xp').style.width = Math.min(100, (rank.into / rank.need) * 100) + '%';
    this.$('h-xptext').textContent = `${props.toLocaleString('en-US')} XP`;
    const stars = Math.round((found / total) * 5);
    this.$('h-armor').style.width = Math.round((found / total) * 100) + '%';
    this.$('h-mission').classList.toggle('hidden', !missionStarted && found === 0);
    this.$('h-mcount').textContent = found >= total ? 'COMPLETE' : `${found} / ${total}`;
  }

  setOnline(n, connected) {
    this.$('h-online').textContent = connected ? `${n} online` : 'Offline · solo mode';
    this.$('h-online').classList.toggle('off', !connected);
    this.$('h-chatcount').textContent = connected ? `${n} connected` : 'offline';
  }

  speedo(s) {
    const el = this.$('h-speedo');
    el.classList.toggle('hidden', !s);
    if (!s) return;
    this.$('h-mph').textContent = Math.round(s.mph);
    this.$('h-vname').textContent = s.boost ? 'BOOST' : s.name;
    el.classList.toggle('boost', !!s.boost);
  }

  race(r) {
    const el = this.$('h-race');
    el.classList.toggle('hidden', !r);
    if (!r) return;
    this.$('h-rname').textContent = r.name;
    this.$('h-rtime').textContent = `${Math.floor(r.time / 60)}:${(r.time % 60).toFixed(2).padStart(5, '0')}`;
    this.$('h-rcp').textContent = `CHECKPOINT ${r.cp + 1} / ${r.total}`;
  }

  ticket(t) {
    this.$('h-tknum').textContent = `${t.id} OF 2`;
    this.$('h-tkname').textContent = `${t.title} · found by ${t.name}`;
    this.$('h-tkcode').textContent = t.code;
    this.$('h-ticket').classList.remove('hidden');
    this.$('h-tkclose').onclick = () => this.$('h-ticket').classList.add('hidden');
  }

  setDaily(list) {
    this.$('h-daily').innerHTML = '<div class="dt">DAILY CHALLENGES</div>' + list.map((c) => `<div class="dc${c.done ? ' done' : ''}"><span>${c.done ? '✓' : '○'} ${esc(c.text)}</span><b>${c.done ? 'DONE' : c.n > 1 ? `${Math.min(c.p, c.n)}/${c.n}` : `+${c.xp}`}</b></div>`).join('');
  }

  speedFx(k) { this.$('h-speedfx').style.opacity = Math.max(0, Math.min(1, k)).toFixed(2); }

  setBoard(boards) {
    const el = this.$('h-board');
    const names = { street: 'STREET RACE', bay: 'JET SKI RUN' };
    const parts = Object.entries(boards || {}).filter(([, b]) => b.length).map(([k, b]) => `<div class="bh">${names[k] || k}</div>` + b.slice(0, 3).map(([n, ms], i) => `<div class="br"><span>${i + 1}. ${esc(n)}</span><b>${(ms / 1000).toFixed(2)}s</b></div>`).join(''));
    el.classList.toggle('hidden', !parts.length);
    el.innerHTML = parts.length ? '<div class="bt">LEADERBOARD</div>' + parts.join('') : '';
  }

  prompt(text) {
    const el = this.$('h-prompt');
    if (text === this._prompt) return;
    this._prompt = text;
    el.classList.toggle('hidden', !text);
    if (text) el.innerHTML = this.isTouch ? esc(text).replace('Press E', 'Tap E') : esc(text).replace('Press E', 'Press <kbd>E</kbd>');
  }

  subtitle(name, text, ms = 4500) {
    const el = this.$('h-sub');
    el.innerHTML = `<b>${esc(name)}:</b> ${esc(text)}`;
    el.classList.remove('hidden');
    clearTimeout(this._subT);
    this._subT = setTimeout(() => el.classList.add('hidden'), ms);
  }

  toast(text, ms = 3200) {
    const el = this.$('h-toast');
    el.textContent = text;
    el.classList.remove('hidden');
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => el.classList.add('hidden'), ms);
  }

  banner(title, sub, color = '#ffd98a', ms = 4200) {
    const el = this.$('h-banner');
    this.$('h-btitle').textContent = title;
    this.$('h-btitle').style.color = color;
    this.$('h-bsub').textContent = sub || '';
    el.classList.remove('hidden');
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
    clearTimeout(this._banT);
    this._banT = setTimeout(() => el.classList.add('hidden'), ms);
  }

  log(name, text, color = '#fff', old = false) {
    const log = this.$('h-log');
    const stick = log.scrollTop + log.clientHeight >= log.scrollHeight - 30;
    const line = document.createElement('div');
    line.className = 'line' + (old ? ' old' : '');
    line.innerHTML = name ? `<b style="color:${color}">${esc(name)}</b> ${esc(text)}` : `<i>${esc(text)}</i>`;
    log.appendChild(line);
    while (log.children.length > 80) log.firstChild.remove();
    if (stick) log.scrollTop = log.scrollHeight;
    if (name && this.$('h-chat').classList.contains('min')) this.$('h-chat').classList.add('unread');
  }

  openChat() {
    if (this.dialogueOpen) return;
    this.typing = true;
    this.$('h-chat').classList.remove('min', 'unread');
    this.$('h-chat').classList.add('active');
    const input = this.$('h-chatin');
    input.value = '';
    setTimeout(() => input.focus(), 0);
  }

  closeChat() {
    if (!this.typing) return;
    this.typing = false;
    const input = this.$('h-chatin');
    input.blur();
    input.value = '';
    this.$('h-chat').classList.remove('active');
  }

  openDialogue(name, text, options, onPick) {
    this.dialogueOpen = true;
    const el = this.$('h-dialogue');
    el.classList.remove('hidden');
    this.$('h-dname').textContent = name;
    const tEl = this.$('h-dtext');
    clearInterval(this._typeT);
    let i = 0;
    tEl.textContent = '';
    this._fullText = text;
    this._typeT = setInterval(() => {
      i += 2;
      tEl.textContent = text.slice(0, i);
      if (i >= text.length) clearInterval(this._typeT);
    }, 16);
    const opts = this.$('h-dopts');
    opts.innerHTML = '';
    this._opts = options;
    this._onPick = onPick;
    options.forEach(([label], idx) => {
      const b = document.createElement('button');
      b.innerHTML = `<span>${idx + 1}</span>${esc(label)}`;
      b.addEventListener('click', () => this.pick(idx));
      opts.appendChild(b);
    });
  }

  pick(idx) {
    if (!this.dialogueOpen || !this._opts || !this._opts[idx]) return;
    clearInterval(this._typeT);
    this._onPick(idx);
  }

  closeDialogue() {
    this.dialogueOpen = false;
    clearInterval(this._typeT);
    this.$('h-dialogue').classList.add('hidden');
  }
}
