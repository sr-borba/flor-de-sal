// Gerador de PDF mínimo, zero dependências, otimizado para vouchers do CRM.
//
// Escopo: A4 retrato, 1+ páginas, fontes Type1 base (Helvetica, Helvetica-Bold,
// Times-Italic, Times-Bold), cor RGB de preenchimento e traço, linhas, texto
// posicionado e link clicável (annotation /URI).
//
// Encoding: WinAnsi (cp1252) — cobre todos os acentos do português.
// Caracteres fora do cp1252 viram '?' (não temos esse caso aqui).

export const A4 = { width: 595.28, height: 841.89 };
export const CM = 28.3464567; // 1cm em pt
export const MARGIN = 2 * CM; // 56.69 pt

// ─── cp1252 + escape de string PDF ────────────────────────────────────
// Diferenças do unicode para cp1252 no range 0x80–0x9F + ligaduras.
const CP1252_EXTRA = {
  0x152: 0x8C, 0x153: 0x9C, 0x160: 0x8A, 0x161: 0x9A,
  0x178: 0x9F, 0x17D: 0x8E, 0x17E: 0x9E, 0x192: 0x83,
  0x2C6: 0x88, 0x2DC: 0x98,
  0x2013: 0x96, 0x2014: 0x97, 0x2018: 0x91, 0x2019: 0x92,
  0x201A: 0x82, 0x201C: 0x93, 0x201D: 0x94, 0x201E: 0x84,
  0x2020: 0x86, 0x2021: 0x87, 0x2022: 0x95, 0x2026: 0x85,
  0x2030: 0x89, 0x2039: 0x8B, 0x203A: 0x9B,
  0x20AC: 0x80, 0x2122: 0x99,
  0xA0: 0xA0, 0xB7: 0xB7,
};

function toCp1252Bytes(s) {
  const out = [];
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    if (code < 0x80) out.push(code);
    else if (code >= 0xA0 && code <= 0xFF) out.push(code);
    else if (CP1252_EXTRA[code] !== undefined) out.push(CP1252_EXTRA[code]);
    else out.push(0x3F);
  }
  return out;
}

export function pdfString(s) {
  const bytes = toCp1252Bytes(s);
  let r = '';
  for (const b of bytes) {
    if (b === 0x28) r += '\\(';
    else if (b === 0x29) r += '\\)';
    else if (b === 0x5C) r += '\\\\';
    else if (b < 0x20 || b >= 0x7F) r += '\\' + b.toString(8).padStart(3, '0');
    else r += String.fromCharCode(b);
  }
  return '(' + r + ')';
}

