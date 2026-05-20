// Renderer dos vouchers em PDF. 3 tipos: confirmada, cancelada, reagendada.
// Layout escuro inspirado nos vouchers do Sais Beach Living Hotel,
// adaptado ao Design System Flor de Sal. Bordas retangulares.

import { createDoc, textWidth, MARGIN } from './pdf.js';
import { drawSvg } from './svg.js';
import { LOGO_FLOR_DE_SAL_SVG } from './logo.js';
import { drawIcon } from './icons.js';

const COLOR = {
  bg:         '#1A0E06',
  card:       '#241408',
  cardBorder: '#3D341F',
  areia:      '#F5EDD8',
  dourado:    '#C7A453',
  dourado200: '#E3CC8A',
  muted:      '#9F9988',
  rule:       '#4C3E2A',
  success:    '#1F8A47',
  danger:     '#9B2A20',
};

const MENU_URL      = 'https://flordesal.saishotel.com.br/cardapio-jantar-flor-de-sal.pdf';
const INSTAGRAM_URL = 'https://instagram.com/flordesal.bypicui';
const INSTAGRAM_HANDLE = '@flordesal.bypicui';

const TITLE = {
  confirmada: 'Reserva Confirmada',
  cancelada:  'Reserva Cancelada',
  reagendada: 'Reserva Reagendada',
};
const SUBTITLE = {
  confirmada: 'Sua mesa está garantida',
  cancelada:  'Esperamos te receber em breve',
  reagendada: 'Confirmada para a nova data',
};
const BADGE = {
  confirmada: { label: 'RESERVA CONFIRMADA',        color: COLOR.success },
  cancelada:  { label: 'RESERVA CANCELADA',         color: COLOR.danger },
  reagendada: { label: 'REAGENDADA · CONFIRMADA',   color: COLOR.dourado },
};

const MESES = [
  'janeiro','fevereiro','março','abril','maio','junho',
  'julho','agosto','setembro','outubro','novembro','dezembro',
];
const MESES_UP = MESES.map((m) => m.toUpperCase());

// Logo embutido (svg.js calcula proporção; usamos só o width alvo).
const LOGO_W = 190;
const LOGO_VB_RATIO = 126.81 / 439.62;
const LOGO_H = LOGO_W * LOGO_VB_RATIO; // ~54.8pt

// Âncoras fixas do rodapé (de baixo pra cima).
const FOOTER_URL_Y       = 34;
const FOOTER_ADDR_Y      = 50;
const FOOTER_RULE_Y      = 68;
const FOOTER_INSTA_Y     = 88; // baseline do handle
const FOOTER_LOGO_BASE_Y = 108;
const FOOTER_ATEBREVE_Y  = FOOTER_LOGO_BASE_Y + LOGO_H + 18; // "Até breve," acima do logo
const FOOTER_SAFE_TOP_Y  = FOOTER_ATEBREVE_Y + 10;

function formatDateUpper(iso) {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso));
  if (!m) return iso;
  return `${parseInt(m[3], 10)} DE ${MESES_UP[parseInt(m[2], 10) - 1] || ''} DE ${m[1]}`;
}

function formatPeople(adultos, criancas) {
  const a = Number.isFinite(+adultos) ? +adultos : 0;
  const c = Number.isFinite(+criancas) ? +criancas : 0;
  const parts = [`${a} adulto${a === 1 ? '' : 's'}`];
  if (c > 0) parts.push(`${c} criança${c === 1 ? '' : 's'}`);
  return parts.join(' · ');
}

function mealLabel(horario) {
  return /^(12|13|14|15)h/.test(String(horario || '')) ? 'Almoço' : 'Jantar';
}

