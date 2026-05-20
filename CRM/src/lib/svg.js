// Parser SVG mínimo (polygon, path com M/L/H/V/C/S/Z, rect) e renderer pro
// nosso PDF builder. Cobre o logo da Flor de Sal — não é parser SVG genérico.

const PATH_CMDS = new Set(['M','m','L','l','H','h','V','v','C','c','S','s','Z','z']);

function tokenize(d) {
  return d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) || [];
}

// Parseia atributo `d` de <path> em comandos PDF [['M',x,y],['L',x,y],['C',...],['Z']].
function parsePath(d) {
  const tokens = tokenize(d);
  const out = [];
  let i = 0, cx = 0, cy = 0, sx = 0, sy = 0;
  let lastC2x = null, lastC2y = null;
  let cmd = null;

  const num = () => parseFloat(tokens[i++]);

  while (i < tokens.length) {
    if (PATH_CMDS.has(tokens[i])) { cmd = tokens[i++]; }
    else if (cmd === 'M') cmd = 'L';
    else if (cmd === 'm') cmd = 'l';

    if (cmd === 'M' || cmd === 'm') {
      let x = num(), y = num();
      if (cmd === 'm') { x += cx; y += cy; }
      cx = x; cy = y; sx = x; sy = y;
      out.push(['M', x, y]);
      lastC2x = lastC2y = null;
    } else if (cmd === 'L' || cmd === 'l') {
      let x = num(), y = num();
      if (cmd === 'l') { x += cx; y += cy; }
      out.push(['L', x, y]); cx = x; cy = y; lastC2x = lastC2y = null;
    } else if (cmd === 'H' || cmd === 'h') {
      let x = num();
      if (cmd === 'h') x += cx;
      out.push(['L', x, cy]); cx = x; lastC2x = lastC2y = null;
    } else if (cmd === 'V' || cmd === 'v') {
      let y = num();
      if (cmd === 'v') y += cy;
      out.push(['L', cx, y]); cy = y; lastC2x = lastC2y = null;
    } else if (cmd === 'C' || cmd === 'c') {
      let x1 = num(), y1 = num(), x2 = num(), y2 = num(), x = num(), y = num();
      if (cmd === 'c') { x1 += cx; y1 += cy; x2 += cx; y2 += cy; x += cx; y += cy; }
      out.push(['C', x1, y1, x2, y2, x, y]);
      lastC2x = x2; lastC2y = y2; cx = x; cy = y;
    } else if (cmd === 'S' || cmd === 's') {
      let x2 = num(), y2 = num(), x = num(), y = num();
      if (cmd === 's') { x2 += cx; y2 += cy; x += cx; y += cy; }
      const x1 = lastC2x != null ? 2 * cx - lastC2x : cx;
      const y1 = lastC2y != null ? 2 * cy - lastC2y : cy;
      out.push(['C', x1, y1, x2, y2, x, y]);
      lastC2x = x2; lastC2y = y2; cx = x; cy = y;
    } else if (cmd === 'Z' || cmd === 'z') {
      out.push(['Z']);
      cx = sx; cy = sy; lastC2x = lastC2y = null;
    } else {
      // Comando não suportado — abandona pra não loopar.
      break;
    }
  }
  return out;
}

function parsePolygonPoints(pointsStr) {
  const nums = (pointsStr.match(/-?\d*\.?\d+/g) || []).map(parseFloat);
  if (nums.length < 4) return [];
  const cmds = [['M', nums[0], nums[1]]];
  for (let i = 2; i < nums.length; i += 2) cmds.push(['L', nums[i], nums[i+1]]);
  cmds.push(['Z']);
  return cmds;
}

// Parser cru de tags <polygon>, <path>, <rect> + viewBox.
export function parseSvg(svgString) {
  const vbMatch = /viewBox\s*=\s*"([^"]+)"/.exec(svgString);
  const viewBox = vbMatch
    ? vbMatch[1].trim().split(/\s+/).map(parseFloat)
    : [0, 0, 100, 100];

  const shapes = [];
  const re = /<(polygon|path|rect)\b([^>]*)\/?>/g;
  let m;
  while ((m = re.exec(svgString)) !== null) {
    const tag = m[1];
    const attrs = m[2];
    if (tag === 'polygon') {
      const p = /points\s*=\s*"([^"]+)"/.exec(attrs);
      if (p) shapes.push({ cmds: parsePolygonPoints(p[1]) });
    } else if (tag === 'path') {
      const d = /\bd\s*=\s*"([^"]+)"/.exec(attrs);
      if (d) shapes.push({ cmds: parsePath(d[1]) });
    } else if (tag === 'rect') {
      const x = parseFloat(/\bx\s*=\s*"([^"]+)"/.exec(attrs)?.[1] || '0');
      const y = parseFloat(/\by\s*=\s*"([^"]+)"/.exec(attrs)?.[1] || '0');
      const w = parseFloat(/\bwidth\s*=\s*"([^"]+)"/.exec(attrs)?.[1] || '0');
      const h = parseFloat(/\bheight\s*=\s*"([^"]+)"/.exec(attrs)?.[1] || '0');
      shapes.push({ cmds: [
        ['M', x, y], ['L', x + w, y], ['L', x + w, y + h], ['L', x, y + h], ['Z'],
      ]});
    }
  }
  return { viewBox, shapes };
}

// Desenha SVG no PDF dentro do retângulo (x, y, w, h) com cor `color`.
// SVG y aponta pra baixo; PDF y aponta pra cima — aplicamos flip via CTM.
// `align` controla âncora vertical: 'top'|'middle'|'bottom' (default 'middle').
export function drawSvg(doc, svgString, { x, y, w, color, align = 'middle' } = {}) {
  const { viewBox, shapes } = parseSvg(svgString);
  const [vx, vy, vw, vh] = viewBox;
  const s = w / vw;
  const h = vh * s;
  // (x, y) é o ponto BASE-ESQUERDA do logo no espaço PDF.
  // Transform: a=s, b=0, c=0, d=-s, e=x-s*vx, f=y+h+s*vy
  doc.save();
  doc.transform(s, 0, 0, -s, x - s * vx, y + h + s * vy);
  for (const sh of shapes) {
    doc.path(sh.cmds, { fill: color });
  }
  doc.restore();
  return { width: w, height: h };
}
