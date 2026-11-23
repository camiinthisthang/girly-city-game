export const BESTIE = 'Bestie Jess';

export const MISSIONS = [
  { type: 'fetch', title: 'Iced Coffee Run', at: [-38, 0, 38], stall: 'ICED COFFEE', stallColor: '#7fd8d4', time: 120,
    ask: 'Babe, emergency. We cannot start the day without iced coffee. Vanilla, oat milk, extra ice. Go!', brief: 'Vanilla, oat milk, extra ice. It is December. Do not care.',
    goText: 'Grab an <b>iced vanilla latte</b>', got: 'Iced coffee secured. Bring one back for your bestie!', passed: 'Caffeinated and unstoppable' },
  { type: 'fetch', title: 'Nail Appointment', at: [62, 0, 13], stall: 'NAIL SALON', stallColor: '#ff8fc8', time: 150,
    ask: 'Your nails are giving "I have not had a manicure in three weeks." The salon by the river has one slot left.', brief: 'One slot left. Chrome pink. Run.',
    goText: 'Get to the <b>nail salon</b>', got: 'Chrome pink nails. Obsessed. Go show your bestie.', passed: 'Nails: done. Confidence: +100' },
  { type: 'collect', title: 'Shopping Spree', spots: [[-22, 0, -58], [30, 0, -80], [36, 1.2, -67], [35, 0, -5]], time: 180,
    ask: 'Sample sale. Four boutiques. We have three minutes before everything good is gone.', brief: 'Four boutiques, three minutes. Grab every bag.',
    goText: 'Hit every <b>boutique</b>', got: 'Four bags. Zero regrets. Back to your bestie!', passed: 'Retail therapy complete' },
  { type: 'quiz', title: 'He Texted', ask: 'Bestie. Your ex just texted "u up?"', question: 'Your ex just texted "u up?" at 2am. What do we do?',
    options: ['Leave him on read', 'Text back "yes"', 'Send a 4 paragraph essay'], correct: 0, wrong: 'BESTIE. NO. Drama +1', passed: 'Left on read. Iconic.' },
  { type: 'fetch', title: 'Bottomless Brunch', at: [-20, 0, 100], stall: 'BRUNCH', stallColor: '#ffc36b', time: 150,
    ask: 'The girls are at brunch and they saved you a seat. Do not let them order the pancakes without you.', brief: 'Pancakes, mimosas, gossip. You are late.',
    goText: 'Meet the girls at <b>brunch</b>', got: 'You got ALL the tea at brunch. Go spill it to your bestie.', passed: 'Tea: spilled' },
  { type: 'quiz', title: 'Boyfriend Status', ask: 'Okay, real talk. Where is your boyfriend right now?', question: 'He says he is "busy playing GTA" again. What do we do?',
    options: ['Wait by the phone', 'Ask him for the 10th time', 'Girls night. Obviously.'], correct: 2, wrong: 'No. We do not wait. Drama +1', passed: 'Girls night is ON' },
  { type: 'fetch', title: 'Golden Hour Shoot', at: [100, 4.2, -10], time: 150,
    ask: 'The light is PERFECT. Meet me on the Bestie Boat top deck for the photo shoot. Hurry!', brief: 'Top deck of the yacht. Golden hour waits for no one.',
    goText: 'Get to the <b>yacht top deck</b> for the shoot', got: 'Got the shot. That is your new profile pic. Show your bestie!', passed: 'Main character content' },
];

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export function showEnd(name) {
  if (document.querySelector('.endcard')) return;
  const el = document.createElement('div');
  el.className = 'endcard';
  el.innerHTML = `
    <div class="end-kicker">ALL MISSIONS PASSED</div>
    <h1>MAIN CHARACTER<br/>UNLOCKED</h1>
    <div class="end-name">${esc(name || 'Bestie')}</div>
    <p class="end-msg">He is still playing GTA.<br/>You just had the best day ever.</p>
    <p class="end-cta">Screenshot this and tag your bestie</p>
    <div class="end-btns"><button id="e-back">Keep playing</button></div>`;
  document.body.appendChild(el);
  el.querySelector('#e-back').onclick = () => el.remove();
}
