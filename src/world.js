export const WIDTH = 3840;
export const HEIGHT = 1280;
export const FERRY_PASSENGER_OFFSET = 46;
export const FERRY_DECK_OFFSET = -6;
export const FERRY_DOCK_Y = 952;
export const FERRY_RIVER_Y = 1080;
export const FERRY_DECK_Y = FERRY_DOCK_Y + FERRY_DECK_OFFSET;
export const FERRY_DOCKS = [1810, 2990];
export const ACTIVITY_DURATION = { tea: 12, feed: 12 };
export const PLACES = [
  { name: '水磨作坊', x: 380 },
  { name: '沿河茶市', x: 1267 },
  { name: '虹桥烟火', x: 2450 },
  { name: '城门货市', x: 3420 },
];
export const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
export const lerp = (a, b, p) => a + (b - a) * p;
export const smooth = p => p * p * (3 - 2 * p);
export function pathY(x) {
  const p = (x - 1990) / 910;
  return 808 - (p > 0 && p < 1 ? Math.sin(p * Math.PI) * 204 : 0);
}
export function pathSlope(x) {
  const p = (x - 1990) / 910;
  return p > 0 && p < 1 ? -204 * Math.PI / 910 * Math.cos(p * Math.PI) : 0;
}
export function getFerryBerth(dockX) {
  return { x: dockX - FERRY_PASSENGER_OFFSET, y: FERRY_DOCK_Y };
}
export function getFerryRoute(from, to, progress) {
  const p = clamp(progress, 0, 1), start = getFerryBerth(from), finish = getFerryBerth(to);
  return {
    x: lerp(start.x, finish.x, smooth(p)),
    y: FERRY_DOCK_Y + (FERRY_RIVER_Y - FERRY_DOCK_Y) * Math.sin(p * Math.PI) ** 2,
    face: Math.sign(to - from) || 1,
  };
}
function transferPoint(points, progress) {
  const lengths = points.slice(1).map((point, index) => Math.hypot(point.x - points[index].x, point.y - points[index].y));
  let distance = lengths.reduce((total, length) => total + length, 0) * smooth(clamp(progress, 0, 1));
  for (let index = 0; index < lengths.length; index++) {
    if (lengths[index] > 0 && distance <= lengths[index]) {
      const p = distance / lengths[index];
      return { x: lerp(points[index].x, points[index + 1].x, p), y: lerp(points[index].y, points[index + 1].y, p) };
    }
    distance -= lengths[index];
  }
  return points[points.length - 1];
}

