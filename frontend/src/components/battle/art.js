// Tutta la grafica del minigioco, come stringhe SVG. Personaggi ORIGINALI in stile cartoon.
// Ogni socio è descritto da un oggetto "look" (vedi fighters.js): per aggiungerne uno basta un nuovo look.

const SW = (c) => `stroke="${c}" stroke-linecap="round" stroke-linejoin="round"`

/* ------------------------------------------------------------------ */
/* SOCIO (chibi, guarda a destra). viewBox 0 0 120 170, piedi a y=166  */
/* ------------------------------------------------------------------ */
function hair(look) {
  const c = look.hair
  if (look.hairStyle === 'quiff') {
    return `<path d="M37 46 C34 25 47 15 62 15 C79 15 88 28 83 46 C80 37 73 31 62 31 C50 31 42 36 37 46 Z" fill="${c}"/>
      <path d="M44 28 C50 17 68 15 79 25 C68 23 56 25 46 33 Z" fill="${c}"/>
      <path d="M48 27 C56 20 68 19 76 24" fill="none" stroke="rgba(255,255,255,.22)" stroke-width="2.2" stroke-linecap="round"/>`
  }
  // 'spiky'
  return `<path d="M37 47 C33 26 46 16 61 16 C79 16 88 29 83 47 C80 37 72 31 61 31 C50 31 42 37 37 47 Z" fill="${c}"/>
    <path d="M40 30 L36 18 L50 24 Z M50 22 L50 8 L62 19 Z M62 19 L70 7 L76 21 Z M74 22 L86 14 L84 30 Z" fill="${c}"/>`
}

function glasses(look) {
  if (!look.glasses) return ''
  if (look.glasses === 'hex-blue') {
    return `<g>
      <path d="M40 41 L58 40 L59 52 L44 54 Q40 52 40 48 Z" fill="${look.lens}" stroke="#0b0b0f" stroke-width="3" stroke-linejoin="round"/>
      <path d="M62 40 L80 41 L80 48 Q80 52 76 54 L61 52 Z" fill="${look.lens}" stroke="#0b0b0f" stroke-width="3" stroke-linejoin="round"/>
      <path d="M58 44 Q60 42 62 44" fill="none" stroke="#0b0b0f" stroke-width="3"/>
      <path d="M44 44 L52 42" stroke="rgba(255,255,255,.45)" stroke-width="2" stroke-linecap="round"/>
      <path d="M38 43 L35 46 M81 43 L85 46" stroke="#0b0b0f" stroke-width="3" stroke-linecap="round"/>
    </g>`
  }
  // 'wayfarer-black'
  return `<g>
    <path d="M38 40 L59 39 L57 53 Q56 55 53 55 L44 55 Q40 54 40 50 Z" fill="${look.lens}" stroke="#050507" stroke-width="3" stroke-linejoin="round"/>
    <path d="M61 39 L82 40 L80 50 Q80 54 76 55 L67 55 Q64 55 63 53 Z" fill="${look.lens}" stroke="#050507" stroke-width="3" stroke-linejoin="round"/>
    <path d="M38 39 L59 38 M61 38 L83 39" stroke="#050507" stroke-width="4.5" stroke-linecap="round"/>
    <path d="M58 43 Q60 41 62 43" fill="none" stroke="#050507" stroke-width="3"/>
    <path d="M44 44 L50 43" stroke="rgba(255,255,255,.3)" stroke-width="2" stroke-linecap="round"/>
  </g>`
}

function beard(look) {
  const c = look.beard
  if (!look.beardStyle) return ''
  if (look.beardStyle === 'full') {
    return `<path d="M38.5 50 C38 70 50 76 60 76 C70 76 82 70 81.5 50 C79 60 72 63 60 63 C48 63 41 60 38.5 50 Z" fill="${c}" opacity=".92"/>
      <path d="M50 61 Q60 57 70 61 Q60 64 50 61 Z" fill="${c}"/>`
  }
  // 'goatee'
  return `<path d="M39 52 C39 68 48 72 55 73 L65 73 C72 72 81 68 81 52 C79 58 72 61 60 61 C48 61 41 58 39 52 Z" fill="${c}" opacity=".8"/>
    <path d="M52 66 Q60 79 68 66 Q60 70 52 66 Z" fill="${c}"/>
    <path d="M49 60 Q60 56 71 60 Q60 63 49 60 Z" fill="${c}"/>`
}

