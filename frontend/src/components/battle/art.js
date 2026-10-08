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
  if (look.hairStyle === 'wavy') {
    // chioma folta e mossa (castano scuro), fronte alta
    return `<g fill="${c}">
      <path d="M36 47 C31 30 40 17 60 15 C80 14 91 28 84 47 C82 38 76 32 70 30 C62 28 50 28 44 32 C40 35 37 41 36 47 Z"/>
      <circle cx="41" cy="29" r="8.5"/><circle cx="51" cy="21" r="9.5"/><circle cx="63" cy="17.5" r="10"/>
      <circle cx="75" cy="21" r="9.5"/><circle cx="83" cy="31" r="8"/><circle cx="37" cy="40" r="5.5"/>
      <circle cx="86" cy="41" r="5"/>
    </g>
    <path d="M44 24 Q50 17 58 20 M62 15 Q70 13 77 19 M70 27 Q78 25 82 31" fill="none" stroke="rgba(255,255,255,.2)" stroke-width="2.2" stroke-linecap="round"/>`
  }
  if (look.hairStyle === 'crop') {
    return `<path d="M37 46 C34 27 45 16 61 16 C78 16 88 27 83 46 C81 38 74 30 61 30 C48 30 41 36 37 46 Z" fill="${c}"/>
      <path d="M45 22 Q58 15 72 19" fill="none" stroke="rgba(255,255,255,.16)" stroke-width="2" stroke-linecap="round"/>`
  }
  if (look.hairStyle === 'swept') {
    return `<path d="M82 38 Q94 50 88 68 Q82 58 80 46 Z" fill="${c}"/>
      <path d="M37 46 C32 24 46 11 62 11 C81 11 91 26 85 46 C81 37 73 31.500 61 31.500 C50 31.500 41 36 37 46 Z" fill="${c}"/>
      <g fill="${c}"><circle cx="45" cy="30" r="6.500"/><circle cx="55" cy="21" r="8"/><circle cx="68" cy="19" r="8.500"/><circle cx="79" cy="27" r="7"/><circle cx="86" cy="40" r="4.500"/></g>
      <path d="M40 36 C38 44 44 47 48 41 C52 36 46 34 44 38" fill="none" stroke="${c}" stroke-width="3.200" stroke-linecap="round"/>
      <path d="M46 24 Q56 15 70 17 M72 25 Q80 24 83 30" fill="none" stroke="rgba(255,255,255,.18)" stroke-width="2" stroke-linecap="round"/>`
  }
  if (look.hairStyle === 'bald') {
    // testa rasata: ombra di rasatura ai lati e riflesso sulla pelata
    return `<path d="M38 44 C36 29 46 23.5 60 23.5 C74 23.5 84 29 82 44 C80 36 74 31.500 60 31.500 C46 31.500 40 36 38 44 Z" fill="${c}" opacity=".35"/>
      <ellipse cx="53" cy="29" rx="9" ry="3.6" fill="#fff" opacity=".3" transform="rotate(-12 53 29)"/>`
  }
  if (look.hairStyle === 'cowboy') {
    const h = look.hat || '#a8743a'
    return `<path d="M38 41 L37.5 52 L41 47 Z M82 41 L82.5 52 L79 47 Z" fill="${c}"/>
      <path d="M36 36 C33 12 46 5 60 6 C74 5 87 12 84 36 Z" fill="${h}" stroke="rgba(0,0,0,.3)" stroke-width="1.2" stroke-linejoin="round"/>
      <path d="M47 9 Q60 17 73 9" fill="none" stroke="rgba(0,0,0,.28)" stroke-width="2.2" stroke-linecap="round"/>
      <path d="M36.5 31 Q60 25 83.5 31 L83.8 36 Q60 30 36.2 36 Z" fill="${look.hatBand || '#3b2412'}"/>
      <rect x="55" y="28.2" width="10" height="5.4" rx="1.2" fill="#facc15" stroke="#a16207" stroke-width=".9"/>
      <path d="M15 30 Q17 42 30 38.5 Q60 31 90 38.5 Q103 42 105 30 Q99 24 60 25.5 Q21 24 15 30 Z" fill="${h}" stroke="rgba(0,0,0,.35)" stroke-width="1.3" stroke-linejoin="round"/>
      <path d="M24 31 Q60 26 96 31" fill="none" stroke="rgba(255,255,255,.22)" stroke-width="1.8" stroke-linecap="round"/>`
  }
  if (look.hairStyle === 'cap-back') {
    // cappellino nero portato al contrario (si vede la fascia con la chiusura davanti)
    return `<path d="M37.5 45 C36 38 36.5 33 38 31 L41 40 Z M82.5 45 C84 38 83.5 33 82 31 L79 40 Z" fill="${c}"/>
      <path d="M38 43 C34 22 46 13 60 13 C74 13 86 22 82 43 C79 36 73 32.5 60 32.5 C47 32.5 41 36 38 43 Z" fill="${look.cap}" stroke="rgba(0,0,0,.35)" stroke-width="1.2" stroke-linejoin="round"/>
      <path d="M40 38 Q60 29 80 38" fill="none" stroke="${look.capBand || '#f1f5f9'}" stroke-width="3.2" stroke-linecap="round" stroke-dasharray="3 3.4"/>
      <rect x="55" y="29.2" width="10" height="4.6" rx="1.4" fill="#6b7280" stroke="#374151" stroke-width="1"/>
      <path d="M46 17 Q58 12 70 16" fill="none" stroke="rgba(255,255,255,.2)" stroke-width="2.4" stroke-linecap="round"/>`
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
  if (look.glasses === 'rect-thick') {
    const f = look.frame || '#2f3b34'
    return `<g>
      <path d="M38.5 40.5 L58.5 40 L58 53.5 L40 54 Q38.5 53.5 38.5 51 Z" fill="${look.lens}" stroke="${f}" stroke-width="3.6" stroke-linejoin="round"/>
      <path d="M61.5 40 L82 40.5 L82 51 Q82 53.5 80 54 L62 53.5 Z" fill="${look.lens}" stroke="${f}" stroke-width="3.6" stroke-linejoin="round"/>
      <path d="M58.5 42.5 H61.5" stroke="${f}" stroke-width="3.6"/>
      <path d="M38 38.8 L58.5 38.3 M61.5 38.3 L82.5 38.8" stroke="${f}" stroke-width="4.6" stroke-linecap="round"/>
      <path d="M36.5 42 L34 47 M83.5 42 L86 47" stroke="${f}" stroke-width="3.2" stroke-linecap="round"/>
      <path d="M43 45 L50 44 M67 44 L74 45" stroke="rgba(255,255,255,.55)" stroke-width="1.8" stroke-linecap="round"/>
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
  if (look.beardStyle === 'dense') {
    // barba piena che arriva fino ai baffi, con striature grigie
    const streak = look.streak
      ? `<path d="M42 60 Q44 69 50 73 M78 60 Q76 69 70 73 M56 74 Q60 76.500 64 74" fill="none" stroke="${look.streak}" stroke-width="2.200" stroke-linecap="round" opacity=".75"/>`
      : ''
    return `<path d="M38.500 47 C38 70 50 77.500 60 77.500 C70 77.500 82 70 81.500 47 C79 54 73 56.500 60 56.500 C47 56.500 41 54 38.500 47 Z" fill="${c}"/>
      <path d="M46 59 Q60 53.500 74 59 Q60 62 46 59 Z" fill="${c}"/>${streak}`
  }
  if (look.beardStyle === 'full') {
    const streak = look.streak
      ? `<path d="M42 62 Q44 69 50 72 M78 62 Q76 69 70 72 M57 72.500 Q60 74.500 63 72.500" fill="none" stroke="${look.streak}" stroke-width="2" stroke-linecap="round" opacity=".8"/>`
      : ''
    return `<path d="M38.5 50 C38 70 50 76 60 76 C70 76 82 70 81.5 50 C79 60 72 63 60 63 C48 63 41 60 38.5 50 Z" fill="${c}" opacity=".92"/>
      <path d="M50 61 Q60 57 70 61 Q60 64 50 61 Z" fill="${c}"/>${streak}`
  }
  if (look.beardStyle === 'mustache-patch') {
    // barba corta color sabbia, baffi folti e ciuffetto grigio sotto il labbro
    return `<path d="M38.5 50 C38 69 49 75 60 75 C71 75 82 69 81.5 50 C79 60 72 63.5 60 63.5 C48 63.5 41 60 38.5 50 Z" fill="${c}" opacity=".5"/>
      <path d="M45 58.5 C47 54.5 53 54 60 56.5 C67 54 73 54.5 75 58.5 C77 62 74 65 71 63.5 C67 61.5 63 60 60 60 C57 60 53 61.5 49 63.5 C46 65 43 62 45 58.5 Z" fill="${look.mustache || c}"/>
      <path d="M54 68 C55 74.5 65 74.5 66 68 C63 70 57 70 54 68 Z" fill="${look.patch || '#b8b2a7'}"/>`
  }
  if (look.beardStyle === 'stubble') {
    return `<path d="M39.5 51 C40 68 50 73.5 60 73.5 C70 73.5 80 68 80.5 51 C78 58 72 62.5 60 62.5 C48 62.5 42 58 39.5 51 Z" fill="${c}" opacity=".42"/>
      <path d="M49 58.5 Q60 55 71 58.5 Q60 60.5 49 58.5 Z" fill="${c}" opacity=".6"/>
      <g fill="${c}" opacity=".5"><circle cx="46" cy="64" r=".9"/><circle cx="51" cy="68" r=".9"/><circle cx="57" cy="70" r=".9"/><circle cx="63" cy="70.5" r=".9"/><circle cx="69" cy="68" r=".9"/><circle cx="74" cy="64" r=".9"/><circle cx="43" cy="58" r=".9"/><circle cx="77" cy="58" r=".9"/></g>`
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
  if (look.smile === 'lips') {
    return `<path d="M51.5 63.6 Q60 61 68.5 63.6 Q60 69 51.5 63.6 Z" fill="#c98585" stroke="#7a3f3f" stroke-width="1.2" stroke-linejoin="round"/>
      <path d="M52 63.8 Q60 65.4 68 63.8" fill="none" stroke="#7a3f3f" stroke-width="1.1"/>`
  }
  if (look.smile === 'soft') {
    return `<path d="M50 63.5 Q60 69.5 71 62.5" fill="none" stroke="#6b3a2e" stroke-width="2.4" stroke-linecap="round"/>
      <path d="M71 62.5 L73 60.8" stroke="#6b3a2e" stroke-width="1.6" stroke-linecap="round"/>`
  }
  if (look.smile === 'big') {
    return `<path d="M47 61 Q60 77 73 61 Q60 64 47 61 Z" fill="#fff" stroke="#4a2a22" stroke-width="2" stroke-linejoin="round"/>
      <path d="M50 64 Q60 66 70 64" fill="none" stroke="#d9d2cc" stroke-width="1.4"/>`
  }
  return `<path d="M51 65 Q60 69 70 63" fill="none" stroke="#f0c6ad" stroke-width="3" stroke-linecap="round"/>`
}

/* Elettricista: camicia da lavoro grigia, gilet rosso/nero con strisce riflettenti, cintura porta-attrezzi */
function vestOutfit(o) {
  return `
    <path d="M36 76 Q60 66 84 76 L88 128 Q60 135 32 128 Z" fill="${o.jacket}"/>
    <path d="M50 71 Q60 83 70 71 Z" fill="${o.shirt}"/>
    <path d="M40 76 L51 71 L58 100 L57 128 L33 126 Z" fill="${o.vest}" stroke="${o.vestDark}" stroke-width="2.2" stroke-linejoin="round"/>
    <path d="M80 76 L69 71 L62 100 L63 128 L87 126 Z" fill="${o.vest}" stroke="${o.vestDark}" stroke-width="2.2" stroke-linejoin="round"/>
    <path d="M39 108 L57.5 109 L57.5 114.5 L38 113.5 Z M81 108 L62.5 109 L62.5 114.5 L82 113.5 Z" fill="#e5e7eb" stroke="#facc15" stroke-width="1.2"/>
    <path d="M44 83 L51 83 L47.5 90 L52 90 L43 102 L45.5 92 L41.5 92 Z" fill="#fde047" stroke="#a16207" stroke-width="1" stroke-linejoin="round"/>
    <rect x="70" y="84" width="9" height="9" rx="1.5" fill="${o.vestDark}" opacity=".5"/>
    <path d="M73 84 V80 M76 84 V81" stroke="#facc15" stroke-width="2" stroke-linecap="round"/>
    <rect x="32" y="122" width="56" height="9" rx="3" fill="${o.belt}" stroke="rgba(0,0,0,.35)" stroke-width="1"/>
    <rect x="56" y="123.5" width="9" height="6" rx="1.5" fill="#d1d5db" stroke="#6b7280" stroke-width="1"/>
    <rect x="34" y="129" width="13" height="15" rx="2.5" fill="#3f2a14" stroke="#1f1409" stroke-width="1.2"/>
    <rect x="36" y="119" width="3.4" height="11" rx="1" fill="#facc15"/><rect x="41" y="117" width="3.4" height="13" rx="1" fill="#dc2626"/>
    <path d="M76 131 L80 131 L81 150 L75 150 Z" fill="#9ca3af" stroke="#4b5563" stroke-width="1"/>
    <rect x="75" y="140" width="6.5" height="12" rx="2" fill="#dc2626"/>
    <path d="M84 126 Q96 130 88 140 Q80 148 86 138" fill="none" stroke="#facc15" stroke-width="2.6" stroke-linecap="round"/>`
}

/* Commesso di ferramenta: maglietta chiara e grembiule in tela con tasche piene di attrezzi */
function apronOutfit(o) {
  return `
    <path d="M36 76 Q60 66 84 76 L88 128 Q60 135 32 128 Z" fill="${o.jacket}"/>
    <path d="M50 71 Q60 83 70 71 Z" fill="${o.shirt}"/>
    <path d="M47 74 L41 78 M73 74 L79 78" stroke="${o.apronDark}" stroke-width="4.5" stroke-linecap="round"/>
    <path d="M46 72 L74 72 L80 128 L40 128 Z" fill="${o.apron}" stroke="${o.apronDark}" stroke-width="2" stroke-linejoin="round"/>
    <rect x="52" y="82" width="14" height="8" rx="1.5" fill="#f8fafc" stroke="${o.apronDark}" stroke-width="1"/>
    <path d="M54.5 86 H63.5" stroke="#94a3b8" stroke-width="1.4" stroke-linecap="round"/>
    <rect x="45" y="104" width="30" height="20" rx="3" fill="${o.apronDark}" opacity=".55"/>
    <path d="M60 104 V124" stroke="${o.apronDark}" stroke-width="1.6"/>
    <rect x="50" y="94" width="4.4" height="14" rx="1.4" fill="#facc15" stroke="#854d0e" stroke-width=".8"/>
    <rect x="56" y="97" width="3.2" height="11" rx="1" fill="#2563eb"/>
    <path d="M63 100 L66 100 L66 108 L63 108 Z" fill="#ef4444"/>
    <rect x="66.5" y="107" width="8" height="8" rx="1.6" fill="#facc15" stroke="#854d0e" stroke-width="1"/>
    <path d="M70 107 V104" stroke="#9ca3af" stroke-width="1.5"/>
    <path d="M40 115 H46" stroke="${o.apronDark}" stroke-width="1"/>
    <rect x="33" y="125" width="54" height="5" rx="2.5" fill="${o.apronDark}"/>`
}

/* Pistolero: camicia chiara, bandana rossa, gilet di cuoio con stella, cintura con fondina e revolver */
function cowboyOutfit(o) {
  return `
    <path d="M36 76 Q60 66 84 76 L88 128 Q60 135 32 128 Z" fill="${o.jacket}"/>
    <path d="M50 71 Q60 83 70 71 Z" fill="${o.shirt}"/>
    <path d="M40 76 L51 71 L57 100 L56 128 L33 126 Z" fill="${o.vest}" stroke="${o.vestDark}" stroke-width="2.2" stroke-linejoin="round"/>
    <path d="M80 76 L69 71 L63 100 L64 128 L87 126 Z" fill="${o.vest}" stroke="${o.vestDark}" stroke-width="2.2" stroke-linejoin="round"/>
    <path d="M36 112 L55 113 M85 112 L65 113" stroke="${o.vestDark}" stroke-width="1.2" stroke-dasharray="2.5 2.5"/>
    <path d="M47 78 L49.5 84.5 L56 84.5 L50.800 88.500 L53 95 L47 91 L41 95 L43.200 88.500 L38 84.500 L44.500 84.500 Z" fill="#facc15" stroke="#a16207" stroke-width="1" stroke-linejoin="round"/>
    <path d="M47 70 L73 70 L61 92 Z" fill="${o.bandana}" stroke="rgba(0,0,0,.25)" stroke-width="1"/>
    <g fill="#fff" opacity=".85"><circle cx="55" cy="74" r="1.1"/><circle cx="62" cy="74.5" r="1.1"/><circle cx="68" cy="73.5" r="1.1"/><circle cx="60" cy="80" r="1.1"/><circle cx="64" cy="84" r="1.1"/></g>
    <rect x="32" y="122" width="56" height="9" rx="3" fill="${o.belt}" stroke="rgba(0,0,0,.4)" stroke-width="1"/>
    <rect x="54" y="122.5" width="12" height="8" rx="2" fill="#facc15" stroke="#a16207" stroke-width="1.2"/>
    <path d="M70 130 L84 130 L85 148 L72 148 Z" fill="#5b3a1c" stroke="#2b1a0b" stroke-width="1.2" stroke-linejoin="round"/>
    <path d="M71 124 L78 124 L78 131 L71 131 Z" fill="#8b5a2b" stroke="#2b1a0b" stroke-width="1"/>
    <path d="M73 118 L77 118 L78 125 L72 125 Z" fill="#7c4a1d" stroke="#2b1a0b" stroke-width="1"/>
    <path d="M33 127 L37 127 L37 135 L33 135 Z M40 127 L44 127 L44 135 L40 135 Z" fill="#fde68a" stroke="#a16207" stroke-width=".8"/>`
}

/* Allenatore: tuta con zip e colletto alto, fischietto al collo, palloncino sul petto */
function coachOutfit(o) {
  return `
    <path d="M36 76 Q60 66 84 76 L88 128 Q60 135 32 128 Z" fill="${o.jacket}"/>
    <path d="M37 80 L39.500 126 M83 80 L80.500 126" stroke="${o.trim}" stroke-width="3" stroke-linecap="round"/>
    <path d="M60 78 L60 128" stroke="${o.trim}" stroke-width="2.2"/>
    <path d="M47 69 L73 69 L71 79 Q60 85 49 79 Z" fill="${o.jacketDark}" stroke="${o.trim}" stroke-width="1.2" stroke-linejoin="round"/>
    <path d="M52 76 L60 100 L68 76" fill="none" stroke="#facc15" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="55.500" y="98" width="9" height="6.500" rx="3" fill="#e5e7eb" stroke="#4b5563" stroke-width="1.200"/>
    <circle cx="58.500" cy="101" r="1.300" fill="#111827"/>
    <circle cx="72" cy="94" r="5.500" fill="#fff" stroke="#111827" stroke-width="1.200"/>
    <path d="M72 90.500 L75 92.700 L73.800 96.200 L70.200 96.200 L69 92.700 Z" fill="#111827"/>
    <rect x="32" y="122" width="56" height="9" rx="3" fill="${o.jacketDark}"/>`
}

/* Stylist: maglia nera con borchie al collo, cappotto cammello aperto, catenina d'argento */
function stylistOutfit(o) {
  const studs = [[49,73.500],[52,77],[56,79.500],[60,80.500],[64,79.500],[68,77],[71,73.500]]
    .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.500" fill="#e5e7eb" stroke="#6b7280" stroke-width=".5"/>`).join('')
  return `
    <path d="M36 76 Q60 66 84 76 L88 128 Q60 135 32 128 Z" fill="${o.shirt}"/>
    <path d="M50 71 Q60 84 70 71 Z" fill="${o.skin}"/>
    <path d="M36 76 L50 71 L53 100 L55 128 L32 128 Z" fill="${o.jacket}" stroke="${o.jacketDark}" stroke-width="1.500" stroke-linejoin="round"/>
    <path d="M84 76 L70 71 L67 100 L65 128 L88 128 Z" fill="${o.jacket}" stroke="${o.jacketDark}" stroke-width="1.500" stroke-linejoin="round"/>
    <path d="M50 71 L42 86 L53 98 Z M70 71 L78 86 L67 98 Z" fill="${o.jacketDark}" opacity=".7"/>
    ${studs}
    <path d="M51 74 Q60 94 69 74" fill="none" stroke="#d1d5db" stroke-width="1.200"/>
    <circle cx="60" cy="90" r="2" fill="#e5e7eb" stroke="#6b7280" stroke-width=".6"/>
    <rect x="32" y="122" width="56" height="7" rx="3" fill="#18181b"/>
    <rect x="56" y="123" width="8" height="5" rx="1" fill="#d1d5db"/>`
}

