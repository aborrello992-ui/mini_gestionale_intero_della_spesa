// I soci che combattono. Per aggiungerne uno: copia un blocco, cambia look e moves.
// kind delle mosse: lightning | drill | wrench | sleep | pillow  (vedi PROJECTILES in art.js)
// dmg = danno al boss (il boss ha 180 punti vita), stun = millisecondi in cui il boss resta addormentato.
// outfit.style: 'vest' (elettricista) | 'apron' (commesso di ferramenta) | (omesso = giacca)

export const FIGHTERS = [
  {
    id: 'michele',
    name: 'MIWOKI',
    look: {
      skin: '#dfac84',
      eye: '#4a3224',
      hair: '#1d1511',
      hairStyle: 'cap-back',
      cap: '#17181c',
      capBand: '#f1f5f9',
      brows: 'thick',
      browColor: '#1d1511',
      beard: '#4a372c',
      beardStyle: 'stubble',
      smile: 'soft',
      gloves: '#dc2626',
      glovesRear: '#dc2626',
      outfit: {
        style: 'vest',
        jacket: '#475569', jacketDark: '#334155', shirt: '#dfac84',
        vest: '#dc2626', vestDark: '#18181b', belt: '#6b4423',
        pants: '#27272a', shoes: '#18181b',
      },
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
      skin: '#e6b28f',
      eye: '#6f8f78',
      hair: '#3a281d',
      hairStyle: 'wavy',
      brows: 'thick',
      browColor: '#3a281d',
      beard: '#a07c58',
      mustache: '#8a6544',
      patch: '#bdb7ac',
      beardStyle: 'mustache-patch',
      glasses: 'rect-thick',
      frame: '#2f3b34',
      lens: 'rgba(220,238,235,.28)',
      smile: 'lips',
      rearHold: 'pillow',
      outfit: {
        style: 'apron', sleeve: 'short',
        jacket: '#e2e8f0', jacketDark: '#cbd5e1', shirt: '#e6b28f',
        apron: '#b7873f', apronDark: '#7c5a22',
        pants: '#334155', shoes: '#4a3426',
      },
    },
    moves: [
      { kind: 'wrench', label: 'CHIAVE INGLESE!', dmg: 2.8 },
      { kind: 'pillow', label: 'CUSCINO KO!', dmg: 3.4 },
      { kind: 'wrench', label: 'CHIAVE INGLESE!', dmg: 2.8 },
      { kind: 'sleep', label: 'NUVOLA DEL SONNO!', dmg: 1.5, stun: 1400 },
    ],
  },
]