export function renderVoucher(reserva, tipo) {
  if (!TITLE[tipo]) throw new Error(`tipo inválido: ${tipo}`);

  const doc = createDoc();
  const W = doc.width;
  const H = doc.height;
  const xLeft = MARGIN;
  const xRight = W - MARGIN;
  const cw = xRight - xLeft;

  const isReag = tipo === 'reagendada';
  const isCanc = tipo === 'cancelada';

  // Fundo escuro de página inteira.
  doc.fillRect(0, 0, W, H, COLOR.bg);

  // ─── Cabeçalho ─────────────────────────────────────────────────────
  let y = H - MARGIN - 10;
  doc.textCenter('FLOR DE SAL BISTRÔ & BAR', {
    x1: xLeft, x2: xRight, y,
    font: 'helvBold', size: 8.5, color: COLOR.dourado, letterSpacing: 4,
  });
  y -= 18;
  doc.textCenter('ALMOÇO & JANTAR À BEIRA-MAR · SAIS BEACH LIVING HOTEL', {
    x1: xLeft, x2: xRight, y,
    font: 'helv', size: 7.5, color: COLOR.muted, letterSpacing: 2.5,
  });

  // Título (2 linhas, italic display).
  y -= 42;
  const [titleLine1, titleLine2] = splitTitle(TITLE[tipo]);
  doc.textCenter(titleLine1, {
    x1: xLeft, x2: xRight, y,
    font: 'timesIt', size: 28, color: COLOR.areia,
  });
  y -= 30;
  doc.textCenter(titleLine2, {
    x1: xLeft, x2: xRight, y,
    font: 'timesIt', size: 28, color: COLOR.dourado,
  });

  // Linha decorativa curta.
  y -= 20;
  const ruleW = 56;
  doc.line(W / 2 - ruleW / 2, y, W / 2 + ruleW / 2, y, {
    color: COLOR.dourado, width: 1,
  });

  // Subtítulo italic + data caps.
  y -= 18;
  doc.textCenter(SUBTITLE[tipo], {
    x1: xLeft, x2: xRight, y,
    font: 'timesIt', size: 11.5, color: COLOR.muted,
  });
  y -= 16;
  doc.textCenter(`${formatDateUpper(reserva.data_reserva)} · MACEIÓ, ALAGOAS`, {
    x1: xLeft, x2: xRight, y,
    font: 'helv', size: 8, color: COLOR.dourado200, letterSpacing: 2,
  });

  // ─── Saudação + intro ──────────────────────────────────────────────
  y -= 38;
  const firstName = (reserva.nome || '').split(/\s+/)[0] || 'olá';
  doc.text(`Olá, ${firstName},`, {
    x: xLeft, y, font: 'timesIt', size: 16, color: COLOR.areia,
  });

  const introText = isCanc
    ? 'Sua reserva foi cancelada. Sentimos não te receber desta vez — esperamos te ver em breve.'
    : isReag
      ? 'Sua reserva foi reagendada com sucesso. As informações abaixo refletem a nova data e horário confirmados.'
      : 'Sua reserva está confirmada. Prepare-se para uma experiência inesquecível à beira-mar.';
  y -= 20;
  for (const ln of wrapText(introText, 'helv', 10.5, cw)) {
    doc.text(ln, { x: xLeft, y, font: 'helv', size: 10.5, color: COLOR.muted });
    y -= 14;
  }

  // ─── Card de detalhes ──────────────────────────────────────────────
  y -= 6;
  const obsRaw = (reserva.observacoes || '').trim();
  // Truncamos observações para não estourar o card.
  const obs = obsRaw.length > 180 ? obsRaw.slice(0, 177).trimEnd() + '…' : obsRaw;
  const hasObs = !!obs && !isCanc;
  const cardH = hasObs ? 166 : 130;
  const cardTopY = y;
  const cardBottomY = cardTopY - cardH;
  // Borda + fundo (retângulo reto).
  doc.fillRect(xLeft, cardBottomY, cw, cardH, COLOR.card);
  drawRectStroke(doc, xLeft, cardBottomY, cw, cardH, COLOR.cardBorder, 0.6);
  // Barra de acento à esquerda.
  doc.fillRect(xLeft, cardBottomY + 12, 2, cardH - 24, COLOR.dourado);

  const cardX = xLeft + 18;
  const cardW = cw - 24;
  let cy = cardTopY - 22;

  cy = renderField(doc, isReag ? 'NOVO HORÁRIO' : 'HORÁRIO',
    `${reserva.horario || '—'} · ${mealLabel(reserva.horario)}`, cardX, cy, cardW);
  cy -= 8;

  const colW = (cardW - 16) / 2;
  renderField(doc, 'CONVIDADOS', formatPeople(reserva.adultos, reserva.criancas),
    cardX, cy, colW);
  renderField(doc, 'CÓDIGO', reserva.reservation_code || '—',
    cardX + colW + 16, cy, colW, { mono: true });
  cy -= 38;

  if (hasObs) {
    renderField(doc, 'OBSERVAÇÕES', obs, cardX, cy, cardW, { wrap: true });
  }

  // Badge no rodapé do card (retangular).
  const badge = BADGE[tipo];
  drawBadge(doc, badge.label, badge.color, cardX, cardBottomY + 14);

  y = cardBottomY - 18;

  // ─── Bloco "informações importantes" ───────────────────────────────
  if (!isCanc) {
    y = renderInfoBlock(doc, [
      ['pin', 'COMO CHEGAR',
        'Av. Doutor Antônio Gouveia, 81 · Pajuçara · Maceió/AL — Andar Lazer. Estacionamento rotativo no hotel · R$ 35 a diária.'],
      ['clock', 'CHECK-IN',
        'Apresente este voucher na recepção do Sais Beach Living Hotel e suba para o Andar Lazer — nossa equipe estará aguardando.'],
      ['stopwatch', 'TOLERÂNCIA',
        `Mesa garantida por até 20 minutos após o horário reservado. ${
          isReag ? 'Precisou reagendar novamente?' : 'Precisou reagendar?'
        } Concierge · WhatsApp (82) 8723-3023.`],
    ], xLeft, y, cw);
  } else {
    y = renderInfoBlock(doc, [
      ['pin', 'NOVA RESERVA',
        'Quer remarcar? Fale com o Concierge · WhatsApp (82) 8723-3023.'],
    ], xLeft, y, cw);
  }

  // ─── Botão cardápio (retangular, clicável → PDF do cardápio) ───────
  const btnLabel = isCanc ? 'Planeje sua próxima visita' : 'Ver cardápio completo';
  const btnW = 210;
  const btnH = 28;
  const btnX = (W - btnW) / 2;
  // Botão ancorado um pouco acima do fecho.
  const btnY = Math.max(y - btnH - 12, FOOTER_SAFE_TOP_Y);
  drawRectStroke(doc, btnX, btnY, btnW, btnH, COLOR.dourado, 1);
  const btnTextW = textWidth(btnLabel, 'helvBold', 9.5);
  doc.text(btnLabel, {
    x: btnX + (btnW - btnTextW) / 2,
    y: btnY + btnH / 2 - 3.2,
    font: 'helvBold', size: 9.5, color: COLOR.dourado,
  });
  doc.link({ x: btnX, y: btnY, w: btnW, h: btnH, url: MENU_URL });

  // ─── Rodapé fixo: "Até breve,", logo, Instagram, separator, endereço, URL ─
  doc.textCenter('Até breve,', {
    x1: xLeft, x2: xRight, y: FOOTER_ATEBREVE_Y,
    font: 'timesIt', size: 10.5, color: COLOR.muted,
  });

  // Logo Flor de Sal centralizado.
  drawSvg(doc, LOGO_FLOR_DE_SAL_SVG, {
    x: (W - LOGO_W) / 2,
    y: FOOTER_LOGO_BASE_Y,
    w: LOGO_W,
    color: COLOR.dourado,
  });

  // Linha Instagram clicável (ícone + handle), centralizada.
  drawInstagramLine(doc, FOOTER_INSTA_Y, W);

  // Linha decorativa.
  doc.line(xLeft + 60, FOOTER_RULE_Y, xRight - 60, FOOTER_RULE_Y, {
    color: COLOR.rule, width: 0.5,
  });
  doc.textCenter('SAIS BEACH LIVING HOTEL · AV. DR. ANTÔNIO GOUVEIA, 81 · PAJUÇARA — MACEIÓ/AL', {
    x1: xLeft, x2: xRight, y: FOOTER_ADDR_Y,
    font: 'helv', size: 6.6, color: COLOR.muted, letterSpacing: 1.2,
  });
  doc.textCenter('flordesal.saishotel.com.br', {
    x1: xLeft, x2: xRight, y: FOOTER_URL_Y,
    font: 'helv', size: 7.1, color: COLOR.dourado200,
  });

  const filenameCode = (reserva.reservation_code || 'reserva').replace(/[^A-Za-z0-9-]+/g, '');
  return {
    bytes: doc.build(),
    filename: `voucher-${filenameCode}-${tipo}.pdf`,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────

function splitTitle(s) {
  const parts = s.split(' ');
  if (parts.length === 1) return [s, ''];
  return [parts[0], parts.slice(1).join(' ')];
}

// Contorno retangular via 4 linhas (sem cantos arredondados).
function drawRectStroke(doc, x, y, w, h, color, lw) {
  doc.line(x, y + h, x + w, y + h, { color, width: lw }); // topo
  doc.line(x, y, x + w, y, { color, width: lw });         // base
  doc.line(x, y, x, y + h, { color, width: lw });         // esquerda
  doc.line(x + w, y, x + w, y + h, { color, width: lw }); // direita
}

function renderField(doc, label, value, x, y, w, { mono = false, wrap = false } = {}) {
  doc.text(label, {
    x, y, font: 'helvBold', size: 7, color: COLOR.dourado200,
  });
  if (!wrap) {
    doc.text(String(value), {
      x, y: y - 16,
      font: mono ? 'helvBold' : 'helv',
      size: mono ? 12 : 13,
      color: COLOR.areia,
    });
    return y - 30;
  }
  const lines = wrapText(String(value), 'helv', 10.5, w);
  let yy = y - 14;
  for (const ln of lines) {
    doc.text(ln, { x, y: yy, font: 'helv', size: 10.5, color: COLOR.areia });
    yy -= 13;
  }
  return yy - 4;
}

// Badge retangular sólido + pequeno indicador branco à esquerda.
function drawBadge(doc, label, color, x, y) {
  const padX = 10;
  const labelW = textWidth(label, 'helvBold', 8);
  const w = labelW + padX * 2 + 12;
  const h = 18;
  doc.fillRect(x, y, w, h, color);
  doc.fillRect(x + 8, y + h / 2 - 2, 4, 4, '#FFFFFF');
  doc.text(label, {
    x: x + padX + 10,
    y: y + h / 2 - 3,
    font: 'helvBold', size: 8, color: '#FFFFFF',
  });
}

// Lista vertical de itens com ícone à esquerda + título + corpo.
// items: [['iconName', 'TÍTULO', 'corpo...'], ...]
function renderInfoBlock(doc, items, xLeft, startY, w) {
  const iconSize = 12;
  const gap = 9;
  const textX = xLeft + iconSize + gap;
  const textW = w - iconSize - gap;
  let y = startY;
  for (const [icon, title, body] of items) {
    // Ícone alinhado ao baseline visual do título.
    drawIcon(doc, icon, xLeft, y - 3.5, iconSize, COLOR.dourado);
    doc.text(title, {
      x: textX, y,
      font: 'helvBold', size: 7, color: COLOR.dourado, letterSpacing: 0.8,
    });
    y -= 11;
    const lines = wrapText(body, 'helv', 8.4, textW);
    for (const ln of lines) {
      doc.text(ln, { x: textX, y, font: 'helv', size: 8.4, color: COLOR.areia });
      y -= 10.4;
    }
    y -= 6.5;
  }
  return y;
}

// Linha "[icone Instagram] @flordesal.bypicui" centralizada e clicável.
function drawInstagramLine(doc, y, W) {
  const iconSize = 13.5;
  const gap = 7;
  const handle = INSTAGRAM_HANDLE;
  const fontSize = 9;
  const handleW = textWidth(handle, 'helv', fontSize);
  const totalW = iconSize + gap + handleW;
  const xStart = (W - totalW) / 2;
  // Ícone com base alinhada ao baseline do texto.
  drawIcon(doc, 'instagram', xStart, y - 3.5, iconSize, COLOR.dourado200);
  doc.text(handle, {
    x: xStart + iconSize + gap, y,
    font: 'helv', size: fontSize, color: COLOR.dourado200,
  });
  // Área clicável cobrindo ícone + texto.
  doc.link({
    x: xStart - 5, y: y - 5, w: totalW + 10, h: iconSize + 8,
    url: INSTAGRAM_URL,
  });
}

function wrapText(text, font, size, maxWidth) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const tentative = cur ? `${cur} ${w}` : w;
    if (textWidth(tentative, font, size) > maxWidth && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = tentative;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}
