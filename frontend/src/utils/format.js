export const money = (cents = 0) =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(cents / 100)

export const quantity = (value, unit = '') => `${Number(value || 0).toLocaleString('it-IT')} ${unit}`.trim()

export const dateTime = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  return `${date.toLocaleDateString('it-IT')} alle ${date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`
}

export const errorMessage = (error) =>
  error?.response?.data?.message ||
  Object.values(error?.response?.data?.errors || {})?.[0]?.[0] ||
  'Operazione non riuscita.'
