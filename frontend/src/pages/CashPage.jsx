import { useCallback, useEffect, useState } from 'react'
import api from '../api/client'
import { dateTime, money } from '../utils/format'

export default function CashPage() {
  const [counters, setCounters] = useState(null)
  const [rows, setRows] = useState([])
  const [filters, setFilters] = useState({ direction: '', type: '' })

  const load = useCallback(async () => {
    const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value))
    const [balance, movements] = await Promise.all([api.get('/cash/balance'), api.get(`/cash/movements?${params}`)])
    setCounters(balance.data); setRows(movements.data.data)
  }, [filters])

  useEffect(() => { load() }, [load])

  return (
    <section>
      <div className="page-title"><h1>Cassa</h1></div>
      <div className="metric-grid mb-3">
        <div className="metric"><span>Saldo attuale</span><strong>{money(counters?.balance_cents || 0)}</strong></div>
        <div className="metric"><span>Incasso potenziale magazzino</span><strong>{money(counters?.inventory_potential_cents || 0)}</strong></div>
        <div className="metric"><span>Da incassare dai copponi</span><strong>{money(counters?.open_coppone_cents || 0)}</strong></div>
      </div>
      <div className="app-card form-grid mb-3">
        <select className="form-select" value={filters.direction} onChange={(e) => setFilters({ ...filters, direction: e.target.value })}><option value="">Entrate e uscite</option><option value="entrata">Entrate</option><option value="uscita">Uscite</option></select>
        <select className="form-select" value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })}><option value="">Tutte le tipologie</option>{['prodotto_pagato', 'pagamento_debito', 'spesa_locale', 'accredito', 'quota', 'correzione', 'acquisto_prodotti'].map((t) => <option key={t} value={t}>{t}</option>)}</select>
      </div>
      <div className="app-card">
        {rows.map((m) => <div className="list-row" key={m.id}>
          <strong>{money(m.amount_cents)}</strong> · {m.direction} · {m.type} · {m.description}
          <div className="small text-secondary">{dateTime(`${m.movement_date}T${m.movement_time || '00:00'}`)} · membro {m.member?.name || '-'} · prodotto {m.product?.name || '-'} · saldo {money(m.resulting_balance_cents || 0)} · {m.status}</div>
        </div>)}
        {!rows.length && <p className="text-secondary mb-0">Nessun movimento di cassa.</p>}
      </div>
    </section>
  )
}
