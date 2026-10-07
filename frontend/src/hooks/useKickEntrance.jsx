import { useCallback, useEffect, useRef, useState } from 'react'
import { Fighter } from '../components/KickEntrance'

/**
 * Uso:
 *   const { overlay, play } = useKickEntrance()
 *   await play(() => api.post('/guest'), () => { window.location.href = '/products' })
 *   ... return (<> ... {overlay} </>)
 *
 * `action` parte subito, in parallelo all'animazione. Se fallisce l'animazione si
 * interrompe e l'errore viene rilanciato a chi ha chiamato play().
 * `finish` viene chiamata solo quando animazione e action sono finite.
 * Con "riduci animazioni" attivo, salta tutto.
 */
export function useKickEntrance() {
  const [phase, setPhase] = useState(null) // null | run | kick | impact | done
  const timers = useRef([])
  const busy = useRef(false)

  const clear = () => { timers.current.forEach(clearTimeout); timers.current = [] }
  useEffect(() => clear, [])

  const play = useCallback(async (action, finish) => {
    if (busy.current) return
    busy.current = true
    try {
      const actionPromise = Promise.resolve().then(action)
      const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      if (reduced) {
        await actionPromise
        finish?.()
        return
      }

      setPhase('run')
      const animation = new Promise((resolve, reject) => {
        const at = (ms, fn) => timers.current.push(setTimeout(fn, ms))
        at(650, () => setPhase('kick'))
        at(900, () => setPhase('impact'))
        at(1750, resolve)
        actionPromise.catch((err) => { clear(); reject(err) })
      })

      await Promise.all([actionPromise, animation])
      setPhase('done')
      finish?.()
    } catch (err) {
      clear()
      setPhase(null)
      throw err
    } finally {
      busy.current = false
    }
  }, [])

  const overlay = phase && phase !== 'done' ? (
    <div className={`kf-overlay kf-${phase}`} role="presentation">
      <div className="kf-shard kf-s1" />
      <div className="kf-shard kf-s2" />
      <div className="kf-shard kf-s3" />
      <div className="kf-shard kf-s4" />
      <div className="kf-fighter">
        <Fighter />
        <span className="kf-ring" />
      </div>
      <div className="kf-flash" />
    </div>
  ) : null

  return { overlay, play, playing: Boolean(phase) && phase !== 'done' }
}
