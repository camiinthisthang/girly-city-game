export const BESTIE = 'Bestie Jess';

const TIME = 160;
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export const MISSIONS = [
  {
    type: 'rush', title: 'Glow Up Rush', time: TIME, listTitle: 'GET READY',
    ask: `BABE. The yacht party starts in ${fmt(TIME)} and you look like you just woke up. Hair, nails, brows, lashes AND a new fit. Steal a car, hit turbo, GO.`,
    brief: 'Hair, nails, brows, lashes, outfit. Then the yacht.',
    partyBrief: 'You look INCREDIBLE. Now get to the yacht party!',
    stops: [
      { label: 'Hair', stall: 'BLOWOUT BAR', color: '#f6bccb', at: [-44, 0, -270], hold: 4, doing: 'Getting a <b>blowout</b>', doneText: 'Blowout done. The volume is unreal.' },
      { label: 'Nails', stall: 'NAIL SALON', color: '#cdb9e6', at: [-270, 0, -93], hold: 4, doing: 'Getting <b>chrome nails</b>', doneText: 'Chrome nails. Do not touch anything.' },
      { label: 'Brows', stall: 'BROW BAR', color: '#ffc4a3', at: [-44, 0, 270], hold: 4, doing: '<b>Brow lamination</b>', doneText: 'Brows laminated. Face card: approved.' },
      { label: 'Lashes', stall: 'LASH STUDIO', color: '#a7d3ea', at: [60, 0, -93], hold: 4, doing: '<b>Lash extensions</b>', doneText: 'Lashes on. Blinking feels expensive.' },
      { label: 'Outfit', stall: 'BOUTIQUE', color: '#a9d3b9', at: [-44, 0, 110], hold: 4, doing: 'Trying on <b>the fit</b>', doneText: 'The fit is fitting. Receipts: hidden.' },
    ],
    party: { label: 'Yacht party', at: [100, 4.2, -10] },
  },
];

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export function showEnd(name, st) {
  if (document.querySelector('.endcard')) return;
  const left = Math.max(0, st?.left || 0);
  const best = Math.max(left, Number(localStorage.getItem('gc_best') || 0));
  localStorage.setItem('gc_best', String(best));
  const el = document.createElement('div');
  el.className = 'endcard';
  el.innerHTML = `
    <div class="end-kicker">READY IN TIME</div>
    <h1>MAIN CHARACTER<br/>UNLOCKED</h1>
    <div class="end-name">${esc(name || 'Bestie')}</div>
    <p class="end-msg">Hair, nails, brows, lashes and the fit with <b>${fmt(left)}</b> to spare.<br/><span>He is still loading GTA.</span></p>
    <p class="end-best">Best: ${fmt(best)} to spare</p>
    <p class="end-cta">Screenshot this and challenge your bestie</p>
    <div class="end-btns"><button id="e-again">Run it again</button><button id="e-back">Keep playing</button></div>`;
  document.body.appendChild(el);
  el.querySelector('#e-back').onclick = () => el.remove();
  el.querySelector('#e-again').onclick = () => location.reload();
}
