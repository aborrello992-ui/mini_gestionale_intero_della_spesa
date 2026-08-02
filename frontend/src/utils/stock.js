export function stockLevel(product) {
  const current = Number(product.current_quantity || 0)
  const threshold = Number(product.minimum_threshold || 0)
  if (current === 0) return { label: 'Esaurito', status: 'esaurito', tone: 'danger', color: 'var(--color-danger)' }
  if (current <= threshold / 2) return { label: 'Quasi esaurito', status: 'basso', tone: 'warning', color: 'var(--color-warning)' }
  if (current <= threshold) return { label: 'Scorta bassa', status: 'basso', tone: 'warning', color: 'var(--color-warning)' }
  return { label: 'Disponibilità buona', status: 'ok', tone: 'success', color: 'var(--color-success)' }
}
