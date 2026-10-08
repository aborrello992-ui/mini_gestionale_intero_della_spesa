// I soci che combattono. Per aggiungerne uno: copia un blocco, cambia look e moves.
// kind delle mosse: lightning | drill | wrench | sleep | pillow  (vedi PROJECTILES in art.js)
// dmg = danno al boss (il boss ha 180 punti vita), stun = millisecondi in cui il boss resta addormentato.

export const FIGHTERS = [
  {
    id: 'michele',
    name: 'MIWOKI',
    look: {
      skin: '#e0ad86',
      hair: '#2a1c15',
      hairStyle: 'quiff',
      beard: '#3a2a22',
      beardStyle: 'full',
      glasses: 'hex-blue',
      lens: '#47597a',
      smile: 'smirk',
      gloves: '#dc2626',
      glovesRear: '#dc2626',
      outfit: { jacket: '#4b5563', jacketDark: '#374151', shirt: '#f8fafc', tie: null, pants: '#1f2937', shoes: '#111827' },
    },
    moves: [
      { kind: 'lightning', label: 'PUGNI FULMINE!', dmg: 3.2 },
      { kind: 'drill', label: 'TRAPANO ROSSO!', dmg: 4 },
    ],
  },
  {
    id: 'luca',
    name: 'LUCA MANCA',
    look: {
      skin: '#deaa82',
      hair: '#241914',
      hairStyle: 'spiky',
      beard: '#3b2b23',
      beardStyle: 'goatee',
      glasses: 'wayfarer-black',
      lens: '#101114',
      smile: 'big',
      rearHold: 'flute',
      outfit: { jacket: '#15181d', jacketDark: '#0b0d10', shirt: '#f8fafc', tie: '#2f9e8f', pants: '#15181d', shoes: '#0b0d10' },
    },
    moves: [
      { kind: 'wrench', label: 'CHIAVE INGLESE!', dmg: 2.8 },
      { kind: 'pillow', label: 'CUSCINO KO!', dmg: 3.4 },
      { kind: 'wrench', label: 'CHIAVE INGLESE!', dmg: 2.8 },
      { kind: 'sleep', label: 'NUVOLA DEL SONNO!', dmg: 1.5, stun: 1400 },
    ],
  },
]
