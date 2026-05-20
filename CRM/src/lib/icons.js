// Ícones desenhados como paths PDF (outline). Cobrimos só os que o voucher usa:
// pin (como chegar), check (check-in), clock (tolerância), instagram.
// Todos renderizados no quadrado (x, y, size) — y é a base do box, PDF convention.

function rounded(x, y, w, h, r) {
  const k = r * 0.5522847498;
  return [
    ['M', x + r, y + h],
    ['L', x + w - r, y + h],
    ['C', x + w - r + k, y + h, x + w, y + h - r + k, x + w, y + h - r],
    ['L', x + w, y + r],
    ['C', x + w, y + r - k, x + w - r + k, y, x + w - r, y],
    ['L', x + r, y],
    ['C', x + r - k, y, x, y + r - k, x, y + r],
    ['L', x, y + h - r],
    ['C', x, y + h - r + k, x + r - k, y + h, x + r, y + h],
    ['Z'],
  ];
}

function circlePath(cx, cy, r) {
  const k = r * 0.5522847498;
  return [
    ['M', cx - r, cy],
    ['C', cx - r, cy + k, cx - k, cy + r, cx, cy + r],
    ['C', cx + k, cy + r, cx + r, cy + k, cx + r, cy],
    ['C', cx + r, cy - k, cx + k, cy - r, cx, cy - r],
    ['C', cx - k, cy - r, cx - r, cy - k, cx - r, cy],
    ['Z'],
  ];
}

export function drawIcon(doc, name, x, y, size, color) {
  const s = size;
  const cx = x + s / 2;
  const lw = Math.max(0.9, s * 0.075);

  if (name === 'pin') {
    // Gota de água apontando pra baixo. Topo do círculo em y+s, ponta em y.
    const r = s * 0.36;
    const cy = y + s - r; // centro do círculo
    const k = r * 0.5522847498;
    // Path: começa no lado esquerdo do círculo, faz semicírculo até a direita,
    // depois desce em curva até a ponta (cx, y), e volta em curva.
    const cmds = [
      ['M', cx - r, cy],
      ['C', cx - r, cy + k, cx - k, cy + r, cx, cy + r],
      ['C', cx + k, cy + r, cx + r, cy + k, cx + r, cy],
      ['C', cx + r, cy - r * 0.6, cx + r * 0.6, y + s * 0.25, cx, y],
      ['C', cx - r * 0.6, y + s * 0.25, cx - r, cy - r * 0.6, cx - r, cy],
      ['Z'],
    ];
    doc.path(cmds, { stroke: color, lineWidth: lw });
    // Ponto interno (sólido).
    doc.circle(cx, cy, r * 0.30, { fill: color });
    return;
  }

  if (name === 'clock') {
    // Círculo (outline) + 2 ponteiros (12h e 4h).
    const r = s * 0.42;
    const cy = y + s / 2;
    doc.circle(cx, cy, r, { stroke: color, lineWidth: lw });
    // Ponteiro vertical (12).
    doc.line(cx, cy, cx, cy + r * 0.60, { color, width: lw });
    // Ponteiro horizontal (4 — pra direita e levemente baixo).
    doc.line(cx, cy, cx + r * 0.55, cy - r * 0.15, { color, width: lw });
    return;
  }

  if (name === 'stopwatch') {
    // Stopwatch: círculo + tampa + botão + ponteiro inclinado.
    const r = s * 0.36;
    const cy = y + s * 0.42;
    doc.circle(cx, cy, r, { stroke: color, lineWidth: lw });
    // Tampa: retângulo curto no topo.
    const tampaW = s * 0.22;
    const tampaH = s * 0.08;
    doc.line(cx - tampaW / 2, y + s - tampaH, cx + tampaW / 2, y + s - tampaH, { color, width: lw });
    // Hastes da tampa.
    doc.line(cx - tampaW / 2, y + s - tampaH, cx - tampaW / 2, cy + r - lw * 0.5, { color, width: lw });
    doc.line(cx + tampaW / 2, y + s - tampaH, cx + tampaW / 2, cy + r - lw * 0.5, { color, width: lw });
    // Botão central acima da tampa.
    doc.line(cx, y + s - tampaH, cx, y + s, { color, width: lw });
    // Ponteiro inclinado (centro → nordeste).
    doc.line(cx, cy, cx + r * 0.55, cy + r * 0.40, { color, width: lw });
    return;
  }

  if (name === 'instagram') {
    // Quadrado arredondado + círculo central + ponto.
    const pad = s * 0.10;
    const sq = s - pad * 2;
    const xq = x + pad;
    const yq = y + pad;
    doc.path(rounded(xq, yq, sq, sq, sq * 0.22), { stroke: color, lineWidth: lw });
    doc.circle(xq + sq / 2, yq + sq / 2, sq * 0.26, { stroke: color, lineWidth: lw });
    // Pontinho.
    doc.circle(xq + sq * 0.78, yq + sq * 0.78, sq * 0.055, { fill: color });
    return;
  }
}
