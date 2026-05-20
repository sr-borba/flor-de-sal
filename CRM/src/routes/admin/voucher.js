// GET /api/admin/reservas/:id/voucher?tipo=confirmada|cancelada|reagendada
//
// Devolve PDF do voucher gerado server-side a partir dos dados da reserva.
// Permission: export_voucher (admin, gerente, concierge).
// Audit log gravado em audit_logs (entidade='reservations', acao='voucher_exportado').

import { error, methodNotAllowed } from '../../lib/responses.js';
import { requirePermission } from '../../lib/permissions.js';
import { renderVoucher } from '../../lib/voucher.js';

const TIPOS_VALIDOS = new Set(['confirmada', 'cancelada', 'reagendada']);
const TIPO_POR_STATUS = {
  confirmada: 'confirmada',
  cancelada: 'cancelada',
  remarcada: 'reagendada',
};

export async function handleAdminVoucher(request, env, ctx, auth, id) {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  const denied = requirePermission(auth, 'export_voucher', request, env, ctx);
  if (denied) return denied;

  const reservaId = parseInt(id, 10);
  if (!Number.isInteger(reservaId) || reservaId < 1) {
    return error('invalid_id', 'id inválido', { status: 400 });
  }

  const url = new URL(request.url);
  const tipo = (url.searchParams.get('tipo') || '').trim();
  if (!TIPOS_VALIDOS.has(tipo)) {
    return error('invalid_tipo', 'tipo deve ser confirmada, cancelada ou reagendada.', { status: 400 });
  }

  const reserva = await env.DB
    .prepare(`SELECT * FROM reservations WHERE id = ?`)
    .bind(reservaId)
    .first();
  if (!reserva) return error('not_found', 'reserva não encontrada', { status: 404 });

  const tipoEsperado = TIPO_POR_STATUS[reserva.status];
  if (!tipoEsperado) {
    return error('voucher_unavailable', 'Voucher indisponível para o status atual da reserva.', {
      status: 409,
      extra: { status_atual: reserva.status },
    });
  }
  if (tipo !== tipoEsperado) {
    return error('tipo_status_mismatch', 'Tipo de voucher incompatível com o status atual da reserva.', {
      status: 409,
      extra: { status_atual: reserva.status, tipo_esperado: tipoEsperado },
    });
  }

  let pdfOut;
  try {
    pdfOut = renderVoucher(reserva, tipo);
  } catch (e) {
    console.error('voucher render falhou', e?.message || e);
    return error('render_error', 'Falha ao gerar voucher.', { status: 500 });
  }

  // Audit log — gravar com info do que foi exportado. Não bloqueia resposta.
  const detalhes = JSON.stringify({
    tipo,
    reservation_code: reserva.reservation_code,
    status_atual: reserva.status,
  });
  const auditPromise = env.DB
    .prepare(
      `INSERT INTO audit_logs (entidade, entidade_id, acao, usuario_email, detalhes)
       VALUES ('reservations', ?, 'voucher_exportado', ?, ?)`
    )
    .bind(reservaId, auth.email, detalhes)
    .run()
    .catch((e) => console.error('audit voucher_exportado falhou', e?.message || e));
  if (ctx?.waitUntil) ctx.waitUntil(auditPromise);

  return new Response(pdfOut.bytes, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${pdfOut.filename}"`,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'X-Frame-Options': 'DENY',
    },
  });
}
