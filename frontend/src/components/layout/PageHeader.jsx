// Ideogramma decorativo per ogni sezione (stile schermata di selezione arcade).
const KANJI = {
  Prodotti: '商品',
  Debiti: '借金',
  Cassa: '金庫',
  Storico: '記録',
  'Lista spesa': '買物',
  Gestione: '管理',
  'Prodotti admin': '在庫',
  Magazzino: '在庫',
  Utenti: '選手',
}

export default function PageHeader({ title, subtitle, kicker, badge, primaryAction, secondaryAction }) {
  const kanji = KANJI[title]

  return (
    <header className="page-header">
      <div className="min-0">
        {(kicker || kanji) && <div className="page-kicker">{kanji && <span className="page-kanji" aria-hidden="true">{kanji}</span>}{kicker}</div>}
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
