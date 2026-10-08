import { useEffect, useImperativeHandle, useRef } from 'react'
import { createBattle } from './battle/engine'
import { FIGHTERS } from './battle/fighters'
import './battle/battle.css'

/**
 * Minigioco "Soci vs Locale".
 *  - Si gioca toccando lo schermo (o Invio/Spazio).
 *  - waiting=true  -> l'app sta aspettando il server: se nessuno gioca parte una lotta in loop.
 *  - onEnter       -> se passato, mostra il pulsante "Entra nel sito" (server pronto mentre si gioca).
 *  - onEnd('win' | 'lose') parte a fine partita (solo se giocata dall'utente).
 *  - ref.getEngagement() -> 'fighting' | 'ended' | 'idle' (l'utente sta giocando?)
 */
export default function BossBattle({ waiting = false, caption = '', onEnd, onEnter, ref }) {
  const rootRef = useRef(null)
  const battleRef = useRef(null)
  const onEndRef = useRef(onEnd)
  onEndRef.current = onEnd

  useEffect(() => {
    const battle = createBattle(rootRef.current, { fighters: FIGHTERS, onEnd: (r) => onEndRef.current?.(r) })
    battleRef.current = battle
    return () => {
      battle.destroy()
      battleRef.current = null
    }
  }, [])

  useEffect(() => {
    battleRef.current?.setWaiting(waiting)
  }, [waiting])

  useImperativeHandle(ref, () => ({ getEngagement: () => battleRef.current?.getEngagement() ?? 'idle' }), [])

  return (
    <div className="bb-wrap">
      <div ref={rootRef} />
      {waiting && !onEnter && <div className="bb-caption" role="status">{caption || 'Attendo il server…'}</div>}
      {onEnter && (
        <button type="button" className="bb-enter" onClick={onEnter}>
          Server pronto · Entra nel sito ▶
        </button>
      )}
    </div>
  )
}