export class World {
  constructor() {
    this.x = PLACES[1].x; this.v = 0; this.face = 1; this.steps = 0;
    this.target = null; this.auto = false; this.paused = false; this.time = 0;
    this.mode = 'walk'; this.action = null; this.timer = 0; this.transfer = null;
    this.ferry = { x: 1750, y: FERRY_RIVER_Y, face: 1, phase: 'idle', from: 1810, to: 2990, elapsed: 0, approachX: 1750, approachY: FERRY_RIVER_Y };
    this.activity = { duration: 12, cycle: 0, choice: '' };
    this.story = { phase: 'idle', progress: 0, holding: false, elapsed: 0 };
    this.events = [];
  }
  emit(text) { this.events.push(text); }
  get y() {
    if (this.mode === 'sailing') return this.ferry.y + FERRY_DECK_OFFSET;
    if (this.transfer && (this.mode === 'boarding' || this.mode === 'disembark')) {
      return transferPoint(this.transfer.points, this.timer / 2).y;
    }
    return pathY(this.x);
  }
  get pose() {
    const transferring = this.mode === 'boarding' || this.mode === 'disembark';
    const progress = clamp(this.mode === 'sailing' ? this.ferry.elapsed / 12 : this.timer / (transferring ? 2 : this.activity.duration || 1), 0, 1);
    const speed = this.mode === 'walk' ? clamp(Math.abs(this.v) / 175, 0, 1) : 0;
    const stride = transferring ? Math.sin(progress * Math.PI) * .75 : speed;
    return {
      action: this.mode === 'walk' && speed < .003 ? 'idle' : this.mode,
      progress: this.mode === 'walk' || this.mode === 'shop' ? 0 : progress,
      steps: this.steps, stride, lean: stride * .08,
      walking: stride > .003, riding: this.mode === 'sailing',
    };
  }
  go(x, action = null) {
    if (this.mode !== 'walk' || this.story.phase !== 'idle') return false;
    this.auto = false; this.target = clamp(x, 45, WIDTH - 45); this.action = action;
    return true;
  }
  cancel() { this.target = null; this.auto = false; this.action = null; }
  callFerry() {
    if (this.mode !== 'walk' || this.story.phase !== 'idle') return false;
    const left = Math.abs(this.x - 1810) <= Math.abs(this.x - 2990);
    this.ferry.from = left ? 1810 : 2990;
    this.ferry.to = left ? 2990 : 1810;
    this.ferry.phase = 'idle';
    this.go(this.ferry.from, 'ferry');
    this.emit('客官，且到码头等船。'); return true;
  }
  board() {
    const berth = getFerryBerth(this.ferry.from);
    if (this.ferry.phase !== 'ready' || this.mode !== 'walk' || this.story.phase !== 'idle' || Math.abs(this.x - this.ferry.from) > 20 || Math.hypot(this.ferry.x - berth.x, this.ferry.y - berth.y) > 1) return false;
    this.transfer = { points: [
      { x: this.x, y: this.y },
      { x: this.ferry.from, y: pathY(this.ferry.from) },
      { x: this.ferry.from, y: 928 },
      { x: this.ferry.x + FERRY_PASSENGER_OFFSET, y: this.ferry.y + FERRY_DECK_OFFSET },
    ] };
    this.face = Math.sign(this.ferry.from - this.x) || Math.sign(this.ferry.to - this.ferry.from);
    this.mode = 'boarding'; this.timer = 0; this.v = 0; this.cancel(); this.ferry.phase = 'boarding';
    this.emit('缓步登船，沿河看景。'); return true;
  }
  endActivity() {
    if (!['tea', 'feed', 'shop'].includes(this.mode)) return false;
    this.mode = 'walk'; this.timer = 0; this.v = 0; this.activity.choice = '';
    this.emit('歇过脚，继续沿河漫游。'); return true;
  }
  repeatActivity() {
    if (!['tea', 'feed'].includes(this.mode)) return false;
    this.timer = 0; this.activity.cycle++; this.activity.choice = ''; return true;
  }
  startStory() {
    if (this.mode !== 'walk') return false;
    this.cancel(); this.x = 2370; this.v = 0;
    this.story = { phase: 'lowering', progress: 0, holding: false, elapsed: 0 };
    this.emit('漕船将至，按住「落桅」放下桅杆。'); return true;
  }
  leaveStory() { this.story.phase = 'idle'; this.story.holding = false; }
  arrive() {
    this.v = 0; this.target = null;
    const action = this.action; this.action = null;
    if (action === 'tea' || action === 'feed' || action === 'shop') {
      this.mode = action; this.timer = 0;
      this.activity.duration = ACTIVITY_DURATION[action] || 0; this.activity.cycle++; this.activity.choice = '';
      this.emit(action === 'tea' ? '一盏春茶，且坐片刻。' : action === 'feed' ? '撒一把谷粒，看桥头雀鸟。' : '客官，来看看汴京好物！');
    } else if (action === 'ferry') {
      this.ferry.phase = 'calling'; this.ferry.elapsed = 0; this.ferry.approachX = this.ferry.x; this.ferry.approachY = this.ferry.y;
      this.ferry.face = Math.sign(getFerryBerth(this.ferry.from).x - this.ferry.x) || this.ferry.face;
      this.emit('船家听见了，正向岸边划来。');
    }
  }
  update(dt, direction = 0) {
    if (this.paused) return;
    dt = clamp(dt, 0, .05); this.time += dt;
    const story = this.story;
    if (story.phase === 'lowering' || story.phase === 'towing') {
      story.elapsed += dt;
      story.progress = clamp(story.progress + (story.holding ? dt * (story.phase === 'lowering' ? 34 : 16) : -dt * 3), 0, 100);
      if (story.progress >= 100) {
        if (story.phase === 'lowering') { story.phase = 'towing'; story.progress = 0; story.holding = false; this.emit('桅杆已落。按住接绳，牵引漕船过桥。'); }
        else { story.phase = 'complete'; story.holding = false; this.emit('漕船平安过桥！画师已为你留下画稿。'); }
      }
      return;
    }
    const ferry = this.ferry;
    if (ferry.phase === 'calling') {
      const berth = getFerryBerth(ferry.from);
      ferry.elapsed += dt; const p = clamp(ferry.elapsed / 3, 0, 1);
      ferry.x = lerp(ferry.approachX, berth.x, smooth(p));
      const outward = Math.min(1, Math.abs(berth.x - ferry.approachX) / 250) * Math.max(0, FERRY_RIVER_Y - Math.max(ferry.approachY, berth.y));
      ferry.y = lerp(ferry.approachY, berth.y, smooth(p)) + Math.sin(p * Math.PI) ** 2 * outward;
      if (ferry.elapsed >= 3) { ferry.x = berth.x; ferry.y = berth.y; ferry.phase = 'ready'; this.emit('船已靠岸，点击「上船」。'); }
    }
    if (this.mode === 'boarding') {
      const beforeX = this.x, beforeY = this.y;
      this.timer += dt;
      this.x = transferPoint(this.transfer.points, this.timer / 2).x;
      this.steps += Math.hypot(this.x - beforeX, this.y - beforeY) * .065;
      if (this.timer >= 2) {
        this.mode = 'sailing'; ferry.phase = 'sailing'; ferry.elapsed = 0; this.transfer = null;
        this.face = ferry.face = Math.sign(ferry.to - ferry.from);
      }
      return;
    }
    if (this.mode === 'sailing') {
      ferry.elapsed += dt; Object.assign(ferry, getFerryRoute(ferry.from, ferry.to, ferry.elapsed / 12)); this.x = ferry.x + FERRY_PASSENGER_OFFSET;
      if (ferry.elapsed >= 12) {
        this.transfer = { points: [
          { x: this.x, y: ferry.y + FERRY_DECK_OFFSET },
          { x: ferry.to, y: 928 },
          { x: ferry.to, y: pathY(ferry.to) },
        ] };
        this.mode = 'disembark'; this.timer = 0; ferry.phase = 'disembark'; this.emit('船已靠岸，缓步下船。');
      }
      return;
    }
    if (this.mode === 'disembark') {
      const beforeX = this.x, beforeY = this.y;
      this.timer += dt;
      this.x = transferPoint(this.transfer.points, this.timer / 2).x;
      this.steps += Math.hypot(this.x - beforeX, this.y - beforeY) * .065;
      if (this.timer >= 2) { this.mode = 'walk'; this.x = ferry.to; this.transfer = null; ferry.phase = 'idle'; this.emit('已到对岸，再走一走吧。'); }
      return;
    }
    if (this.mode === 'tea' || this.mode === 'feed' || this.mode === 'shop') {
      this.timer += dt;
      if (this.mode !== 'shop' && this.timer >= this.activity.duration) this.endActivity();
      return;
    }
    if (story.phase === 'complete') return;
    if (direction) this.cancel();
    let aim = direction || (this.auto ? this.face : 0);
    if (this.target !== null) {
      const distance = this.target - this.x;
      if (Math.abs(distance) <= 3) { this.x = this.target; this.arrive(); return; }
      aim = Math.sign(distance) * Math.min(1, Math.sqrt(Math.abs(distance) / 100));
    }
    // Keep the pace measured along the bridge surface, so the steep ramps take shorter horizontal steps.
    const reversing = aim && this.v * aim < 0;
    const wanted = reversing ? 0 : aim * 175 / Math.hypot(1, pathSlope(this.x));
    const acceleration = reversing ? 650 : aim ? 360 : 540;
    this.v += clamp(wanted - this.v, -acceleration * dt, acceleration * dt);
    if (Math.abs(this.v) < .2 && !aim) this.v = 0;
    const next = clamp(this.x + this.v * dt, 45, WIDTH - 45);
    if (this.target !== null && (this.target - this.x) * (this.target - next) <= 0) { this.x = this.target; this.arrive(); return; }
    this.steps += Math.hypot(next - this.x, pathY(next) - pathY(this.x)) * .065; this.x = next;
    if (Math.abs(this.v) > 2) this.face = Math.sign(this.v);
    if (next === 45 || next === WIDTH - 45) { this.auto = false; this.v = 0; }
  }
}
