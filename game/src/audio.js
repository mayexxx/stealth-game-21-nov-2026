// All sound is synthesised with WebAudio: no audio files ship with the game.
// The context is created on the first user gesture (a browser only lets
// sound start after one), and every effect is a short oscillator or filtered
// noise burst, so nothing is ever fetched over the network.

export function createAudio() {
  let context = null;
  let master = null;
  let muted = false;
  let hum = null;

  function ensure() {
    if (context) {
      if (context.state === 'suspended') context.resume();
      return true;
    }
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0.5;
      master.connect(context.destination);
    } catch {
      return false;
    }
    return true;
  }

  /** Call from a user gesture so the browser lets sound start. */
  function unlock() {
    if (!ensure()) return;
    if (hum) return;
    // A barely-there room tone: two detuned low sines through a low gain.
    const gain = context.createGain();
    gain.gain.value = 0.018;
    gain.connect(master);
    for (const freq of [55, 55.7]) {
      const osc = context.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.connect(gain);
      osc.start();
    }
    hum = gain;
  }

  function tone(freq, dur, type, volume, when = 0, slideTo = null) {
    if (!context || muted) return;
    const start = context.currentTime + when;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(slideTo, start + dur);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(start);
    osc.stop(start + dur + 0.05);
  }

  function noiseBurst(dur, volume, lowFreq) {
    if (!context || muted) return;
    const start = context.currentTime;
    const length = Math.max(1, Math.floor(context.sampleRate * dur));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowFreq;
    const gain = context.createGain();
    gain.gain.value = volume;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(start);
  }

  return {
    unlock,
    setMuted(value) {
      muted = value;
    },
    isMuted() {
      return muted;
    },
    /** The player's own step: a soft thud, quieter while sneaking. */
    footstep(sneak) {
      noiseBurst(0.07, sneak ? 0.05 : 0.11, sneak ? 300 : 500);
    },
    /** A guard's step, heard from `distance` pixels away: fades with range. */
    guardStep(distance) {
      const volume = Math.max(0, 0.16 * (1 - distance / 420));
      if (volume <= 0.01) return;
      noiseBurst(0.08, volume, 380);
    },
    /** A guard grows suspicious: one short questioning note. */
    suspicious() {
      tone(520, 0.16, 'sine', 0.1);
    },
    /** The alarm: two rising notes. */
    alert() {
      tone(392, 0.16, 'square', 0.07);
      tone(587, 0.28, 'square', 0.07, 0.14);
    },
    /** A relic picked up: a small bright chime. */
    pickup() {
      tone(880, 0.12, 'sine', 0.1);
      tone(1318, 0.2, 'sine', 0.09, 0.08);
    },
    /** A pebble thrown: a light tick. */
    toss() {
      noiseBurst(0.05, 0.09, 1400);
    },
    /** Caught: a low falling sting. */
    caught() {
      tone(220, 0.5, 'sawtooth', 0.08, 0, 110);
    },
    /** The exit opens: a soft mechanical slide. */
    door() {
      tone(180, 0.3, 'triangle', 0.09, 0, 320);
    },
    /** All three galleries cleared: a short rising figure. */
    win() {
      tone(523, 0.16, 'sine', 0.1);
      tone(659, 0.16, 'sine', 0.1, 0.14);
      tone(784, 0.3, 'sine', 0.11, 0.28);
    },
  };
}
