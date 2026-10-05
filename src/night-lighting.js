// Openings calibrated against panorama.webp in the 3840 x 1280 scroll space.
// The tea-house gable is plaster, not a row of illuminated windows.
const interiors = [
  { points: [[1188,548],[1214,546],[1214,585],[1188,589]], warmth: .64 },
  { points: [[1264,545],[1390,548],[1390,590],[1264,584]], warmth: .88 },
  { points: [[1449,546],[1610,551],[1610,594],[1449,588]], warmth: .84 },
  { points: [[1777,582],[1870,585],[1870,615],[1777,610]], warmth: .64 },
  // Keep the light above counters and below the canvas awnings.
  { points: [[1070,705],[1175,705],[1175,739],[1070,742]], warmth: .45 },
  { points: [[1265,704],[1365,704],[1365,738],[1265,734]], warmth: .48 },
  { points: [[1457,692],[1536,698],[1536,721],[1457,720]], warmth: .63 },
  { points: [[1541,704],[1589,705],[1589,722],[1541,722]], warmth: .55 },
  { points: [[1660,714],[1750,715],[1750,738],[1660,738]], warmth: .38 },
  { points: [[2812,598],[2940,591],[2940,621],[2812,628]], warmth: .55 },
  { points: [[3039,712],[3197,712],[3197,743],[3039,742]], warmth: .46 },
  { points: [[3220,703],[3309,703],[3309,741],[3220,741]], warmth: .46 },
  { points: [[3455,712],[3589,712],[3589,749],[3455,749]], warmth: .45 },
  { points: [[3625,709],[3732,702],[3732,749],[3625,749]], warmth: .55 },
  { points: [[3749,712],[3837,710],[3837,749],[3749,749]], warmth: .48 },
  // Glazing ends before the original timber balcony and stone parapet.
  { points: [[3397,382],[3629,376],[3629,413],[3397,418]], warmth: .64 },
  { points: [[3664,378],[3763,389],[3763,418],[3664,411]], warmth: .56 },
];

// Light the painted paper bodies; retain their original ribs and outline.
const lanterns = [
  { x: 1255, y: 548, rx: 7, ry: 13 },
  { x: 1253, y: 574, rx: 6, ry: 10 },
  { x: 1438, y: 543, rx: 8, ry: 14 },
  { x: 1437, y: 572, rx: 8, ry: 13 },
  { x: 1631, y: 555, rx: 7, ry: 12 },
  { x: 1630, y: 582, rx: 7, ry: 12 },
  { x: 1796, y: 585, rx: 6, ry: 10 },
  { x: 1796, y: 607, rx: 6, ry: 10 },
  { x: 1447, y: 696, rx: 7, ry: 10, ground: 802 },
  { x: 2994, y: 696, rx: 5, ry: 8, ground: 802 },
  { x: 3354, y: 699, rx: 6, ry: 8, ground: 798 },
  { x: 3390, y: 682, rx: 6, ry: 10 },
  { x: 3386, y: 701, rx: 6, ry: 9, ground: 802 },
  { x: 3743, y: 712, rx: 7, ry: 10, ground: 816 },
];

const lightingCache = new WeakMap();
const smooth = (low, high, value) => {
  const t = Math.max(0, Math.min(1, (value - low) / (high - low)));
  return t * t * (3 - 2 * t);
};

function surface(width, height) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height);
  const canvas = document.createElement('canvas');
  canvas.width = width;canvas.height = height;return canvas;
}

function insidePolygon(x, y, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [ax, ay] = points[i], [bx, by] = points[j];
    if ((ay > y) !== (by > y) && x < (bx - ax) * (y - ay) / (by - ay) + ax) inside = !inside;
  }
  return inside;
}

function edgeDistance(x, y, points) {
  let distance = Infinity;
  for (let i = 0; i < points.length; i++) {
    const [ax, ay] = points[i], [bx, by] = points[(i + 1) % points.length];
    const dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
    distance = Math.min(distance, Math.hypot(x - ax - t * dx, y - ay - t * dy));
  }
  return distance;
}

