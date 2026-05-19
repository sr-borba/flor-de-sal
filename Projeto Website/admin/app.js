// Flor de Sal — Painel de Reservas (SPA hash-routed).
// Protegido por Cloudflare Access. Nenhum dado é gravado em localStorage.

(function () {
  'use strict';

  // ─── DOM helpers ────────────────────────────────────────────────────
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        const v = attrs[k];
        if (v == null || v === false) continue;
        if (k === 'class') node.className = v;
        else if (k === 'text') node.textContent = v;
        else if (k === 'html') node.innerHTML = v; // só com markup estático
        else if (k === 'onclick') node.addEventListener('click', v);
        else if (k === 'onsubmit') node.addEventListener('submit', v);
        else if (k === 'onchange') node.addEventListener('change', v);
        else if (k === 'oninput') node.addEventListener('input', v);
        else if (k === 'dataset') Object.assign(node.dataset, v);
        else if (k === 'value') node.value = v;
        else if (v === true) node.setAttribute(k, '');
        else node.setAttribute(k, v);
      }
    }
    if (children) {
      if (!Array.isArray(children)) children = [children];
      for (const c of children) {
        if (c == null || c === false) continue;
        node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
      }
    }
    return node;
  }

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  function fmt(n) { return n == null ? '—' : String(n); }
  function fmtInt(n) { return Number.isFinite(n) ? n.toLocaleString('pt-BR') : '—'; }
  function fmtPct(n) { return Number.isFinite(n) ? `${n.toFixed(1).replace('.', ',')}%` : '—'; }
  function fmtDateBr(iso) {
    if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return iso || '—';
    const [y, m, d] = iso.slice(0, 10).split('-');
    return `${d}/${m}/${y}`;
  }
  function fmtDateTimeBr(s) {
    if (!s) return '—';
    // SQLite timestamps são "YYYY-MM-DD HH:MM:SS" em UTC
    const safe = s.replace(' ', 'T') + (s.endsWith('Z') ? '' : 'Z');
    const dt = new Date(safe);
    if (Number.isNaN(dt.getTime())) return s;
    return dt.toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }
  function fmtPhone(d) {
    if (!d) return '—';
    const digits = String(d).replace(/\D+/g, '');
    if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return d;
  }
  function whatsappLink(phone) {
    const d = String(phone || '').replace(/\D+/g, '');
    if (!d) return null;
    // Adiciona 55 se for celular BR sem DDI
    const intl = d.length <= 11 ? `55${d}` : d;
    return `https://wa.me/${intl}`;
  }

  function statusLabel(s) {
    return ({
      solicitada: 'Solicitada',
      aguardando_resposta: 'Aguardando',
      confirmada: 'Confirmada',
      remarcada: 'Remarcada',
      cancelada: 'Cancelada',
      compareceu: 'Compareceu',
      no_show: 'No-show',
    })[s] || s || '—';
  }

  function badge(status) {
    return el('span', { class: `badge badge--${status}`, text: statusLabel(status) });
  }

  function origemBadge(o) {
    const cls = o === 'manual' ? 'badge--origem-manual' : 'badge--origem-lp';
    const label = o === 'manual' ? 'Manual' : 'LP';
    return el('span', { class: `badge ${cls}`, text: label });
  }

  // ─── Toast ──────────────────────────────────────────────────────────
  function toast(msg, kind) {
    const wrap = $('#toast-wrap');
    const t = el('div', { class: `toast toast--${kind || 'info'}`, text: msg });
    wrap.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; }, 3500);
    setTimeout(() => { t.remove(); }, 4000);
  }

  // ─── API wrapper ────────────────────────────────────────────────────
  async function api(path, opts) {
    opts = opts || {};
    const headers = { ...(opts.headers || {}) };
    if (opts.body != null && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
    let r;
    try {
      r = await fetch(path, { ...opts, headers, credentials: 'same-origin' });
    } catch (e) {
      throw { kind: 'network', message: 'Falha de rede. Verifique sua conexão.' };
    }
    if (r.status === 401 || r.status === 302) {
      // CF Access provavelmente expirou a sessão. Reload completo força re-auth.
      location.reload();
      throw { kind: 'auth', message: 'Sessão expirada.' };
    }
    if (r.redirected && r.url.includes('/cdn-cgi/access')) {
      location.reload();
      throw { kind: 'auth', message: 'Sessão expirada.' };
    }
    let body = null;
    try { body = await r.json(); } catch {}
    if (!body || typeof body !== 'object') {
      throw { kind: 'api', status: r.status, message: 'Resposta inesperada do servidor.' };
    }
    if (!r.ok) {
      const msg = body && body.error && body.error.message ? body.error.message : `HTTP ${r.status}`;
      const fields = body && body.error && body.error.fields;
      throw { kind: 'api', status: r.status, message: msg, fields };
    }
    return body;
  }

  // ─── Modal ──────────────────────────────────────────────────────────
  function modal(title, contentNode, onSubmit) {
    return new Promise((resolve) => {
      const overlay = el('div', {
        class: 'modal-overlay',
        style: 'position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:50;display:flex;align-items:center;justify-content:center;padding:1rem;',
      });
      const dialog = el('div', {
        class: 'card',
        style: 'max-width:480px;width:100%;',
      }, [
        el('h3', { style: 'margin:0 0 1rem;font-size:1.05rem;', text: title }),
        contentNode,
        el('div', { class: 'form-actions' }, [
          el('button', {
            class: 'btn btn--ghost',
            type: 'button',
            text: 'Cancelar',
            onclick: () => { overlay.remove(); resolve(null); },
          }),
          el('button', {
            class: 'btn btn--primary',
            type: 'button',
            text: 'Confirmar',
            onclick: async () => {
              const result = onSubmit();
              if (result === false) return; // validação interna falhou
              overlay.remove();
              resolve(result);
            },
          }),
        ]),
      ]);
      overlay.appendChild(dialog);
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) { overlay.remove(); resolve(null); }
      });
      document.body.appendChild(overlay);
    });
  }

  // ─── Period helpers ────────────────────────────────────────────────
  function isoLocal(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  function periodPresets() {
    const t = new Date();
    const today = isoLocal(t);
    const tomorrow = isoLocal(new Date(t.getFullYear(), t.getMonth(), t.getDate() + 1));
    // Semana: domingo a sábado
    const start = new Date(t); start.setDate(t.getDate() - t.getDay());
    const end = new Date(start); end.setDate(start.getDate() + 6);
    const monthStart = new Date(t.getFullYear(), t.getMonth(), 1);
    const monthEnd = new Date(t.getFullYear(), t.getMonth() + 1, 0);
    return {
      hoje: { from: today, to: today },
      amanha: { from: tomorrow, to: tomorrow },
      semana: { from: isoLocal(start), to: isoLocal(end) },
      mes: { from: isoLocal(monthStart), to: isoLocal(monthEnd) },
    };
  }

  // ─── Layout ─────────────────────────────────────────────────────────
  function renderTopbar(email) {
    const bar = $('#topbar');
    clear(bar);
    bar.appendChild(el('div', { class: 'topbar__brand' }, [
      el('span', { class: 'topbar__brand-dot' }),
      el('span', { text: 'Flor de Sal · Painel' }),
    ]));
    bar.appendChild(el('div', { class: 'topbar__user' }, [
      email ? el('span', { text: email }) : null,
      el('a', { href: '/cdn-cgi/access/logout', text: 'Sair' }),
    ]));
  }

  const NAV = [
    { hash: '#/dashboard',     label: 'Dashboard' },
    { hash: '#/reservas',      label: 'Reservas' },
    { hash: '#/check-in',      label: 'Check-in' },
    { hash: '#/reservas/nova', label: 'Nova reserva' },
  ];
  function renderSidebar() {
    const nav = $('#sidebar-nav');
    clear(nav);
    for (const item of NAV) {
      const a = el('a', {
        class: 'sidebar__link',
        href: item.hash,
        text: item.label,
      });
      if (location.hash.startsWith(item.hash)) a.classList.add('is-active');
      nav.appendChild(a);
    }
  }

  function setMain(node) {
    const m = $('#main');
    clear(m);
    if (Array.isArray(node)) node.forEach((n) => m.appendChild(n));
    else m.appendChild(node);
  }

  function pageHeader(title, right) {
    return el('div', { class: 'page__header' }, [
      el('div', null, [el('h1', { class: 'page__title', text: title })]),
      right || null,
    ]);
  }

  // ─── Page: Dashboard ───────────────────────────────────────────────
  async function renderDashboard() {
    setMain(el('div', { class: 'loading', text: 'Carregando dashboard…' }));

    const presets = periodPresets();
    let activePreset = 'mes';
    let from = presets.mes.from;
    let to = presets.mes.to;

    async function load() {
      const main = $('#main');
      clear(main);
      main.appendChild(pageHeader('Dashboard'));
      main.appendChild(buildPeriodBar());
      const placeholder = el('div', { class: 'loading', text: 'Carregando dados…' });
      main.appendChild(placeholder);

      try {
        const r = await api(`/api/admin/dashboard/stats?from=${from}&to=${to}`);
        placeholder.remove();
        renderStats(main, r.stats, r.period);
      } catch (e) {
        placeholder.remove();
        main.appendChild(el('div', { class: 'empty', text: `Erro: ${e.message}` }));
        toast(e.message, 'error');
      }
    }

    function buildPeriodBar() {
      const bar = el('div', { class: 'period-bar' });
      const presetButtons = [
        ['hoje', 'Hoje'],
        ['amanha', 'Amanhã'],
        ['semana', 'Esta semana'],
        ['mes', 'Este mês'],
        ['personalizado', 'Personalizado'],
      ];
      for (const [key, label] of presetButtons) {
        const btn = el('button', {
          class: `period-bar__btn${activePreset === key ? ' is-active' : ''}`,
          type: 'button',
          text: label,
          onclick: () => {
            activePreset = key;
            if (key !== 'personalizado') {
              from = presets[key].from;
              to = presets[key].to;
              load();
            } else {
              load();
            }
          },
        });
        bar.appendChild(btn);
      }
      if (activePreset === 'personalizado') {
        const custom = el('div', { class: 'period-bar__custom' }, [
          el('input', { type: 'date', value: from, onchange: (e) => { from = e.target.value; if (from && to) load(); } }),
          el('span', { text: 'até' }),
          el('input', { type: 'date', value: to, onchange: (e) => { to = e.target.value; if (from && to) load(); } }),
        ]);
        bar.appendChild(custom);
      }
      bar.appendChild(el('span', { class: 'muted', style: 'margin-left:auto;font-size:.8rem;', text: `${fmtDateBr(from)} → ${fmtDateBr(to)}` }));
      return bar;
    }

    function renderStats(main, s, period) {
      const grid1 = el('div', { class: 'grid' });
      function addCard(label, value, gold) {
        grid1.appendChild(el('div', { class: 'card' }, [
          el('p', { class: 'card__label', text: label }),
          el('p', { class: `card__value${gold ? ' card__value--gold' : ''}`, text: fmtInt(value) }),
        ]));
      }
      addCard('Total no período', s.total, true);
      addCard('Solicitadas', s.solicitada);
      addCard('Aguardando', s.aguardando_resposta);
      addCard('Confirmadas', s.confirmada);
      addCard('Remarcadas', s.remarcada);
      addCard('Canceladas', s.cancelada);
      addCard('Compareceram', s.compareceu);
      addCard('No-show', s.no_show);
      main.appendChild(grid1);

      main.appendChild(el('h3', { class: 'section__title', style: 'margin-top:1.5rem;', text: 'Pessoas' }));
      const grid2 = el('div', { class: 'grid' });
      grid2.appendChild(el('div', { class: 'card' }, [
        el('p', { class: 'card__label', text: 'Pessoas confirmadas' }),
        el('p', { class: 'card__value', text: fmtInt(s.pessoas_confirmadas) }),
      ]));
      grid2.appendChild(el('div', { class: 'card' }, [
        el('p', { class: 'card__label', text: 'Pessoas que compareceram' }),
        el('p', { class: 'card__value card__value--gold', text: fmtInt(s.pessoas_compareceu) }),
      ]));
      main.appendChild(grid2);

      main.appendChild(el('h3', { class: 'section__title', style: 'margin-top:1.5rem;', text: 'Taxas' }));
      const grid3 = el('div', { class: 'grid' });
      grid3.appendChild(el('div', { class: 'card' }, [
        el('p', { class: 'card__label', text: 'Taxa de comparecimento' }),
        el('p', { class: 'card__value card__value--gold', text: fmtPct(s.taxa_comparecimento) }),
        el('p', { class: 'card__hint', text: 'compareceu / (compareceu + no-show)' }),
      ]));
      grid3.appendChild(el('div', { class: 'card' }, [
        el('p', { class: 'card__label', text: 'Taxa de no-show' }),
        el('p', { class: 'card__value', text: fmtPct(s.taxa_no_show) }),
        el('p', { class: 'card__hint', text: 'no-show / (compareceu + no-show)' }),
      ]));
      grid3.appendChild(el('div', { class: 'card' }, [
        el('p', { class: 'card__label', text: 'Taxa de cancelamento' }),
        el('p', { class: 'card__value', text: fmtPct(s.taxa_cancelamento) }),
        el('p', { class: 'card__hint', text: 'cancelada / total no período' }),
      ]));
      main.appendChild(grid3);
    }

    load();
  }

  // ─── Page: Reservas list ────────────────────────────────────────────
  async function renderReservasList() {
    const state = {
      q: '', status: '', origem: '', from: '', to: '', horario: '',
      order_by: 'data_reserva', order: 'asc', page: 1, per_page: 25,
    };

    async function load() {
      const main = $('#main');
      clear(main);
      main.appendChild(pageHeader('Reservas', el('a', {
        class: 'btn btn--primary', href: '#/reservas/nova', text: '+ Nova reserva',
      })));
      main.appendChild(buildFilters());
      const placeholder = el('div', { class: 'loading', text: 'Carregando…' });
      main.appendChild(placeholder);

      const qs = new URLSearchParams();
      for (const k in state) {
        if (state[k] !== '' && state[k] != null) qs.set(k, state[k]);
      }
      try {
        const r = await api(`/api/admin/reservas?${qs}`);
        placeholder.remove();
        renderTable(main, r.items, r.pagination);
      } catch (e) {
        placeholder.remove();
        main.appendChild(el('div', { class: 'empty', text: `Erro: ${e.message}` }));
      }
    }

    function buildFilters() {
      const filters = el('form', {
        class: 'filters',
        onsubmit: (e) => { e.preventDefault(); state.page = 1; load(); },
      });
      function group(label, child) {
        return el('div', { class: 'filters__group' }, [
          el('label', { class: 'filters__label', text: label }),
          child,
        ]);
      }
      filters.appendChild(group('Busca', el('input', {
        class: 'filters__input', type: 'text',
        placeholder: 'Nome, telefone ou código',
        value: state.q,
        oninput: (e) => { state.q = e.target.value; },
      })));
      filters.appendChild(group('Status', selectEl(state.status, [
        ['', 'Todos'],
        ['solicitada', 'Solicitada'],
        ['aguardando_resposta', 'Aguardando'],
        ['confirmada', 'Confirmada'],
        ['remarcada', 'Remarcada'],
        ['cancelada', 'Cancelada'],
        ['compareceu', 'Compareceu'],
        ['no_show', 'No-show'],
      ], (v) => { state.status = v; })));
      filters.appendChild(group('Origem', selectEl(state.origem, [
        ['', 'Todas'], ['lp', 'LP'], ['manual', 'Manual'],
      ], (v) => { state.origem = v; })));
      filters.appendChild(group('De', el('input', {
        class: 'filters__input', type: 'date', value: state.from,
        oninput: (e) => { state.from = e.target.value; },
      })));
      filters.appendChild(group('Até', el('input', {
        class: 'filters__input', type: 'date', value: state.to,
        oninput: (e) => { state.to = e.target.value; },
      })));
      filters.appendChild(group('Horário', selectEl(state.horario, [
        ['', 'Todos'], ['19h', '19h'], ['19h30', '19h30'],
        ['20h', '20h'], ['20h30', '20h30'], ['21h', '21h'], ['21h30', '21h30'],
      ], (v) => { state.horario = v; })));
      filters.appendChild(group('Ordenar por', selectEl(`${state.order_by}:${state.order}`, [
        ['data_reserva:asc', 'Data reserva ↑'],
        ['data_reserva:desc', 'Data reserva ↓'],
        ['criado_em:desc', 'Criado em ↓'],
        ['criado_em:asc', 'Criado em ↑'],
      ], (v) => { const [a, b] = v.split(':'); state.order_by = a; state.order = b; })));
      filters.appendChild(el('button', {
        class: 'btn btn--primary', type: 'submit', text: 'Aplicar',
      }));
      filters.appendChild(el('button', {
        class: 'btn btn--ghost', type: 'button', text: 'Limpar',
        onclick: () => {
          state.q = state.status = state.origem = state.from = state.to = state.horario = '';
          state.page = 1; load();
        },
      }));
      return filters;
    }

    function selectEl(value, opts, onChange) {
      const sel = el('select', { class: 'filters__select', onchange: (e) => onChange(e.target.value) });
      for (const [v, l] of opts) sel.appendChild(el('option', { value: v, text: l, selected: v === value }));
      return sel;
    }

    function renderTable(main, items, pag) {
      if (!items.length) {
        main.appendChild(el('div', { class: 'empty', text: 'Nenhuma reserva encontrada.' }));
        return;
      }
      const wrap = el('div', { class: 'table-wrap' });
      const table = el('table', { class: 'table' });
      const thead = el('thead', null, [
        el('tr', null, [
          el('th', { text: 'Código' }),
          el('th', { text: 'Nome' }),
          el('th', { text: 'Data' }),
          el('th', { text: 'Hora' }),
          el('th', { text: 'Pess.' }),
          el('th', { text: 'Status' }),
          el('th', { text: 'Origem' }),
          el('th', { text: 'Telefone' }),
          el('th', { text: '' }),
        ]),
      ]);
      const tbody = el('tbody');
      for (const r of items) {
        const wa = whatsappLink(r.telefone);
        const actions = el('div', { class: 'table__actions' }, [
          wa && el('a', { class: 'btn btn--sm btn--ghost', href: wa, target: '_blank', rel: 'noopener', text: 'WhatsApp' }),
          el('a', { class: 'btn btn--sm', href: `#/reservas/${r.id}`, text: 'Abrir' }),
        ]);
        tbody.appendChild(el('tr', null, [
          el('td', { class: 'mono' }, [el('a', { href: `#/reservas/${r.id}`, text: r.reservation_code })]),
          el('td', { text: [r.nome, r.sobrenome].filter(Boolean).join(' ') }),
          el('td', { text: fmtDateBr(r.data_reserva) }),
          el('td', { text: r.horario }),
          el('td', { text: String(r.total_pessoas) }),
          el('td', null, [badge(r.status)]),
          el('td', null, [origemBadge(r.origem)]),
          el('td', { text: fmtPhone(r.telefone) }),
          el('td', null, [actions]),
        ]));
      }
      table.appendChild(thead);
      table.appendChild(tbody);
      wrap.appendChild(table);
      main.appendChild(wrap);

      const ctrl = el('div', { class: 'pagination__controls' });
      ctrl.appendChild(el('button', {
        class: 'btn btn--sm', text: '←', disabled: pag.page <= 1,
        onclick: () => { state.page = Math.max(1, pag.page - 1); load(); },
      }));
      ctrl.appendChild(el('span', { class: 'muted', style: 'padding:0 .5rem;', text: `${pag.page} / ${pag.total_pages}` }));
      ctrl.appendChild(el('button', {
        class: 'btn btn--sm', text: '→', disabled: pag.page >= pag.total_pages,
        onclick: () => { state.page = Math.min(pag.total_pages, pag.page + 1); load(); },
      }));
      main.appendChild(el('div', { class: 'pagination' }, [
        el('div', { class: 'pagination__info', text: `${pag.total} reservas` }),
        ctrl,
      ]));
    }

    load();
  }

  // ─── Page: Reserva detail ──────────────────────────────────────────
  async function renderReservaDetail(id) {
    setMain(el('div', { class: 'loading', text: 'Carregando reserva…' }));
    let data;
    try {
      data = await api(`/api/admin/reservas/${id}`);
    } catch (e) {
      setMain(el('div', { class: 'empty', text: `Erro: ${e.message}` }));
      return;
    }

    const r = data.reserva;
    const main = $('#main');
    clear(main);

    main.appendChild(pageHeader(`Reserva ${r.reservation_code}`, el('a', {
      class: 'btn btn--ghost', href: '#/reservas', text: '← Voltar',
    })));

    const left = el('div');
    const right = el('div');

    // Dados do cliente
    const cliente = el('div', { class: 'card' }, [
      el('h3', { class: 'section__title', style: 'margin:0 0 .7rem;', text: 'Cliente' }),
      buildKv([
        ['Nome', [r.nome, r.sobrenome].filter(Boolean).join(' ') || '—'],
        ['Telefone', fmtPhone(r.telefone)],
        ['E-mail', r.email || '—'],
        ['WhatsApp', whatsappLink(r.telefone)
          ? linkEl(whatsappLink(r.telefone), 'Abrir conversa', true)
          : '—'],
      ]),
    ]);
    left.appendChild(cliente);

    // Dados da reserva
    const reserva = el('div', { class: 'card', style: 'margin-top:1rem;' }, [
      el('h3', { class: 'section__title', style: 'margin:0 0 .7rem;', text: 'Reserva' }),
      buildKv([
        ['Código', el('span', { class: 'mono', text: r.reservation_code })],
        ['Data', fmtDateBr(r.data_reserva)],
        ['Horário', r.horario],
        ['Adultos', String(r.adultos)],
        ['Crianças', String(r.criancas)],
        ['Total', `${r.total_pessoas} pessoa(s)`],
        ['Status', badge(r.status)],
        ['Origem', origemBadge(r.origem)],
        ['Criado por', r.criado_por || '—'],
        ['Criado em', fmtDateTimeBr(r.criado_em)],
        ['Atualizado em', fmtDateTimeBr(r.atualizado_em)],
      ]),
    ]);
    left.appendChild(reserva);

    // Observações cliente
    left.appendChild(el('div', { class: 'card', style: 'margin-top:1rem;' }, [
      el('h3', { class: 'section__title', style: 'margin:0 0 .7rem;', text: 'Observações do cliente' }),
      el('p', { style: 'margin:0;white-space:pre-wrap;', text: r.observacoes || '—' }),
    ]));

    // Observações internas (editáveis)
    const obsTxt = el('textarea', {
      class: 'field__textarea', style: 'width:100%;min-height:90px;',
      value: r.observacoes_internas || '',
      placeholder: 'Anotações internas (não visíveis ao cliente)',
    });
    const obsBtn = el('button', { class: 'btn btn--primary btn--sm', type: 'button', text: 'Salvar observações' });
    obsBtn.addEventListener('click', async () => {
      obsBtn.disabled = true;
      try {
        await api(`/api/admin/reservas/${r.id}/observacoes-internas`, {
          method: 'PATCH',
          body: JSON.stringify({ observacoes_internas: obsTxt.value }),
        });
        toast('Observações internas atualizadas.', 'success');
      } catch (e) { toast(e.message, 'error'); }
      finally { obsBtn.disabled = false; }
    });
    left.appendChild(el('div', { class: 'card', style: 'margin-top:1rem;' }, [
      el('h3', { class: 'section__title', style: 'margin:0 0 .7rem;', text: 'Observações internas' }),
      obsTxt,
      el('div', { class: 'form-actions' }, [obsBtn]),
    ]));

    // UTMs
    const utmKvs = [
      ['utm_source', r.utm_source], ['utm_medium', r.utm_medium],
      ['utm_campaign', r.utm_campaign], ['utm_content', r.utm_content],
      ['utm_term', r.utm_term], ['referrer', r.referrer],
      ['landing_page', r.landing_page], ['user_agent', r.user_agent],
    ].filter(([, v]) => v);
    if (utmKvs.length) {
      left.appendChild(el('div', { class: 'card', style: 'margin-top:1rem;' }, [
        el('h3', { class: 'section__title', style: 'margin:0 0 .7rem;', text: 'Atribuição' }),
        buildKv(utmKvs.map(([k, v]) => [k, el('span', { class: 'kv__v kv__v--mono', text: v })])),
      ]));
    }

    // Ações de status
    right.appendChild(buildActionsCard(r));

    // Histórico
    right.appendChild(buildHistoryCard(data.history));

    main.appendChild(el('div', { class: 'detail-grid' }, [left, right]));

    function buildActionsCard(r) {
      const card = el('div', { class: 'card' });
      card.appendChild(el('h3', { class: 'section__title', style: 'margin:0 0 .7rem;', text: 'Ações' }));
      const actions = el('div', { style: 'display:flex;flex-direction:column;gap:.4rem;' });
      const mk = (label, kind, handler) => {
        const b = el('button', { class: `btn${kind === 'primary' ? ' btn--primary' : kind === 'danger' ? ' btn--danger' : ''}`, type: 'button', text: label });
        b.addEventListener('click', handler);
        return b;
      };
      actions.appendChild(mk('Confirmar', 'primary', () => changeStatus('confirmada')));
      actions.appendChild(mk('Marcar como aguardando', null, () => changeStatus('aguardando_resposta')));
      actions.appendChild(mk('Marcar comparecimento', 'primary', () => changeStatus('compareceu')));
      actions.appendChild(mk('Marcar no-show', 'danger', () => changeStatus('no_show')));
      actions.appendChild(mk('Remarcar', null, () => promptRemarcar(r)));
      actions.appendChild(mk('Cancelar', 'danger', () => promptCancelar()));
      card.appendChild(actions);
      return card;
    }

    async function changeStatus(novo, extra) {
      const payload = { status_novo: novo };
      if (extra) Object.assign(payload, extra);
      try {
        await api(`/api/admin/reservas/${id}/status`, {
          method: 'PATCH', body: JSON.stringify(payload),
        });
        toast(`Status atualizado: ${statusLabel(novo)}`, 'success');
        renderReservaDetail(id);
      } catch (e) {
        toast(e.message, 'error');
      }
    }

    async function promptCancelar() {
      const motivoInput = el('textarea', { class: 'field__textarea', style: 'width:100%;min-height:80px;', placeholder: 'Motivo do cancelamento (obrigatório)' });
      const errEl = el('p', { class: 'field__error' });
      const result = await modal('Cancelar reserva', el('div', null, [
        motivoInput, errEl,
      ]), () => {
        const motivo = motivoInput.value.trim();
        if (!motivo) { errEl.textContent = 'Motivo é obrigatório.'; return false; }
        return { motivo };
      });
      if (result) changeStatus('cancelada', { motivo: result.motivo });
    }

    async function promptRemarcar(r) {
      const dataInput = el('input', { class: 'field__input', type: 'date', value: r.data_reserva });
      const horarioSel = el('select', { class: 'field__select' });
      for (const h of ['19h', '19h30', '20h', '20h30', '21h', '21h30']) {
        horarioSel.appendChild(el('option', { value: h, text: h, selected: h === r.horario }));
      }
      const motivoInput = el('input', { class: 'field__input', type: 'text', placeholder: 'Motivo (opcional)' });
      const errEl = el('p', { class: 'field__error' });
      const result = await modal('Remarcar reserva', el('div', { class: 'form-grid' }, [
        el('div', { class: 'field' }, [el('label', { class: 'field__label', text: 'Nova data' }), dataInput]),
        el('div', { class: 'field' }, [el('label', { class: 'field__label', text: 'Novo horário' }), horarioSel]),
        el('div', { class: 'field field--full' }, [el('label', { class: 'field__label', text: 'Motivo (opcional)' }), motivoInput]),
        el('div', { class: 'field field--full' }, [errEl]),
      ]), () => {
        const d = dataInput.value, h = horarioSel.value;
        if (!d || !h) { errEl.textContent = 'Preencha data e horário.'; return false; }
        return { nova_data: d, novo_horario: h, motivo: motivoInput.value.trim() || null };
      });
      if (result) changeStatus('remarcada', result);
    }
  }

  function buildKv(pairs) {
    const grid = el('div', { class: 'kv' });
    for (const [k, v] of pairs) {
      grid.appendChild(el('div', { class: 'kv__k', text: k }));
      const vNode = (v && typeof v === 'object' && v.nodeType) ? v : el('div', { class: 'kv__v', text: v == null ? '—' : String(v) });
      if (!vNode.classList || !vNode.classList.contains('kv__v')) vNode.classList && vNode.classList.add('kv__v');
      grid.appendChild(vNode);
    }
    return grid;
  }
  function linkEl(href, text, external) {
    return el('a', { href, target: external ? '_blank' : null, rel: external ? 'noopener' : null, text });
  }
  function buildHistoryCard(history) {
    const card = el('div', { class: 'card', style: 'margin-top:1rem;' });
    card.appendChild(el('h3', { class: 'section__title', style: 'margin:0 0 .7rem;', text: 'Histórico' }));
    if (!history.length) {
      card.appendChild(el('p', { class: 'muted', style: 'margin:0;', text: 'Sem alterações registradas.' }));
      return card;
    }
    const tl = el('div', { class: 'timeline' });
    for (const h of history) {
      const head = el('div', { class: 'timeline__head' });
      if (h.status_anterior) {
        head.appendChild(badge(h.status_anterior));
        head.appendChild(document.createTextNode(' → '));
      } else {
        head.appendChild(el('span', { class: 'muted', text: 'inicial → ' }));
      }
      head.appendChild(badge(h.status_novo));
      const meta = el('p', { class: 'timeline__meta', text: `${fmtDateTimeBr(h.alterado_em)} · ${h.usuario_email || 'sistema'}${h.motivo ? ' · ' + h.motivo : ''}` });
      tl.appendChild(el('div', { class: 'timeline__item' }, [head, meta]));
    }
    card.appendChild(tl);
    return card;
  }

  // ─── Page: Check-in ────────────────────────────────────────────────
  async function renderCheckin() {
    let date = isoLocal(new Date());
    let search = '';

    async function load() {
      const main = $('#main');
      clear(main);
      const dateInput = el('input', { type: 'date', value: date, class: 'filters__input', onchange: (e) => { date = e.target.value; load(); } });
      main.appendChild(pageHeader('Check-in', el('div', { class: 'row' }, [
        el('label', { class: 'muted', text: 'Dia:' }), dateInput,
      ])));

      const searchBar = el('div', { class: 'filters', style: 'margin-bottom:1rem;' }, [
        el('div', { class: 'filters__group', style: 'flex:1;' }, [
          el('label', { class: 'filters__label', text: 'Buscar' }),
          el('input', {
            class: 'filters__input', type: 'search',
            placeholder: 'Nome, telefone ou código',
            value: search,
            oninput: (e) => { search = e.target.value.toLowerCase(); applyFilter(); },
          }),
        ]),
      ]);
      main.appendChild(searchBar);

      const container = el('div', { id: 'checkin-container' });
      main.appendChild(container);

      const placeholder = el('div', { class: 'loading', text: 'Carregando…' });
      container.appendChild(placeholder);

      let data;
      try {
        data = await api(`/api/admin/check-in?date=${date}`);
      } catch (e) {
        clear(container);
        container.appendChild(el('div', { class: 'empty', text: `Erro: ${e.message}` }));
        return;
      }
      renderGroups(data);

      function renderGroups(data) {
        clear(container);
        if (data.total === 0) {
          container.appendChild(el('div', { class: 'empty', text: 'Nenhuma reserva para esta data.' }));
          return;
        }
        for (const g of data.grupos) {
          if (!g.reservas.length) continue;
          const section = el('div', { class: 'checkin-group', dataset: { horario: g.horario } });
          section.appendChild(el('div', { class: 'checkin-group__header' }, [
            el('span', { class: 'checkin-group__horario', text: g.horario }),
            el('span', { class: 'checkin-group__count', text: `${g.reservas.length} reserva(s)` }),
          ]));
          for (const r of g.reservas) section.appendChild(renderCard(r));
          container.appendChild(section);
        }
        applyFilter();
      }

      function renderCard(r) {
        const card = el('div', { class: `checkin-card${r.status === 'confirmada' ? ' checkin-card--confirmada' : ''}`, dataset: {
          name: ([r.nome, r.sobrenome].filter(Boolean).join(' ') || '').toLowerCase(),
          phone: String(r.telefone || '').replace(/\D+/g, ''),
          code: (r.reservation_code || '').toLowerCase(),
        }});
        const left = el('div');
        left.appendChild(el('div', { class: 'checkin-card__name' }, [
          document.createTextNode([r.nome, r.sobrenome].filter(Boolean).join(' ')),
          document.createTextNode(' '),
          badge(r.status),
        ]));
        left.appendChild(el('div', { class: 'checkin-card__meta', text:
          `${r.total_pessoas} pessoa(s) · ${fmtPhone(r.telefone)} · ${r.reservation_code}`
        }));
        if (r.observacoes) left.appendChild(el('div', { class: 'checkin-card__meta muted', text: `Obs: ${r.observacoes}` }));

        const wa = whatsappLink(r.telefone);
        const actions = el('div', { class: 'checkin-card__actions' });
        const detailLink = el('a', { class: 'btn btn--sm', href: `#/reservas/${r.id}`, text: 'Abrir' });
        actions.appendChild(detailLink);
        if (wa) actions.appendChild(el('a', { class: 'btn btn--sm btn--ghost', href: wa, target: '_blank', rel: 'noopener', text: 'WhatsApp' }));

        const compBtn = el('button', { class: 'btn btn--sm btn--primary', type: 'button', text: 'Compareceu' });
        compBtn.addEventListener('click', async () => {
          compBtn.disabled = true;
          try {
            await api(`/api/admin/reservas/${r.id}/status`, { method: 'PATCH', body: JSON.stringify({ status_novo: 'compareceu' }) });
            toast(`${r.nome}: marcado como compareceu`, 'success');
            load();
          } catch (e) { compBtn.disabled = false; toast(e.message, 'error'); }
        });
        actions.appendChild(compBtn);

        const noShowBtn = el('button', { class: 'btn btn--sm btn--danger', type: 'button', text: 'No-show' });
        noShowBtn.addEventListener('click', async () => {
          if (!confirm(`Confirmar no-show para ${r.nome}?`)) return;
          noShowBtn.disabled = true;
          try {
            await api(`/api/admin/reservas/${r.id}/status`, { method: 'PATCH', body: JSON.stringify({ status_novo: 'no_show' }) });
            toast(`${r.nome}: no-show`, 'success'); load();
          } catch (e) { noShowBtn.disabled = false; toast(e.message, 'error'); }
        });
        actions.appendChild(noShowBtn);

        const remarcarBtn = el('button', { class: 'btn btn--sm', type: 'button', text: 'Remarcar' });
        remarcarBtn.addEventListener('click', () => promptRemarcarInline(r));
        actions.appendChild(remarcarBtn);

        const cancelarBtn = el('button', { class: 'btn btn--sm btn--danger', type: 'button', text: 'Cancelar' });
        cancelarBtn.addEventListener('click', () => promptCancelarInline(r));
        actions.appendChild(cancelarBtn);

        card.appendChild(left);
        card.appendChild(actions);
        return card;
      }

      async function promptCancelarInline(r) {
        const motivoInput = el('textarea', { class: 'field__textarea', style: 'width:100%;min-height:80px;', placeholder: 'Motivo do cancelamento' });
        const errEl = el('p', { class: 'field__error' });
        const result = await modal(`Cancelar reserva de ${r.nome}`, el('div', null, [motivoInput, errEl]), () => {
          const m = motivoInput.value.trim();
          if (!m) { errEl.textContent = 'Motivo é obrigatório.'; return false; }
          return { motivo: m };
        });
        if (!result) return;
        try {
          await api(`/api/admin/reservas/${r.id}/status`, { method: 'PATCH', body: JSON.stringify({ status_novo: 'cancelada', motivo: result.motivo }) });
          toast('Reserva cancelada.', 'success'); load();
        } catch (e) { toast(e.message, 'error'); }
      }

      async function promptRemarcarInline(r) {
        const dataInput = el('input', { class: 'field__input', type: 'date', value: r.data_reserva || date });
        const horarioSel = el('select', { class: 'field__select' });
        for (const h of ['19h', '19h30', '20h', '20h30', '21h', '21h30']) {
          horarioSel.appendChild(el('option', { value: h, text: h, selected: h === r.horario }));
        }
        const motivoInput = el('input', { class: 'field__input', type: 'text', placeholder: 'Motivo (opcional)' });
        const errEl = el('p', { class: 'field__error' });
        const result = await modal(`Remarcar ${r.nome}`, el('div', { class: 'form-grid' }, [
          el('div', { class: 'field' }, [el('label', { class: 'field__label', text: 'Nova data' }), dataInput]),
          el('div', { class: 'field' }, [el('label', { class: 'field__label', text: 'Novo horário' }), horarioSel]),
          el('div', { class: 'field field--full' }, [el('label', { class: 'field__label', text: 'Motivo (opcional)' }), motivoInput]),
          el('div', { class: 'field field--full' }, [errEl]),
        ]), () => {
          if (!dataInput.value || !horarioSel.value) { errEl.textContent = 'Preencha data e horário.'; return false; }
          return { nova_data: dataInput.value, novo_horario: horarioSel.value, motivo: motivoInput.value.trim() || null };
        });
        if (!result) return;
        try {
          await api(`/api/admin/reservas/${r.id}/status`, { method: 'PATCH', body: JSON.stringify({ status_novo: 'remarcada', ...result }) });
          toast('Reserva remarcada.', 'success'); load();
        } catch (e) { toast(e.message, 'error'); }
      }

      function applyFilter() {
        const cards = $$('.checkin-card', container);
        for (const c of cards) {
          const ds = c.dataset;
          const match = !search ||
            ds.name.includes(search) ||
            ds.phone.includes(search.replace(/\D+/g, '')) ||
            ds.code.includes(search);
          c.style.display = match ? '' : 'none';
        }
      }
    }

    load();
  }

  // ─── Page: Nova reserva ────────────────────────────────────────────
  function renderReservaNova() {
    const main = $('#main');
    clear(main);
    main.appendChild(pageHeader('Nova reserva', el('a', {
      class: 'btn btn--ghost', href: '#/reservas', text: '← Voltar',
    })));

    const fields = {};
    function field(name, label, opts) {
      opts = opts || {};
      const id = `f-${name}`;
      let input;
      if (opts.type === 'textarea') input = el('textarea', { id, name, class: 'field__textarea', rows: 3 });
      else if (opts.type === 'select') {
        input = el('select', { id, name, class: 'field__select' });
        for (const [v, l] of opts.options) input.appendChild(el('option', { value: v, text: l }));
      } else {
        input = el('input', { id, name, class: 'field__input', type: opts.type || 'text', value: opts.value || '' });
      }
      if (opts.required) input.required = true;
      if (opts.min != null) input.min = String(opts.min);
      if (opts.max != null) input.max = String(opts.max);
      fields[name] = input;
      return el('div', { class: `field${opts.full ? ' field--full' : ''}` }, [
        el('label', { class: 'field__label', for: id }, [
          document.createTextNode(label),
          opts.required ? el('sup', { text: '*' }) : null,
        ]),
        input,
      ]);
    }

    const today = isoLocal(new Date());
    const form = el('form', {
      class: 'card',
      onsubmit: async (e) => {
        e.preventDefault();
        const body = {
          nome: fields.nome.value,
          sobrenome: fields.sobrenome.value,
          telefone: fields.telefone.value,
          email: fields.email.value,
          data_reserva: fields.data_reserva.value,
          horario: fields.horario.value,
          adultos: Number(fields.adultos.value),
          criancas: Number(fields.criancas.value),
          observacoes: fields.observacoes.value,
          observacoes_internas: fields.observacoes_internas.value,
        };
        const btn = $('#nova-submit');
        btn.disabled = true;
        try {
          const r = await api('/api/admin/reservas', {
            method: 'POST', body: JSON.stringify(body),
          });
          toast(`Reserva ${r.reservation_code} criada.`, 'success');
          location.hash = `#/reservas/${r.reserva_id}`;
        } catch (e) {
          btn.disabled = false;
          let msg = e.message;
          if (e.fields) msg += ': ' + e.fields.map((f) => `${f.field} ${f.message}`).join(', ');
          toast(msg, 'error');
        }
      },
    });

    const grid = el('div', { class: 'form-grid' }, [
      field('nome', 'Nome', { required: true }),
      field('sobrenome', 'Sobrenome'),
      field('telefone', 'Telefone/WhatsApp', { required: true }),
      field('email', 'E-mail', { type: 'email' }),
      field('data_reserva', 'Data da reserva', { type: 'date', value: today, required: true }),
      field('horario', 'Horário', { type: 'select', required: true, options: [
        ['', '— Selecione —'],
        ['19h', '19h'], ['19h30', '19h30'], ['20h', '20h'],
        ['20h30', '20h30'], ['21h', '21h'], ['21h30', '21h30'],
      ]}),
      field('adultos', 'Adultos', { type: 'number', value: '2', min: 1, max: 30, required: true }),
      field('criancas', 'Crianças', { type: 'number', value: '0', min: 0, max: 30 }),
      field('observacoes', 'Observações (cliente)', { type: 'textarea', full: true }),
      field('observacoes_internas', 'Observações internas', { type: 'textarea', full: true }),
    ]);
    form.appendChild(grid);
    form.appendChild(el('div', { class: 'form-actions' }, [
      el('a', { class: 'btn btn--ghost', href: '#/reservas', text: 'Cancelar' }),
      el('button', { id: 'nova-submit', class: 'btn btn--primary', type: 'submit', text: 'Criar reserva (confirmada)' }),
    ]));

    main.appendChild(form);
  }

  // ─── Router ─────────────────────────────────────────────────────────
  const routes = [
    { re: /^\/dashboard$/, render: () => renderDashboard() },
    { re: /^\/reservas$/, render: () => renderReservasList() },
    { re: /^\/reservas\/nova$/, render: () => renderReservaNova() },
    { re: /^\/reservas\/(\d+)$/, render: (m) => renderReservaDetail(m[1]) },
    { re: /^\/check-in$/, render: () => renderCheckin() },
  ];

  function router() {
    const hash = location.hash.slice(1);
    if (!hash || hash === '/' || hash === '') {
      location.hash = '#/dashboard';
      return;
    }
    renderSidebar();
    for (const route of routes) {
      const m = hash.match(route.re);
      if (m) { route.render(m); return; }
    }
    setMain(el('div', { class: 'empty', text: 'Página não encontrada.' }));
  }

  // ─── Bootstrap ──────────────────────────────────────────────────────
  async function init() {
    try {
      const me = await api('/api/admin/me');
      renderTopbar(me.email);
    } catch (e) {
      renderTopbar(null);
    }
    window.addEventListener('hashchange', router);
    router();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