// ─── Métricas de fontes (Adobe AFM, em 1/1000 em) ─────────────────────
// Apenas chars que usamos. Default 500 para qualquer outro.
// Helvetica.
const W_HELV = {
  32:278, 33:278, 34:355, 35:556, 37:889, 38:667, 39:191, 40:333, 41:333,
  44:278, 45:333, 46:278, 47:278,
  48:556,49:556,50:556,51:556,52:556,53:556,54:556,55:556,56:556,57:556,
  58:278, 59:278, 63:556,
  65:667,66:667,67:722,68:722,69:667,70:611,71:778,72:722,73:278,74:500,
  75:667,76:556,77:833,78:722,79:778,80:667,81:778,82:722,83:667,84:611,
  85:722,86:667,87:944,88:667,89:667,90:611,
  97:556,98:556,99:500,100:556,101:556,102:278,103:556,104:556,105:222,
  106:222,107:500,108:222,109:833,110:556,111:556,112:556,113:556,114:333,
  115:500,116:278,117:556,118:500,119:722,120:500,121:500,122:500,
  // acentos
  192:667,193:667,194:667,195:667,196:667,199:722,
  201:667,202:667,205:278,
  211:778,212:778,213:778,
  218:722,
  224:556,225:556,226:556,227:556,228:556,231:500,
  233:556,234:556,237:222,
  243:556,244:556,245:556,
  250:556,
};
const W_HELV_BOLD = {
  32:278, 33:333, 34:474, 35:556, 37:889, 38:722, 39:238, 40:333, 41:333,
  44:278, 45:333, 46:278, 47:278,
  48:556,49:556,50:556,51:556,52:556,53:556,54:556,55:556,56:556,57:556,
  58:333, 59:333, 63:611,
  65:722,66:722,67:722,68:722,69:667,70:611,71:778,72:722,73:278,74:556,
  75:722,76:611,77:833,78:722,79:778,80:667,81:778,82:722,83:667,84:611,
  85:722,86:667,87:944,88:667,89:667,90:611,
  97:556,98:611,99:556,100:611,101:556,102:333,103:611,104:611,105:278,
  106:278,107:556,108:278,109:889,110:611,111:611,112:611,113:611,114:389,
  115:556,116:333,117:611,118:556,119:778,120:556,121:556,122:500,
  192:722,193:722,194:722,195:722,196:722,199:722,
  201:667,202:667,205:278,
  211:778,212:778,213:778,
  218:722,
  224:556,225:556,226:556,227:556,228:556,231:556,
  233:556,234:556,237:278,
  243:611,244:611,245:611,
  250:611,
};
const W_TIMES_ITALIC = {
  32:250, 33:333, 34:420, 38:778, 39:214, 40:333, 41:333,
  44:250, 45:333, 46:250, 47:278,
  48:500,49:500,50:500,51:500,52:500,53:500,54:500,55:500,56:500,57:500,
  58:333, 59:333, 63:500,
  65:611,66:611,67:667,68:722,69:611,70:611,71:722,72:722,73:333,74:444,
  75:667,76:556,77:833,78:667,79:722,80:611,81:722,82:611,83:500,84:556,
  85:722,86:611,87:833,88:611,89:556,90:556,
  97:500,98:500,99:444,100:500,101:444,102:278,103:500,104:500,105:278,
  106:278,107:444,108:278,109:722,110:500,111:500,112:500,113:500,114:389,
  115:389,116:278,117:500,118:444,119:667,120:444,121:444,122:389,
  192:611,193:611,194:611,195:611,196:611,199:667,
  201:611,202:611,205:333,
  211:722,212:722,213:722,
  218:722,
  224:500,225:500,226:500,227:500,228:500,231:444,
  233:444,234:444,237:278,
  243:500,244:500,245:500,
  250:500,
};
const W_TIMES_BOLD = {
  32:250, 33:333, 34:555, 38:833, 39:333, 40:333, 41:333,
  44:250, 45:333, 46:250, 47:278,
  48:500,49:500,50:500,51:500,52:500,53:500,54:500,55:500,56:500,57:500,
  58:333, 59:333, 63:500,
  65:722,66:667,67:722,68:722,69:667,70:611,71:778,72:778,73:389,74:500,
  75:778,76:667,77:944,78:722,79:778,80:611,81:778,82:722,83:556,84:667,
  85:722,86:722,87:1000,88:722,89:722,90:667,
  97:500,98:556,99:444,100:556,101:444,102:333,103:500,104:556,105:278,
  106:333,107:556,108:278,109:833,110:556,111:500,112:556,113:556,114:444,
  115:389,116:333,117:556,118:500,119:722,120:500,121:500,122:444,
  192:722,193:722,194:722,195:722,196:722,199:722,
  201:667,202:667,205:389,
  211:778,212:778,213:778,
  218:722,
  224:500,225:500,226:500,227:500,228:500,231:444,
  233:444,234:444,237:278,
  243:500,244:500,245:500,
  250:556,
};

const FONT_DEFS = {
  helv:     { name: 'Helvetica',      widths: W_HELV },
  helvBold: { name: 'Helvetica-Bold', widths: W_HELV_BOLD },
  timesIt:  { name: 'Times-Italic',   widths: W_TIMES_ITALIC },
  timesBold:{ name: 'Times-Bold',     widths: W_TIMES_BOLD },
};

export function textWidth(s, fontKey, size) {
  const widths = (FONT_DEFS[fontKey] || FONT_DEFS.helv).widths;
  const bytes = toCp1252Bytes(s);
  let total = 0;
  for (const b of bytes) total += (widths[b] != null ? widths[b] : 500);
  return (total / 1000) * size;
}