/* Uomo della giungla: torso nudo, bandoliera maculata, cintura di liane e perizoma leopardato, pappagallo sulla spalla */
function jungleOutfit(o) {
  const spots = [[50,80],[58,88],[66,96],[74,104],[80,114]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.800" fill="#5b3a1c"/>`).join('')
  return `
    <path d="M36 76 Q60 66 84 76 L88 128 Q60 135 32 128 Z" fill="${o.skin}"/>
    <path d="M42 90 Q51 98 60 92 M78 90 Q69 98 60 92 M60 94 L60 112" fill="none" stroke="rgba(0,0,0,.16)" stroke-width="2" stroke-linecap="round"/>
    <path d="M44 74 L82 124" stroke="${o.fur}" stroke-width="8.500" stroke-linecap="round"/>${spots}
    <path d="M32 123 Q60 130 88 123 L88 130 Q60 137 32 130 Z" fill="${o.vine}" stroke="#365314" stroke-width="1.200"/>
    <path d="M42 130 Q38 138 46 138 Q48 134 42 130 Z M76 130 Q82 138 74 138 Q72 134 76 130 Z" fill="#65a30d" stroke="#365314" stroke-width="1"/>
    <path d="M34 130 L86 130 L84 143 L77 138 L71 148 L65 140 L59 149 L53 140 L47 148 L41 138 L36 144 Z" fill="${o.fur}" stroke="#7a4f1a" stroke-width="1.200" stroke-linejoin="round"/>
    <g fill="#5b3a1c"><circle cx="42" cy="134" r="2"/><circle cx="52" cy="137" r="2.200"/><circle cx="63" cy="135" r="2"/><circle cx="73" cy="137" r="2.200"/><circle cx="82" cy="134" r="1.800"/><circle cx="58" cy="143" r="1.600"/><circle cx="68" cy="144" r="1.600"/></g>
    <g transform="translate(36 66)">
      <path d="M-10 4 L-20 12 L-14 13 Z" fill="#2563eb"/>
      <ellipse cx="0" cy="3" rx="7" ry="9" fill="#dc2626"/>
      <path d="M-5 -1 Q-1 -4 3 3 Q-1 10 -5 8 Z" fill="#2563eb"/><path d="M-5 5 Q-2 3 1 7" fill="none" stroke="#facc15" stroke-width="1.800"/>
      <circle cx="3" cy="-8" r="5.500" fill="#dc2626"/><circle cx="5" cy="-9" r="1.800" fill="#fff"/><circle cx="5.500" cy="-9" r=".9" fill="#111"/>
      <path d="M7 -9 Q12 -8 10 -3 Q8 -5 6 -5 Z" fill="#fef3c7" stroke="#92400e" stroke-width=".8"/>
    </g>`
}

function outfit(look) {
  const o = look.outfit
  if (o.style === 'jungle') return jungleOutfit({ ...o, skin: look.skin })
  if (o.style === 'stylist') return stylistOutfit({ ...o, skin: look.skin })
  if (o.style === 'coach') return coachOutfit(o)
  if (o.style === 'cowboy') return cowboyOutfit(o)
  if (o.style === 'vest') return vestOutfit(o)
  if (o.style === 'apron') return apronOutfit(o)
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
  const pillowHold = look.rearHold === 'pillow'
    ? `<g transform="translate(22 110) rotate(-14)">
         <path d="M-12 -8 Q0 -12 12 -8 Q14 0 12 8 Q0 12 -12 8 Q-14 0 -12 -8 Z" fill="#bfdbfe" stroke="#60a5fa" stroke-width="1.6" stroke-linejoin="round"/>
         <path d="M-12 -8 L-15 -11 M12 -8 L15 -11 M-12 8 L-15 11 M12 8 L15 11" stroke="#f9a8d4" stroke-width="2.4" stroke-linecap="round"/>
         <text x="-6" y="3.5" font-family="Impact, 'Arial Black', sans-serif" font-size="9" fill="#6366f1">Zz</text>
       </g>`
    : ''
  const boardHold = look.rearHold === 'board'
    ? `<g transform="translate(22 110) rotate(-14)">
         <rect x="-12" y="-9" width="24" height="18" rx="2.500" fill="#8b5a2b" stroke="#3b2412" stroke-width="1.400"/>
         <rect x="-9.500" y="-6.500" width="19" height="13" rx="1.500" fill="#15803d"/>
         <path d="M-6 -3 L-3 0 M-3 -3 L-6 0 M2 3 L5 0 M5 3 L2 0" stroke="#fff" stroke-width="1.100" stroke-linecap="round"/>
         <path d="M-5 4 Q0 -2 6 -4" fill="none" stroke="#fde047" stroke-width="1" stroke-dasharray="2 1.500"/>
       </g>`
    : ''
  const hangerHold = look.rearHold === 'hanger'
    ? `<g transform="translate(22 108) rotate(-10)">
         <path d="M0 -12 Q0 -17 4 -17 Q7 -17 7 -14 M0 -12 L0 -9 M0 -9 L-13 -3 M0 -9 L13 -3" fill="none" stroke="#cbd5e1" stroke-width="1.500" stroke-linecap="round"/>
         <path d="M-12 -3 L-3 -5 L0 2 L3 -5 L12 -3 L14 12 L-14 12 Z" fill="#374151" stroke="#111827" stroke-width="1.200" stroke-linejoin="round"/>
         <path d="M-3 -5 L0 6 L3 -5" fill="none" stroke="#9ca3af" stroke-width="1"/>
       </g>`
    : ''
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
    ${o.pantStripe ? `<rect x="43.500" y="128" width="3" height="30" rx="1.500" fill="${o.pantStripe}"/>` : ''}
    <path d="M38 158 h22 q4 8 -3 8 h-19 q-5 -4 0 -8z" fill="${o.shoes}"/>
  </g>
  <g class="bb-leg-f" style="transform-origin:70px 122px">
    <rect x="62" y="120" width="16" height="42" rx="6" fill="${o.pants}"/>
    ${o.pantStripe ? `<rect x="73.500" y="128" width="3" height="30" rx="1.500" fill="${o.pantStripe}"/>` : ''}
    <path d="M60 158 h22 q5 4 0 8 h-19 q-6 0 -3 -8z" fill="${o.shoes}"/>
  </g>
  <g class="bb-rear-arm" style="transform-origin:38px 82px">
    ${o.sleeve === 'short'
      ? `<path d="M38 82 L${look.rearHold ? 26 : 35} 108" ${SW(look.skin)} stroke-width="12" fill="none"/>
         <path d="M38 82 L37 92" ${SW(o.jacketDark)} stroke-width="14" fill="none"/>`
      : `<path d="M38 82 L${look.rearHold ? 26 : 35} 108" ${SW(o.jacketDark)} stroke-width="13" fill="none"/>`}
    <circle cx="${look.rearHold ? 25 : 35}" cy="111" r="7" fill="${look.glovesRear || look.skin}"/>
    ${rearHold}${pillowHold}${boardHold}${hangerHold}
  </g>
  <g class="bb-torso">
    ${outfit(look)}
    <rect x="53" y="60" width="14" height="14" fill="${look.skin}"/>
    <g class="bb-head">
      <ellipse cx="39" cy="48" rx="4.5" ry="6" fill="${look.skin}"/><ellipse cx="81" cy="48" rx="4.5" ry="6" fill="${look.skin}"/>
      <ellipse cx="60" cy="46" rx="21.5" ry="24" fill="${look.skin}"/>
      ${look.earring ? `<circle cx="38.500" cy="55" r="3.200" fill="none" stroke="${look.earring}" stroke-width="1.600"/>${look.earring2 ? `<circle cx="39" cy="51.500" r="2.400" fill="none" stroke="${look.earring}" stroke-width="1.300"/>` : ''}` : ''}
      ${beard(look)}
      ${hair(look)}
      ${look.brows === 'angry'
        ? `<path d="M42 40 L57 35 M63 35 L78 40" stroke="${look.hair}" stroke-width="4" stroke-linecap="round"/><circle cx="51" cy="45" r="2.6" fill="#111827"/><circle cx="69" cy="45" r="2.6" fill="#111827"/>`
        : `<ellipse cx="51" cy="46" rx="3.6" ry="3.2" fill="#fff"/><ellipse cx="69" cy="46" rx="3.6" ry="3.2" fill="#fff"/>
           <circle cx="52" cy="46" r="2.2" fill="${look.eye || '#3b2a20'}"/><circle cx="70" cy="46" r="2.2" fill="${look.eye || '#3b2a20'}"/>
           <circle cx="52.8" cy="45.2" r=".7" fill="#fff"/><circle cx="70.8" cy="45.2" r=".7" fill="#fff"/>
           ${look.brows === 'thick'
             ? `<path d="M42.5 38.5 Q49 33.5 57 36.5 M63 36.5 Q71 33.5 77.5 38.5" fill="none" stroke="${look.browColor || look.hair}" stroke-width="5.2" stroke-linecap="round"/>`
             : `<path d="M44 37 L56 36 M64 36 L76 37" stroke="${look.hair}" stroke-width="3" stroke-linecap="round"/>`}`}
      ${glasses(look)}
      <path d="M60 46 L58 56 L62 56" fill="none" stroke="rgba(120,70,40,.45)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      ${mouth(look)}
    </g>
    <g class="bb-arm" style="transform-origin:82px 82px">
      ${o.sleeve === 'short'
        ? `<path d="M82 82 L85 108" ${SW(look.skin)} stroke-width="12.5" fill="none"/>
           <path d="M82 82 L83.4 93" ${SW(o.jacket)} stroke-width="15" fill="none"/>`
        : `<path d="M82 82 L85 108" ${SW(o.jacket)} stroke-width="14" fill="none"/>
           <path d="M82 82 L85 108" ${SW(o.jacketDark)} stroke-width="14" fill="none" opacity=".25"/>`}
      ${look.frontHold === 'bow'
        ? `<path d="M64 88 Q86 136 108 88" fill="none" stroke="#2b1a0b" stroke-width="8" stroke-linecap="round"/>
           <path d="M64 88 Q86 136 108 88" fill="none" stroke="#b9772f" stroke-width="5" stroke-linecap="round"/>
           <path d="M64 88 L108 88" stroke="#f8fafc" stroke-width="1.6"/>
           <rect x="83" y="107" width="6" height="11" rx="2" fill="#3b2412"/>`
        : ''}
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
function parrot(c, k) {
  return `<g transform="scale(${k})">
    <path d="M-12 0 L-38 -6 L-36 3 L-40 9 L-12 6 Z" fill="${c.tail}"/><path d="M-14 3 L-34 3" stroke="${c.tail2}" stroke-width="3" stroke-linecap="round"/>
    <ellipse cx="0" cy="2" rx="15" ry="8.500" fill="${c.body}"/>
    <circle cx="14" cy="-4" r="7" fill="${c.head}"/>
    <path d="M19 -7 Q27 -6 24 1 Q21 -2 17 -2 Z" fill="${c.beak}" stroke="#92400e" stroke-width="1" stroke-linejoin="round"/>
    <circle cx="15.500" cy="-6" r="2.200" fill="#fff"/><circle cx="16" cy="-6" r="1.100" fill="#111"/>
    <g class="bb-flap"><path d="M-8 -2 Q-8 -24 8 -22 Q3 -12 6 0 Z" fill="${c.wing}" stroke="${c.edge}" stroke-width="1.600" stroke-linejoin="round"/></g>
    <path d="M6 10 L8 14 M0 10 L2 14" stroke="#92400e" stroke-width="1.400" stroke-linecap="round"/>
  </g>`
}

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

  // ara rossa
  macaw: parrot({ body: '#dc2626', head: '#ef4444', wing: '#2563eb', edge: '#facc15', tail: '#2563eb', tail2: '#dc2626', beak: '#fef3c7' }, 1),

  // pappagallino verde e giallo
  parakeet: parrot({ body: '#22c55e', head: '#facc15', wing: '#15803d', edge: '#bef264', tail: '#16a34a', tail2: '#22c55e', beak: '#fb923c' }, 0.85),

  // stormo di tre pappagalli
  flock: `<g transform="translate(6 -14) scale(.62)">${parrot({ body: '#f97316', head: '#fb923c', wing: '#dc2626', edge: '#facc15', tail: '#dc2626', tail2: '#f97316', beak: '#fef3c7' }, 1)}</g>
    <g transform="translate(-12 4) scale(.7)">${parrot({ body: '#22c55e', head: '#facc15', wing: '#15803d', edge: '#bef264', tail: '#16a34a', tail2: '#22c55e', beak: '#fb923c' }, 1)}</g>
    <g transform="translate(10 18) scale(.6)">${parrot({ body: '#3b82f6', head: '#60a5fa', wing: '#1d4ed8', edge: '#fde047', tail: '#1d4ed8', tail2: '#60a5fa', beak: '#fef3c7' }, 1)}</g>`,

  // maglietta
  shirt: `
    <path d="M-16 -12 L-7 -16 Q0 -10 7 -16 L16 -12 L23 -2 L15 3 L12 -2 L12 15 L-12 15 L-12 -2 L-15 3 L-23 -2 Z" fill="#f8fafc" stroke="#64748b" stroke-width="1.800" stroke-linejoin="round"/>
    <path d="M-12 1 H12 M-12 7 H12" stroke="#1e3a8a" stroke-width="2.200"/>
    <path d="M-7 -16 Q0 -10 7 -16" fill="none" stroke="#1e3a8a" stroke-width="2"/>`,

  // giacca su gruccia
  blazer: `
    <path d="M0 -20 Q0 -27 5 -27 Q10 -27 10 -22 M0 -20 L0 -16 M0 -16 L-19 -8 M0 -16 L19 -8" fill="none" stroke="#cbd5e1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M-17 -8 L-5 -11 L0 0 L5 -11 L17 -8 L22 16 L-22 16 Z" fill="#374151" stroke="#111827" stroke-width="1.800" stroke-linejoin="round"/>
    <path d="M-5 -11 L0 10 L5 -11 M0 10 L0 16" fill="none" stroke="#9ca3af" stroke-width="1.400"/>
    <circle cx="0" cy="6" r="1.400" fill="#e5e7eb"/><circle cx="0" cy="12" r="1.400" fill="#e5e7eb"/>`,

  // sneaker
  sneaker: `
    <path d="M-22 7 L-22 -1 Q-9 -3 -5 -12 L5 -12 Q7 -3 17 0 Q24 2 24 7 Z" fill="#f8fafc" stroke="#64748b" stroke-width="1.800" stroke-linejoin="round"/>
    <path d="M-4 -6 L2 -4 M-3 -1 L5 1" stroke="#94a3b8" stroke-width="1.400" stroke-linecap="round"/>
    <path d="M-10 0 Q-2 -4 4 -1" fill="none" stroke="#dc2626" stroke-width="2.200" stroke-linecap="round"/>
    <rect x="-23" y="6" width="48" height="6" rx="3" fill="#e2e8f0" stroke="#64748b" stroke-width="1.400"/>`,

  // lavagnetta tattica
  board: `
    <rect x="-21" y="-15" width="42" height="30" rx="4" fill="#8b5a2b" stroke="#3b2412" stroke-width="2"/>
    <rect x="-17" y="-11" width="34" height="22" rx="2.500" fill="#15803d"/>
    <path d="M-12 -6 L-7 -1 M-7 -6 L-12 -1 M5 3 L10 8 M10 3 L5 8" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
    <circle cx="9" cy="-4" r="3.200" fill="none" stroke="#fff" stroke-width="1.800"/>
    <path d="M-10 6 Q-2 -6 4 -6" fill="none" stroke="#fde047" stroke-width="1.600" stroke-dasharray="3 2.500" stroke-linecap="round"/>
    <path d="M3 -9 L7 -6 L3 -3" fill="none" stroke="#fde047" stroke-width="1.600" stroke-linecap="round" stroke-linejoin="round"/>`,

  // cono da allenamento
  cone: `
    <path d="M-10 9 L-4 -15 L4 -15 L10 9 Z" fill="#f97316" stroke="#9a3412" stroke-width="1.800" stroke-linejoin="round"/>
    <path d="M-5.600 -8 L5.600 -8 L6.400 -5 L-6.400 -5 Z M-7.800 0 L7.800 0 L8.600 3 L-8.600 3 Z" fill="#fff"/>
    <rect x="-15" y="9" width="30" height="5" rx="1.500" fill="#ea580c" stroke="#9a3412" stroke-width="1.600"/>`,

  // freccia
  arrow: `
    <path d="M-34 0 L26 0" stroke="#8b5a2b" stroke-width="3" stroke-linecap="round"/>
    <path d="M24 -6 L38 0 L24 6 Z" fill="#cbd5e1" stroke="#475569" stroke-width="1.4" stroke-linejoin="round"/>
    <path d="M-34 0 L-44 -7 M-34 0 L-44 7 M-27 0 L-37 -7 M-27 0 L-37 7" stroke="#dc2626" stroke-width="3" stroke-linecap="round"/>`,

  // freccia di fuoco
  firearrow: `
    <g class="bb-flicker">
      <path d="M-30 0 Q-44 -10 -60 -3 Q-48 0 -60 4 Q-44 10 -30 0 Z" fill="#fb923c" opacity=".85"/>
      <path d="M18 0 Q22 -14 34 -12 Q30 -6 42 -3 Q50 0 42 3 Q30 6 34 12 Q22 14 18 0 Z" fill="#f97316"/>
      <path d="M24 0 Q28 -7 36 -5 Q34 -2 40 0 Q34 2 36 5 Q28 7 24 0 Z" fill="#fde047"/>
    </g>
    <path d="M-34 0 L24 0" stroke="#8b5a2b" stroke-width="3" stroke-linecap="round"/>
    <path d="M-34 0 L-44 -7 M-34 0 L-44 7" stroke="#dc2626" stroke-width="3" stroke-linecap="round"/>`,

  // colpo di revolver
  bullet: `
    <path d="M-40 -3 L-10 -1 M-46 3 L-12 2" stroke="#fde68a" stroke-width="2.4" stroke-linecap="round" opacity=".8"/>
    <path d="M-8 -5 L10 -5 Q20 -5 24 0 Q20 5 10 5 L-8 5 Z" fill="#fbbf24" stroke="#92400e" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M10 -5 Q20 -5 24 0 Q20 5 10 5 Z" fill="#b45309"/>
    <path d="M-6 -3 H8" stroke="#fff7b0" stroke-width="1.4" opacity=".9"/>`,

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