function createPaintedLight(image) {
  const width = image.naturalWidth || image.width, height = image.naturalHeight || image.height;
  if (!width || !height) return null;
  const canvas = surface(width, height);
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(image, 0, 0, width, height);
  const original = context.getImageData(0, 0, width, height).data;
  const lit = context.createImageData(width, height), sx = width / 3840, sy = height / 1280;

  function illuminate(bounds, mask, lantern = false) {
    const left = Math.max(0, Math.floor(bounds.left * sx)), right = Math.min(width, Math.ceil(bounds.right * sx));
    const top = Math.max(0, Math.floor(bounds.top * sy)), bottom = Math.min(height, Math.ceil(bounds.bottom * sy));
    for (let py = top; py < bottom; py++) for (let px = left; px < right; px++) {
      const x = (px + .5) / sx, y = (py + .5) / sy, coverage = mask(x, y);
      if (coverage <= 0) continue;
      const index = (py * width + px) * 4;
      const r = original[index], g = original[index + 1], b = original[index + 2];
      const luminance = r * .2126 + g * .7152 + b * .0722;
      // The original dark timbers, mullions, posts and railings occlude light.
      const timber = smooth(57, 145, luminance);
      const plaster = 1 - smooth(183, 222, luminance) * .72;
      const paper = lantern ? smooth(0, 24, r - g) * smooth(0, 18, g - b) : 1;
      const alpha = coverage * (lantern ? .82 : .60) * timber * (lantern ? paper : plaster);
      if (alpha * 255 <= lit.data[index + 3]) continue;
      // Warm the source texture instead of painting an opaque yellow panel.
      lit.data[index] = Math.min(255, r * (lantern ? 1.22 : 1.14) + (lantern ? 26 : 16));
      lit.data[index + 1] = Math.min(255, g * (lantern ? 1.08 : 1.01) + 9);
      lit.data[index + 2] = b * (lantern ? .66 : .73) + 5;
      lit.data[index + 3] = Math.round(alpha * 255);
    }
  }

  for (const room of interiors) {
    const xs = room.points.map(point => point[0]), ys = room.points.map(point => point[1]);
    const bounds = { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) };
    const cx = (bounds.left + bounds.right) / 2, cy = (bounds.top + bounds.bottom) / 2;
    const rx = (bounds.right - bounds.left) * .6, ry = (bounds.bottom - bounds.top) * .72;
    illuminate(bounds, (x, y) => {
      if (!insidePolygon(x, y, room.points)) return 0;
      const falloff = Math.exp(-.65 * (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2));
      return room.warmth * falloff * smooth(0, 3.8, edgeDistance(x, y, room.points));
    });
  }
  for (const lamp of lanterns) {
    illuminate({ left: lamp.x - lamp.rx, right: lamp.x + lamp.rx, top: lamp.y - lamp.ry, bottom: lamp.y + lamp.ry }, (x, y) => {
      const radius = ((x - lamp.x) / lamp.rx) ** 2 + ((y - lamp.y) / lamp.ry) ** 2;
      return 1 - smooth(.42, 1, radius);
    }, true);
  }
  context.clearRect(0, 0, width, height);context.putImageData(lit, 0, 0);return canvas;
}

function paintedLight(image) {
  if (!image || !(image.naturalWidth || image.width)) return null;
  if (lightingCache.has(image)) return lightingCache.get(image);
  try {
    const layer = createPaintedLight(image);
    lightingCache.set(image, layer);return layer;
  } catch {
    // A pixel-read restriction must not fall back to generic window rectangles.
    lightingCache.set(image, null);return null;
  }
}

function softLight(c, x, y, rx, ry, alpha, color = '239,177,84') {
  c.save();c.translate(x, y);c.scale(rx, ry);
  const light = c.createRadialGradient(0, 0, 0, 0, 0, 1);
  light.addColorStop(0, 'rgba(' + color + ',' + alpha + ')');
  light.addColorStop(.38, 'rgba(' + color + ',' + alpha * .65 + ')');
  light.addColorStop(1, 'rgba(' + color + ',0)');
  c.fillStyle = light;c.beginPath();c.arc(0, 0, 1, 0, Math.PI * 2);c.fill();c.restore();
}