// ─── Builder ──────────────────────────────────────────────────────────
// Cada doc tem 1+ páginas; cada página tem operadores no content stream.
// Anotações (links) ficam por página.
export function createDoc({ width = A4.width, height = A4.height } = {}) {
  const pages = [];
  let cur = newPage();

  function newPage() {
    return { ops: [], annots: [] };
  }
  function startPage() {
    cur = newPage();
    pages.push(cur);
    return cur;
  }
  startPage();

  function op(line) { cur.ops.push(line); }

  // Cores no formato CSS hex (#RRGGBB) ou triple [r,g,b] em 0–1.
  function parseColor(c) {
    if (Array.isArray(c)) return c;
    const m = /^#([0-9a-f]{6})$/i.exec(c);
    if (!m) return [0, 0, 0];
    const n = parseInt(m[1], 16);
    return [((n >> 16) & 0xff) / 255, ((n >> 8) & 0xff) / 255, (n & 0xff) / 255];
  }
  function fmt(n) { return (Math.round(n * 100) / 100).toString(); }

  return {
    width, height,
    addPage() { startPage(); },

    text(s, { x, y, font = 'helv', size = 11, color = '#000000' } = {}) {
      const [r, g, b] = parseColor(color);
      const f = FONT_DEFS[font] ? font : 'helv';
      op('BT');
      op(`${fmt(r)} ${fmt(g)} ${fmt(b)} rg`);
      op(`/${f} ${fmt(size)} Tf`);
      op(`1 0 0 1 ${fmt(x)} ${fmt(y)} Tm`);
      op(`${pdfString(s)} Tj`);
      op('ET');
    },

    // Texto centralizado horizontalmente entre x1 e x2.
    textCenter(s, { x1, x2, y, font = 'helv', size = 11, color = '#000000', letterSpacing = 0 } = {}) {
      const w = textWidth(s, font, size) + letterSpacing * (s.length - 1);
      const x = x1 + ((x2 - x1) - w) / 2;
      if (letterSpacing) {
        const [r, g, b] = parseColor(color);
        const f = FONT_DEFS[font] ? font : 'helv';
        op('BT');
        op(`${fmt(r)} ${fmt(g)} ${fmt(b)} rg`);
        op(`/${f} ${fmt(size)} Tf`);
        op(`${fmt(letterSpacing)} Tc`);
        op(`1 0 0 1 ${fmt(x)} ${fmt(y)} Tm`);
        op(`${pdfString(s)} Tj`);
        op('0 Tc');
        op('ET');
      } else {
        this.text(s, { x, y, font, size, color });
      }
    },

    line(x1, y1, x2, y2, { color = '#000000', width: lw = 0.5 } = {}) {
      const [r, g, b] = parseColor(color);
      op(`${fmt(r)} ${fmt(g)} ${fmt(b)} RG`);
      op(`${fmt(lw)} w`);
      op(`${fmt(x1)} ${fmt(y1)} m`);
      op(`${fmt(x2)} ${fmt(y2)} l`);
      op('S');
    },

    // Retângulo preenchido (fundo, badges sólidos).
    fillRect(x, y, w, h, color = '#000000') {
      const [r, g, b] = parseColor(color);
      op(`${fmt(r)} ${fmt(g)} ${fmt(b)} rg`);
      op(`${fmt(x)} ${fmt(y)} ${fmt(w)} ${fmt(h)} re`);
      op('f');
    },

    // Retângulo com cantos arredondados (preenche e/ou contorna).
    // r = raio do canto. Para pill, passar r = h/2.
    roundedRect(x, y, w, h, r, { fill, stroke, lineWidth = 1 } = {}) {
      const rad = Math.min(r, h / 2, w / 2);
      const k = rad * 0.5522847498; // ponto de controle do círculo via bezier
      // Path partindo do canto superior-esquerdo, sentido horário.
      op(`${fmt(x + rad)} ${fmt(y + h)} m`);
      op(`${fmt(x + w - rad)} ${fmt(y + h)} l`);
      op(`${fmt(x + w - rad + k)} ${fmt(y + h)} ${fmt(x + w)} ${fmt(y + h - rad + k)} ${fmt(x + w)} ${fmt(y + h - rad)} c`);
      op(`${fmt(x + w)} ${fmt(y + rad)} l`);
      op(`${fmt(x + w)} ${fmt(y + rad - k)} ${fmt(x + w - rad + k)} ${fmt(y)} ${fmt(x + w - rad)} ${fmt(y)} c`);
      op(`${fmt(x + rad)} ${fmt(y)} l`);
      op(`${fmt(x + rad - k)} ${fmt(y)} ${fmt(x)} ${fmt(y + rad - k)} ${fmt(x)} ${fmt(y + rad)} c`);
      op(`${fmt(x)} ${fmt(y + h - rad)} l`);
      op(`${fmt(x)} ${fmt(y + h - rad + k)} ${fmt(x + rad - k)} ${fmt(y + h)} ${fmt(x + rad)} ${fmt(y + h)} c`);
      op('h');
      if (fill && stroke) {
        const [fr, fg, fb] = parseColor(fill);
        const [sr, sg, sb] = parseColor(stroke);
        op(`${fmt(fr)} ${fmt(fg)} ${fmt(fb)} rg`);
        op(`${fmt(sr)} ${fmt(sg)} ${fmt(sb)} RG`);
        op(`${fmt(lineWidth)} w`);
        op('B');
      } else if (fill) {
        const [fr, fg, fb] = parseColor(fill);
        op(`${fmt(fr)} ${fmt(fg)} ${fmt(fb)} rg`);
        op('f');
      } else if (stroke) {
        const [sr, sg, sb] = parseColor(stroke);
        op(`${fmt(sr)} ${fmt(sg)} ${fmt(sb)} RG`);
        op(`${fmt(lineWidth)} w`);
        op('S');
      }
    },

    // Link clicável (annotation). Coords em pt (PDF: y de baixo p/ cima).
    link({ x, y, w, h, url }) {
      cur.annots.push({ rect: [x, y, x + w, y + h], url });
    },

    // Estado gráfico — usado para aplicar transform local (SVG, ícones).
    save() { op('q'); },
    restore() { op('Q'); },
    // Matriz CTM: x' = a*x + c*y + e, y' = b*x + d*y + f.
    transform(a, b, c, d, e, f) {
      op(`${fmt(a)} ${fmt(b)} ${fmt(c)} ${fmt(d)} ${fmt(e)} ${fmt(f)} cm`);
    },

    // Desenha path arbitrário a partir de array de comandos.
    // Cada comando: ['M', x, y] | ['L', x, y] | ['C', x1, y1, x2, y2, x, y] | ['Z'].
    // Coordenadas em pt no espaço atual (respeita transform via save/restore).
    path(cmds, { fill, stroke, lineWidth = 1, evenOdd = false } = {}) {
      for (const c of cmds) {
        const t = c[0];
        if (t === 'M') op(`${fmt(c[1])} ${fmt(c[2])} m`);
        else if (t === 'L') op(`${fmt(c[1])} ${fmt(c[2])} l`);
        else if (t === 'C') op(`${fmt(c[1])} ${fmt(c[2])} ${fmt(c[3])} ${fmt(c[4])} ${fmt(c[5])} ${fmt(c[6])} c`);
        else if (t === 'Z') op('h');
      }
      if (fill && stroke) {
        const [fr, fg, fb] = parseColor(fill);
        const [sr, sg, sb] = parseColor(stroke);
        op(`${fmt(fr)} ${fmt(fg)} ${fmt(fb)} rg`);
        op(`${fmt(sr)} ${fmt(sg)} ${fmt(sb)} RG`);
        op(`${fmt(lineWidth)} w`);
        op(evenOdd ? 'B*' : 'B');
      } else if (fill) {
        const [fr, fg, fb] = parseColor(fill);
        op(`${fmt(fr)} ${fmt(fg)} ${fmt(fb)} rg`);
        op(evenOdd ? 'f*' : 'f');
      } else if (stroke) {
        const [sr, sg, sb] = parseColor(stroke);
        op(`${fmt(sr)} ${fmt(sg)} ${fmt(sb)} RG`);
        op(`${fmt(lineWidth)} w`);
        op('S');
      }
    },

    // Círculo aproximado via 4 curvas bezier.
    circle(cx, cy, r, options) {
      const k = r * 0.5522847498;
      const cmds = [
        ['M', cx - r, cy],
        ['C', cx - r, cy + k, cx - k, cy + r, cx, cy + r],
        ['C', cx + k, cy + r, cx + r, cy + k, cx + r, cy],
        ['C', cx + r, cy - k, cx + k, cy - r, cx, cy - r],
        ['C', cx - k, cy - r, cx - r, cy - k, cx - r, cy],
        ['Z'],
      ];
      this.path(cmds, options);
    },

    // Serializa o documento para Uint8Array.
    build() {
      return buildPdf({ width, height, pages });
    },
  };
}

