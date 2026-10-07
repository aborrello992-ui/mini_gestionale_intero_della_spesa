import { ShoppingCart } from 'lucide-react'
import StatusBadge from './ui/StatusBadge'
import ProductThumb from './ui/ProductThumb'
import StockIndicator from './ui/StockIndicator'
import { money, quantity } from '../utils/format'
import { stockLevel } from '../utils/stock'

export default function ProductCard({ product, onTake, onAddToShoppingList }) {
  const current = Number(product.current_quantity || 0)
  const level = stockLevel(product)

  return (
    <article className={`app-card product-card ${current <= 0 ? 'is-empty' : ''}`}>
      <div className="product-card-media">
        <ProductThumb product={product} />
        <div className="product-card-badges">
          <StatusBadge tone="primary">{product.category?.name || 'Categoria'}</StatusBadge>
          <StatusBadge status={level.status}>{level.label}</StatusBadge>
        </div>
      </div>

      <div className="product-card-body">
        <div>
          <h3 className="product-card-title">{product.name}</h3>
          <div className="product-meta">{product.location?.name || 'Locale'} · {product.unit}</div>
        </div>
        <div className="product-card-metrics">
          <div>
            <div className="small text-muted-app">Prezzo</div>
            <span className="price">{money(product.selling_price_cents)}</span>
          </div>
          <div className="text-end">
            <div className="small text-muted-app">Disponibili</div>
            <strong>{quantity(product.current_quantity, product.unit)}</strong>
          </div>
        </div>
        <StockIndicator product={product} />
      </div>

      <div className="product-card-actions">
        {current > 0
          ? <button type="button" className="btn btn-primary btn-lg w-100" onClick={() => onTake(product)}>Prendi</button>
          : <button type="button" className="btn btn-outline-secondary w-100" onClick={() => onAddToShoppingList(product)}>
            <ShoppingCart size={17} /> Aggiungi alla lista
          </button>}
      </div>
    </article>
  )
}
