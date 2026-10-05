export class Soundscape {
  constructor() {
    // Ambient music is opt-in. Interaction sounds become available after a
    // user gesture, until the user explicitly mutes them.
    this.enabled = false;
    this.muted = false;
    this.effectsEnabled = true;
    this.active = false;
    this.ctx = null;
    this.master = null;
    this.music = null;
    this.rain = null;
    this.effects = null;
    this.timer = null;
    this.note = 0;
    this.rainLevel = 0;
    this.night = false;
  }

  async unlock() {
    // Unlocking must never overwrite a mute preference.
    try {
      if (!this.ctx && !this.init()) return false;
      if (this.ctx.state === 'suspended') await this.ctx.resume();
      return this.ctx.state === 'running';
    } catch {
      return false;
    }
  }

  async toggle() {
    this.enabled = !this.enabled;
    this.muted = !this.enabled;
    this.effectsEnabled = this.enabled;
    this.applyLevels();
    if (!this.enabled) return false;
    if (!await this.unlock()) {
      this.enabled = false;
      this.muted = true;
      this.effectsEnabled = false;
    }
    this.applyLevels();
    return this.enabled;
  }

  setMuted(value) {
    this.muted = Boolean(value);
    this.effectsEnabled = !this.muted;
    if (this.muted) this.enabled = false;
    this.applyLevels();
    return !this.muted;
  }

  init() {
    const Audio = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!Audio) return false;
    this.ctx = new Audio();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.active && !this.muted ? 1 : 0;
    this.master.connect(this.ctx.destination);
    this.music = this.ctx.createGain();
    this.music.gain.value = 0;
    this.music.connect(this.master);
    this.effects = this.ctx.createGain();
    this.effects.gain.value = this.effectsEnabled && !this.muted ? 1 : 0;
    const effectFilter = this.ctx.createBiquadFilter();
    effectFilter.type = 'lowpass';
    effectFilter.frequency.value = 2500;
    this.effects.connect(effectFilter);
    effectFilter.connect(this.master);

    this.noiseBuffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 3, this.ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    let previous = 0;
    for (let i = 0; i < data.length; i++) {
      previous = (previous + (Math.random() * 2 - 1) * .04) / 1.02;
      data[i] = previous * 3;
    }
    const source = this.ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    source.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1600;
    source.connect(filter);
    this.rain = this.ctx.createGain();
    this.rain.gain.value = 0;
    filter.connect(this.rain);
    this.rain.connect(this.master);
    source.start();
    this.timer = setInterval(() => this.pluck(), 1600);
    this.timer.unref?.();
    return true;
  }

  applyLevels() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.active && !this.muted ? 1 : 0, t, .025);
    this.effects.gain.setTargetAtTime(this.effectsEnabled && !this.muted ? 1 : 0, t, .025);
    const ambient = this.enabled && !this.muted && this.active;
    this.music.gain.setTargetAtTime(ambient ? .22 * (1 - this.rainLevel * .8) : 0, t, .4);
    this.rain.gain.setTargetAtTime(ambient ? this.rainLevel * .3 : 0, t, .6);
  }

  update(active, rain = 0, night = false) {
    this.active = active;
    this.rainLevel = Math.max(0, Math.min(1, rain));
    this.night = night;
    this.applyLevels();
  }

  pluck() {
    if (!this.ctx || !this.enabled || this.muted || !this.active) return;
    const tones = [196, 220, 261.63, 293.66, 329.63, 293.66, 261.63, 220];
    this.tone(tones[this.note++ % tones.length] * (this.night ? .5 : 1), {
      type: 'triangle', duration: 1.5, volume: .14, destination: this.music,
    });
  }

  canPlayEffect() {
    return Boolean(this.ctx?.state === 'running' && this.active && this.effectsEnabled && !this.muted);
  }

  tone(frequency, { delay = 0, duration = .2, volume = .018, type = 'sine', endFrequency, destination = this.effects } = {}) {
    const oscillator = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const t = this.ctx.currentTime + delay;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, t);
    if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency, t + duration * .75);
    gain.gain.setValueAtTime(.0001, t);
    gain.gain.linearRampToValueAtTime(volume, t + .015);
    gain.gain.exponentialRampToValueAtTime(.0001, t + duration);
    oscillator.connect(gain);
    gain.connect(destination);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    oscillator.start(t);
    oscillator.stop(t + duration + .02);
  }

  cup(delay = 0) {
    if (!this.canPlayEffect()) return false;
    this.tone(820, { delay, duration: .32, volume: .018 });
    this.tone(1240, { delay: delay + .008, duration: .2, volume: .006 });
    return true;
  }

  pourTea() {
    if (!this.canPlayEffect()) return false;
    const source = this.ctx.createBufferSource();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    const t = this.ctx.currentTime;
    source.buffer = this.noiseBuffer;
    filter.type = 'bandpass';
    filter.frequency.value = 780;
    filter.Q.value = .55;
    gain.gain.setValueAtTime(.0001, t);
    gain.gain.linearRampToValueAtTime(.12, t + .12);
    gain.gain.linearRampToValueAtTime(.055, t + .8);
    gain.gain.exponentialRampToValueAtTime(.0001, t + 1.05);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.effects);
    source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
    source.start(t);
    source.stop(t + 1.1);
    this.cup(.95);
    return true;
  }

  chirp() {
    if (!this.canPlayEffect()) return false;
    // Rounded, low-volume sweeps avoid shrill peaks.
    const calls = [[1450, 1770, 0], [1710, 1370, .18], [1520, 1880, .42]];
    for (const [frequency, endFrequency, delay] of calls) {
      this.tone(frequency, { endFrequency, delay, duration: .13, volume: .012 });
    }
    return true;
  }

  market() {
    if (!this.canPlayEffect()) return false;
    this.tone(523.25, { duration: .15, volume: .016 });
    this.tone(659.25, { delay: .1, duration: .22, volume: .012 });
    return true;
  }

  feedback(kind = 'market') {
    if (kind === 'tea') return this.cup();
    if (kind === 'bird' || kind === 'feed') return this.chirp();
    return this.market();
  }
}
