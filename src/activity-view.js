import { clamp, lerp, smooth, pathY } from './world.js';

const TAU = Math.PI * 2;
const ink = '#66513b';
const random = seed => {
  const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
};

function ellipse(ctx, x, y, rx, ry, fill, stroke = null) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
}

function cup(ctx, x, y, fill = '#eadbc0') {
  ctx.fillStyle = fill;
  ctx.strokeStyle = ink;
  ctx.lineWidth = .9;
  ctx.beginPath();
  ctx.moveTo(x - 7, y);ctx.lineTo(x + 7, y);ctx.lineTo(x + 5, y + 8);
  ctx.quadraticCurveTo(x, y + 11, x - 5, y + 8);ctx.closePath();
  ctx.fill();ctx.stroke();
  ellipse(ctx, x, y, 7, 2.4, '#916b37', '#a28a65');
}

function steam(ctx, x, y, age, reduced, strength = 1) {
  ctx.save();
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = `rgba(243,236,215,${strength * .78})`;
  for (let i = 0; i < 3; i++) {
    const sway = reduced ? i - 1 : Math.sin(age * 1.6 + i) * 4;
    const rise = reduced ? 0 : (age * 4 + i * 5) % 9;
    ctx.beginPath();
    ctx.moveTo(x - 5 + i * 5, y - 4 - rise);
    ctx.bezierCurveTo(x + sway - 8 + i * 5, y - 11 - rise,
      x + sway + 4 + i * 4, y - 19 - rise, x - 4 + i * 5, y - 27 - rise);
    ctx.stroke();
  }
  ctx.restore();
}

function teapot(ctx, x, y, tilt = 0) {
  ctx.save();ctx.translate(x, y);ctx.rotate(tilt);
  ctx.lineWidth = 1.1;ctx.strokeStyle = ink;
  ctx.beginPath();ctx.arc(8, -4, 11, -1.8, 1.8);ctx.stroke();
  ctx.fillStyle = '#9c7751';
  ctx.beginPath();ctx.moveTo(-10, -7);ctx.lineTo(-19, -14);ctx.lineTo(-24, -14);ctx.lineTo(-16, -3);ctx.closePath();ctx.fill();ctx.stroke();
  ellipse(ctx, 0, 0, 14, 11, '#b69267', ink);
  ellipse(ctx, 0, -9, 9, 2.8, '#d0b081', ink);
  ellipse(ctx, 0, -13, 2.4, 2.7, '#93724e', ink);
  ctx.strokeStyle = '#e0c29266';ctx.beginPath();ctx.arc(-1, -1, 9, 2.8, 4.2);ctx.stroke();
  ctx.restore();
}

function drawTea(ctx, { x, y, face, elapsed, time, reduced, choice, choiceAge }) {
  const pouring = elapsed < 1.8;
  const sip = choice === 'sip' && choiceAge < 2.5;
  ctx.save();ctx.translate(x, y);ctx.scale(face, 1);
  ellipse(ctx, 84, 6, 63, 9, '#58472d21');
  ctx.strokeStyle = ink;ctx.lineWidth = 1.5;ctx.fillStyle = '#90704d';
  ctx.fillRect(37, -23, 8, 29);ctx.fillRect(127, -23, 8, 29);
  ctx.strokeRect(37, -23, 8, 29);ctx.strokeRect(127, -23, 8, 29);
  ctx.fillStyle = '#b19469';
  ctx.beginPath();ctx.moveTo(29, -37);ctx.lineTo(132, -37);ctx.lineTo(145, -25);ctx.lineTo(22, -25);ctx.closePath();ctx.fill();ctx.stroke();
  ctx.fillStyle = '#96764f';ctx.fillRect(22, -25, 123, 6);ctx.strokeRect(22, -25, 123, 6);
  ctx.strokeStyle = '#6f593d55';
  for (let line = 0; line < 3; line++) {
    ctx.beginPath();ctx.moveTo(35 + line * 2, -34 + line * 3);ctx.lineTo(128, -34 + line * 3);ctx.stroke();
  }
  ellipse(ctx, 54, -29, 13, 3.5, '#d5c49f', '#86704e');
  cup(ctx, 54, -38);cup(ctx, 118, -37, '#d5dfc8');
  const lift = pouring && !reduced ? Math.sin(clamp(elapsed / 1.8, 0, 1) * Math.PI) * 12 : 0;
  teapot(ctx, 92, -43 - lift, pouring && !reduced ? -.22 : 0);
  if (pouring) {
    ctx.strokeStyle = '#d8bc808f';ctx.lineWidth = 1.6;
    ctx.beginPath();ctx.moveTo(67, -56 - lift);ctx.quadraticCurveTo(58, -50 - lift * .35, 54, -38);ctx.stroke();
  }
  steam(ctx, 54, -38, time, reduced, sip ? 1 : .75);
  steam(ctx, 118, -37, time + 2, reduced, .45);
  ctx.restore();
  return { stage: pouring ? 'pouring' : sip ? 'sipping' : 'tea-ready', birds: 0, grains: 0 };
}