function mouth(look) {
  if (look.smile === 'shout') {
    return `<path d="M49 61 Q60 78 71 61 Q60 57 49 61 Z" fill="#5b1a1a" stroke="#3b0d0d" stroke-width="2" stroke-linejoin="round"/>
      <path d="M52 61 L68 61" stroke="#fff" stroke-width="3" stroke-linecap="round"/>
      <path d="M54 70 Q60 66 66 70 Q60 75 54 70Z" fill="#ef6b6b"/>`
  }
  if (look.smile === 'big') {
    return `<path d="M47 61 Q60 77 73 61 Q60 64 47 61 Z" fill="#fff" stroke="#4a2a22" stroke-width="2" stroke-linejoin="round"/>
      <path d="M50 64 Q60 66 70 64" fill="none" stroke="#d9d2cc" stroke-width="1.4"/>`
  }
  return `<path d="M51 65 Q60 69 70 63" fill="none" stroke="#f0c6ad" stroke-width="3" stroke-linecap="round"/>`
}

function outfit(look) {
  const o = look.outfit
  const tie = o.tie
    ? `<path d="M56 74 L64 74 L66 84 L60 112 L54 84 Z" fill="${o.tie}"/>
       <circle cx="58" cy="88" r="2.4" fill="#f59e0b"/><circle cx="62" cy="96" r="2.4" fill="#7c3aed"/>
       <circle cx="58" cy="103" r="2.4" fill="#f97316"/><circle cx="61" cy="82" r="2.2" fill="#7c3aed"/>
       <path d="M55 73 L60 78 L65 73 Z" fill="${o.tie}"/>`
    : ''
  return `
    <path d="M36 76 Q60 66 84 76 L88 128 Q60 135 32 128 Z" fill="${o.jacket}"/>
    <path d="M51 71 L60 104 L69 71 Z" fill="${o.shirt}"/>
    ${tie}
    <path d="M51 71 L45 84 L56 80 Z M69 71 L75 84 L64 80 Z" fill="${o.shirt}" stroke="rgba(0,0,0,.18)" stroke-width="1"/>
    <path d="M45 78 L38 100 L50 112 L58 88 Z M75 78 L82 100 L70 112 L62 88 Z" fill="${o.jacketDark}" opacity=".75"/>
    <rect x="33" y="123" width="54" height="8" rx="3" fill="${o.belt || o.jacketDark}"/>
    ${o.belt ? `<rect x="56" y="125" width="9" height="22" rx="2" fill="${o.belt}" stroke="rgba(0,0,0,.25)" stroke-width="1"/>` : ''}`
}

export function fighterArt(look) {
  const o = look.outfit
  const handFront = look.gloves ? look.gloves : look.skin
  const rearHold = look.rearHold === 'flute'
    ? `<g transform="translate(24 106) rotate(-6)">
         <path d="M-6 -30 L6 -30 L5 -14 Q5 -7 0 -5 Q-5 -7 -5 -14 Z" fill="rgba(225,240,255,.8)" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/>
         <path d="M-4 -19 L4 -19 L3.4 -14 Q3 -9 0 -8 Q-3 -9 -3.4 -14Z" fill="#f4c97a"/>
         <circle cx="-1" cy="-24" r="1.2" fill="#fff" opacity=".9"/><circle cx="2" cy="-16" r="1" fill="#fff" opacity=".9"/>
         <path d="M0 -5 L0 12 M-6 13 L6 13" stroke="#e5f2ff" stroke-width="2" stroke-linecap="round"/>
       </g>`
    : ''
  return `
  <ellipse cx="60" cy="166" rx="31" ry="5" fill="rgba(0,0,0,.32)"/>
  <g class="bb-leg-b" style="transform-origin:50px 122px">
    <rect x="42" y="120" width="16" height="42" rx="6" fill="${o.pants}"/>
    <path d="M38 158 h22 q4 8 -3 8 h-19 q-5 -4 0 -8z" fill="${o.shoes}"/>
  </g>
  <g class="bb-leg-f" style="transform-origin:70px 122px">
    <rect x="62" y="120" width="16" height="42" rx="6" fill="${o.pants}"/>
    <path d="M60 158 h22 q5 4 0 8 h-19 q-6 0 -3 -8z" fill="${o.shoes}"/>
  </g>
  <g class="bb-rear-arm" style="transform-origin:38px 82px">
    <path d="M38 82 L${look.rearHold ? 26 : 35} 108" ${SW(o.jacketDark)} stroke-width="13" fill="none"/>
    <circle cx="${look.rearHold ? 25 : 35}" cy="111" r="7" fill="${look.glovesRear || look.skin}"/>
    ${rearHold}
  </g>
  <g class="bb-torso">
    ${outfit(look)}
    <rect x="53" y="60" width="14" height="14" fill="${look.skin}"/>
    <g class="bb-head">
      <ellipse cx="39" cy="48" rx="4.5" ry="6" fill="${look.skin}"/><ellipse cx="81" cy="48" rx="4.5" ry="6" fill="${look.skin}"/>
      <ellipse cx="60" cy="46" rx="21.5" ry="24" fill="${look.skin}"/>
      ${beard(look)}
      ${hair(look)}
      ${look.brows === 'angry'
        ? `<path d="M42 40 L57 35 M63 35 L78 40" stroke="${look.hair}" stroke-width="4" stroke-linecap="round"/><circle cx="51" cy="45" r="2.6" fill="#111827"/><circle cx="69" cy="45" r="2.6" fill="#111827"/>`
        : `<path d="M44 37 L56 36 M64 36 L76 37" stroke="${look.hair}" stroke-width="3" stroke-linecap="round"/>`}
      ${glasses(look)}
      <path d="M60 46 L58 56 L62 56" fill="none" stroke="rgba(120,70,40,.45)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      ${mouth(look)}
    </g>
    <g class="bb-arm" style="transform-origin:82px 82px">
      <path d="M82 82 L85 108" ${SW(o.jacket)} stroke-width="14" fill="none"/>
      <path d="M82 82 L85 108" ${SW(o.jacketDark)} stroke-width="14" fill="none" opacity=".25"/>
      <circle cx="86" cy="112" r="${look.gloves ? 8 : 7}" fill="${handFront}"/>
    </g>
  </g>`
}

