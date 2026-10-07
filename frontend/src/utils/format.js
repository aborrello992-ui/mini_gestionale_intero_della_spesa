export const money = (cents = 0) =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(cents / 100)

export const quantity = (value, unit = '') => `${Number(value || 0).toLocaleString('it-IT')} ${unit}`.trim()

export const dateTime = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  return `${date.toLocaleDateString('it-IT')} alle ${date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`
}

const pad = (value) => String(value).padStart(2, '0')

/** Data locale YYYY-MM-DD (non UTC: toISOString() sbaglia giorno dopo mezzanotte). */
export const localDate = (date = new Date()) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

/** Ora locale HH:MM. */
export const localTime = (date = new Date()) => `${pad(date.getHours())}:${pad(date.getMinutes())}`

/** Euro digitati ("1,50" o "1.50") in centesimi interi. */
export const toCents = (value) => {
  const parsed = Number(String(value ?? '').replace(',', '.'))
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0
}

export const centsToInput = (cents) => (cents / 100).toFixed(2)

function firstValidationError(errors, itemLabel) {
  const [field, messages] = Object.entries(errors || {})[0] || []
  if (!field) return null
  const message = Array.isArray(messages) ? messages[0] : messages
  const match = field.match(/^items\.(\d+)\./)
  if (match && itemLabel) {
    const label = itemLabel(Number(match[1]))
    if (label && !String(message).includes(label)) return `${label}: ${message}`
  }
  return message
}

/**
 * Messaggio leggibile per un errore API.
 * itemLabel(index) facoltativo: nome della riga per errori annidati come items.0.quantity.
 */
export const errorMessage = (error, { itemLabel } = {}) => {
  console.error('API error', error)
  if (error?.userMessage) return error.userMessage
  if (!error?.response) return 'Backend non raggiungibile. Controlla la connessione e riprova.'
  const { status, data } = error.response
  if (status === 401) return 'Sessione scaduta o non autorizzata. Accedi di nuovo.'
  if (status === 403) return 'Questa operazione è riservata agli amministratori.'
  if (status === 413) return 'File troppo grande: riduci la foto e riprova.'
  if (status === 419) return 'Sessione scaduta. Ricarica la pagina e riprova.'
  if (status === 409) return data?.message || 'Operazione non consentita nello stato attuale.'
  if (status === 422) return firstValidationError(data?.errors, itemLabel) || data?.message || 'Dati non validi.'
  if (status >= 500) return 'Errore del server. Controlla i log Laravel.'
  return data?.message || `Richiesta non riuscita (${status}).`
}

/** UUID v4 anche su HTTP in rete locale, dove crypto.randomUUID non esiste. */
export const newUuid = () => {
  if (globalThis.crypto?.randomUUID) {
    try { return globalThis.crypto.randomUUID() } catch { /* contesto non sicuro */ }
  }
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/** Data e ora di un movimento di cassa (movement_date arriva come ISO completo, movement_time come HH:MM:SS). */
export const movementDateTime = (row) => {
  if (!row?.movement_date) return '-'
  return dateTime(`${String(row.movement_date).slice(0, 10)}T${String(row.movement_time || '00:00').slice(0, 5)}`)
}

export const shortDate = (value) => (value ? new Date(`${String(value).slice(0, 10)}T12:00`).toLocaleDateString('it-IT') : '-')