function sparrow(ctx, { x, y, direction, flying, peck, time, seed, reduced, opacity }) {
  ctx.save();ctx.globalAlpha *= opacity;ctx.translate(x, y);ctx.scale(direction, 1);ctx.lineWidth = 1;
  if (!flying) {
    ellipse(ctx, 0, 2, 9, 2.2, '#50452c20');
    ctx.strokeStyle = '#725433';
    ctx.beginPath();ctx.moveTo(-3, -2);ctx.lineTo(-3, 2);ctx.lineTo(-6, 2);ctx.moveTo(2, -2);ctx.lineTo(2, 2);ctx.lineTo(5, 2);ctx.stroke();
  }
  ctx.fillStyle = '#826b4d';ctx.strokeStyle = '#655439';
  ctx.beginPath();ctx.moveTo(-6, -7);ctx.lineTo(-15, -11);ctx.lineTo(-11, -4);ctx.closePath();ctx.fill();ctx.stroke();
  ellipse(ctx, 0, -6, 8, 5, '#988361', '#655439');
  ctx.fillStyle = '#695b43';
  ctx.beginPath();ctx.moveTo(-6, -8);ctx.quadraticCurveTo(0, -13, 5, -7);ctx.quadraticCurveTo(0, -4, -6, -5);ctx.fill();
  const headY = -12 + (peck && !reduced ? (1 + Math.sin(time * 9 + seed)) * 3 : peck ? 5 : 0);
  ellipse(ctx, 6, headY, 4.3, 4.2, '#746245', '#655439');
  ellipse(ctx, 7, headY + 1, 2.6, 2.1, '#e1cdb0');
  ellipse(ctx, 8, headY - 1, .7, .7, '#3d382c');
  ctx.fillStyle = '#b18b49';
  ctx.beginPath();ctx.moveTo(10, headY);ctx.lineTo(14, headY + 1);ctx.lineTo(10, headY + 2);ctx.closePath();ctx.fill();
  if (flying) {
    const flap = reduced ? 9 : 6 + Math.sin(time * 17 + seed) * 7;
    ctx.strokeStyle = '#7c684b';ctx.lineWidth = 2;
    ctx.beginPath();ctx.moveTo(-2, -8);ctx.quadraticCurveTo(-10, -15 - flap, -14, -12 - flap);ctx.moveTo(1, -8);ctx.quadraticCurveTo(8, -17 - flap, 13, -13 - flap);ctx.stroke();
  }
  ctx.restore();
}

function drawFeed(ctx, { x, y, face, progress, time, reduced }) {
  const scattering = progress < .18;
  const departing = progress > .76;
  let birdCount = 0;
  ctx.save();ctx.translate(x, y);
  const scatter = smooth(clamp(progress / .18, 0, 1));
  const grainOpacity = departing ? 1 - clamp((progress - .82) / .18, 0, 1) : .9;
  for (let i = 0; i < 22; i++) {
    const landingX = face * (22 + random(i + 30) * 90);
    const landingY = pathY(x + landingX) - y + 2 + random(i + 50) * 5;
    const local = reduced ? 1 : clamp(scatter * 1.4 - random(i + 70) * .35, 0, 1);
    const grainX = lerp(face * 12, landingX, local);
    const grainY = lerp(-34, landingY, local) - Math.sin(local * Math.PI) * 16;
    ctx.globalAlpha = grainOpacity;
    ellipse(ctx, grainX, grainY, 1.3 + random(i + 10) * .7, .8, i % 3 ? '#c0a263' : '#967644');
  }
  ctx.globalAlpha = 1;
  for (let i = 0; i < 7; i++) {
    const landingX = face * (32 + random(i + 120) * 76);
    const landingY = pathY(x + landingX) - y + 3 + random(i + 140) * 5;
    const side = i % 2 ? 1 : -1;
    const arrival = smooth(clamp((progress - i * .012) / .25, 0, 1));
    const departure = smooth(clamp((progress - .76 - i * .008) / .18, 0, 1));
    const birdX = reduced ? landingX : lerp(landingX + side * 125, landingX, arrival) + side * departure * 150;
    const birdY = reduced ? landingY : lerp(-45 - i * 6, landingY, arrival) - departure * (65 + i * 6);
    const opacity = reduced ? 1 : Math.min(1, arrival * 3) * (1 - departure);
    if (opacity > .05) birdCount++;
    sparrow(ctx, {
      x: birdX, y: birdY, direction: birdX > face * 60 ? -1 : 1,
      flying: !reduced && (arrival < .97 || departure > .03),
      peck: arrival > .97 && departure < .03, time, seed: i, reduced, opacity,
    });
  }
  ctx.restore();
  return { stage: scattering ? 'scattering' : departing ? 'birds-departing' : 'birds-pecking', birds: birdCount, grains: grainOpacity > .05 ? 22 : 0 };
}

