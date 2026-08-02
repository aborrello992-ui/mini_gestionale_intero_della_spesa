export default function PageHeader({ title, subtitle, kicker, badge, primaryAction, secondaryAction }) {
  return (
    <header className="page-header">
      <div className="min-0">
        {kicker && <div className="page-kicker">{kicker}</div>}
        <div className="cluster">
          <h1>{title}</h1>
          {badge}
        </div>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {(primaryAction || secondaryAction) && (
        <div className="page-actions">
          {secondaryAction}
          {primaryAction}
        </div>
      )}
    </header>
  )
}
