import { useEffect, useState } from 'react'
import { bossArt, fighterArt, PROJECTILES } from './battle/art'
import { avatarFor } from './battle/avatars'
import './wait-scene.css'

const BASE = {
  pay: 'Stai pagando il boss…',
  coppone: 'Il boss segna sul taccuino…',
  suggest: 'Il boss ascolta il tuo consiglio…',
  generic: 'Un attimo…',
}

function caption(kind, seconds) {
  if (seconds >= 40) return 'Ci mette più del solito: non chiudere, ci siamo quasi.'
  if (seconds >= 10) return 'Il server si sta svegliando: fa stretching…'
  return BASE[kind] || BASE.generic
}

// Oggetti che girano in volo; gli altri (frecce, proiettili, pappagalli, fulmini) volano dritti.
const SPINNING = ['drill', 'wrench', 'board', 'cone', 'shirt', 'blazer', 'sneaker', 'pillow']

const coin = (cls) => `<g class="ws-coin ${cls}"><circle r="8" fill="#ffd23f" stroke="#b45309" stroke-width="2.4"/><text y="4" text-anchor="middle" font-size="11" font-weight="900" fill="#b45309">€</text></g>`

// Oggetti di scena per ogni azione (coordinate del viewBox 400x220). Ogni scena è un ciclo continuo.
function props(kind, avatar) {
  if (kind === 'pay') {
    // Il socio porge le monete, il boss le conta (annuisce) e timbra PAGATO.
    return `${coin('ws-coin-1')}${coin('ws-coin-2')}${coin('ws-coin-3')}
      <g class="ws-stamp"><g transform="rotate(-12)"><rect x="-52" y="-17" width="104" height="34" rx="4" fill="rgba(255,255,255,.92)" stroke="#16a34a" stroke-width="4"/>
        <text y="9" text-anchor="middle" font-family="Impact, 'Arial Black', sans-serif" font-size="25" letter-spacing="2" fill="#16a34a">PAGATO</text></g></g>`
  }
  if (kind === 'coppone') {
    // Il boss scrive il debito sul taccuino, il socio si gratta la testa.
    return `<g class="ws-notepad" transform="translate(236 92)"><rect width="34" height="42" rx="3" fill="#fff8e1" stroke="#0e1020" stroke-width="2.5"/>
        <path d="M6 12 H28 M6 20 H28" stroke="#94a3b8" stroke-width="2"/><path class="ws-scribble" d="M6 29 Q10 25 13 29 T20 29 T27 29" fill="none" stroke="#dc2626" stroke-width="2.2" stroke-linecap="round"/>
        <g class="ws-pencil"><path d="M26 4 L40 -10 L44 -6 L30 8 Z" fill="#f59e0b" stroke="#0e1020" stroke-width="2"/></g></g>
      <text class="ws-question" x="112" y="38" font-size="26" font-weight="900" fill="#ffd23f" stroke="#0e1020" stroke-width="2" paint-order="stroke">?</text>`
  }
  if (kind === 'suggest') {
    // Il socio va a sussurrargli all'orecchio, il boss annuisce.
    return `<g class="ws-bubble" transform="translate(196 28)"><path d="M0 0 H62 Q70 0 70 8 V26 Q70 34 62 34 H50 L60 46 L36 34 H8 Q0 34 0 26 V8 Q0 0 8 0 Z" fill="#fff" stroke="#0e1020" stroke-width="2.5"/>
        <text x="35" y="23" text-anchor="middle" font-family="Impact, 'Arial Black', sans-serif" font-size="15" letter-spacing="1" fill="#0e1020">psst…</text></g>
      <g class="ws-check" transform="translate(300 34)"><circle r="12" fill="#16a34a" stroke="#fff" stroke-width="2.5"/><path d="M-5 0 L-1 4 L6 -4" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></g>`
  }
  // Attesa generica: il socio tira la sua mossa personale, il boss para.
  const move = avatar.moves?.[0]?.kind
  const art = PROJECTILES[move] || PROJECTILES.wrench
  return `<g class="ws-shot"><g class="${SPINNING.includes(move) ? 'ws-spin' : ''}">${art}</g></g>
    <g class="ws-hit" transform="translate(252 112)"><path d="M0 -18 L5 -6 L18 -8 L8 2 L16 14 L3 8 L-4 19 L-6 6 L-19 6 L-8 -2 L-15 -14 L-3 -8 Z" fill="#ffd23f" stroke="#ff7a00" stroke-width="2"/></g>`
}

/**
 * Scena d'attesa: l'avatar di chi sta facendo l'azione contro il boss, in loop finché il server risponde.
 * kind: pay (monete e timbro PAGATO) | coppone (taccuino) | suggest (sussurro) | generic (mossa personale del socio)
 */
export default function WaitScene({ kind = 'generic', user, startedAt }) {
  const [seconds, setSeconds] = useState(0)
  const avatar = avatarFor(user)

  useEffect(() => {
    const timer = setInterval(() => setSeconds(Math.floor((Date.now() - startedAt) / 1000)), 1000)
    return () => clearInterval(timer)
  }, [startedAt])

  const scene = `
    <defs><linearGradient id="ws-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0c1230"/><stop offset=".6" stop-color="#3a2466"/><stop offset="1" stop-color="#ff8a5c"/></linearGradient></defs>
    <rect width="400" height="220" fill="url(#ws-sky)"/>
    <rect y="190" width="400" height="30" fill="#4a2c1d"/><path d="M0 190 H400" stroke="#9a6a4a" stroke-width="2"/>
    <g class="ws-actor ws-user"><svg x="40" y="44" width="105" height="149" viewBox="0 0 120 170" style="overflow:visible">${fighterArt(avatar.look)}</svg></g>
    <g class="ws-actor ws-boss"><g transform="translate(600 0) scale(-1 1)"><svg x="236" y="34" width="128" height="181" viewBox="0 0 120 170" style="overflow:visible">${bossArt()}</svg></g></g>
    ${props(kind, avatar)}`

  return (
    <div className={`ws-overlay ws-${kind}`} role="status" aria-live="polite">
      <div className="ws-card">
        <div className="ws-names"><span>{avatar.name}</span><strong>VS</strong><span>BOSS</span></div>
        <svg className="ws-scene" viewBox="0 0 400 220" aria-hidden="true" focusable="false" dangerouslySetInnerHTML={{ __html: scene }} />
        <p className="ws-caption">{caption(kind, seconds)}</p>
      </div>
    </div>
  )
}
