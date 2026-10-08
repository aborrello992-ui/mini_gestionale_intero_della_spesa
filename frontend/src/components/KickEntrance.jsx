import { bossArt } from './battle/art'
import './kick-entrance.css'

/**
 * Il boss del locale: lo stesso personaggio del minigioco, usato anche nel calcio d'ingresso.
 * Guarda a destra; il calcio ruota la gamba .bb-leg-f.
 */
export function Fighter() {
  return <svg className="kf-svg" viewBox="0 0 120 170" aria-hidden="true" dangerouslySetInnerHTML={{ __html: bossArt() }} />
}
