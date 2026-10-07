import { useState } from 'react'
import { ExternalLink, ZoomIn, ZoomOut } from 'lucide-react'
import AppModal from './AppModal'

/** Foto (es. scontrino) aperta dentro l'app, con ingrandimento e ripiego se non si carica. */
export default function PhotoViewer({ url, title = 'Foto scontrino', subtitle, onClose }) {
  const [zoomed, setZoomed] = useState(false)
  const [failed, setFailed] = useState(false)

  return (
    <AppModal title={title} subtitle={subtitle} onClose={onClose} labelledBy="photo-viewer-title">
      <div className="stack-sm">
        {failed
          ? <div className="summary-box">La foto non si carica. Un admin può usare «Controlla immagini» in Magazzino per capire se l'archivio immagini funziona.</div>
          : <div className={`photo-viewer ${zoomed ? 'is-zoomed' : ''}`}>
            <img src={url} alt={title} onError={() => setFailed(true)} onClick={() => setZoomed((value) => !value)} />
          </div>}
        <div className="product-admin-actions">
          {!failed && <button type="button" className="btn btn-outline-primary" onClick={() => setZoomed((value) => !value)}>{zoomed ? <ZoomOut size={17} /> : <ZoomIn size={17} />} {zoomed ? 'Riduci' : 'Ingrandisci'}</button>}
          <a className="btn btn-outline-secondary" href={url} target="_blank" rel="noopener noreferrer"><ExternalLink size={17} /> Apri originale</a>
        </div>
      </div>
    </AppModal>
  )
}
