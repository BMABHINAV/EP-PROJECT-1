/**
 * SoundManager — Web Audio API utility for command-center audio cues.
 * No external dependencies. Toggle-able.
 */

let audioCtx = null
let enabled = false

function getCtx() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)() }
    catch { return null }
  }
  return audioCtx
}

function playTone({ frequency = 440, type = 'sine', duration = 0.15, gain = 0.08, delay = 0 }) {
  if (!enabled) return
  const ctx = getCtx()
  if (!ctx) return
  try {
    const osc = ctx.createOscillator()
    const amp = ctx.createGain()
    osc.connect(amp)
    amp.connect(ctx.destination)
    osc.type = type
    osc.frequency.setValueAtTime(frequency, ctx.currentTime + delay)
    amp.gain.setValueAtTime(0, ctx.currentTime + delay)
    amp.gain.linearRampToValueAtTime(gain, ctx.currentTime + delay + 0.01)
    amp.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + duration)
    osc.start(ctx.currentTime + delay)
    osc.stop(ctx.currentTime + delay + duration + 0.01)
  } catch { /* ignore */ }
}

const SoundManager = {
  /** Enable or disable all sounds */
  setEnabled(val) { enabled = val },
  isEnabled() { return enabled },
  toggle() { enabled = !enabled; return enabled },

  /** Subtle soft beep — info / new data */
  beep() {
    playTone({ frequency: 880, type: 'sine', duration: 0.12, gain: 0.06 })
  },

  /** Double-beep — alert received */
  alertBeep() {
    playTone({ frequency: 660, type: 'square', duration: 0.08, gain: 0.05 })
    playTone({ frequency: 880, type: 'square', duration: 0.08, gain: 0.05, delay: 0.12 })
  },

  /** Triple descending tone — critical alarm */
  criticalAlarm() {
    playTone({ frequency: 1200, type: 'sawtooth', duration: 0.15, gain: 0.07 })
    playTone({ frequency: 900,  type: 'sawtooth', duration: 0.15, gain: 0.07, delay: 0.18 })
    playTone({ frequency: 600,  type: 'sawtooth', duration: 0.15, gain: 0.07, delay: 0.36 })
  },

  /** Soft mission-start tone */
  missionStart() {
    playTone({ frequency: 440, type: 'sine', duration: 0.2,  gain: 0.06 })
    playTone({ frequency: 550, type: 'sine', duration: 0.2,  gain: 0.06, delay: 0.22 })
    playTone({ frequency: 660, type: 'sine', duration: 0.35, gain: 0.07, delay: 0.44 })
  },

  /** Unlock audio context on user gesture (required by browsers) */
  unlock() {
    const ctx = getCtx()
    if (ctx && ctx.state === 'suspended') ctx.resume()
  }
}

export default SoundManager
