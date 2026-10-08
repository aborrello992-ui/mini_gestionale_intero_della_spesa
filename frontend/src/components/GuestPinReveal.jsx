import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import ArcadeBurst from './ArcadeBurst'

/** PIN dell'ospite mostrato con l'esplosione arcade, con Copia e Memorizzato. */
export default function GuestPinReveal({ pin, expiresAt, onClose }) {
  const [copied, setCopied] = useState(false)

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
  }

  const until = expiresAt ? new Date(expiresAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : null

  return (
    <ArcadeBurst label="Il tuo PIN" tiles={pin} onClose={onClose} subtitle={`Memorizzalo o copialo: ti serve quando mangi con un socio. Vale per questa visita${until ? `, fino alle ${until}` : ''}.`}>
      <button type="button" className="btn btn-warning btn-lg" onClick={copy}>{copied ? <Check size={18} /> : <Copy size={18} />} {copied ? 'Copiato' : 'Copia'}</button>
      <button type="button" className="btn btn-primary btn-lg" onClick={onClose} autoFocus>Memorizzato</button>
    </ArcadeBurst>
  )
}
