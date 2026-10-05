import { FERRY_DOCKS, FERRY_DOCK_Y, FERRY_DECK_OFFSET, getFerryBerth, pathY } from './world.js';

function edgeWidth(y, shoreY) {
  return 15 + Math.max(0, Math.min(1, (y - shoreY) / (928 - shoreY))) * 8;
}

function drawRail(c, x, shoreY, side) {
  c.strokeStyle = side > 0 ? '#705b3e' : '#8b7350';c.lineWidth = 2.2;c.lineCap = 'round';
  // Posts follow the actual stepping surface, so a visitor stays between the
  // rails throughout the descent from the stone bank to the water landing.
  for (const y of [shoreY + 4, shoreY + 40, shoreY + 79, 927]) {
    const xx = x + edgeWidth(y, shoreY) * side;
    c.fillStyle = side > 0 ? '#8c7049' : '#ad9066';c.fillRect(xx - 1.8, y - 26, 3.6, 31);
    c.strokeStyle = '#665239a6';c.lineWidth = .75;c.strokeRect(xx - 1.8, y - 26, 3.6, 31);
    c.fillStyle = '#b9a078';c.beginPath();c.ellipse(xx, y - 26, 2.4, 1.6, 0, 0, Math.PI * 2);c.fill();
  }
  c.strokeStyle = side > 0 ? '#725e41' : '#a48b63';c.lineWidth = 2.6;
  c.beginPath();c.moveTo(x + side * 15, shoreY - 22);c.lineTo(x + side * 23, 905);c.stroke();
  c.strokeStyle = '#c6af85a6';c.lineWidth = .65;
  c.beginPath();c.moveTo(x + side * 15 - .8, shoreY - 23);c.lineTo(x + side * 23 - .8, 904);c.stroke();
}

function drawPier(c, x) {
  const shoreY = pathY(x);
  c.save();
  c.fillStyle = '#3f4c3a27';c.beginPath();c.ellipse(x + 4, 941, 34, 9, 0, 0, Math.PI * 2);c.fill();
  // Two piles carry the landing above the water; the descending stair covers
  // the vertical face of the painted quay rather than hovering over it.
  for (const offset of [-19, 19]) {
    c.fillStyle = '#796346';c.fillRect(x + offset - 2.3, 918, 4.6, 40);
    c.fillStyle = '#ad946e';c.fillRect(x + offset - 1.8, 918, 1.2, 38);
    c.strokeStyle = '#d5cbb572';c.lineWidth = .75;c.beginPath();c.ellipse(x + offset, 956, 9, 2, 0, 0, Math.PI * 2);c.stroke();
  }
  const timber = c.createLinearGradient(0, shoreY, 0, 932);
  timber.addColorStop(0, '#b39a70');timber.addColorStop(.6, '#a58b61');timber.addColorStop(1, '#baa077');
  c.fillStyle = timber;c.strokeStyle = '#796344';c.lineWidth = 1;
  c.beginPath();c.moveTo(x - 15, shoreY - 3);c.lineTo(x + 15, shoreY - 3);
  c.lineTo(x + 23, 930);c.lineTo(x - 23, 930);c.closePath();c.fill();c.stroke();
  for (let y = shoreY + 7; y < 918; y += 12) {
    const width = edgeWidth(y, shoreY);
    c.fillStyle = '#59473036';c.fillRect(x - width, y, width * 2, 2.3);
    c.strokeStyle = '#d6bd91a3';c.lineWidth = .8;c.beginPath();c.moveTo(x - width, y - 1);c.lineTo(x + width, y - 1);c.stroke();
    c.strokeStyle = '#775f3b50';c.lineWidth = .6;c.beginPath();c.moveTo(x - width + 4, y - 6);c.quadraticCurveTo(x, y - 5, x + width - 6, y - 6);c.stroke();
  }
  c.fillStyle = '#b8a078';c.fillRect(x - 23, 917, 46, 13);c.strokeStyle = '#705b3c';c.strokeRect(x - 23, 917, 46, 13);
  for (const y of [921, 926]) {c.strokeStyle = '#806941a0';c.lineWidth = .7;c.beginPath();c.moveTo(x - 22, y);c.lineTo(x + 22, y);c.stroke();}
  drawRail(c, x, shoreY, -1);
  c.restore();
}

function berthedDock(ferry) {
  if (!ferry || !['idle', 'ready', 'boarding', 'disembark'].includes(ferry.phase)) return null;
  return FERRY_DOCKS.find(x => {
    const berth = getFerryBerth(x);
    return Math.hypot(ferry.x - berth.x, ferry.y - berth.y) < 1;
  }) ?? null;
}

function drawPlank(c, dockX, ferry) {
  const deckY = ferry.y + FERRY_DECK_OFFSET;
  c.save();c.fillStyle = '#5d4a3030';c.fillRect(dockX - 8, 927, 18, deckY - 923);
  c.fillStyle = '#c1a679';c.strokeStyle = '#7b6341';c.lineWidth = .9;
  c.beginPath();c.moveTo(dockX - 8, 926);c.lineTo(dockX + 8, 926);c.lineTo(dockX + 9, deckY + 2);c.lineTo(dockX - 9, deckY + 2);c.closePath();c.fill();c.stroke();
  c.strokeStyle = '#82694091';c.lineWidth = .65;
  for (let y = 931; y < deckY; y += 6) {c.beginPath();c.moveTo(dockX - 7, y);c.lineTo(dockX + 7, y);c.stroke();}
  c.strokeStyle = '#dcc49b99';c.beginPath();c.moveTo(dockX - 1, 927);c.lineTo(dockX - 1, deckY);c.stroke();c.restore();
}

export function drawFerryDocks(ctx, { world, time = 0, reduced = false, foreground = false } = {}) {
  const ferry = world?.ferry, dockX = berthedDock(ferry);
  ctx.save();
  if (!foreground) {
    for (const x of FERRY_DOCKS) drawPier(ctx, x);
    if (dockX !== null) drawPlank(ctx, dockX, ferry);
  } else {
    for (const x of FERRY_DOCKS) drawRail(ctx, x, pathY(x), 1);
    if (dockX !== null) {
      const slack = reduced ? 0 : Math.sin(time * .65) * .7;
      ctx.strokeStyle = '#766448';ctx.lineWidth = 1.15;ctx.beginPath();
      ctx.moveTo(dockX + 23, 920);ctx.quadraticCurveTo(dockX + 27, 940 + slack, ferry.x + 68, FERRY_DOCK_Y - 2);ctx.stroke();
    }
  }
  ctx.restore();
}
