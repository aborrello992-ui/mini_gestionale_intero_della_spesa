// Motore del minigioco "Soci vs Locale". Niente librerie: DOM + SVG + requestAnimationFrame.
// Uso:  const b = createBattle(div, { fighters })  ->  b.setWaiting(true/false), b.reset(), b.destroy()

import { bossArt, fighterArt, portrait, PROJECTILES, BOSS_ZZZ } from './art.js'
import { FIGHTERS } from './fighters.js'

const NS = 'http://www.w3.org/2000/svg'
const GROUND = 207

// Geometria della scena (viewBox 400x240)
const FIGHTER_BOX = { x: 34, y: 58, w: 108, h: 153 } // arte 120x170 a scala .9
const BOSS_CX = 312
const BOSS_SCALE = 1.25
const BOSS_BOX = { w: 120 * BOSS_SCALE, h: 170 * BOSS_SCALE }
BOSS_BOX.x = BOSS_CX - BOSS_BOX.w / 2
BOSS_BOX.y = GROUND + 1 - 166 * BOSS_SCALE
const FIGHTER_HIT_X = 126
const BOSS_HIT_X = 284
const HAND = { x: 134, y: 126 } // da dove parte il tiro dei soci

const CFG = {
  teamHp: 100,
  bossHp: 180,
  tapCooldown: 190, // ms tra un colpo e l'altro
  bossDamage: 6.5,
  bossEvery: [1700, 2500], // ms tra due attacchi del boss
  autoAfter: 1300, // in attesa: se non tocchi per questo tempo, i soci combattono da soli
  autoEvery: [420, 700],
}

const rand = (a, b) => a + Math.random() * (b - a)
// I nomi possono arrivare dagli utenti: mai inserirli nell'HTML senza escape.
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

function sceneMarkup(fighters) {
  const fighterG = fighters
    .map(
      (f, i) => `<g class="bb-actor bb-fighter${i === 0 ? ' bb-on' : ''}" data-i="${i}">
        <svg x="${FIGHTER_BOX.x}" y="${FIGHTER_BOX.y}" width="${FIGHTER_BOX.w}" height="${FIGHTER_BOX.h}" viewBox="0 0 120 170" style="overflow:visible">${fighterArt(f.look)}</svg>
      </g>`,
    )
    .join('')

  return `<svg class="bb-scene" viewBox="0 0 400 240" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="bb-sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#0c1230"/><stop offset=".55" stop-color="#3a2466"/><stop offset="1" stop-color="#ff8a5c"/>
      </linearGradient>
      <linearGradient id="bb-floor" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#6b3f2a"/><stop offset="1" stop-color="#2f1a12"/>
      </linearGradient>
    </defs>
    <rect width="400" height="240" fill="url(#bb-sky)"/>
    <circle cx="312" cy="120" r="64" fill="#ffb36b" opacity=".35"/>
    <circle cx="312" cy="120" r="46" fill="#ffd08a" opacity=".5"/>
    <path d="M0 170 L40 138 L78 160 L120 126 L170 164 L214 134 L262 166 L316 130 L362 160 L400 140 L400 200 L0 200 Z" fill="#1a1238" opacity=".85"/>
    <text x="200" y="26" text-anchor="middle" font-family="Impact, 'Arial Black', sans-serif" font-size="15" letter-spacing="5" fill="#5eead4" stroke="#0f766e" stroke-width=".6" opacity=".95">LOCALE</text>
    <rect x="0" y="${GROUND - 4}" width="400" height="${240 - GROUND + 4}" fill="url(#bb-floor)"/>
    <path d="M0 ${GROUND - 4} H400" stroke="#9a6a4a" stroke-width="2"/>
    <path d="M0 222 H400 M0 235 H400 M60 ${GROUND} L20 240 M150 ${GROUND} L130 240 M250 ${GROUND} L270 240 M340 ${GROUND} L380 240" stroke="rgba(0,0,0,.28)" stroke-width="1.5"/>
    ${fighterG}
    <g class="bb-actor bb-boss">
      <g transform="translate(${2 * BOSS_CX} 0) scale(-1 1)">
        <svg x="${BOSS_BOX.x}" y="${BOSS_BOX.y}" width="${BOSS_BOX.w}" height="${BOSS_BOX.h}" viewBox="0 0 120 170" style="overflow:visible">${bossArt()}</svg>
      </g>
    </g>
    <g class="bb-zzz" transform="translate(${BOSS_CX - 14} ${BOSS_BOX.y + 28})">${BOSS_ZZZ}</g>
    <g class="bb-fx"></g>
  </svg>`
}

