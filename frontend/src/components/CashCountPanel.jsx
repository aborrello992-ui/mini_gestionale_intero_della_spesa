import { useCallback, useEffect, useState } from 'react'
import { Calculator, Coins } from 'lucide-react'
import api from '../api/client'
import AppModal from './ui/AppModal'
import { dateTime, errorMessage, money, newUuid, toCents } from '../utils/format'

const label = (cents) => (cents >= 100 ? `${cents / 100} €` : `${cents} cent`)

/** Frase sulla differenza fra contanti contati e attesi (negativo = mancano). */
function driftText(drift) {
  if (drift === null || drift === undefined) return null
  if (drift === 0) return { tone: 'ok', text: 'Tutto torna con il conteggio precedente ✓' }
  return drift < 0
    ? { tone: 'diff', text: `Mancano ${money(-drift)} rispetto a quanto atteso` }
    : { tone: 'warn', text: `Avanzano ${money(drift)} rispetto a quanto atteso` }
}

/**
 * Contanti reali nel cassetto: ultimo conteggio + movimenti registrati dopo.
 * Il saldo dell'app può differire dai contanti per motivi noti (spese pagate di tasca):
 * per questo il controllo confronta le variazioni da un conteggio all'altro.
 */
export default function CashCountPanel({ isAdmin, refreshKey, onCounted }) {
  const [data, setData] = useState(null)
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState('pieces')
  const [pieces, setPieces] = useState({})
  const [total, setTotal] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [key, setKey] = useState(newUuid)
  const [showHistory, setShowHistory] = useState(false)

  const load = useCallback(async () => {
    try { setData((await api.get('/cash/counts')).data) } catch { setData(null) }
  }, [])

  useEffect(() => { load() }, [load, refreshKey])

  const denominations = data?.denominations || [5000, 2000, 1000, 500, 200, 100, 50, 20, 10, 5, 2, 1]
  const piecesTotal = denominations.reduce((sum, value) => sum + value * (Number(pieces[value]) || 0), 0)
  const counted = mode === 'pieces' ? piecesTotal : toCents(total)
  const expected = data?.expected_cents
  const previewDrift = expected === null || expected === undefined ? null : counted - expected
  const latestDrift = driftText(data?.latest?.drift_cents)

  function startCount() {
    setPieces({}); setTotal(''); setNote(''); setError(''); setKey(newUuid()); setOpen(true)
  }

  const setPiece = (value, amount) => setPieces((current) => ({ ...current, [value]: Math.max(0, amount) }))

  async function save(event) {
    event.preventDefault()
    if (saving) return
    setSaving(true)
    setError('')
    try {
      const body = mode === 'pieces'
        ? { breakdown: Object.fromEntries(Object.entries(pieces).filter(([, amount]) => Number(amount) > 0)), note }
        : { counted: (toCents(total) / 100).toFixed(2), note }
      const { data: result } = await api.post('/cash/counts', body, { headers: { 'Idempotency-Key': key } })
      setData(result)
      setOpen(false)
      const drift = driftText(result.latest?.drift_cents)
      onCounted?.(`Conteggio salvato: ${money(result.latest.counted_cents)} nel cassetto.${drift ? ` ${drift.text}.` : ''}`)
    } catch (err) { setError(errorMessage(err)) } finally { setSaving(false) }
  }

  if (!data) return null

  return (
    <div className="app-card stack-sm mb-3 cash-count">
      <div className="split align-items-start">
        <div className="min-0">
          <div className="small text-muted-app"><Coins size={15} aria-hidden="true" /> Contanti nel cassetto</div>
          {data.latest
            ? <>
              <strong className="h3 num d-block mb-0">{money(expected)}</strong>
              <div className="small text-muted-app">Contati {money(data.latest.counted_cents)} il {dateTime(data.latest.counted_at)}{expected !== data.latest.counted_cents ? `, poi ${expected > data.latest.counted_cents ? '+' : '−'}${money(Math.abs(expected - data.latest.counted_cents))} di movimenti` : ''}</div>
            </>
            : <div className="text-muted-app">Non hai ancora contato i contanti. Contali una volta: da lì l'app ti dice quanti dovrebbero essercene.</div>}
        </div>
        {isAdmin && <button type="button" className="btn btn-primary" onClick={startCount}><Calculator size={17} /> Conta i contanti</button>}
      </div>
      {latestDrift && <div className={`cash-count-drift is-${latestDrift.tone}`}>Ultimo conteggio: {latestDrift.text}</div>}
      {data.latest && data.latest.counted_cents - data.latest.app_balance_cents !== 0 && <div className="small text-muted-app">
        Differenza fissa con il saldo dell'app: {money(data.latest.counted_cents - data.latest.app_balance_cents)} (es. spese pagate di tasca e non ancora rimborsate).
      </div>}
      {data.counts.length > 1 && <button type="button" className="btn btn-link btn-sm p-0 align-self-start" onClick={() => setShowHistory((value) => !value)}>{showHistory ? 'Nascondi conteggi' : `Vedi gli ultimi ${data.counts.length} conteggi`}</button>}
      {showHistory && <ul className="list-unstyled small mb-0 stack-sm">
        {data.counts.map((row) => {
          const drift = driftText(row.drift_cents)
          return <li key={row.id} className="split">
            <span>{dateTime(row.counted_at)} · {row.user?.name || '-'}{row.note ? ` · ${row.note}` : ''}</span>
            <span className="text-end"><strong className="num">{money(row.counted_cents)}</strong>{drift && <span className={`d-block cash-count-drift is-${drift.tone}`}>{row.drift_cents === 0 ? 'torna ✓' : `${row.drift_cents < 0 ? '−' : '+'}${money(Math.abs(row.drift_cents))}`}</span>}</span>
          </li>
        })}
      </ul>}

      {open && <AppModal title="Conta i contanti" subtitle={expected !== null && expected !== undefined ? `Dovrebbero esserci ${money(expected)}` : 'Primo conteggio: diventa il punto di partenza.'} onClose={() => !saving && setOpen(false)} labelledBy="cash-count-title">
        <form className="stack-md" onSubmit={save}>
          {error && <div className="alert alert-danger mb-0" role="alert">{error}</div>}
          <div className="restock-toggle" role="group" aria-label="Come contare">
            <button type="button" className={`btn btn-sm ${mode === 'pieces' ? 'btn-primary' : 'btn-outline-primary'}`} aria-pressed={mode === 'pieces'} onClick={() => setMode('pieces')}>Banconote e monete</button>
            <button type="button" className={`btn btn-sm ${mode === 'total' ? 'btn-primary' : 'btn-outline-primary'}`} aria-pressed={mode === 'total'} onClick={() => setMode('total')}>Solo il totale</button>
          </div>
          {mode === 'pieces'
            ? <div className="cash-count-grid">
              {denominations.map((value) => (
                <div className="cash-count-piece" key={value}>
                  <label htmlFor={`count-${value}`}>{label(value)}</label>
                  <div className="cash-count-stepper">
                    <button type="button" className="btn btn-outline-secondary" aria-label={`Togli un pezzo da ${label(value)}`} onClick={() => setPiece(value, (Number(pieces[value]) || 0) - 1)}>−</button>
                    <input id={`count-${value}`} className="form-control text-center" inputMode="numeric" value={pieces[value] ?? ''} placeholder="0" onChange={(e) => setPiece(value, Number(e.target.value.replace(/\D/g, '')) || 0)} />
                    <button type="button" className="btn btn-outline-secondary" aria-label={`Aggiungi un pezzo da ${label(value)}`} onClick={() => setPiece(value, (Number(pieces[value]) || 0) + 1)}>+</button>
                  </div>
                </div>
              ))}
            </div>
            : <div>
              <label className="form-label" htmlFor="count-total">Totale contato (€)</label>
              <input id="count-total" className="form-control form-control-lg" inputMode="decimal" placeholder="Es. 8,38" value={total} onChange={(e) => setTotal(e.target.value)} autoFocus />
            </div>}
          <div>
            <label className="form-label" htmlFor="count-note">Nota (facoltativa)</label>
            <input id="count-note" className="form-control" maxLength={255} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Es. dopo la spesa Eurospin" />
          </div>
          <div className="summary-box stack-sm" aria-live="polite">
            <div className="split"><span>Contati</span><strong className="num">{money(counted)}</strong></div>
            {previewDrift !== null && <>
              <div className="split"><span>Attesi</span><span className="num">{money(expected)}</span></div>
              <strong className={previewDrift === 0 ? 'text-success' : previewDrift < 0 ? 'text-danger' : ''}>{previewDrift === 0 ? 'Torna ✓' : previewDrift < 0 ? `Mancano ${money(-previewDrift)}` : `Avanzano ${money(previewDrift)}`}</strong>
            </>}
          </div>
          <button className="btn btn-primary btn-lg" disabled={saving || (mode === 'total' && total === '')}>{saving ? 'Attendi…' : 'Salva conteggio'}</button>
        </form>
      </AppModal>}
    </div>
  )
}