/* Solo la testa (per i ritratti nelle barre) */
export function portrait(look) {
  return `<svg viewBox="26 4 68 68" aria-hidden="true" focusable="false">${fighterArt(look)}</svg>`
}

/* ------------------------------------------------------------------ */
/* BOSS "LOCALE" (originale): stesso stile dei soci, ma in tuta teal    */
/* ------------------------------------------------------------------ */
export const BOSS_LOOK = {
  skin: '#e6b384',
  hair: '#0f1624',
  hairStyle: 'spiky',
  brows: 'angry',
  smile: 'shout',
  outfit: { jacket: '#14b8a6', jacketDark: '#0f766e', shirt: '#e6fffb', tie: null, pants: '#14b8a6', shoes: '#e6b384', belt: '#f97316' },
}
export const bossArt = () => fighterArt(BOSS_LOOK)

/* ------------------------------------------------------------------ */
/* PROIETTILI, centrati sull'origine, diretti verso destra              */
/* ------------------------------------------------------------------ */
export const PROJECTILES = {
  // pugno rosso con fulmini
  lightning: `
    <g class="bb-flicker">
      <path d="M-34 -2 L-24 -10 L-20 -2 L-10 -12 L-6 -3" fill="none" stroke="#fde047" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"/>
      <path d="M-36 8 L-26 2 L-22 10 L-13 3" fill="none" stroke="#fff7b0" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
      <path d="M14 -16 L8 -4 L16 -4 L9 10" fill="none" stroke="#fde047" stroke-width="3.2" stroke-linejoin="round" stroke-linecap="round"/>
    </g>
    <rect x="-8" y="-11" width="24" height="22" rx="8" fill="#dc2626" stroke="#7f1d1d" stroke-width="2"/>
    <path d="M2 -9 V9 M8 -9 V9" stroke="#7f1d1d" stroke-width="1.6" opacity=".7"/>
    <rect x="-12" y="-8" width="8" height="16" rx="3" fill="#991b1b"/>
    <path d="M17 -4 L20 -8 M18 0 L23 0 M17 4 L20 8" stroke="#fde047" stroke-width="2.4" stroke-linecap="round"/>`,

  // trapano a batteria rosso
  drill: `
    <g transform="scale(1.15)">
      <path d="M-26 8 L-12 8 L-8 -6 L-22 -6 Z" fill="#1f2937"/>
      <path d="M-24 8 L-8 8 L-8 16 L-24 16 Z" fill="#111827"/>
      <path d="M-6 -14 Q4 -18 14 -14 L16 -2 Q4 4 -8 0 Z" fill="#e11d2a" stroke="#7f1d1d" stroke-width="1.6" stroke-linejoin="round"/>
      <path d="M-10 -6 L-4 -6 L-2 12 L-12 12 Z" fill="#c1121f" stroke="#7f1d1d" stroke-width="1.4" stroke-linejoin="round"/>
      <rect x="-14" y="10" width="14" height="8" rx="2" fill="#374151" stroke="#111827" stroke-width="1.2"/>
      <rect x="15" y="-12" width="9" height="10" rx="2" fill="#6b7280" stroke="#374151" stroke-width="1.2"/>
      <path d="M24 -9 L40 -7 L24 -5 Z" fill="#d1d5db" stroke="#6b7280" stroke-width="1"/>
      <path d="M26 -9 L38 -7 M28 -6.6 L36 -6" stroke="#6b7280" stroke-width=".8"/>
      <circle cx="4" cy="-9" r="2.2" fill="#111827"/>
    </g>`,

  // chiave inglese regolabile
  wrench: `
    <g transform="scale(1.1)">
      <path d="M-22 -4 L10 -4 L10 4 L-22 4 Q-28 4 -28 0 Q-28 -4 -22 -4 Z" fill="#cbd5e1" stroke="#64748b" stroke-width="1.8" stroke-linejoin="round"/>
      <circle cx="-23" cy="0" r="2.4" fill="#475569"/>
      <path d="M8 -12 L24 -12 L24 -5 L16 -5 L16 5 L24 5 L24 12 L8 12 Q4 12 4 8 L4 -8 Q4 -12 8 -12 Z" fill="#e2e8f0" stroke="#64748b" stroke-width="1.8" stroke-linejoin="round"/>
      <path d="M10 -9 L22 -9" stroke="#fff" stroke-width="1.6" opacity=".8"/>
    </g>`,

  // nuvoletta del sonno con Z
  sleep: `
    <g class="bb-float">
      <circle cx="-12" cy="4" r="11" fill="#dbeafe"/><circle cx="0" cy="-2" r="14" fill="#eff6ff"/>
      <circle cx="13" cy="4" r="11" fill="#dbeafe"/><rect x="-14" y="4" width="30" height="11" rx="5" fill="#dbeafe"/>
      <text x="-5" y="3" font-family="Impact, 'Arial Black', sans-serif" font-size="15" fill="#6366f1" stroke="#312e81" stroke-width=".8" paint-order="stroke">Z</text>
      <text x="9" y="-12" font-family="Impact, 'Arial Black', sans-serif" font-size="11" fill="#818cf8" stroke="#312e81" stroke-width=".7" paint-order="stroke">z</text>
      <text x="-22" y="-14" font-family="Impact, 'Arial Black', sans-serif" font-size="9" fill="#a5b4fc" stroke="#312e81" stroke-width=".6" paint-order="stroke">z</text>
    </g>`,

  // cuscino
  pillow: `
    <path d="M-22 -13 Q0 -19 22 -13 Q26 0 22 13 Q0 19 -22 13 Q-26 0 -22 -13 Z" fill="#bfdbfe" stroke="#60a5fa" stroke-width="2" stroke-linejoin="round"/>
    <path d="M-17 -8 Q0 -12 17 -8 M-17 8 Q0 12 17 8" fill="none" stroke="#93c5fd" stroke-width="1.6" stroke-dasharray="3 3"/>
    <path d="M-23 -13 L-27 -17 M23 -13 L27 -17 M-23 13 L-27 17 M23 13 L27 17" stroke="#f9a8d4" stroke-width="3" stroke-linecap="round"/>
    <text x="-6" y="5" font-family="Impact, 'Arial Black', sans-serif" font-size="13" fill="#6366f1">Zz</text>`,

  // onda d'urto del boss (rivolta a sinistra: viene specchiata dal motore)
  shockwave: `
    <path d="M10 -22 Q-16 0 10 22 Q-2 0 10 -22 Z" fill="#5eead4" stroke="#0f766e" stroke-width="2" stroke-linejoin="round"/>
    <path d="M8 -15 Q-8 0 8 15" fill="none" stroke="#f0fdfa" stroke-width="3" stroke-linecap="round"/>
    <path d="M18 -10 L30 -14 M20 0 L34 0 M18 10 L30 14" stroke="#99f6e4" stroke-width="3" stroke-linecap="round" opacity=".85"/>`,
}

export const BOSS_ZZZ = `
  <g class="bb-boss-zzz" font-family="Impact, 'Arial Black', sans-serif" fill="#a5b4fc" stroke="#312e81" stroke-width=".8" paint-order="stroke">
    <text x="0" y="0" font-size="14">Z</text><text x="12" y="-12" font-size="11">z</text><text x="22" y="-22" font-size="9">z</text>
  </g>`
