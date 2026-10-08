import { useCallback, useRef, useState } from 'react'
import WaitScene from '../components/WaitScene'

/**
 * Esegue una richiesta al server mostrando la scena d'attesa solo se ci mette più di mezzo secondo.
 *   const { run, scene } = useWaitScene()
 *   await run('pay', user, () => api.post(...))
 *   ... {scene}
 */
export function useWaitScene(delayMs = 500) {
  const [state, setState] = useState(null)
  const counter = useRef(0)

  const run = useCallback(async (kind, user, task) => {
    const id = ++counter.current
    const startedAt = Date.now()
    const timer = setTimeout(() => { if (counter.current === id) setState({ kind, user, startedAt }) }, delayMs)
    try {
      return await task()
    } finally {
      clearTimeout(timer)
      if (counter.current === id) setState(null)
    }
  }, [delayMs])

  const scene = state ? <WaitScene kind={state.kind} user={state.user} startedAt={state.startedAt} /> : null
  return { run, scene }
}
