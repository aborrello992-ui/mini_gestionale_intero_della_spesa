import { useEffect, useState } from 'react'
import { bossArt, fighterArt } from './battle/art'
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

// Oggetti di scena per ogni azione (coordinate del viewBox 400x220).
const PROPS = {
  pay: `<g class="ws-coin"><circle r="9" fill="#ffd23f" stroke="#b45309" stroke-width="2.5"/><text y="4.5" text-anchor="middle" font-size="12" font-weight="900" fill="#b45309">€</text></g>
        <g class="ws-coin ws-coin-2"><circle r="9" fill="#ffd23f" stroke="#b45309" stroke-width="2.5"/><text y="4.5" text-anchor="middle" font-size="12" font-weight="900" fill="#b45309">€</text></g>`,
  coppone: `<g class="ws-notepad" transform="translate(236 92)"><rect width="34" height="42" rx="3" fill="#fff8e1" stroke="#0e1020" stroke-width="2.5"/>
          <path d="M6 12 H28 M6 20 H28 M6 28 H22" stroke="#94a3b8" stroke-width="2"/><g class="ws-pencil"><path d="M26 4 L40 -10 L44 -6 L30 8 Z" fill="#f59e0b" stroke="#0e1020" stroke-width="2"/></g></g>
        <text class="ws-question" x="112" y="38" font-size="26" font-weight="900" fill="#ffd23f" stroke="#0e1020" stroke-width="2" paint-order="stroke">?</text>`,
  suggest: `<g class="ws-bubble" transform="translate(150 30)"><path d="M0 0 H70 Q78 0 78 8 V28 Q78 36 70 36 H24 L10 48 L14 36 H8 Q0 36 0 28 V8 Q0 0 8 0 Z" fill="#fff" stroke="#0e1020" stroke-width="2.5"/>
          <circle class="ws-dot" cx="22" cy="18" r="4.5" fill="#0e1020"/><circle class="ws-dot ws-dot-2" cx="39" cy="18" r="4.5" fill="#0e1020"/><circle class="ws-dot ws-dot-3" cx="56" cy="18" r="4.5" fill="#0e1020"/></g>`,
  generic: `<g class="ws-spark" transform="translate(200 120)"><path d="M0 -14 L4 -4 L14 0 L4 4 L0 14 L-4 4 L-14 0 L-4 -4 Z" fill="#ffd23f" stroke="#ff7a00" stroke-width="2"/></g>`,
}

/**
 * Scena d'attesa: l'avatar di chi sta facendo l'azione contro il boss, in loop finché il server risponde.
 * kind: pay | coppone | suggest | generic
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
    ${PROPS[kind] || PROPS.generic}`

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
