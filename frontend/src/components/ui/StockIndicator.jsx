import { quantity } from '../../utils/format'
import { stockLevel } from '../../utils/stock'

export default function StockIndicator({ product }) {
  const current = Number(product.current_quantity || 0)
  const threshold = Number(product.minimum_threshold || 0)
  const reference = Number(product.stock_reference_quantity || Math.max(threshold * 3, current, 1))
  const percent = Math.max(0, Math.min(100, (current / reference) * 100))
  const level = stockLevel(product)

  return (
    <div className="stock-indicator">
      <div className="stock-indicator-head">
        <span>{level.label}</span>
        <strong>{quantity(product.current_quantity, product.unit)}</strong>
      </div>
      <div className="stock-meter" aria-label={`${level.label}: ${quantity(product.current_quantity, product.unit)}`}>
        <div style={{ width: `${percent}%`, '--stock-color': level.color }} />
      </div>
    </div>
  )
}
