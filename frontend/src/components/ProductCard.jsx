import StockBadge from './StockBadge'
import { money, quantity } from '../utils/format'

export default function ProductCard({ product, onTake }) {
  const current = Number(product.current_quantity || 0)
  const threshold = Number(product.minimum_threshold || 0)
  const reference = Number(product.stock_reference_quantity || Math.max(threshold * 3, current, 1))
  const percent = Math.max(0, Math.min(100, (current / reference) * 100))
  const level = current === 0 ? 'Esaurito' : current <= threshold / 2 ? 'Quasi esaurito' : current <= threshold ? 'Disponibilità bassa' : 'Disponibilità buona'

  return (
    <div className="app-card product-card h-100">
      <div className="product-image" aria-label={product.image_alt || product.name}>
        {product.image_url ? <img src={product.image_url} alt={product.image_alt || product.name} /> : <span>{product.name.slice(0, 1)}</span>}
      </div>
      <div className="d-flex justify-content-between gap-2">
        <div>
          <h3 className="h6 mb-1">{product.name}</h3>
          <div className="small text-secondary">{product.category?.name} · {product.location?.name}</div>
        </div>
        <StockBadge product={product} />
      </div>
      <div className="mt-3 d-flex justify-content-between align-items-center">
        <strong>{quantity(product.current_quantity, product.unit)}</strong>
        <span className="price">{money(product.selling_price_cents)}</span>
      </div>
      <div className="stock-meter" aria-label={`Disponibilita: ${level}`}>
        <div style={{ width: `${percent}%` }} />
      </div>
      <div className="small text-secondary mb-3">Disponibilità: {level}</div>
      <button className="btn btn-primary btn-lg w-100" onClick={() => onTake(product)} disabled={current <= 0}>Prendi</button>
    </div>
  )
}
