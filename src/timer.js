export class StudyTimer {
  constructor(onTick, onComplete) {
    this.onTick = onTick; this.onComplete = onComplete;
    this.duration = 25 * 60; this.remaining = this.duration;
    this.running = false; this.endAt = 0; this.interval = null;
  }
  setDuration(seconds) {
    this.pause(); this.duration = Math.max(1, seconds);
    this.remaining = this.duration; this.emit();
  }
  start() {
    if (this.running) return;
    if (this.remaining <= 0) this.remaining = this.duration;
    this.running = true; this.endAt = Date.now() + this.remaining * 1000;
    this.interval = setInterval(() => this.tick(), 200);
    this.tick();
  }
  pause() {
    if (!this.running) return;
    this.remaining = Math.max(0, Math.ceil((this.endAt - Date.now()) / 1000));
    this.running = false; clearInterval(this.interval); this.interval = null; this.emit();
  }
  reset() {
    this.pause(); this.remaining = this.duration; this.emit();
  }
  tick() {
    this.remaining = Math.max(0, Math.ceil((this.endAt - Date.now()) / 1000));
    this.emit();
    if (this.remaining <= 0) {
      this.running = false; clearInterval(this.interval); this.interval = null;
      this.onComplete?.();
    }
  }
  emit() {
    const m = Math.floor(this.remaining / 60), s = this.remaining % 60;
    this.onTick?.({
      remaining: this.remaining,
      formatted: `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`,
      progress: this.duration ? 1 - this.remaining / this.duration : 0,
      running: this.running
    });
  }
  destroy() { this.pause(); }
}
