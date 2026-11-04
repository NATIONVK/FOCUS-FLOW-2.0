export class BlackHole {
  constructor(canvas, options = {}) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d');
    this.options = { enabled: true, intensity: 70, speed: 60, particles: 70, color: '#53e6a0', style: 'blackhole', ...options };
    this.particles = []; this.frame = 0; this.running = true; this.resize = this.resize.bind(this);
    window.addEventListener('resize', this.resize); this.resize(); this.seed(); this.animate();
  }
  setOptions(options) { this.options = { ...this.options, ...options }; this.seed(); }
  setColor(color) { this.options.color = color; }
  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = Math.max(1, rect.width); this.h = Math.max(1, rect.height);
    this.canvas.width = Math.round(this.w * dpr); this.canvas.height = Math.round(this.h * dpr);
    this.ctx.setTransform(dpr,0,0,dpr,0,0);
    this.cx = this.w / 2; this.cy = this.h / 2;
  }
  seed() {
    this.particles = Array.from({length: Math.max(8, Math.min(180, Number(this.options.particles) || 70))}, () => ({
      angle: Math.random() * Math.PI * 2,
      radius: 34 + Math.random() * Math.min(this.w, this.h) * .36,
      size: .5 + Math.random() * 2,
      orbit: .5 + Math.random() * 1.5,
      phase: Math.random() * 6
    }));
  }
  animate = () => {
    if (!this.running) return;
    this.frame = requestAnimationFrame(this.animate);
    const c = this.ctx, w = this.w, h = this.h;
    c.clearRect(0,0,w,h);
    if (!this.options.enabled) return;
    const power = Math.max(0, Number(this.options.intensity) / 100);
    const speed = Math.max(0, Number(this.options.speed) / 60);
    const radius = Math.min(w,h) * (.12 + power * .055);
    const glow = c.createRadialGradient(this.cx,this.cy,2,this.cx,this.cy,radius*3.4);
    glow.addColorStop(0,'rgba(0,0,0,1)');
    glow.addColorStop(.22,'rgba(0,0,0,.98)');
    glow.addColorStop(.48,this.hexAlpha(this.options.color,.18*power));
    glow.addColorStop(1,'rgba(0,0,0,0)');
    c.fillStyle=glow;c.fillRect(0,0,w,h);
    const t=this.frame*.008*speed;
    for(let ring=0;ring<4;ring++){
      c.save();c.translate(this.cx,this.cy);c.rotate(t*(ring%2?-.7:.7)+ring);
      c.beginPath();c.ellipse(0,0,radius*(1.35+ring*.34),radius*(.28+ring*.07),-.16,0,Math.PI*2);
      c.strokeStyle=this.hexAlpha(this.options.color,(.12+power*.22)*(1-ring*.13));
      c.lineWidth=1+power*2;c.shadowBlur=18*power;c.shadowColor=this.options.color;c.stroke();c.restore();
    }
    for(const p of this.particles){
      p.angle += .003 * speed * p.orbit;
      const wobble=Math.sin(t+p.phase)*3*power;
      const x=this.cx+Math.cos(p.angle)* (p.radius+wobble);
      const y=this.cy+Math.sin(p.angle)* (p.radius*.43+wobble);
      const alpha=.25+(.65*(.5+.5*Math.sin(t*2+p.phase)))*power;
      c.beginPath();c.arc(x,y,p.size*(.5+power),0,Math.PI*2);
      c.fillStyle=this.hexAlpha(this.options.color,alpha);c.shadowBlur=8*power;c.shadowColor=this.options.color;c.fill();
    }
    c.save();c.translate(this.cx,this.cy);
    c.beginPath();c.arc(0,0,radius,0,Math.PI*2);c.fillStyle='#010207';c.shadowBlur=30*power;c.shadowColor=this.options.color;c.fill();c.restore();
  };
  hexAlpha(hex,a) {
    const clean=String(hex).replace('#','');
    if(clean.length!==6)return `rgba(83,230,160,${a})`;
    const n=parseInt(clean,16);
    return `rgba(${n>>16},${(n>>8)&255},${n&255},${Math.max(0,Math.min(1,a))})`;
  }
  destroy() { this.running=false;cancelAnimationFrame(this.frame);window.removeEventListener('resize',this.resize); }
}
