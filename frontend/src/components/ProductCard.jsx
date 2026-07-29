import StockBadge from './StockBadge'
import { money, quantity } from '../utils/format'

export default function ProductCard({ product }) {
  return (
    <div className="app-card h-100">
      <div className="d-flex justify-content-between gap-2">
        <div>
          <h3 className="h6 mb-1">{product.name}</h3>
          <div className="small text-secondary">{product.category?.name} · {product.location?.name}</div>
        </div>
        <StockBadge product={product} />
      </div>
      <div className="mt-3 d-flex justify-content-between">
        <strong>{quantity(product.current_quantity, product.unit)}</strong>
        <span className="text-secondary small">medio {money(product.average_price_cents)}</span>
      </div>
    </div>
  )
}
