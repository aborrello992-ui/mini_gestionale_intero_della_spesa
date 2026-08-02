import { X } from 'lucide-react'

export default function AppModal({ title, subtitle, children, onClose, labelledBy = 'app-modal-title' }) {
  return (
    <div className="modal-backdrop-lite" role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
      <div className="app-modal-panel">
        <div className="app-modal-head">
          <div>
            <h2 className="h4 mb-1" id={labelledBy}>{title}</h2>
            {subtitle && <p className="text-muted-app mb-0">{subtitle}</p>}
          </div>
          <button className="btn btn-sm btn-outline-secondary" type="button" onClick={onClose} aria-label="Chiudi">
            <X size={17} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