function drawLanternGlow(c, lamp, index, time, reduced) {
  const flicker = reduced ? 1 : 1 + Math.sin(time * 1.4 + index * 2.1) * .025;
  softLight(c, lamp.x, lamp.y, lamp.rx * 4.2, lamp.ry * 2.6, .14 * flicker);
  if (lamp.ground !== undefined) softLight(c, lamp.x, lamp.ground, 54, 12, .075 * flicker);
}

function drawReflections(c, time, reduced, height) {
  c.save();c.beginPath();c.rect(0, 915, 3840, Math.max(0, height - 915));c.clip();c.lineCap = 'round';
  for (let index = 0; index < lanterns.length; index++) {
    const lamp = lanterns[index];if (lamp.ground === undefined) continue;
    const start = 936 + index % 3 * 9;
    softLight(c, lamp.x, start + 45, 22, 64, .045);
    for (let line = 0; line < 16; line++) {
      const depth = line / 16;
      const drift = reduced ? Math.sin(index + line) * 2 : Math.sin(time * .85 + line * 1.7 + index) * (2 + depth * 4);
      const length = 6 + Math.sin(line * 2.6 + index) ** 2 * 17 + depth * 8, y = start + line * 8.2;
      c.lineWidth = line % 4 === 0 ? 2 : 1.1;
      c.strokeStyle = 'rgba(244,191,97,' + ((.20 - depth * .17) * (line % 3 === 0 ? .65 : 1)) + ')';
      c.beginPath();c.moveTo(lamp.x + drift - length / 2, y);
      c.quadraticCurveTo(lamp.x + drift, y + .6, lamp.x + drift + length / 2, y);c.stroke();
    }
  }
  c.restore();
}

let moonTexture;

function lunarNoise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const grain = (a, b) => {
    const value = Math.sin(a * 127.1 + b * 311.7 + 19.3) * 43758.5453;
    return value - Math.floor(value);
  };
  const top = grain(ix, iy) * (1 - ux) + grain(ix + 1, iy) * ux;
  const bottom = grain(ix, iy + 1) * (1 - ux) + grain(ix + 1, iy + 1) * ux;
  return top * (1 - uy) + bottom * uy;
}

function createMoonTexture() {
  const size = 384, canvas = surface(size, size), c = canvas.getContext('2d');
  const pixels = c.createImageData(size, size), center = size / 2, radius = center - 2;
  // Soft, irregular washes suggest the lunar seas rather than isolated dots.
  // The darker western plain and northern seas remain legible at small scale.
  const maria = [
    { x: -.43, y: -.05, rx: .30, ry: .52, angle: -.15, depth: .76 },
    { x: -.22, y: -.35, rx: .34, ry: .24, angle: -.18, depth: .88 },
    { x: .19, y: -.33, rx: .23, ry: .20, angle: .2, depth: .92 },
    { x: .34, y: -.02, rx: .24, ry: .29, angle: -.4, depth: .87 },
    { x: .66, y: -.20, rx: .13, ry: .16, angle: .1, depth: .72 },
    { x: -.10, y: .34, rx: .26, ry: .19, angle: .35, depth: .64 },
    { x: -.41, y: .34, rx: .15, ry: .16, angle: -.25, depth: .58 },
  ].map(sea => ({ ...sea, cosine: Math.cos(sea.angle), sine: Math.sin(sea.angle) }));
  const craters = [
    { x: -.08, y: .57, radius: .032, rays: .22 },
    { x: -.32, y: -.10, radius: .043, rays: .13 },
    { x: -.55, y: -.03, radius: .024, rays: .08 },
    { x: .43, y: .40, radius: .032, rays: .035 },
  ];

  for (let py = 0; py < size; py++) for (let px = 0; px < size; px++) {
    const x = (px + .5 - center) / radius, y = (py + .5 - center) / radius;
    const rr = x * x + y * y;if (rr >= 1.01) continue;
    const distance = Math.sqrt(rr), index = (py * size + px) * 4;
    const broad = lunarNoise(x * 8 + 23, y * 8 + 17);
    const medium = lunarNoise(x * 24 + 7, y * 24 + 31);
    const fine = lunarNoise(x * 93 + 41, y * 93 + 13);
    let seaDepth = 0;
    for (const sea of maria) {
      const dx = x - sea.x, dy = y - sea.y;
      const u = (dx * sea.cosine + dy * sea.sine) / sea.rx;
      const v = (-dx * sea.sine + dy * sea.cosine) / sea.ry;
      const coast = u * u + v * v + (broad - .5) * .46 + (medium - .5) * .14;
      seaDepth = Math.max(seaDepth, (1 - smooth(.33, 1.24, coast)) * sea.depth);
    }
    // A slight rounded falloff and translucent grain keep a painted surface.
    let shade = seaDepth * (17 + broad * 6) + distance ** 3 * 4.4;
    shade += (medium - .5) * 2.7 + (fine - .5) * 1.6 + (x + y) * 1.0;
    let rays = 0;
    for (const crater of craters) {
      const dx = x - crater.x, dy = y - crater.y, d = Math.hypot(dx, dy);
      const rim = Math.exp(-(((d - crater.radius) / .010) ** 2));
      const bowl = Math.exp(-((d / (crater.radius * .68)) ** 2));
      shade += bowl * 3.8 - rim * 2.7;
      // Broken, very pale rays around the two larger bright craters.
      const angle = Math.atan2(dy, dx);
      const streak = Math.max(0, Math.cos(angle * 11 + 1.7) * Math.cos(angle * 7 - .4)) ** 7;
      rays += streak * Math.exp(-d / crater.rays) * smooth(crater.radius, crater.radius * 2, d) * 5;
    }
    pixels.data[index] = Math.min(255, 253 - shade + rays);
    pixels.data[index + 1] = Math.min(255, 250 - shade * .90 + rays);
    pixels.data[index + 2] = Math.min(255, 235 - shade * .62 + rays);
    pixels.data[index + 3] = Math.round((1 - smooth(.996, 1.004, distance)) * 255);
  }
  c.putImageData(pixels, 0, 0);return canvas;
}

