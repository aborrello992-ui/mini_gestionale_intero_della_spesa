export default function MetricCard({ label, value, help, icon: Icon, tone = 'primary', emphasis = false }) {
  return (
    <article className={`metric ${emphasis ? 'metric-main' : ''}`}>
      <div className="split">
        <span className="metric-label">{label}</span>
        {Icon && <span className={`metric-icon status-${tone}`}><Icon size={20} aria-hidden="true" /></span>}
      </div>
      <strong className="metric-value num">{value}</strong>
      {help && <p className="metric-help">{help}</p>}
    </article>
  )
}
