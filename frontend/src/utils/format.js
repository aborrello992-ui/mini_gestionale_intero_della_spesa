export const money = (cents = 0) =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(cents / 100)

export const quantity = (value, unit = '') => `${Number(value || 0).toLocaleString('it-IT')} ${unit}`.trim()

export const dateTime = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  return `${date.toLocaleDateString('it-IT')} alle ${date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`
}

export const errorMessage = (error) => {
  console.error('API error', error)
  if (!error?.response) return 'Backend non raggiungibile. Verifica che Laravel sia avviato su http://localhost:8000.'
  if (error.response.status === 401) return 'Sessione scaduta o non autorizzata. Accedi di nuovo.'
  if (error.response.status === 419) return 'Sessione scaduta. Ricarica la pagina e riprova.'
  if (error.response.status === 422) return error.response.data?.message || Object.values(error.response.data?.errors || {})?.[0]?.[0] || 'Dati non validi.'
  if (error.response.status >= 500) return 'Errore del server. Controlla i log Laravel.'
  return error.response.data?.message || `Richiesta non riuscita (${error.response.status}).`
}