function drawMoon(c) {
  const x = 3140, y = 230, radius = 31;
  // The layered halo is local and static, leaving the wider night sky intact.
  softLight(c, x, y, 88, 88, .045, '247,244,226');
  softLight(c, x, y, 58, 58, .095, '250,247,233');
  softLight(c, x, y, 39, 39, .15, '253,250,237');
  if (!moonTexture) moonTexture = createMoonTexture();
  c.save();
  c.imageSmoothingEnabled = true;c.imageSmoothingQuality = 'high';
  const textureRadius = moonTexture.width / 2 - 2;
  const drawSize = radius * moonTexture.width / textureRadius;
  c.drawImage(moonTexture, x - drawSize / 2, y - drawSize / 2, drawSize, drawSize);
  c.strokeStyle = 'rgba(255,252,239,.62)';c.lineWidth = .48;
  c.beginPath();c.arc(x, y, radius - .18, 0, Math.PI * 2);c.stroke();c.restore();
}

export function drawNightLighting(ctx, { night, image, time = 0, reduced = false, width = 3840, height = 1280 }) {
  const strength = Math.max(0, Math.min(1, night));if (strength <= .001) return;
  ctx.save();ctx.globalAlpha *= strength;
  ctx.globalCompositeOperation = 'multiply';ctx.fillStyle = 'rgba(58,80,115,.40)';ctx.fillRect(0, 0, width, height);
  ctx.globalCompositeOperation = 'source-over';
  const sky = ctx.createLinearGradient(0, 0, 0, height * .69);
  sky.addColorStop(0, 'rgba(65,96,140,.29)');sky.addColorStop(.55, 'rgba(74,103,142,.16)');sky.addColorStop(1, 'rgba(74,103,142,0)');
  ctx.fillStyle = sky;ctx.fillRect(0, 0, width, height * .69);
  const layer = paintedLight(image);
  if (layer) {
    ctx.save();ctx.globalAlpha *= reduced ? 1 : .988 + Math.sin(time * .62) * .012;
    ctx.drawImage(layer, 0, 0, width, height);ctx.restore();
  }
  for (let i = 0; i < lanterns.length; i++) drawLanternGlow(ctx, lanterns[i], i, time, reduced);
  drawReflections(ctx, time, reduced, height);
  drawMoon(ctx);
  ctx.restore();
}