function resultMarkup() {
  const text = (word, fill, stroke, shadow) => `
    <svg viewBox="0 0 400 110" class="bb-result-svg" aria-hidden="true">
      <defs>
        <linearGradient id="bb-g-${word}" x1="0" y1="0" x2="0" y2="1">${fill}</linearGradient>
      </defs>
      <g transform="skewX(-10) translate(18 0)">
        <text x="200" y="88" text-anchor="middle" textLength="340" lengthAdjust="spacingAndGlyphs"
          font-family="Impact, Haettenschweiler, 'Arial Black', sans-serif" font-size="82" font-weight="900"
          fill="${shadow}" stroke="${shadow}" stroke-width="12" stroke-linejoin="round" transform="translate(5 6)">${word === 'win' ? 'YOU WIN' : 'YOU LOSE'}</text>
        <text x="200" y="88" text-anchor="middle" textLength="340" lengthAdjust="spacingAndGlyphs"
          font-family="Impact, Haettenschweiler, 'Arial Black', sans-serif" font-size="82" font-weight="900"
          fill="url(#bb-g-${word})" stroke="${stroke}" stroke-width="5" stroke-linejoin="round" paint-order="stroke">${word === 'win' ? 'YOU WIN' : 'YOU LOSE'}</text>
      </g>
    </svg>`
  return {
    win: text('win', '<stop offset="0" stop-color="#fffbb8"/><stop offset=".5" stop-color="#ffd21f"/><stop offset="1" stop-color="#ff7a00"/>', '#7a1500', '#2a0800'),
    lose: text('lose', '<stop offset="0" stop-color="#ffd0d0"/><stop offset=".5" stop-color="#ff3b30"/><stop offset="1" stop-color="#8a0c0c"/>', '#2a0000', '#12000a'),
  }
}

