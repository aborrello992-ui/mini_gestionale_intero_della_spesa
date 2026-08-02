const toneMap = {
  paid: ['success', 'Pagato'],
  coppone: ['accent', 'Coppone'],
  saldato: ['success', 'Saldato'],
  open: ['warning', 'Aperto'],
  active: ['success', 'Attivo'],
  inactive: ['neutral', 'Disattivato'],
  entrata: ['success', 'Entrata'],
  uscita: ['danger', 'Uscita'],
  storico: ['info', 'Storico'],
  annullato: ['neutral', 'Annullato'],
  esaurito: ['danger', 'Esaurito'],
  basso: ['warning', 'Scorta bassa'],
  ok: ['success', 'Disponibile'],
}

export default function StatusBadge({ status, children, tone }) {
  const [mappedTone, mappedLabel] = toneMap[String(status || '').toLowerCase()] || ['neutral', status]
  return <span className={`status-badge status-${tone || mappedTone}`}>{children || mappedLabel || 'Stato'}</span>
}