function drawMarket(ctx, { x, y, face, choice, time, reduced }) {
  ctx.save();ctx.translate(x + face * 62, y);ctx.scale(face, 1);
  ellipse(ctx, 18, 5, 62, 10, '#58472d21');
  ctx.fillStyle = '#9d7c53';ctx.strokeStyle = ink;ctx.lineWidth = 1.2;
  ctx.fillRect(-33, -32, 101, 32);ctx.strokeRect(-33, -32, 101, 32);
  ctx.fillStyle = '#baa075';
  ctx.beginPath();ctx.moveTo(-40, -42);ctx.lineTo(59, -42);ctx.lineTo(72, -32);ctx.lineTo(-33, -32);ctx.closePath();ctx.fill();ctx.stroke();
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = ['#99735d', '#7c917f', '#aaa27a'][i];
    ctx.fillRect(-29, -48 - i * 7, 34 - i * 3, 7);ctx.strokeRect(-29, -48 - i * 7, 34 - i * 3, 7);
    ellipse(ctx, -29, -44.5 - i * 7, 3, 3.5, '#d3c29d', ink);
  }
  teapot(ctx, 23, -45);cup(ctx, 48, -42, '#d4dfcb');
  ctx.fillStyle = '#b69b68';ctx.fillRect(46, -26, 14, 18);ctx.strokeRect(46, -26, 14, 18);
  ctx.strokeStyle = '#6f6446';
  ctx.beginPath();ctx.moveTo(53, -23);ctx.quadraticCurveTo(46, -18, 53, -14);ctx.quadraticCurveTo(59, -18, 53, -23);ctx.stroke();
  if (choice) {
    const chosenX = choice === 'silk' ? -12 : choice === 'tea' ? 53 : 23;
    const chosenY = choice === 'tea' ? -17 : -49;
    ctx.strokeStyle = '#bc8c4b';ctx.lineWidth = 1.2;
    const radius = 20 + (reduced ? 0 : Math.sin(time * 1.4) * 1.5);
    ctx.beginPath();ctx.ellipse(chosenX, chosenY, radius, radius * .65, 0, 0, TAU);ctx.stroke();
  }
  ctx.restore();
  return { stage: choice ? 'goods-selected' : 'market-ready', birds: 0, grains: 0 };
}

// Call within the renderer's world-coordinate transform, before painting the hero.
// Props and wildlife are drawn here; people.js remains responsible for characters.
export function drawActivity(ctx, { world = {}, time = world.time ?? 0, reduced = false,
  elapsed = world.timer ?? 0, duration = world.activity?.duration ?? 12,
  x = world.x ?? 0, y = world.y ?? 0 } = {}) {
  const kind = world.mode;
  if (!['tea', 'feed', 'shop'].includes(kind)) return { kind: null, stage: 'idle', progress: 0, birds: 0, grains: 0 };
  const progress = clamp(elapsed / Math.max(duration, .1), 0, 1);
  const options = {
    x, y, time, reduced, elapsed, progress, face: world.face < 0 ? -1 : 1,
    choice: world.activity?.choice ?? '', choiceAge: time - (world.activity?.choiceAt ?? -100),
  };
  const details = kind === 'tea' ? drawTea(ctx, options) : kind === 'feed' ? drawFeed(ctx, options) : drawMarket(ctx, options);
  return { kind, progress, ...details };
}
