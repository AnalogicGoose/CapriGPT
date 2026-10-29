import { reducedMotion } from './util.js';

const ART = new URL('../../../assets/capri/portrait-blink.png', import.meta.url).href;

// A live portrait instead of a permanently running GIF: hidden panels do no work.
export class Portrait {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.active = false;
    this.raf = 0;
    this.mood = 'calm';
    this.last = 0;
    this.image = new Image();
    this.image.onload = () => { this.ready = true; this.reset(); this.refresh(); };
    this.image.onerror = () => {
      if (this.fallback) return;
      this.fallback = true;
      this.image.src = new URL('../../../assets/capri/capri-face.png', import.meta.url).href;
    };
    this.image.src = ART;
    this.tick = this.tick.bind(this);
    this.onPreference = () => { this.reset(); this.refresh(); };
    reducedMotion.addEventListener('change', this.onPreference);
    document.addEventListener('visibilitychange', this.onPreference);
  }

  reset(now = performance.now()) {
    this.nextBlink = now + 2800 + Math.random() * 2800;
    this.blinkStart = -Infinity;
    this.glitchStart = -Infinity;
    this.nextGlitch = now + 7000 + Math.random() * 6000;
  }

  setMood(mood) {
    if (mood === this.mood) return;
    this.mood = mood;
    if (this.active && !reducedMotion.matches) this.glitchStart = performance.now();
  }

  setActive(active) {
    if (this.active === active) return;
    this.active = active;
    if (active) this.reset();
    this.refresh();
  }

  refresh() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    if (!this.ready) return;
    this.draw(performance.now());
    if (this.active && !document.hidden && !reducedMotion.matches) this.raf = requestAnimationFrame(this.tick);
  }

  tick(now) {
    this.raf = 0;
    if (!this.active || document.hidden || reducedMotion.matches) return;
    if (now - this.last >= 1000 / 30) {
      if (now >= this.nextBlink) {
        this.blinkStart = now;
        this.nextBlink = now + 3500 + Math.random() * 3000;
      }
      if (now >= this.nextGlitch) {
        this.glitchStart = now;
        this.nextGlitch = now + 8000 + Math.random() * 6000;
      }
      this.draw(now);
      this.last = now;
    }
    this.raf = requestAnimationFrame(this.tick);
  }

  draw(now) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const size = 64;
    const pixels = Math.round(size * Math.min(window.devicePixelRatio || 1, 2));
    if (this.canvas.width !== pixels || this.canvas.height !== pixels) {
      this.canvas.width = this.canvas.height = pixels;
    }
    ctx.setTransform(pixels / size, 0, 0, pixels / size, 0, 0);
    ctx.clearRect(0, 0, size, size);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    const width = this.image.naturalWidth / (this.fallback ? 1 : 2);
    const height = this.image.naturalHeight;
    const motion = this.active && !document.hidden && !reducedMotion.matches;
    const age = now - this.blinkStart;
    // Short eased close, closed hold, and slower opening. No full-image squash.
    let blink = 0;
    if (motion && age >= 0 && age < 210) {
      if (age < 65) blink = age / 65;
      else if (age < 105) blink = 1;
      else blink = 1 - (age - 105) / 105;
      blink = blink * blink * (3 - 2 * blink);
    }
    ctx.globalAlpha = 1;
    ctx.drawImage(this.image, 0, 0, width, height, 0, 0, size, size);
    if (blink > 0 && !this.fallback) {
      ctx.globalAlpha = blink;
      ctx.drawImage(this.image, width, 0, width, height, 0, 0, size, size);
      ctx.globalAlpha = 1;
    }
    // A few narrow displaced scan bands, never a bright full-frame flash.
    const glitchAge = now - this.glitchStart;
    if (motion && glitchAge >= 0 && glitchAge < 150) {
      const offset = Math.floor(glitchAge / 35) % 2 ? -2 : 2;
      ctx.globalAlpha = 0.7;
      for (const [y, h] of [[18, 3], [39, 2], [48, 1]]) {
        ctx.drawImage(this.image, 0, y / size * height, width, h / size * height, offset, y, size, h);
      }
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = '#43ffd4'; ctx.fillRect(1, 20, size - 2, 1);
      ctx.fillStyle = '#d444ff'; ctx.fillRect(1, 41, size - 2, 1);
    }
    ctx.globalAlpha = 0.055;
    ctx.fillStyle = '#090310';
    for (let y = 1; y < size; y += 3) ctx.fillRect(0, y, size, 0.6);
    ctx.globalAlpha = 1;
  }
}
