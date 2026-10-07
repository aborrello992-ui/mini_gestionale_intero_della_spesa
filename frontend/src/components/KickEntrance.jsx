import './kick-entrance.css'

// Lottatore ORIGINALE (karateka con tuta teal, cintura arancione, capelli neri corti).
// Guarda a destra. Il calcio ruota la gamba .kf-kick-leg attorno all'anca (108,138).
export function Fighter() {
  return (
    <svg className="kf-svg" viewBox="0 0 260 280" aria-hidden="true">
      <ellipse className="kf-shadow" cx="110" cy="266" rx="70" ry="9" />

      {/* gamba d'appoggio */}
      <g className="kf-rear-leg">
        <path d="M96 136 L120 136 L108 204 L112 254 L84 254 L90 204 Z" fill="#0f766e" />
        <path d="M80 252 L116 252 Q122 262 112 266 L78 266 Q74 258 80 252 Z" fill="#f1c27d" />
      </g>

      {/* gamba del calcio */}
      <g className="kf-kick-leg">
        <path d="M98 134 L122 134 L118 258 L98 258 Z" fill="#14b8a6" />
        <path d="M96 252 L122 252 Q128 266 116 270 L94 270 Q90 260 96 252 Z" fill="#f1c27d" />
      </g>

      {/* busto */}
      <g className="kf-torso">
        <path className="kf-arm-back" d="M122 80 L138 108 L120 100" fill="none" stroke="#0f766e" strokeWidth="15" strokeLinecap="round" strokeLinejoin="round" />
        <circle className="kf-fist-back" cx="120" cy="100" r="8" fill="#f1c27d" />
        <path d="M82 66 L130 66 L124 138 L88 138 Z" fill="#14b8a6" />
        <path d="M98 66 L112 66 L108 110 Z" fill="#e6fffb" />
        <rect x="86" y="126" width="40" height="10" rx="2" fill="#f97316" />
        <rect x="104" y="128" width="8" height="26" rx="2" fill="#ea580c" />
        {/* testa */}
        <rect x="102" y="56" width="12" height="12" fill="#e0ae6b" />
        <circle cx="108" cy="46" r="20" fill="#f1c27d" />
        <path d="M87 46 Q86 22 109 24 Q132 24 129 46 Q121 34 108 36 Q95 36 87 46 Z" fill="#111827" />
        <path d="M92 28 L86 18 L100 24 Z M104 24 L102 12 L114 22 Z M118 24 L124 14 L128 28 Z" fill="#111827" />
        <path d="M112 44 L126 42" stroke="#111827" strokeWidth="3" strokeLinecap="round" />
        <circle cx="120" cy="47" r="2.2" fill="#111827" />
        <path d="M114 58 L122 57" stroke="#7c4a1e" strokeWidth="2" strokeLinecap="round" />
        {/* braccio anteriore con fascia arancione */}
        <g className="kf-arm-front">
          <path d="M90 80 L76 110 L102 102" fill="none" stroke="#14b8a6" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M86 86 L78 100" stroke="#f97316" strokeWidth="18" strokeLinecap="butt" />
          <circle cx="102" cy="102" r="9" fill="#f1c27d" />
        </g>
      </g>
    </svg>
  )
}

/** Il lottatore in guardia sulla pagina d'ingresso, prima del calcio. */
export function IdleFighter({ hidden = false }) {
  return (
    <div className={`kf-idle ${hidden ? 'is-hidden' : ''}`} aria-hidden="true">
      <Fighter />
    </div>
  )
}