// ─── Serialização ─────────────────────────────────────────────────────
function buildPdf({ width, height, pages }) {
  // Estrutura de objetos:
  //  1 Catalog
  //  2 Pages (kids/count)
  //  3..3+N-1 Page objects
  //  block fontes (4 objetos)
  //  block content streams (N objetos)
  //  block link annotations (variável)
  const fontKeys = Object.keys(FONT_DEFS); // helv, helvBold, timesIt, timesBold
  const objects = []; // será preenchido; índice 0 não é usado.
  objects.push(null); // 0

  // Reserva slots: 1 catalog, 2 pages, depois alocamos.
  const CATALOG_ID = 1;
  const PAGES_ID = 2;
  objects[CATALOG_ID] = null;
  objects[PAGES_ID] = null;

  // Fontes — alocadas após o bloco de páginas (precisamos saber ids para Resources).
  // Estratégia: alocar os ids agora em ordem fixa.
  const fontIds = {};
  let nextId = 3;
  for (const k of fontKeys) {
    fontIds[k] = nextId++;
    objects[fontIds[k]] = null;
  }

  // Page objects + content streams + annotations.
  const pageIds = [];
  const contentIds = [];
  const annotIds = []; // [{ pageIdx, ids: [...] }]

  for (let i = 0; i < pages.length; i++) {
    pageIds.push(nextId++);
    contentIds.push(nextId++);
    objects[pageIds[i]] = null;
    objects[contentIds[i]] = null;
    const ids = [];
    for (let a = 0; a < pages[i].annots.length; a++) {
      const id = nextId++;
      ids.push(id);
      objects[id] = null;
    }
    annotIds.push(ids);
  }

  // 1) Catalog
  objects[CATALOG_ID] = `<< /Type /Catalog /Pages ${PAGES_ID} 0 R >>`;

  // 2) Pages
  objects[PAGES_ID] =
    `<< /Type /Pages /Kids [ ${pageIds.map((id) => `${id} 0 R`).join(' ')} ] ` +
    `/Count ${pageIds.length} >>`;

  // Fontes
  for (const k of fontKeys) {
    objects[fontIds[k]] =
      `<< /Type /Font /Subtype /Type1 /BaseFont /${FONT_DEFS[k].name} /Encoding /WinAnsiEncoding >>`;
  }

  // Resources reusável (mesma referência de fontes em todas as páginas).
  const fontResource =
    '<< ' + fontKeys.map((k) => `/${k} ${fontIds[k]} 0 R`).join(' ') + ' >>';

  // Páginas + content streams + annotations.
  for (let i = 0; i < pages.length; i++) {
    const annotRefs = annotIds[i].map((id) => `${id} 0 R`).join(' ');
    const pageDict =
      `<< /Type /Page /Parent ${PAGES_ID} 0 R ` +
      `/MediaBox [0 0 ${width} ${height}] ` +
      `/Resources << /Font ${fontResource} >> ` +
      `/Contents ${contentIds[i]} 0 R` +
      (annotRefs ? ` /Annots [ ${annotRefs} ]` : '') +
      ` >>`;
    objects[pageIds[i]] = pageDict;

    const stream = pages[i].ops.join('\n');
    objects[contentIds[i]] =
      `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;

    // Annotations
    for (let a = 0; a < pages[i].annots.length; a++) {
      const an = pages[i].annots[a];
      const id = annotIds[i][a];
      const [x1, y1, x2, y2] = an.rect.map((n) => Math.round(n * 100) / 100);
      objects[id] =
        `<< /Type /Annot /Subtype /Link ` +
        `/Rect [${x1} ${y1} ${x2} ${y2}] ` +
        `/Border [0 0 0] ` +
        `/A << /S /URI /URI ${pdfString(an.url)} >> >>`;
    }
  }

  // Monta bytes. Tudo é ASCII, então usar TextEncoder UTF-8 funciona
  // (PDF aceita bytes brutos; nossos escapes octais cobrem >=0x80).
  const header = `%PDF-1.4\n%\xE2\xE3\xCF\xD3\n`;
  let body = '';
  const offsets = new Array(objects.length).fill(0);
  // Offset 0: reservado para o "free" header xref (não usado p/ obj 0).
  let pos = header.length;
  for (let i = 1; i < objects.length; i++) {
    offsets[i] = pos;
    const chunk = `${i} 0 obj\n${objects[i]}\nendobj\n`;
    body += chunk;
    pos += chunk.length;
  }
  const xrefStart = pos;
  let xref = `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let i = 1; i < objects.length; i++) {
    xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  const trailer =
    `trailer\n<< /Size ${objects.length} /Root ${CATALOG_ID} 0 R >>\n` +
    `startxref\n${xrefStart}\n%%EOF\n`;

  // Concat como bytes (header tem bytes não-ASCII no marker).
  const enc = new TextEncoder();
  const headBytes = new Uint8Array(header.length);
  for (let i = 0; i < header.length; i++) headBytes[i] = header.charCodeAt(i) & 0xff;
  const bodyBytes = enc.encode(body);
  const xrefBytes = enc.encode(xref);
  const trailBytes = enc.encode(trailer);
  const out = new Uint8Array(headBytes.length + bodyBytes.length + xrefBytes.length + trailBytes.length);
  let p = 0;
  out.set(headBytes, p); p += headBytes.length;
  out.set(bodyBytes, p); p += bodyBytes.length;
  out.set(xrefBytes, p); p += xrefBytes.length;
  out.set(trailBytes, p);
  return out;
}
