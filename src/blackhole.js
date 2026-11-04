const PAL = [140, 0, 45, 215, 270, 185, 325, 25]; // green red gold blue purple cyan pink orange
const STYLES = {
  blackhole: { rings: 5, waves: 3, blobs: 1, flow: 'in', arms: 0, tilt: .62, trails: 1 },
  galaxy:    { rings: 0, waves: 1, blobs: 2, flow: 'orbit', arms: .012, tilt: .55, trails: 0 },
  nebula:    { rings: 1, waves: 1, blobs: 6, flow: 'orbit', arms: 0, tilt: .8, trails: 0 },
  orbit:     { rings: 6, waves: 0, blobs: 1, flow: 'orbit', arms: 0, tilt: 1, trails: 1 },
  waves:     { rings: 0, waves: 7, blobs: 1, flow: 'out', arms: 0, tilt: 1, trails: 0 }
};
const hexHue = hex => {
  const n = parseInt(String(hex).slice(1), 16), r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), d = mx - Math.min(r, g, b);
  if (!d) return 150;
  const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
};

export class BlackHole {
  constructor(canvas, options = {}) {
    this.cv = canvas; this.c = canvas.getContext('2d');
    this.o = { enabled: true, intensity: 70, speed: 60, particles: 70, style: 'blackhole', colorMode: 'multi', accent: '#53e6a0', perf: false, ...options };
    this.t = 0; this.raf = 0; this.dead = false; this.run = true; this.last = performance.now();
    this.onResize = () => this.resize();
    this.onVis = () => {
      cancelAnimationFrame(this.raf);
      if (document.hidden) this.run = false;
      else if (!this.dead) { this.run = true; this.last = performance.now(); this.loop(); }
    };
    addEventListener('resize', this.onResize); document.addEventListener('visibilitychange', this.onVis);
    this.resize(); this.seed(); this.loop();
  }
  setOptions(o) { Object.assign(this.o, o); this.hue0 = hexHue(this.o.accent); this.resize(); this.seed(); }
  resize() {
    const dpr = this.o.perf ? 1 : Math.min(devicePixelRatio || 1, 2);
    this.w = Math.max(1, this.cv.clientWidth); this.h = Math.max(1, this.cv.clientHeight);
    this.cv.width = Math.round(this.w * dpr); this.cv.height = Math.round(this.h * dpr);
    this.c.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.cx = this.w / 2; this.cy = this.h / 2;
    this.R = Math.min(this.w * .78, this.h * .6, 420) / 2;   // matches the timer ring size in CSS
    this.maxR = Math.hypot(this.w, this.h) / 2;
    this.c.fillStyle = '#05070d'; this.c.fillRect(0, 0, this.w, this.h);
    this.hue0 = hexHue(this.o.accent);
  }
  seed() {
    const n = Math.round(Math.max(8, Math.min(220, +this.o.particles || 70)) * (this.o.perf ? .5 : 1));
    this.ps = Array.from({ length: n }, () => ({
      a: Math.random() * 6.283, r: this.R * 1.05 + Math.random() * (this.maxR - this.R * 1.05),
      s: .5 + Math.random() * 1.8, sp: .4 + Math.random() * 1.1, k: (Math.random() * 8) | 0,
      dir: Math.random() < .7 ? 1 : -1, px: null, py: 0
    }));
  }
  hue(k) { return this.o.colorMode === 'multi' ? (PAL[k % 8] + this.t * 14) % 360 : (this.hue0 + (k % 4) * 8) % 360; }
  col(k, a, l = 60) { return `hsla(${this.hue(k).toFixed(0)},95%,${l}%,${Math.max(0, Math.min(1, a)).toFixed(3)})`; }
  loop = () => {
    if (this.dead || !this.run) return;
    this.raf = requestAnimationFrame(this.loop);
    const now = performance.now(), dt = Math.min(.05, (now - this.last) / 1000); this.last = now;
    this.draw(dt);
  };
  draw(dt) {
    const o = this.o, c = this.c, { w, h, cx, cy, R } = this, S = STYLES[o.style] || STYLES.blackhole;
    const P = Math.max(.05, o.intensity / 100), spd = Math.max(0, o.speed / 60);
    this.t += dt * spd;
    const t = this.t, perf = o.perf;
    c.globalCompositeOperation = 'source-over'; c.shadowBlur = 0;
    c.fillStyle = `rgba(5,7,13,${o.enabled ? .2 : 1})`; c.fillRect(0, 0, w, h);
    if (!o.enabled) { this.core(c, P); return; }
    c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < S.blobs; i++) { // soft gas clouds / glow
      const a = t * .15 + i * 1.7, r = R * (S.blobs > 2 ? 1.6 : 2.4);
      const x = cx + Math.cos(a) * R * (S.blobs > 2 ? 1.1 : .2), y = cy + Math.sin(a * 1.3) * R * (S.blobs > 2 ? .8 : .2);
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, this.col(i, .22 * P)); g.addColorStop(1, this.col(i, 0));
      c.fillStyle = g; c.fillRect(0, 0, w, h);
    }
    for (let i = 0; i < S.waves; i++) { // expanding energy waves
      const f = (t * .12 + i / S.waves) % 1;
      c.beginPath(); c.arc(cx, cy, R * (1 + f * 2.6), 0, 6.283);
      c.strokeStyle = this.col(i + 2, (1 - f) * .35 * P); c.lineWidth = 1 + P * 2; c.stroke();
    }
    for (let i = 0; i < S.rings; i++) { // accretion rings
      c.save(); c.translate(cx, cy); c.rotate(t * (i % 2 ? -.5 : .5) + i * 1.1);
      c.beginPath(); c.ellipse(0, 0, R * (1.12 + i * .22), R * (1.12 + i * .22) * S.tilt * (S.tilt === 1 ? 1 : .45 + i * .05), -.16, 0, 6.283);
      c.strokeStyle = this.col(i, (.2 + P * .35) * (1 - i * .1)); c.lineWidth = 1 + P * 2.5;
      if (!perf) { c.shadowBlur = 14 * P; c.shadowColor = this.col(i, 1); }
      c.stroke(); c.restore();
    }
    c.shadowBlur = 0;
    for (const p of this.ps) { // particles with light trails
      p.a += dt * spd * p.sp * (.35 + R / p.r) * .6;
      const rs = R * .12 * spd * dt;
      if (S.flow === 'in') p.r += p.dir > 0 ? -rs * (R / p.r + .3) : rs * .8;
      else if (S.flow === 'out') p.r += rs * p.sp * 2;
      if (p.r < R * 1.02 || p.r > this.maxR) { p.r = S.flow === 'in' && p.dir > 0 ? this.maxR * (.6 + Math.random() * .4) : R * (1.03 + Math.random() * .15); p.px = null; }
      const ang = p.a + S.arms * p.r, x = cx + Math.cos(ang) * p.r, y = cy + Math.sin(ang) * p.r * S.tilt;
      const al = (.3 + .6 * (.5 + .5 * Math.sin(t * 2 + p.k + p.a))) * P;
      if (S.trails && p.px !== null && !perf) { c.beginPath(); c.moveTo(p.px, p.py); c.lineTo(x, y); c.strokeStyle = this.col(p.k, al * .8); c.lineWidth = p.s; c.stroke(); }
      c.beginPath(); c.arc(x, y, p.s * (.5 + P), 0, 6.283); c.fillStyle = this.col(p.k, al, 70); c.fill();
      p.px = x; p.py = y;
    }
    c.globalCompositeOperation = 'source-over';
    this.core(c, P);
  }
  core(c, P) { // event horizon: keeps the timer readable
    const { cx, cy, R } = this;
    c.beginPath(); c.arc(cx, cy, R * .9, 0, 6.283); c.fillStyle = '#010207'; c.fill();
    c.beginPath(); c.arc(cx, cy, R * .92, 0, 6.283);
    c.strokeStyle = this.col(0, .35 * P); c.lineWidth = 2; c.stroke();
  }
  destroy() {
    this.dead = true; this.run = false; cancelAnimationFrame(this.raf);
    removeEventListener('resize', this.onResize); document.removeEventListener('visibilitychange', this.onVis);
  }
      }
