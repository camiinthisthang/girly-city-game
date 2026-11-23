export class Net {
  constructor(handlers) {
    this.h = handlers;
    this.ws = null;
    this.id = null;
    this.online = false;
  }

  connect(name, look) {
    this.name = name;
    this.look = look;
    const url = import.meta.env.VITE_WS_URL
      || (location.hostname.endsWith('.vercel.app') ? 'wss://react-miami-neon-nights.fly.dev/ws' : `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
    let ws;
    try { ws = new WebSocket(url); } catch { this.h.status?.(false); return; }
    this.ws = ws;
    ws.onopen = () => ws.send(JSON.stringify({ t: 'join', name: this.name, look: this.look }));
    ws.onmessage = (e) => {
      let m;
      try { m = JSON.parse(e.data); } catch { return; }
      if (m.t === 'welcome') { this.id = m.id; this.online = true; this.h.status?.(true); m.players.forEach((p) => this.h.join?.(p)); (m.history || []).forEach((c) => this.h.history?.(c)); if (m.boards) this.h.board?.(m.boards); if (m.tickets) this.h.tickets?.(m.tickets); }
      else if (m.t === 'joined') this.h.join?.(m);
      else if (m.t === 'left') this.h.leave?.(m.id);
      else if (m.t === 'look') this.h.look?.(m);
      else if (m.t === 'snap') this.h.snap?.(m.p);
      else if (m.t === 'chat') this.h.chat?.(m);
      else if (m.t === 'board') this.h.board?.(m.boards);
      else if (m.t === 'ticket') this.h.ticket?.(m);
      else if (m.t === 'ticketTaken') this.h.ticketTaken?.(m);
      else if (m.t === 'tickets') this.h.tickets?.(m.tickets);
    };
    ws.onclose = () => {
      const was = this.online;
      this.online = false;
      this.h.status?.(false);
      this.h.reset?.();
      setTimeout(() => this.connect(this.name, this.look), was ? 1500 : 6000);
    };
  }

  send(o) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(o)); }
  state(arr) { this.send({ t: 's', s: arr }); }
  chat(text) { this.send({ t: 'chat', text }); }
  setLook(name, look) { this.name = name; this.look = look; this.send({ t: 'look', name, look }); }
}
