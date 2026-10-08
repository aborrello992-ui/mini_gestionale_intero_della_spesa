import { useEffect, useRef, useState } from 'react'
import './guest-pin-reveal.css'

const SPARKS = Array.from({ length: 14 }, (_, index) => index)

/**
 * Esplosione arcade a tutto schermo (raggi, onda d'urto, scintille, parole che sbattono).
 * Usata per il PIN dell'ospite e per i messaggi di Pagato / Coppone.
 * tone: "gold" (festa) o "red" (avvertimento). Tocca il titolo per far ripartire l'esplosione.
 */
export default function ArcadeBurst({ label, words = [], tiles, subtitle, tone = 'gold', autoCloseMs, onClose, children }) {
  const [burst, setBurst] = useState(0)
  const closeRef = useRef(null)

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (event) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const timer = autoCloseMs ? setTimeout(onClose, autoCloseMs) : null
    return () => { window.removeEventListener('keydown', onKey); if (timer) clearTimeout(timer) }
  }, [onClose, autoCloseMs])

  return (
    <div className={`gp-overlay gp-${tone}`} role="dialog" aria-modal="true" aria-labelledby="gp-title" onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div className="gp-stage" key={burst}>
        <div className="gp-rays" aria-hidden="true" />
        <div className="gp-ring" aria-hidden="true" />
        <div className="gp-sparks" aria-hidden="true">{SPARKS.map((index) => <i key={index} style={{ '--a': `${(360 / SPARKS.length) * index}deg`, '--d': `${120 + (index % 4) * 40}px` }} />)}</div>
        {label && <p className="gp-label" id="gp-title">{label}</p>}
        {tiles
          ? <button type="button" className="gp-pin" onClick={() => setBurst((value) => value + 1)} aria-label={`${tiles.split('').join(' ')}. Tocca per rivederlo esplodere`}>
            {tiles.split('').map((char, index) => <span key={index} style={{ '--i': index }}>{char}</span>)}
          </button>
          : <button type="button" className="gp-headline" onClick={() => setBurst((value) => value + 1)} aria-label={words.join(' ')}>
            {words.map((word, index) => <span key={index} style={{ '--i': index }}>{word}</span>)}
          </button>}
        {subtitle && <p className="gp-help">{subtitle}</p>}
        <div className="gp-actions">
          {children}
          {!children && <button type="button" className="btn btn-primary btn-lg gp-full" onClick={onClose} ref={closeRef}>OK</button>}
        </div>
      </div>
    </div>
  )
}
