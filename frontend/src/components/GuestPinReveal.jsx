import { useEffect, useRef, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import './guest-pin-reveal.css'

const SPARKS = Array.from({ length: 14 }, (_, index) => index)

/**
 * PIN dell'ospite mostrato con un'esplosione in stile arcade.
 * Toccando le cifre l'esplosione riparte; "Copia" mette il PIN negli appunti.
 */
export default function GuestPinReveal({ pin, expiresAt, onClose }) {
  const [burst, setBurst] = useState(0)
  const [copied, setCopied] = useState(false)
  const closeRef = useRef(null)

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (event) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function copy() {
    try {
      await navigator.clipboard.writeText(pin)
    } catch {
      // Contesto non sicuro (http in rete locale): ripiego con una textarea temporanea.
      const area = Object.assign(document.createElement('textarea'), { value: pin })
      document.body.appendChild(area)
      area.select()
      document.execCommand('copy')
      area.remove()
    }
    setCopied(true)
    setBurst((value) => value + 1)
  }

  const until = expiresAt ? new Date(expiresAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : null

  return (
    <div className="gp-overlay" role="dialog" aria-modal="true" aria-labelledby="gp-title" aria-describedby="gp-help">
      <div className="gp-stage" key={burst}>
        <div className="gp-rays" aria-hidden="true" />
        <div className="gp-ring" aria-hidden="true" />
        <div className="gp-sparks" aria-hidden="true">{SPARKS.map((index) => <i key={index} style={{ '--a': `${(360 / SPARKS.length) * index}deg`, '--d': `${120 + (index % 4) * 40}px` }} />)}</div>
        <p className="gp-label" id="gp-title">Il tuo PIN</p>
        <button type="button" className="gp-pin" onClick={() => setBurst((value) => value + 1)} aria-label={`PIN ${pin.split('').join(' ')}. Tocca per rivederlo esplodere`}>
          {pin.split('').map((digit, index) => <span key={index} style={{ '--i': index }}>{digit}</span>)}
        </button>
        <p className="gp-help" id="gp-help">Memorizzalo o copialo: ti serve quando mangi con un socio. Vale per questa visita{until ? `, fino alle ${until}` : ''}.</p>
        <div className="gp-actions">
          <button type="button" className="btn btn-warning btn-lg" onClick={copy}>{copied ? <Check size={18} /> : <Copy size={18} />} {copied ? 'Copiato' : 'Copia'}</button>
          <button type="button" className="btn btn-primary btn-lg" onClick={onClose} ref={closeRef}>Memorizzato</button>
        </div>
      </div>
    </div>
  )
}