export function createBattle(root, opts = {}) {
  const fighters = opts.fighters || FIGHTERS
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const results = resultMarkup()

  root.classList.add('bb')
  root.setAttribute('tabindex', '0')
  root.setAttribute('role', 'button')
  root.setAttribute('aria-label', 'Minigioco: tocca per far combattere i soci contro il boss')
  root.innerHTML = `
    <div class="bb-hud">
      <div class="bb-side">
        <div class="bb-label"><span class="bb-team">SOCI</span><span class="bb-active"></span></div>
        <div class="bb-bar bb-bar-team"><i class="bb-lag"></i><i class="bb-fill"></i></div>
        <div class="bb-roster">${fighters.map((f, i) => `<span class="bb-pic" data-i="${i}" title="${escapeHtml(f.name)}">${portrait(f.look)}</span>`).join('')}</div>
      </div>
      <div class="bb-vs">VS</div>
      <div class="bb-side bb-side-r">
        <div class="bb-label"><span class="bb-team">LOCALE</span><span class="bb-active">BOSS</span></div>
        <div class="bb-bar bb-bar-r bb-bar-boss"><i class="bb-lag"></i><i class="bb-fill"></i></div>
      </div>
    </div>
    <div class="bb-stage">
      ${sceneMarkup(fighters)}
      <div class="bb-move" aria-hidden="true"></div>
      <div class="bb-prompt">TOCCA PER COMBATTERE</div>
      <div class="bb-result" aria-live="polite"></div>
    </div>`

  const $ = (s) => root.querySelector(s)
  const fx = $('.bb-fx')
  const bossEl = $('.bb-boss')
  const zzzEl = $('.bb-zzz')
  const fighterEls = [...root.querySelectorAll('.bb-fighter')]
  const picEls = [...root.querySelectorAll('.bb-pic')]
  const nameEl = $('.bb-side .bb-active')
  const moveEl = $('.bb-move')
  const promptEl = $('.bb-prompt')
  const resultEl = $('.bb-result')
  const teamBar = $('.bb-bar-team')
  const bossBar = $('.bb-bar-boss')

  const state = {
    phase: 'ready', // ready | fight | ended
    auto: false, // il combattimento in corso è partito da solo (attesa) e nessuno ha ancora toccato
    waiting: false,
    teamHp: CFG.teamHp,
    bossHp: CFG.bossHp,
    active: 0,
    moveIdx: fighters.map(() => 0),
    lastTap: 0,
    lastAttack: 0,
    nextAuto: 0,
    bossNextAt: 0,
    stunUntil: 0,
    endedAt: 0,
  }
  const projectiles = []
  const timers = new Set()
  const pulses = new WeakMap()
  let raf = 0
  let last = 0
  let destroyed = false

  /* ---------- utilità ---------- */
  function later(fn, ms) {
    const id = setTimeout(() => {
      timers.delete(id)
      if (!destroyed) fn()
    }, ms)
    timers.add(id)
    return id
  }

  function pulse(node, cls, ms) {
    const map = pulses.get(node) || {}
    if (map[cls]) {
      clearTimeout(map[cls])
      timers.delete(map[cls])
    }
    node.classList.remove(cls)
    void node.getBoundingClientRect() // riavvia l'animazione CSS
    node.classList.add(cls)
    const id = later(() => node.classList.remove(cls), ms)
    map[cls] = id
    pulses.set(node, map)
  }

  const svgEl = (tag, attrs = {}) => {
    const n = document.createElementNS(NS, tag)
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v)
    return n
  }

  function burst(x, y, colors = ['#ffd23f', '#fff', '#ff7a00']) {
    if (reduced) return
    for (let i = 0; i < 9; i++) {
      const c = svgEl('circle', { r: (2 + Math.random() * 2.6).toFixed(1), fill: colors[i % colors.length], cx: 0, cy: 0 })
      fx.appendChild(c)
      const a = Math.random() * Math.PI * 2
      const d = 14 + Math.random() * 26
      const anim = c.animate(
        [
          { transform: `translate(${x}px, ${y}px) scale(1)`, opacity: 1 },
          { transform: `translate(${x + Math.cos(a) * d}px, ${y + Math.sin(a) * d}px) scale(.2)`, opacity: 0 },
        ],
        { duration: 340 + Math.random() * 200, easing: 'ease-out' },
      )
      anim.onfinish = () => c.remove()
    }
  }

  function floatText(x, y, text, fill = '#ffd23f') {
    const t = svgEl('text', {
      x: 0,
      y: 0,
      'text-anchor': 'middle',
      'font-family': "Impact, 'Arial Black', sans-serif",
      'font-size': 15,
      fill,
      stroke: '#3a1500',
      'stroke-width': 3,
      'paint-order': 'stroke',
    })
    t.textContent = text
    fx.appendChild(t)
    const anim = t.animate(
      [
        { transform: `translate(${x}px, ${y}px)`, opacity: 1 },
        { transform: `translate(${x}px, ${y - 26}px)`, opacity: 0 },
      ],
      { duration: 650, easing: 'ease-out' },
    )
    anim.onfinish = () => t.remove()
  }

  /* ---------- barre e HUD ---------- */
  function renderBars() {
    const team = clamp(state.teamHp / CFG.teamHp, 0, 1) * 100
    const boss = clamp(state.bossHp / CFG.bossHp, 0, 1) * 100
    teamBar.querySelector('.bb-fill').style.width = team + '%'
    teamBar.querySelector('.bb-lag').style.width = team + '%'
    bossBar.querySelector('.bb-fill').style.width = boss + '%'
    bossBar.querySelector('.bb-lag').style.width = boss + '%'
    teamBar.classList.toggle('bb-low', team <= 25)
    bossBar.classList.toggle('bb-low', boss <= 25)
  }

  function setActive(i, animate) {
    state.active = i
    fighterEls.forEach((el, k) => el.classList.toggle('bb-on', k === i))
    picEls.forEach((el, k) => el.classList.toggle('bb-on', k === i))
    nameEl.textContent = fighters[i].name
    if (animate) pulse(fighterEls[i], 'bb-in', 380)
  }

  function showMove(label) {
    moveEl.textContent = label
    pulse(moveEl, 'bb-show', 800)
  }

  /* ---------- proiettili ---------- */
  function spawn({ kind, from, x, y, vx, spin = 0, dmg = 0, stun = 0, flip = 1 }) {
    const g = svgEl('g')
    g.innerHTML = PROJECTILES[kind]
    fx.appendChild(g)
    const p = { g, kind, from, x, y, vx, spin, rot: 0, dmg, stun, flip }
    placeProjectile(p)
    projectiles.push(p)
  }

  function placeProjectile(p) {
    p.g.setAttribute('transform', `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${p.rot.toFixed(1)}) scale(${p.flip} 1)`)
  }

  function clearProjectiles() {
    projectiles.splice(0).forEach((p) => p.g.remove())
  }

  /* ---------- azioni ---------- */
  function attack() {
    if (state.phase !== 'fight') return
    const now = performance.now()
    const f = fighters[state.active]
    const move = f.moves[state.moveIdx[state.active]++ % f.moves.length]
    state.lastAttack = now
    pulse(fighterEls[state.active], 'bb-throw', 300)
    showMove(move.label)
    const who = state.active
    later(() => {
      if (state.phase !== 'fight' || who !== state.active) return
      const spinSpeed = { drill: 540, wrench: 720, pillow: 280, lightning: 0, sleep: 0 }[move.kind] || 0
      spawn({ kind: move.kind, from: 'team', x: HAND.x, y: HAND.y + (move.kind === 'sleep' ? -4 : 0), vx: move.kind === 'sleep' ? 250 : 460, spin: spinSpeed, dmg: move.dmg, stun: move.stun || 0 })
    }, 90)
  }

  function bossAttack() {
    if (state.phase !== 'fight') return
    pulse(bossEl, 'bb-charge', 420)
    later(() => {
      if (state.phase !== 'fight') return
      pulse(bossEl, 'bb-kick', 340)
      later(() => {
        if (state.phase !== 'fight') return
        spawn({ kind: 'shockwave', from: 'boss', x: 240, y: 152, vx: -330, dmg: CFG.bossDamage, flip: -1 })
      }, 130)
    }, 420)
  }

  function hitBoss(p, now) {
    state.bossHp = Math.max(0, state.bossHp - p.dmg)
    burst(BOSS_HIT_X, p.y)
    floatText(BOSS_HIT_X - 6, p.y - 12, '-' + Math.max(1, Math.round(p.dmg)))
    pulse(bossEl, 'bb-hurt', 340)
    if (p.stun) {
      state.stunUntil = now + p.stun
      state.bossNextAt = Math.max(state.bossNextAt, state.stunUntil + 500)
      bossEl.classList.add('bb-stunned')
      zzzEl.classList.add('bb-on')
      later(() => {
        bossEl.classList.remove('bb-stunned')
        zzzEl.classList.remove('bb-on')
      }, p.stun)
    }
    renderBars()
    if (state.bossHp <= 0) finish('win')
  }

  function hitTeam(p) {
    state.teamHp = Math.max(0, state.teamHp - p.dmg)
    burst(FIGHTER_HIT_X, p.y, ['#5eead4', '#fff', '#fde047'])
    floatText(FIGHTER_HIT_X - 18, p.y - 12, '-' + Math.max(1, Math.round(p.dmg)), '#ff6b6b')
    pulse(fighterEls[state.active], 'bb-hurt', 340)
    renderBars()
    if (state.teamHp <= 0) {
      finish('lose')
    } else if (fighters.length > 1) {
      // cambio: entra il socio successivo
      later(() => {
        if (state.phase === 'fight') setActive((state.active + 1) % fighters.length, true)
      }, 280)
    }
  }

  function finish(result) {
    if (state.phase !== 'fight') return
    state.phase = 'ended'
    state.endedAt = performance.now()
    clearProjectiles()
    bossEl.classList.remove('bb-stunned')
    zzzEl.classList.remove('bb-on')
    const loserEl = result === 'win' ? bossEl : fighterEls[state.active]
    const winnerEl = result === 'win' ? fighterEls[state.active] : bossEl
    loserEl.classList.add('bb-ko')
    later(() => winnerEl.classList.add('bb-win'), 350)

    if (state.auto) {
      // animazione d'attesa: niente scritta, ricomincia da sola
      later(() => {
        resetToReady()
        if (state.waiting && !reduced) startFight(true)
      }, 1600)
      return
    }
    later(() => {
      resultEl.innerHTML = `${results[result]}<div class="bb-hint">TOCCA PER RIGIOCARE</div>`
      resultEl.classList.add('bb-visible')
    }, 650)
    opts.onEnd?.(result)
  }

  function resetToReady() {
    timers.forEach(clearTimeout)
    timers.clear()
    clearProjectiles()
    fx.replaceChildren()
    root.querySelectorAll('.bb-ko, .bb-win, .bb-throw, .bb-hurt, .bb-charge, .bb-kick, .bb-in, .bb-stunned').forEach((n) => n.classList.remove('bb-ko', 'bb-win', 'bb-throw', 'bb-hurt', 'bb-charge', 'bb-kick', 'bb-in', 'bb-stunned'))
    zzzEl.classList.remove('bb-on')
    resultEl.classList.remove('bb-visible')
    resultEl.innerHTML = ''
    state.phase = 'ready'
    state.auto = false
    state.teamHp = CFG.teamHp
    state.bossHp = CFG.bossHp
    state.stunUntil = 0
    state.lastTap = 0
    setActive((state.active + 1) % fighters.length, false)
    renderBars()
    promptEl.style.display = ''
  }

  function startFight(auto) {
    state.phase = 'fight'
    state.auto = auto
    state.bossNextAt = performance.now() + 1500
    state.nextAuto = performance.now() + 250
    promptEl.style.display = 'none'
    resultEl.classList.remove('bb-visible')
  }

  /* ---------- input ---------- */
  function tap() {
    const now = performance.now()
    if (state.phase === 'ended') {
      if (state.auto || now - state.endedAt > 700) {
        resetToReady()
        startFight(false)
        state.lastTap = now
        attack()
      }
      return
    }
    if (state.phase === 'ready') startFight(false)
    state.auto = false // da qui in poi gioca l'utente
    state.lastTap = now
    if (now - state.lastAttack >= CFG.tapCooldown) attack()
  }

  const onPointer = (e) => {
    if (e.button !== undefined && e.button > 0) return
    tap()
  }
  const onKey = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      tap()
    }
  }
  root.addEventListener('pointerdown', onPointer)
  root.addEventListener('keydown', onKey)

  /* ---------- ciclo ---------- */
  function tick(t) {
    if (destroyed) return
    raf = requestAnimationFrame(tick)
    const dt = Math.min(0.05, (t - (last || t)) / 1000)
    last = t
    const now = performance.now()

    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i]
      p.x += p.vx * dt
      p.rot += p.spin * dt
      if (p.kind === 'sleep') p.y += Math.sin(now / 120) * 0.25
      placeProjectile(p)
      if (p.from === 'team' && p.x >= BOSS_HIT_X) {
        projectiles.splice(i, 1)
        p.g.remove()
        if (state.phase === 'fight') hitBoss(p, now)
      } else if (p.from === 'boss' && p.x <= FIGHTER_HIT_X) {
        projectiles.splice(i, 1)
        p.g.remove()
        if (state.phase === 'fight') hitTeam(p)
      } else if (p.x < -60 || p.x > 460) {
        projectiles.splice(i, 1)
        p.g.remove()
      }
    }

    if (state.phase === 'fight') {
      if (now >= state.bossNextAt && now >= state.stunUntil) {
        bossAttack()
        state.bossNextAt = now + rand(...CFG.bossEvery)
      }
      // in attesa, o in modalità automatica, i soci combattono da soli se nessuno tocca
      const idle = now - state.lastTap > CFG.autoAfter
      if ((state.auto || (state.waiting && idle)) && !reduced && now >= state.nextAuto) {
        attack()
        state.nextAuto = now + rand(...CFG.autoEvery)
      }
    }
  }

  /* ---------- API pubblica ---------- */
  setActive(0, false)
  renderBars()
  raf = requestAnimationFrame(tick)

  return {
    // true quando l'app sta aspettando il server: parte l'animazione in loop se nessuno sta giocando
    setWaiting(flag) {
      state.waiting = Boolean(flag)
      if (state.waiting) {
        if (!reduced && state.phase === 'ready') startFight(true)
      } else if (state.auto && state.phase !== 'ready') {
        resetToReady()
      }
    },
    // 'fighting' = l'utente sta giocando adesso, 'ended' = partita dell'utente finita, 'idle' = nessuno sta giocando
    getEngagement() {
      const now = performance.now()
      if (state.phase === 'fight' && !state.auto && now - state.lastTap < 6000) return 'fighting'
      if (state.phase === 'ended' && !state.auto) return 'ended'
      return 'idle'
    },
    reset: resetToReady,
    destroy() {
      destroyed = true
      cancelAnimationFrame(raf)
      timers.forEach(clearTimeout)
      timers.clear()
      root.removeEventListener('pointerdown', onPointer)
      root.removeEventListener('keydown', onKey)
      root.innerHTML = ''
      root.classList.remove('bb')
    },
    // solo per i test
    _state: state,
    _tap: tap,
  }
}
