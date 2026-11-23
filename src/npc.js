import * as THREE from 'three';
import { Character, randomLook } from './character.js';
import { REBECCA_SPOT, BOOTH_SPOT, YACHT } from './world.js';

export const REBECCA_LOOK = {
  body: 'rebecca',
  skin: '#ffe0cc', hairStyle: 'long', hairColor: '#f4e7c5', top: 'tank', topColor: '#1b1b1b',
  bottom: 'jeans', bottomColor: '#2f4a7a', shoes: '#ffffff', hat: 'bucket', accent: '#1b1b1b',
  glasses: 'none', chain: 'gold', bag: 'none', tattoo: true, piercing: true,
};

const CROWD_LINES = [
  "Is it giving? It is giving.",
  "My boyfriend is playing GTA right now. I am playing THIS.",
  "The nail salon has a two-hour wait. Worth it.",
  "Iced coffee in December. I do not make the rules.",
  "Bestie, your fit is eating.",
  "I came for brunch. I stayed for the mimosas.",
  "Golden hour on the boat. Be there.",
  "He said he would text back in five. It has been nine hours.",
  "Pink convertible or nothing.",
  "I am not shopping. I am investing in myself.",
  "Has anyone seen my lip gloss?",
  "That outfit deserves its own photo shoot."
];

const DANCER_LINES = [
  "This DJ only plays girl anthems.",
  "Best night ever.",
  "Bestie boat forever.",
  "No boys allowed on the dance floor."
];

const FOUNDER_LINES = [
  "We are building Uber for iced coffee. Series A closes Friday.",
  "Our app rates outfits. Everyone gets a 10.",
  "The ping pong table is decoration. We do pilates.",
  "We pivoted to lip gloss this morning."
];

const NAMES = ['Ana', 'Leo', 'Priya', 'Marco', 'Sofia', 'Kenji', 'Dani', 'Omar', 'Zoe', 'Luis', 'Maya', 'Theo', 'Ines', 'Raj'];

export function createNpcs(scene, world, opts = {}) {
  const list = [];
  const add = (look, opts, x, y, z, rot = 0) => {
    const c = new Character(look, opts);
    c.root.position.set(x, y, z);
    c.root.rotation.y = rot;
    c.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    scene.add(c.root);
    const npc = { c, x, y, z, rot, ...opts };
    list.push(npc);
    return npc;
  };

  const [rx, rz] = REBECCA_SPOT;
  const rebecca = add(REBECCA_LOOK, { name: opts.giverName || 'Rebecca Bakels', subtitle: opts.giverTag || 'ORGANIZER', tagColor: '#ff8fc8', kind: 'rebecca', blip: 'R' }, rx, 0, rz, 0);

  const [bx, bz] = BOOTH_SPOT;
  const neonRep = add({ ...randomLook(), outfit: 'signature', hat: 'none', glasses: 'none' }, { name: 'Stylist', subtitle: 'WARDROBE', kind: 'neon' }, bx + 1.5, 0, bz - 5.5, 0);

  const { x: yx, z: yz } = YACHT;
  add({ ...randomLook(), hat: 'backwards' }, { name: 'DJ Vibes', kind: 'dancer', emote: 2, lines: ['Next track is a love song. Brace yourselves.', 'Best party on the water!'] }, yx, 4.2, yz - 11.3, 0);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    add(randomLook(), { name: NAMES[i], kind: 'dancer', emote: 2, lines: DANCER_LINES }, yx + Math.cos(a) * 3, 1.6, yz + 13 + Math.sin(a) * 3, a + Math.PI);
  }
  for (const [nm, x, z, rot, emote] of [['Founder Sam', -104, -57.2, Math.PI, 0], ['CTO Priya', -83.5, -55.2, Math.PI, 0], ['Intern Diego', -102.5, -73.4, 0, 0], ['PM Lena', -83.5, -68.6, Math.PI, 1]]) {
    add(randomLook(), { name: nm, subtitle: 'STARTUP HQ', kind: 'founder', emote, lines: FOUNDER_LINES }, x, 0, z, rot);
  }
  const wanderers = [];
  for (let i = 0; i < 12; i++) {
    const n = add(randomLook(), { name: NAMES[(i + 7) % NAMES.length], kind: 'crowd', lines: CROWD_LINES }, -20 + Math.random() * 70, 0, -20 + Math.random() * 30);
    n.target = null;
    n.speed = 1.4 + Math.random() * 0.6;
    wanderers.push(n);
  }

  const pickTarget = (n) => {
    const r = Math.random();
    if (r < 0.5) n.target = [-28 + Math.random() * 88, 11 + Math.random() * 5];
    else if (r < 0.85) n.target = [-28 + Math.random() * 54, -26 + Math.random() * 34];
    else n.target = [46 + Math.random() * 14, -26 + Math.random() * 34];
    n.wait = 0;
    n.timer = 0;
  };

  return {
    list, rebecca, neonRep,
    update(dt, player) {
      for (const n of list) {
        let speed = 0;
        if (n.kind === 'crowd') {
          if (n.talkUntil && n.c.t < n.talkUntil) {
            n.rot = Math.atan2(player.x - n.x, player.z - n.z);
          } else if (n.wait > 0) {
            n.wait -= dt;
          } else {
            if (!n.target) pickTarget(n);
            const dx = n.target[0] - n.x, dz = n.target[1] - n.z;
            const d = Math.hypot(dx, dz);
            n.timer += dt;
            if (d < 0.5 || n.timer > 25) { pickTarget(n); n.wait = 1 + Math.random() * 5; }
            else {
              speed = n.speed;
              const p = { x: n.x + (dx / d) * speed * dt, y: 0, z: n.z + (dz / d) * speed * dt };
              world.collide(p, 0.35);
              n.x = p.x; n.z = p.z;
              const want = Math.atan2(dx, dz);
              n.rot += Math.atan2(Math.sin(want - n.rot), Math.cos(want - n.rot)) * Math.min(1, dt * 6);
            }
          }
        } else if (n.kind === 'rebecca' || n.kind === 'neon') {
          const d = Math.hypot(player.x - n.x, player.z - n.z);
          const want = d < 9 ? Math.atan2(player.x - n.x, player.z - n.z) : 0;
          n.rot += Math.atan2(Math.sin(want - n.rot), Math.cos(want - n.rot)) * Math.min(1, dt * 3);
          if (d < 7 && !n.waved) { n.waved = true; n.waveUntil = n.c.t + 2.5; if (n.kind === 'rebecca') n.c.say(opts.wave || 'Hey! Over here! Come say hi!'); }
          if (d > 15) n.waved = false;
        }
        const emote = n.emote ?? (n.waveUntil && n.c.t < n.waveUntil ? 1 : 0);
        n.c.root.position.set(n.x, n.y, n.z);
        n.c.root.rotation.y = n.rot;
        n.c.update(dt, speed, false, speed > 0 ? 0 : emote);
      }
    },
  };
}

