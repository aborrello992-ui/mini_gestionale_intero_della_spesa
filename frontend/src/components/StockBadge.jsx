export default function StockBadge({ product }) {
  const current = Number(product.current_quantity)
  const min = Number(product.minimum_threshold)
  if (current === 0) return <span className="badge text-bg-danger">Esaurito</span>
  if (current <= min) return <span className="badge text-bg-warning">Sotto scorta</span>
  return <span className="badge text-bg-success">Disponibile</span>
}
