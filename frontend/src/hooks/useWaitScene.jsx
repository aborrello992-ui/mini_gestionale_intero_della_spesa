import { useCallback, useRef, useState } from 'react'
import WaitScene from '../components/WaitScene'
import { newUuid } from '../utils/format'

const STALL_MS = 60000 // dopo un minuto senza risposta compare "Riprova"
const IN_PROGRESS_RETRY_MS = 2500

export const UNCONFIRMED_MESSAGE = 'Il server non ha risposto: controlla nello storico se l\'operazione è stata registrata prima di rifarla.'

/**
 * Esegue una richiesta al server mostrando la scena d'attesa solo se ci mette più di mezzo secondo.
 *   const { run, scene } = useWaitScene()
 *   await run('pay', user, (idempotencyKey) => api.post(url, body, { headers: { 'Idempotency-Key': idempotencyKey } }))
 *   ... {scene}
 * Il codice anti-doppione è lo stesso per tutti i tentativi della stessa operazione: "Riprova" non crea doppioni.
 */
export function useWaitScene(delayMs = 500) {
  const [state, setState] = useState(null)
  const counter = useRef(0)

  const run = useCallback((kind, user, task) => new Promise((resolve, reject) => {
    const id = ++counter.current
    const key = newUuid()
    let done = false
    let latest = 0
    let stallTimer = 0
    let retryTimer = 0
    const current = () => counter.current === id

    const finish = (settle, value) => {
      if (done) return
      done = true
      clearTimeout(showTimer)
      clearTimeout(stallTimer)
      clearTimeout(retryTimer)
      if (current()) setState(null)
      settle(value)
    }

    const attempt = () => {
      const number = ++latest
      clearTimeout(stallTimer)
      stallTimer = setTimeout(() => { if (!done && current()) setState((s) => s && { ...s, stalled: true }) }, STALL_MS)
      Promise.resolve().then(() => task(key)).then(
        (value) => finish(resolve, value),
        (error) => {
          // La stessa operazione è ancora in corso sul server: si aspetta e si richiede la risposta.
          if (error?.response?.status === 409 && error.response.data?.code === 'in_progress') {
            retryTimer = setTimeout(() => { if (!done) attempt() }, IN_PROGRESS_RETRY_MS)
            return
          }
          // Un tentativo vecchio che fallisce non conta se ne è partito uno nuovo.
          if (number === latest) finish(reject, error)
        },
      )
    }

    const retry = () => {
      if (done) return
      setState((s) => s && { ...s, stalled: false, startedAt: Date.now() })
      attempt()
    }
    const cancel = () => {
      const error = new Error(UNCONFIRMED_MESSAGE)
      error.userMessage = UNCONFIRMED_MESSAGE
      finish(reject, error)
    }

    const showTimer = setTimeout(() => {
      if (!done && current()) setState({ kind, user, startedAt: Date.now(), stalled: false, retry, cancel })
    }, delayMs)
    attempt()
  }), [delayMs])

  const scene = state
    ? <WaitScene kind={state.kind} user={state.user} startedAt={state.startedAt} stalled={state.stalled} onRetry={state.retry} onCancel={state.cancel} />
    : null
  return { run, scene }
}
