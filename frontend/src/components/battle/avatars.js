// Avatar degli utenti: chi ne ha uno assegnato (users.avatar_key) usa quello del minigioco,
// gli altri un personaggio generico con colori sempre uguali ricavati dal nome.
import { FIGHTERS } from './fighters.js'

// Riconoscimento automatico dal nome dell'account, finché l'admin non assegna l'avatar dalla pagina Utenti.
// Ogni alias è un insieme di parole che devono comparire tutte nel nome (es. "Squeo" da solo non basta: ci sono due Squeo).
const NAME_MATCHES = {
  michele: ['michele lisco', 'miwoki', 'lisco'],
  luca: ['luca manca', 'manca'],
  roberto: ['roberto squeo', 'roberto'],
  nello: ['nello lorusso', 'lorusso', 'nello'],
  saverio: ['saverio squeo', 'saverio'],
  borrello: ['borrello'],
}

const normalize = (value) => String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

const SKINS = ['#f1c9a5', '#e0ad86', '#c98c62', '#a8714c', '#7d5236']
const HAIRS = ['#1f150f', '#3b2416', '#6b4423', '#a0522d', '#d6b370', '#111827']
const JACKETS = [['#1d4ed8', '#1e3a8a'], ['#b91c1c', '#7f1d1d'], ['#7c3aed', '#5b21b6'], ['#0f766e', '#134e4a'], ['#ea580c', '#9a3412'], ['#334155', '#1e293b']]

function hash(text) {
  let value = 0
  for (const char of normalize(text)) value = (value * 31 + char.charCodeAt(0)) >>> 0
  return value
}

function genericLook(name) {
  const h = hash(name)
  const [jacket, jacketDark] = JACKETS[h % JACKETS.length]
  return {
    skin: SKINS[(h >> 3) % SKINS.length],
    hair: HAIRS[(h >> 6) % HAIRS.length],
    hairStyle: (h >> 9) % 2 ? 'spiky' : 'quiff',
    smile: (h >> 10) % 2 ? 'big' : 'smirk',
    outfit: { jacket, jacketDark, shirt: '#f8fafc', tie: null, pants: '#1f2937', shoes: '#111827' },
  }
}

export function avatarKeyFor(user) {
  // Gli ospiti non prendono mai l'avatar di un socio, anche se si chiamano allo stesso modo.
  if (!user || user.role === 'guest') return null
  if (user.avatar_key && FIGHTERS.some((fighter) => fighter.id === user.avatar_key)) return user.avatar_key
  const words = normalize(user.name).split(/\s+/)
  return Object.entries(NAME_MATCHES).find(([, aliases]) => aliases.some((alias) => alias.split(' ').every((word) => words.includes(word))))?.[0] || null
}

/** { id, name, look, moves, generic } per l'utente (o un ospite) da mostrare nel gioco e nelle attese. */
export function avatarFor(user) {
  const fighter = FIGHTERS.find((candidate) => candidate.id === avatarKeyFor(user))
  const name = String(user?.name || 'Socio').toUpperCase()
  if (fighter) return { ...fighter, name: fighter.id === 'luca' ? name : fighter.name, generic: false }
  return { id: `generic-${hash(name)}`, name, look: genericLook(name), moves: [{ kind: 'wrench', label: 'COLPO!', dmg: 3 }], generic: true }
}

export const AVATAR_OPTIONS = FIGHTERS.map((fighter) => ({ id: fighter.id, name: fighter.name }))
