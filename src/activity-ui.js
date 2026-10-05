const $ = id => document.getElementById(id);
const goods = {
  tea: { name: '春茶', detail: '店家打开茶箱：嫩叶带着清香，先闻一闻，再挑一包。', price: '店家笑道：小包春茶五文，若要送人，再替你包一层纸。' },
  porcelain: { name: '瓷器', detail: '店家取出一只小瓷盏：釉面温润，拿在手中慢慢看。', price: '店家答道：这只小盏十二文，茶壶另算，客官可仔细挑。' },
  silk: { name: '绢布', detail: '店家展开绢布：淡青、米白、藕色，摸摸纹理，再选颜色。', price: '店家答道：按尺裁绢，先量好尺寸再议价，也可看看边上的布头。' },
};

export class ActivityUI {
  constructor(world, sound, onLeave) {
    this.world = world; this.sound = sound; this.onLeave = onLeave;
    this.mode = ''; this.nextBirdCall = 0;
    $('activity-main').addEventListener('click', () => this.primary());
    $('activity-secondary').addEventListener('click', () => this.secondary());
    $('activity-leave').addEventListener('click', () => this.leave());
    $('activity-goods').querySelectorAll('[data-goods]').forEach(button => {
      button.addEventListener('click', () => this.selectGoods(button.dataset.goods));
    });
  }

  play(name) {
    this.sound.unlock().then(() => this.sound[name]?.()).catch(() => {});
  }

  update() {
    const w = this.world;
    const active = ['tea', 'feed', 'shop'].includes(w.mode);
    $('activity-panel').hidden = !active;
    $('toast').hidden = active;
    if (!active) { this.mode = ''; return; }
    if (this.mode !== w.mode) {
      this.mode = w.mode;
      const labels = {
        tea: ['沿河茶铺', '茶铺歇脚', '茶娘提壶添茶，热气慢慢升起。端起杯子，尝一口春茶。', '端杯品茶', '再添一盏'],
        feed: ['虹桥雀语', '桥头喂鸟', '谷粒落在脚边，雀鸟正飞来。等它们落下，看看谁先啄到米粒。', '再撒谷粒', '轻声唤鸟'],
        shop: ['城门货市', '与店家聊聊', goods.tea.detail, '问个价', '打听虹桥'],
      }[w.mode];
      ['activity-kicker', 'activity-title', 'activity-text', 'activity-main', 'activity-secondary'].forEach((id, i) => $(id).textContent = labels[i]);
      $('activity-goods').hidden = w.mode !== 'shop';
      $('activity-panel').classList.toggle('market', w.mode === 'shop');
      if (w.mode === 'shop') this.selectGoods('tea', false);
      this.play(w.mode === 'tea' ? 'pourTea' : w.mode === 'feed' ? 'chirp' : 'market');
      this.nextBirdCall = w.time + 1.9;
    }
    if (w.mode === 'feed' && !w.paused && w.time >= this.nextBirdCall && w.timer < 10) {
      this.sound.chirp(); this.nextBirdCall = w.time + 2.4;
    }
    const progress = Math.min(1, w.timer / (w.activity?.duration || 12));
    $('activity-progress').style.width = `${(1 - progress) * 100}%`;
    $('activity-panel').dataset.kind = w.mode;
    $('activity-panel').dataset.cycle = String(w.activity?.cycle ?? 0);
  }

  primary() {
    const w = this.world;
    if (w.paused) return;
    if (w.mode === 'tea') {
      w.activity.choice = 'sip'; w.activity.choiceAt = w.time;
      $('activity-text').textContent = '端杯轻啜，杯沿微响。春茶清香，河风拂过衣袖。';
      this.play('cup');
    } else if (w.mode === 'feed') {
      w.repeatActivity();
      $('activity-text').textContent = '又撒下一把谷粒，雀鸟拍着翅膀围拢，低头啄食。';
      this.nextBirdCall = w.time + 1.3; this.play('chirp');
    } else if (w.mode === 'shop') {
      $('activity-text').textContent = goods[w.activity.choice || 'tea'].price;
      this.play('feedback');
    }
  }

  secondary() {
    const w = this.world;
    if (w.paused) return;
    if (w.mode === 'tea') {
      w.repeatActivity(); $('activity-text').textContent = '茶娘又添了一盏。壶嘴倾斜，细细的水声落进茶杯。'; this.play('pourTea');
    } else if (w.mode === 'feed') {
      w.activity.choice = 'call'; w.activity.choiceAt = w.time;
      $('activity-text').textContent = '轻声一唤，桥头传来几声雀鸣。莫惊动它们，慢慢看。'; this.play('chirp');
    } else if (w.mode === 'shop') {
      $('activity-text').textContent = '店家指向桥头：沿河往左便是虹桥。听见船家招呼时，可去帮着落桅、牵绳，让漕船平安过桥。'; this.play('market');
    }
  }

  selectGoods(kind, withSound = true) {
    if (this.world.mode !== 'shop') return;
    this.world.activity.choice = kind;
    $('activity-text').textContent = goods[kind].detail;
    $('activity-goods').querySelectorAll('[data-goods]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.goods === kind)));
    if (withSound) this.play('market');
  }

  leave() {
    if (this.world.endActivity()) {
      $('activity-panel').hidden = true; this.mode = ''; this.onLeave();
    }
  }
}
