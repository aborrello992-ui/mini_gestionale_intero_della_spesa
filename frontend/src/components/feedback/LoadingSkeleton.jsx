export default function LoadingSkeleton({ cards = 3, type = 'card' }) {
  if (type === 'metrics') {
    return (
      <div className="metric-grid mb-3" aria-label="Caricamento metriche">
        {Array.from({ length: cards }).map((_, index) => <div className="skeleton metric" key={index} />)}
      </div>
    )
  }

  return (
    <div className="card-grid" aria-label="Caricamento">
      {Array.from({ length: cards }).map((_, index) => <div className="skeleton app-card" style={{ minHeight: 220 }} key={index} />)}
    </div>
  )
}