export function rebeccaDialogue(state) {
  const done = state.swag.length >= state.total;
  const nodes = {
    start: {
      text: state.metRebecca
        ? `Welcome back${state.name ? ', ' + state.name : ''}! What do you need?`
        : `Hey hey${state.name ? ', ' + state.name : ''}! Welcome to React Miami. I'm Rebecca, one of the organizers. You made it to the Hyatt Regency, right on the Miami River.`,
      options: [
        ['What is React Miami?', 'about'],
        ['Who is Neon?', 'neon'],
        [done ? 'I found all the swag!' : state.missionStarted ? 'How is my swag hunt going?' : 'Got a mission for me?', 'mission'],
        ['What is with the yacht?', 'yacht'],
        ['How do I get tickets?', 'tickets'],
        ['Catch you later!', 'bye'],
      ],
    },
    about: {
      text: 'The most fun React conference on the planet. Talks from the people building React and the web, hallway chats with the whole community, and parties that end up on a yacht. Very Miami.',
      options: [['Love it. What else?', 'start'], ['Catch you later!', 'bye']],
    },
    neon: {
      text: 'Neon is our Diamond Sponsor, the biggest sponsor we have! They make serverless Postgres: branch your database like you branch your code, and it scales to zero when you are not using it. Their booth is on the plaza, go get some swag.',
      options: [['Where is the booth?', 'booth'], ['Back', 'start']],
    },
    booth: {
      text: 'Right on the plaza by the Knight Center. Look for the glowing green sign. The Neon crew can hook you up with hoodies, caps, lanyards, all of it.',
      options: [['On my way', 'bye'], ['Back', 'start']],
    },
    mission: done
      ? {
        text: 'Wait, you found ALL of them?! Okay, legend. The Diamond Hoodie is yours. It is the rarest fit in Miami. Grab it from the wardrobe at the Neon booth.',
        options: [['Let us go!', 'bye']],
        effect: 'reward',
      }
      : state.missionStarted
        ? {
          text: `You have found ${state.swag.length} of ${state.total} Neon swag crates. Follow the green beams of light! Check the minimap too. Some are across the bridge in Brickell, and one is on the yacht's top deck.`,
          options: [['On it', 'bye'], ['Back', 'start']],
        }
        : {
          text: `Okay, mission time. Neon hid ${state.total} glowing swag crates around the venue: the Riverwalk, the bridge, Brickell, the park, even the yacht. Find them all and I will unlock something nobody else has.`,
          options: [['Mission accepted', 'bye'], ['Back', 'start']],
          effect: 'startMission',
        },
    yacht: {
      text: 'That is the afterparty! Walk east along the Riverwalk to the dock on the bay. The DJ is already going. Take the stairs at the back of the boat to get to the top deck.',
      options: [['Say less', 'bye'], ['Back', 'start']],
    },
    tickets: {
      text: 'Head to reactmiami.com. And send this game to your friends, so you can all hang out here before the real thing.',
      options: [['Open reactmiami.com', 'link'], ['Back', 'start']],
    },
    bye: { text: 'See you on the dance floor!', options: [] },
  };
  return nodes;
}
