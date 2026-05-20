// Flor de Sal — Painel de Reservas (SPA hash-routed).
// Protegido por Cloudflare Access. Nenhum dado é gravado em localStorage.

(function () {
  'use strict';

  // ─── User / permissions state ──────────────────────────────────────
  // Carregado no bootstrap via GET /api/admin/me. NUNCA autoriza nada —
  // só esconde UI. Backend re-valida toda ação.
  const session = {
    user: null,         // { id, nome, sobrenome, email, role, ativo }
    perms: new Set(),   // capabilities da role atual
  };
  const HORARIOS_RESERVA = [
    '12h', '12h30', '13h', '13h30', '14h', '14h30', '15h',
    '19h', '19h30', '20h', '20h30', '21h', '21h30',
  ];
  const HORARIOS_OPTIONS = HORARIOS_RESERVA.map((h) => [h, h]);
  function can(action) { return session.perms.has(action); }

  function roleLabel(r) {
    return ({
      admin: 'Admin',
      gerente: 'Gerente',
      concierge: 'Concierge',
      marketing: 'Marketing',
    })[r] || r || '—';
  }

  const ICONS = {
    dashboard: ['M3 13h8V3H3v10Z', 'M13 21h8V11h-8v10Z', 'M13 3v6h8V3h-8Z', 'M3 21h8v-6H3v6Z'],
    calendar: ['M8 2v4', 'M16 2v4', 'M3 10h18', 'M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z'],
    check: ['M20 6 9 17l-5-5'],
    plus: ['M12 5v14', 'M5 12h14'],
    chart: ['M3 3v18h18', 'M7 15l4-4 3 3 5-7'],
    users: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z', 'M22 21v-2a4 4 0 0 0-3-3.87', 'M16 3.13a4 4 0 0 1 0 7.75'],
    user: ['M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2', 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z'],
    search: ['M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z', 'M21 21l-4.35-4.35'],
    erase: ['M3 17l6-6 4 4-6 6H3v-4Z', 'M14 4l6 6-7 7-6-6 7-7Z'],
    open: ['M7 7h10v10', 'M7 17 17 7'],
    whatsapp: ['M21 11.5a8.5 8.5 0 0 1-12.4 7.55L3 21l1.95-5.45A8.5 8.5 0 1 1 21 11.5Z', 'M8.8 8.8c.35 3 2.4 5.25 5.45 5.9l1.25-1.25-2.05-1.05-.8.8c-1.15-.55-2.05-1.45-2.6-2.6l.8-.8-1.05-2.05L8.8 8.8Z'],
    save: ['M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z', 'M17 21v-8H7v8', 'M7 3v5h8'],
    download: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'M7 10l5 5 5-5', 'M12 15V3'],
    logout: ['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4', 'M16 17l5-5-5-5', 'M21 12H9'],
  };

  function icon(name) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'ui-icon');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    for (const d of ICONS[name] || ICONS.open) {
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('d', d);
      svg.appendChild(p);
    }
    return svg;
  }

  function iconText(name, text) {
    return [icon(name), el('span', { text })];
  }

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
    if (r.status === 401) {
      // CF Access provavelmente expirou a sessão. Reload força re-auth.
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
      const code = body && body.error && body.error.code;
      const msg = body && body.error && body.error.message ? body.error.message : `HTTP ${r.status}`;
      const fields = body && body.error && body.error.fields;
      throw { kind: 'api', status: r.status, code, message: msg, fields };
    }
    return body;
  }

  // ─── Blocking screens (no_account / inactive / forbidden) ───────────
  function renderBlockingScreen({ title, message, showLogout = true }) {
    document.body.innerHTML = '';
    const wrap = el('div', {
      class: 'blocking',
      style: 'min-height:100vh;display:grid;place-items:center;padding:2rem;',
    }, [
      el('div', { class: 'card', style: 'max-width:520px;text-align:left;' }, [
        el('h1', { style: 'margin:0 0 .75rem;font-size:1.3rem;', text: title }),
        el('p', { class: 'muted', style: 'margin:0 0 1.25rem;line-height:1.5;', text: message }),
        showLogout ? el('a', {
          class: 'btn btn--ghost', href: '/cdn-cgi/access/logout', text: 'Sair e tentar com outra conta',
        }) : null,
      ]),
    ]);
    document.body.appendChild(wrap);
  }

  function renderAccessDenied(message) {
    setMain(el('div', { class: 'access-denied' }, [
      el('div', { class: 'card', style: 'max-width:520px;margin:2rem auto;' }, [
        el('h2', { style: 'margin:0 0 .75rem;font-size:1.15rem;', text: 'Acesso negado' }),
        el('p', { class: 'muted', style: 'margin:0;line-height:1.5;',
          text: message || 'Você não tem permissão para acessar essa página. Procure o administrador se acredita que isso é um erro.',
        }),
      ]),
    ]));
  }

  // ─── Info modal (apenas "Entendi", pra avisos pós-ação) ────────────
  function infoModal(title, contentNode) {
    return new Promise((resolve) => {
      const overlay = el('div', {
        class: 'modal-overlay',
        style: 'position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:50;display:flex;align-items:center;justify-content:center;padding:1rem;',
      });
      const close = () => { overlay.remove(); resolve(); };
      const dialog = el('div', { class: 'card', style: 'max-width:540px;width:100%;' }, [
        el('h3', { style: 'margin:0 0 1rem;font-size:1.05rem;', text: title }),
        contentNode,
        el('div', { class: 'form-actions' }, [
          el('button', { class: 'btn btn--primary', type: 'button', text: 'Entendi', onclick: close }),
        ]),
      ]);
      overlay.appendChild(dialog);
      overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
      document.body.appendChild(overlay);
    });
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
  function renderTopbar() {
    const bar = $('#topbar');
    clear(bar);
    bar.appendChild(el('a', {
      class: 'topbar__brand',
      href: '#/reservas',
      title: 'Ir para Reservas',
      'aria-label': 'Ir para a tela de reservas',
    }, [
      el('img', {
        class: 'topbar__logo',
        src: '/Identidade%20Visual/SVG/Logotipo_Flor de Sal - Dourado_Completa.svg',
        alt: 'Flor de Sal',
      }),
      el('span', { class: 'topbar__divider', text: '|' }),
      el('span', { class: 'topbar__title', text: 'Painel de Reservas' }),
    ]));
    const userBox = el('div', { class: 'topbar__user' });
    const u = session.user;
    if (u) {
      const displayName = [u.nome, u.sobrenome].filter(Boolean).join(' ') || u.email;
      userBox.appendChild(el('a', {
        href: '#/perfil',
        class: 'topbar__name',
        title: u.email,
        text: displayName,
      }));
      userBox.appendChild(el('span', {
        class: `badge badge--role-${u.role}`,
        text: roleLabel(u.role),
      }));
    }
    userBox.appendChild(el('a', { href: '/cdn-cgi/access/logout' }, iconText('logout', 'Sair')));
    bar.appendChild(userBox);
  }

  // Cada item declara a capability necessária (ou null = todos).
  const NAV_ALL = [
    { hash: '#/reservas',      label: 'Reservas',     icon: 'calendar',  perm: 'view_reservas' },
    { hash: '#/reservas/nova', label: 'Nova reserva', icon: 'plus',      perm: 'create_reserva' },
    { hash: '#/check-in',      label: 'Check-in',     icon: 'check',     perm: 'view_reservas' },
    { hash: '#/dashboard',     label: 'Dashboard',    icon: 'dashboard', perm: 'view_dashboard' },
    { hash: '#/relatorios',    label: 'Relatórios',   icon: 'chart',     perm: 'view_reports' },
    { hash: '#/usuarios',      label: 'Usuários',     icon: 'users',     perm: 'manage_users' },
    { hash: '#/perfil',        label: 'Meu perfil',   icon: 'user',      perm: null },
  ];
  function visibleNav() {
    return NAV_ALL.filter((i) => i.perm == null || can(i.perm));
  }
  function renderSidebar() {
    const nav = $('#sidebar-nav');
    clear(nav);
    for (const item of visibleNav()) {
      const a = el('a', {
        class: 'sidebar__link',
        href: item.hash,
      }, iconText(item.icon, item.label));
      if (isNavActive(item)) a.classList.add('is-active');
      nav.appendChild(a);
    }
  }

  function isNavActive(item) {
    const hash = location.hash || '#/dashboard';
    if (item.hash === '#/reservas') {
      return hash === '#/reservas' || /^#\/reservas\/\d+$/.test(hash);
    }
    return hash === item.hash || hash.startsWith(`${item.hash}/`);
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
      order_by: 'criado_em', order: 'desc', page: 1, per_page: 25,
      period: 'todas',
    };

    async function load() {
      const main = $('#main');
      clear(main);
      main.appendChild(pageHeader('Reservas', can('create_reserva') ? el('a', {
        class: 'btn btn--primary', href: '#/reservas/nova',
      }, iconText('plus', 'Nova reserva')) : null));
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
      filters.appendChild(buildReservationPeriodBar());
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
        ['', 'Todos'], ...HORARIOS_OPTIONS,
      ], (v) => { state.horario = v; })));
      filters.appendChild(group('Ordenar por', selectEl(`${state.order_by}:${state.order}`, [
        ['data_reserva:asc', 'Data reserva ↑'],
        ['data_reserva:desc', 'Data reserva ↓'],
        ['criado_em:desc', 'Criado em ↓'],
        ['criado_em:asc', 'Criado em ↑'],
      ], (v) => { const [a, b] = v.split(':'); state.order_by = a; state.order = b; })));
      filters.appendChild(el('button', {
        class: 'btn btn--primary', type: 'submit',
      }, iconText('search', 'Aplicar')));
      filters.appendChild(el('button', {
        class: 'btn btn--ghost', type: 'button',
        onclick: () => {
          state.q = state.status = state.origem = state.from = state.to = state.horario = '';
          state.period = 'todas';
          state.order_by = 'criado_em';
          state.order = 'desc';
          state.page = 1; load();
        },
      }, iconText('erase', 'Limpar')));
      return filters;
    }

    function buildReservationPeriodBar() {
      const presets = periodPresets();
      const wrap = el('div', { class: 'filters__group filters__group--full' }, [
        el('label', { class: 'filters__label', text: 'Período' }),
      ]);
      const bar = el('div', { class: 'period-bar period-bar--compact' });
      const options = [
        ['todas', 'Todas'],
        ['hoje', 'Hoje'],
        ['amanha', 'Amanhã'],
        ['semana', 'Esta semana'],
        ['personalizado', 'Personalizado'],
      ];
      for (const [key, label] of options) {
        bar.appendChild(el('button', {
          class: `period-bar__btn${state.period === key ? ' is-active' : ''}`,
          type: 'button',
          text: label,
          onclick: () => {
            state.period = key;
            state.page = 1;
            if (key === 'todas') {
              state.from = '';
              state.to = '';
              state.order_by = 'criado_em';
              state.order = 'desc';
            } else if (key !== 'personalizado') {
              state.from = presets[key].from;
              state.to = presets[key].to;
            }
            load();
          },
        }));
      }
      if (state.period === 'personalizado') {
        bar.appendChild(el('div', { class: 'period-bar__custom' }, [
          el('input', {
            type: 'date',
            value: state.from,
            onchange: (e) => { state.from = e.target.value; state.page = 1; },
          }),
          el('span', { text: 'até' }),
          el('input', {
            type: 'date',
            value: state.to,
            onchange: (e) => { state.to = e.target.value; state.page = 1; },
          }),
        ]));
      }
      wrap.appendChild(bar);
      return wrap;
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
          wa && el('a', { class: 'btn btn--sm btn--ghost', href: wa, target: '_blank', rel: 'noopener' }, iconText('whatsapp', 'WhatsApp')),
          el('a', { class: 'btn btn--sm', href: `#/reservas/${r.id}` }, iconText('open', 'Abrir')),
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

    // Observações internas (editáveis ou read-only conforme permissão)
    const canEditObs = can('edit_reserva_obs');
    const obsTxt = el('textarea', {
      class: 'field__textarea', style: 'width:100%;min-height:90px;',
      value: r.observacoes_internas || '',
      placeholder: canEditObs
        ? 'Anotações internas (não visíveis ao cliente)'
        : 'Sem observações internas',
      readonly: !canEditObs,
    });
    const obsCard = el('div', { class: 'card', style: 'margin-top:1rem;' }, [
      el('h3', { class: 'section__title', style: 'margin:0 0 .7rem;', text: 'Observações internas' }),
      obsTxt,
    ]);
    if (canEditObs) {
    const obsBtn = el('button', { class: 'btn btn--primary btn--sm', type: 'button' }, iconText('save', 'Salvar observações'));
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
      obsCard.appendChild(el('div', { class: 'form-actions' }, [obsBtn]));
    }
    left.appendChild(obsCard);

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

    // Ações de status (só pra quem pode alterar)
    if (can('edit_reserva_status')) {
      right.appendChild(buildActionsCard(r));
    }

    // Exportar voucher (admin/gerente/concierge) — apenas se o status atual
    // permite gerar voucher (confirmada/cancelada/remarcada).
    if (can('export_voucher') && ['confirmada', 'cancelada', 'remarcada'].includes(r.status)) {
      right.appendChild(buildVoucherCard(r));
    }

    // Histórico
    right.appendChild(buildHistoryCard(data.history));

    main.appendChild(el('div', { class: 'detail-grid' }, [left, right]));

    function buildActionsCard(r) {
      const card = el('div', { class: 'card' });
      card.appendChild(el('h3', { class: 'section__title', style: 'margin:0 0 .7rem;', text: 'Ações' }));
      const actions = el('div', { style: 'display:flex;flex-direction:column;gap:.4rem;' });
      const mk = (label, kind, handler) => {
        const iconName = label.includes('Confirmar') || label.includes('comparecimento') ? 'check'
          : label.includes('Remarcar') ? 'calendar'
            : label.includes('Cancelar') || label.includes('no-show') ? 'erase'
              : 'open';
        const b = el('button', { class: `btn${kind === 'primary' ? ' btn--primary' : kind === 'danger' ? ' btn--danger' : ''}`, type: 'button' }, iconText(iconName, label));
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

    function buildVoucherCard(r) {
      // Apenas o voucher do status atual: o tipo varia conforme a reserva.
      const opcao = ({
        confirmada: { tipo: 'confirmada', label: 'Voucher Confirmado' },
        cancelada:  { tipo: 'cancelada',  label: 'Voucher Cancelado' },
        remarcada:  { tipo: 'reagendada', label: 'Voucher Reagendado' },
      })[r.status];
      if (!opcao) return el('div'); // safety — não deveria chegar aqui
      const card = el('div', { class: 'card', style: 'margin-top:1rem;' });
      card.appendChild(el('h3', { class: 'section__title', style: 'margin:0 0 .35rem;', text: 'Exportar voucher' }));
      card.appendChild(el('p', { class: 'muted', style: 'margin:0 0 .7rem;font-size:.82rem;line-height:1.4;',
        text: 'Gera o PDF do voucher com base no status atual da reserva.' }));
      const b = el('button', { class: 'btn btn--primary', type: 'button' }, iconText('download', opcao.label));
      b.addEventListener('click', () => downloadVoucher(r.id, opcao.tipo, b));
      card.appendChild(b);
      return card;
    }

    async function downloadVoucher(reservaId, tipo, btn) {
      btn.disabled = true;
      try {
        const r = await fetch(`/api/admin/reservas/${reservaId}/voucher?tipo=${encodeURIComponent(tipo)}`, {
          credentials: 'same-origin',
        });
        if (!r.ok) {
          let msg = `HTTP ${r.status}`;
          try { const b = await r.json(); if (b.error?.message) msg = b.error.message; } catch {}
          toast(msg, 'error');
          return;
        }
        const blob = await r.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const disp = r.headers.get('Content-Disposition') || '';
        const m = disp.match(/filename="?([^"]+)"?/);
        a.download = m ? m[1] : `voucher-${tipo}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast('Voucher exportado.', 'success');
      } catch (e) {
        toast('Falha ao gerar voucher.', 'error');
      } finally {
        btn.disabled = false;
      }
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
      for (const h of HORARIOS_RESERVA) {
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
        const detailLink = el('a', { class: 'btn btn--sm', href: `#/reservas/${r.id}` }, iconText('open', 'Abrir'));
        actions.appendChild(detailLink);
        if (wa) actions.appendChild(el('a', { class: 'btn btn--sm btn--ghost', href: wa, target: '_blank', rel: 'noopener' }, iconText('whatsapp', 'WhatsApp')));

        if (can('edit_reserva_status')) {
          const compBtn = el('button', { class: 'btn btn--sm btn--primary', type: 'button' }, iconText('check', 'Compareceu'));
          const today = isoLocal(new Date());
          if (date > today) {
            compBtn.disabled = true;
            compBtn.title = 'Comparecimento só pode ser marcado no dia da reserva ou depois.';
          } else {
            compBtn.addEventListener('click', async () => {
              compBtn.disabled = true;
              try {
                await api(`/api/admin/reservas/${r.id}/status`, { method: 'PATCH', body: JSON.stringify({ status_novo: 'compareceu' }) });
                toast(`${r.nome}: marcado como compareceu`, 'success');
                load();
              } catch (e) { compBtn.disabled = false; toast(e.message, 'error'); }
            });
          }
          actions.appendChild(compBtn);

          const noShowBtn = el('button', { class: 'btn btn--sm btn--danger', type: 'button' }, iconText('erase', 'No-show'));
          noShowBtn.addEventListener('click', async () => {
            if (!confirm(`Confirmar no-show para ${r.nome}?`)) return;
            noShowBtn.disabled = true;
            try {
              await api(`/api/admin/reservas/${r.id}/status`, { method: 'PATCH', body: JSON.stringify({ status_novo: 'no_show' }) });
              toast(`${r.nome}: no-show`, 'success'); load();
            } catch (e) { noShowBtn.disabled = false; toast(e.message, 'error'); }
          });
          actions.appendChild(noShowBtn);

          const remarcarBtn = el('button', { class: 'btn btn--sm', type: 'button' }, iconText('calendar', 'Remarcar'));
          remarcarBtn.addEventListener('click', () => promptRemarcarInline(r));
          actions.appendChild(remarcarBtn);

          const cancelarBtn = el('button', { class: 'btn btn--sm btn--danger', type: 'button' }, iconText('erase', 'Cancelar'));
          cancelarBtn.addEventListener('click', () => promptCancelarInline(r));
          actions.appendChild(cancelarBtn);
        }

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
        for (const h of HORARIOS_RESERVA) {
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
        ...HORARIOS_OPTIONS,
      ]}),
      field('adultos', 'Adultos', { type: 'number', value: '2', min: 1, max: 30, required: true }),
      field('criancas', 'Crianças', { type: 'number', value: '0', min: 0, max: 30 }),
      field('observacoes', 'Observações (cliente)', { type: 'textarea', full: true }),
      field('observacoes_internas', 'Observações internas', { type: 'textarea', full: true }),
    ]);
    form.appendChild(grid);
    form.appendChild(el('div', { class: 'form-actions' }, [
      el('a', { class: 'btn btn--ghost', href: '#/reservas' }, iconText('erase', 'Cancelar')),
      el('button', { id: 'nova-submit', class: 'btn btn--primary', type: 'submit' }, iconText('plus', 'Criar reserva')),
    ]));

    main.appendChild(form);
  }

  // ─── Page: Usuários ────────────────────────────────────────────────
  async function renderUsuarios() {
    const main = $('#main');
    clear(main);

    const novoBtn = el('button', { class: 'btn btn--primary', type: 'button' }, iconText('plus', 'Novo usuário'));
    novoBtn.addEventListener('click', () => openUserModal(null));
    main.appendChild(pageHeader('Usuários', novoBtn));

    const placeholder = el('div', { class: 'loading', text: 'Carregando…' });
    main.appendChild(placeholder);

    let data;
    try {
      data = await api('/api/admin/users');
    } catch (e) {
      placeholder.remove();
      main.appendChild(el('div', { class: 'empty', text: `Erro: ${e.message}` }));
      return;
    }
    placeholder.remove();
    main.appendChild(buildTable(data.items));

    function buildTable(items) {
      if (!items.length) {
        return el('div', { class: 'empty', text: 'Nenhum usuário cadastrado.' });
      }
      const wrap = el('div', { class: 'table-wrap' });
      const table = el('table', { class: 'table' });
      table.appendChild(el('thead', null, [
        el('tr', null, [
          el('th', { text: 'Nome' }),
          el('th', { text: 'E-mail' }),
          el('th', { text: 'Papel' }),
          el('th', { text: 'Status' }),
          el('th', { text: '' }),
        ]),
      ]));
      const tbody = el('tbody');
      for (const u of items) {
        const isSelf = session.user && u.id === session.user.id;
        const acts = el('div', { class: 'table__actions' }, [
          el('button', { class: 'btn btn--sm', type: 'button',
            onclick: () => openUserModal(u) }, iconText('user', 'Editar')),
          el('button', {
            class: `btn btn--sm ${u.ativo ? 'btn--danger' : 'btn--primary'}`,
            type: 'button',
            disabled: isSelf && u.ativo === 1,
            title: isSelf && u.ativo === 1 ? 'Você não pode desativar a si mesmo' : null,
            onclick: () => toggleAtivo(u),
          }, iconText(u.ativo ? 'erase' : 'check', u.ativo ? 'Desativar' : 'Reativar')),
        ]);
        tbody.appendChild(el('tr', { class: u.ativo ? '' : 'is-inactive' }, [
          el('td', { text: [u.nome, u.sobrenome].filter(Boolean).join(' ') }),
          el('td', { class: 'mono', text: u.email }),
          el('td', null, [el('span', { class: `badge badge--role-${u.role}`, text: roleLabel(u.role) })]),
          el('td', null, [el('span', { class: `badge ${u.ativo ? 'badge--ativo' : 'badge--inativo'}`, text: u.ativo ? 'Ativo' : 'Inativo' })]),
          el('td', null, [acts]),
        ]));
      }
      table.appendChild(tbody);
      wrap.appendChild(table);
      return wrap;
    }

    async function toggleAtivo(u) {
      const acao = u.ativo ? 'desativar' : 'reativar';
      if (!confirm(`Tem certeza que quer ${acao} ${u.nome}?`)) return;
      try {
        await api(`/api/admin/users/${u.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ ativo: u.ativo ? 0 : 1 }),
        });
        toast(`Usuário ${u.ativo ? 'desativado' : 'reativado'}.`, 'success');
        renderUsuarios();
      } catch (e) { toast(e.message, 'error'); }
    }

    async function openUserModal(existing) {
      const nomeInput = el('input', { class: 'field__input', type: 'text', value: existing?.nome || '' });
      const sobrenomeInput = el('input', { class: 'field__input', type: 'text', value: existing?.sobrenome || '' });
      const emailInput = el('input', {
        class: 'field__input', type: 'email',
        value: existing?.email || '',
        readonly: !!existing,
        placeholder: 'pessoa@empresa.com.br',
      });
      const roleSel = el('select', { class: 'field__select' });
      for (const [v, l] of [
        ['concierge', 'Concierge'], ['gerente', 'Gerente'],
        ['marketing', 'Marketing'], ['admin', 'Admin'],
      ]) {
        roleSel.appendChild(el('option', { value: v, text: l, selected: (existing?.role || 'concierge') === v }));
      }
      // Não permitir trocar a própria role (backend já bloqueia).
      if (existing && session.user && existing.id === session.user.id) {
        roleSel.disabled = true;
        roleSel.title = 'Você não pode alterar a própria role';
      }
      const errEl = el('p', { class: 'field__error' });

      const content = el('div', { class: 'form-grid' }, [
        el('div', { class: 'field' }, [el('label', { class: 'field__label', text: 'Nome' }), nomeInput]),
        el('div', { class: 'field' }, [el('label', { class: 'field__label', text: 'Sobrenome' }), sobrenomeInput]),
        el('div', { class: 'field field--full' }, [
          el('label', { class: 'field__label', text: 'E-mail' }),
          emailInput,
          existing ? el('p', { class: 'muted', style: 'margin:.25rem 0 0;font-size:.8rem;',
            text: 'E-mail não pode ser alterado. Recrie o usuário se precisar trocar.' }) : null,
        ]),
        el('div', { class: 'field field--full' }, [el('label', { class: 'field__label', text: 'Papel' }), roleSel]),
        el('div', { class: 'field field--full' }, [errEl]),
      ]);

      const result = await modal(existing ? 'Editar usuário' : 'Novo usuário', content, () => {
        const nome = nomeInput.value.trim();
        const email = emailInput.value.trim();
        if (!nome || nome.length < 2) { errEl.textContent = 'Nome obrigatório (2+ chars).'; return false; }
        if (!existing) {
          if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            errEl.textContent = 'E-mail inválido.'; return false;
          }
        }
        return {
          nome,
          sobrenome: sobrenomeInput.value.trim(),
          ...(existing ? {} : { email }),
          role: roleSel.value,
        };
      });
      if (!result) return;

      try {
        if (existing) {
          await api(`/api/admin/users/${existing.id}`, { method: 'PATCH', body: JSON.stringify(result) });
          toast('Usuário atualizado.', 'success');
          renderUsuarios();
        } else {
          await api('/api/admin/users', { method: 'POST', body: JSON.stringify(result) });
          renderUsuarios();
          await showNextStepsAfterCreate(result.email);
        }
      } catch (e) {
        let msg = e.message;
        if (e.fields) msg += ': ' + e.fields.map((f) => `${f.field} ${f.message}`).join(', ');
        toast(msg, 'error');
      }
    }

    async function showNextStepsAfterCreate(email) {
      const content = el('div', null, [
        el('p', { class: 'muted', style: 'margin:0 0 1rem;line-height:1.5;',
          text: 'O usuário foi criado no painel, mas ainda não consegue logar. Faltam dois passos manuais:' }),
        el('ol', { style: 'margin:0 0 1rem;padding-left:1.25rem;line-height:1.6;' }, [
          el('li', null, [
            el('strong', { text: 'Liberar o e-mail no Cloudflare Access.' }),
            el('br'),
            el('span', { class: 'muted', style: 'font-size:.85rem;',
              text: 'Zero Trust → Access → Applications → Flor de Sal — Admin → Policies → Equipe Flor de Sal → adicionar ' }),
            el('span', { class: 'mono', style: 'font-size:.85rem;', text: email }),
            el('span', { class: 'muted', style: 'font-size:.85rem;', text: ' → Save.' }),
          ]),
          el('li', { style: 'margin-top:.6rem;' }, [
            el('strong', { text: 'Avisar a pessoa.' }),
            el('br'),
            el('span', { class: 'muted', style: 'font-size:.85rem;',
              text: 'Ela acessa flordesal.saishotel.com.br/admin e recebe um código de 6 dígitos no e-mail ' }),
            el('span', { class: 'mono', style: 'font-size:.85rem;', text: email }),
            el('span', { class: 'muted', style: 'font-size:.85rem;', text: '.' }),
          ]),
        ]),
        el('p', { class: 'muted', style: 'margin:0;font-size:.8rem;',
          text: 'Sem o passo 1, o Cloudflare bloqueia antes do painel.' }),
      ]);
      await infoModal('Usuário criado — próximos passos', content);
    }
  }

  // ─── Page: Perfil ──────────────────────────────────────────────────
  async function renderPerfil() {
    const main = $('#main');
    clear(main);
    main.appendChild(pageHeader('Meu perfil'));

    const placeholder = el('div', { class: 'loading', text: 'Carregando…' });
    main.appendChild(placeholder);

    let data;
    try { data = await api('/api/admin/users/me'); }
    catch (e) {
      placeholder.remove();
      main.appendChild(el('div', { class: 'empty', text: `Erro: ${e.message}` }));
      return;
    }
    placeholder.remove();
    const u = data.user;

    const nomeInput = el('input', { class: 'field__input', type: 'text', value: u.nome || '' });
    const sobrenomeInput = el('input', { class: 'field__input', type: 'text', value: u.sobrenome || '' });

    const card = el('form', {
      class: 'card', style: 'max-width:560px;',
      onsubmit: async (e) => {
        e.preventDefault();
        try {
          const r = await api('/api/admin/users/me', {
            method: 'PATCH',
            body: JSON.stringify({
              nome: nomeInput.value.trim(),
              sobrenome: sobrenomeInput.value.trim(),
            }),
          });
          // Atualiza sessão local + topbar
          session.user = { ...session.user, nome: r.user.nome, sobrenome: r.user.sobrenome };
          renderTopbar();
          toast('Perfil atualizado.', 'success');
        } catch (err) {
          let msg = err.message;
          if (err.fields) msg += ': ' + err.fields.map((f) => `${f.field} ${f.message}`).join(', ');
          toast(msg, 'error');
        }
      },
    });

    card.appendChild(el('div', { class: 'form-grid' }, [
      el('div', { class: 'field' }, [el('label', { class: 'field__label', text: 'Nome' }), nomeInput]),
      el('div', { class: 'field' }, [el('label', { class: 'field__label', text: 'Sobrenome' }), sobrenomeInput]),
      el('div', { class: 'field field--full' }, [
        el('label', { class: 'field__label', text: 'E-mail' }),
        el('input', { class: 'field__input', type: 'email', value: u.email, readonly: true }),
        el('p', { class: 'muted', style: 'margin:.25rem 0 0;font-size:.8rem;',
          text: 'E-mail vem do Cloudflare Access — alteração precisa ser feita pelo administrador.' }),
      ]),
      el('div', { class: 'field field--full' }, [
        el('label', { class: 'field__label', text: 'Papel' }),
        el('div', null, [el('span', { class: `badge badge--role-${u.role}`, text: roleLabel(u.role) })]),
        el('p', { class: 'muted', style: 'margin:.25rem 0 0;font-size:.8rem;',
          text: 'Só o administrador pode mudar papéis.' }),
      ]),
    ]));
    card.appendChild(el('div', { class: 'form-actions' }, [
      el('button', { class: 'btn btn--primary', type: 'submit' }, iconText('save', 'Salvar perfil')),
    ]));

    main.appendChild(card);
  }

  // ─── Page: Relatórios ──────────────────────────────────────────────
  async function renderRelatorios() {
    const main = $('#main');

    // Estado dos filtros. Default = últimos 30 dias.
    const state = {
      preset: 'last_30d',
      from: '',
      to: '',
      origem: '',
      status: '',
      utm_campaign: '',
      horario: '',
    };

    let filtrosCache = null;

    function buildQs() {
      const qs = new URLSearchParams();
      // Se preset estiver setado e não for "custom", manda só preset.
      // Senão manda from/to.
      if (state.preset && state.preset !== 'custom') {
        qs.set('preset', state.preset);
      } else if (state.from && state.to) {
        qs.set('from', state.from);
        qs.set('to', state.to);
      }
      for (const k of ['origem', 'status', 'utm_campaign', 'horario']) {
        if (state[k]) qs.set(k, state[k]);
      }
      return qs;
    }

    async function load() {
      clear(main);
      main.appendChild(pageHeader('Relatórios', el('div', { class: 'row' }, [
        can('export_csv') ? el('button', {
          class: 'btn btn--primary',
          type: 'button',
          onclick: exportCsv,
        }, iconText('download', 'Exportar CSV')) : null,
      ])));

      // Aviso de "sem valor financeiro" — deixar claro o escopo do relatório.
      main.appendChild(el('p', {
        class: 'muted',
        style: 'margin: -0.5rem 0 1.25rem; font-size: 0.85rem; line-height: 1.5;',
        text: 'Estes relatórios medem volume e comportamento das reservas — não há valores financeiros aqui.',
      }));

      // Filtros
      if (!filtrosCache) {
        try {
          filtrosCache = await api('/api/admin/relatorios/filtros');
        } catch (e) {
          filtrosCache = { origens: [], status: [], horarios: [], campanhas: [] };
        }
      }
      main.appendChild(buildFilters());

      // Métricas
      const placeholder = el('div', { class: 'loading', text: 'Carregando métricas…' });
      main.appendChild(placeholder);

      let data;
      try {
        data = await api(`/api/admin/relatorios/metricas?${buildQs()}`);
      } catch (e) {
        placeholder.remove();
        let msg = e.message;
        if (e.fields) msg += ': ' + e.fields.map((f) => `${f.field} ${f.message}`).join(', ');
        main.appendChild(el('div', { class: 'empty', text: `Erro: ${msg}` }));
        return;
      }
      placeholder.remove();
      renderConteudo(data);
    }

    function buildFilters() {
      const form = el('form', {
        class: 'filters',
        onsubmit: (e) => { e.preventDefault(); load(); },
      });

      // Presets (botões em linha)
      const presets = el('div', { class: 'filters__group filters__group--full' }, [
        el('label', { class: 'filters__label', text: 'Período' }),
        el('div', { class: 'preset-chips' }, [
          ['today', 'Hoje'],
          ['yesterday', 'Ontem'],
          ['week', 'Esta semana'],
          ['month', 'Este mês'],
          ['last_30d', 'Últimos 30 dias'],
          ['custom', 'Personalizado'],
        ].map(([v, l]) => {
          const btn = el('button', {
            class: `chip${state.preset === v ? ' chip--active' : ''}`,
            type: 'button',
            text: l,
            onclick: () => {
              state.preset = v;
              if (v !== 'custom') { state.from = ''; state.to = ''; }
              load();
            },
          });
          return btn;
        })),
      ]);
      form.appendChild(presets);

      // From/To só aparecem com preset=custom
      if (state.preset === 'custom') {
        form.appendChild(group('De', el('input', {
          class: 'filters__input', type: 'date', value: state.from,
          oninput: (e) => { state.from = e.target.value; },
        })));
        form.appendChild(group('Até', el('input', {
          class: 'filters__input', type: 'date', value: state.to,
          oninput: (e) => { state.to = e.target.value; },
        })));
      }

      // Origem
      form.appendChild(group('Origem', selectEl(state.origem, [
        ['', 'Todas'],
        ...(filtrosCache.origens || []).map((o) => [o, origemLabel(o)]),
      ], (v) => { state.origem = v; })));

      // Status
      form.appendChild(group('Status', selectEl(state.status, [
        ['', 'Todos'],
        ...(filtrosCache.status || []).map((s) => [s, statusLabel(s)]),
      ], (v) => { state.status = v; })));

      // Horário
      form.appendChild(group('Horário', selectEl(state.horario, [
        ['', 'Todos'],
        ...(filtrosCache.horarios || []).map((h) => [h, h]),
      ], (v) => { state.horario = v; })));

      // Campanha (só se houver e o user vê UTMs)
      if (filtrosCache.campanhas && filtrosCache.campanhas.length) {
        form.appendChild(group('Campanha', selectEl(state.utm_campaign, [
          ['', 'Todas'],
          ...filtrosCache.campanhas.map((c) => [c, c]),
        ], (v) => { state.utm_campaign = v; })));
      }

      form.appendChild(el('button', { class: 'btn btn--primary', type: 'submit' }, iconText('search', 'Aplicar')));
      form.appendChild(el('button', {
        class: 'btn btn--ghost', type: 'button',
        onclick: () => {
          state.preset = 'last_30d'; state.from = ''; state.to = '';
          state.origem = ''; state.status = ''; state.utm_campaign = ''; state.horario = '';
          load();
        },
      }, iconText('erase', 'Limpar')));

      return form;
    }

    function group(label, child) {
      return el('div', { class: 'filters__group' }, [
        el('label', { class: 'filters__label', text: label }),
        child,
      ]);
    }
    function selectEl(value, opts, onChange) {
      const sel = el('select', { class: 'filters__select', onchange: (e) => onChange(e.target.value) });
      for (const [v, l] of opts) sel.appendChild(el('option', { value: v, text: l, selected: v === value }));
      return sel;
    }

    function renderConteudo(data) {
      // Indicador do período aplicado
      main.appendChild(el('p', {
        class: 'muted',
        style: 'margin: 0 0 1rem; font-size: 0.85rem;',
        text: `Período aplicado: ${fmtDateBr(data.period.from)} até ${fmtDateBr(data.period.to)}`,
      }));

      // Cards principais
      main.appendChild(buildCards(data));

      // Gráfico por dia
      if (data.por_dia && data.por_dia.length) {
        main.appendChild(buildChart(data.por_dia));
      } else {
        main.appendChild(el('div', { class: 'card', style: 'margin-bottom:1rem;' }, [
          el('h3', { class: 'section__title', style: 'margin:0 0 .5rem;', text: 'Reservas por dia' }),
          el('p', { class: 'muted', style: 'margin:0;', text: 'Sem dados no período.' }),
        ]));
      }

      // Por origem
      main.appendChild(buildOrigemTable(data.por_origem));

      // Por campanha (só se a role vê UTMs — backend nula `por_campanha` pra gerente)
      if (data.por_campanha) {
        main.appendChild(buildCampanhaTable(data.por_campanha));
      }

      // Por horário
      main.appendChild(buildHorarioTable(data.por_horario));
    }

    function buildCards(data) {
      const t = data.totais;
      const r = data.taxas;
      const cards = [
        ['Solicitadas',         fmtInt(t.solicitada)],
        ['Aguardando',          fmtInt(t.aguardando_resposta)],
        ['Confirmadas',         fmtInt(t.confirmada)],
        ['Remarcadas',          fmtInt(t.remarcada)],
        ['Cancelas',            fmtInt(t.cancelada), 'danger'],
        ['Compareceram',        fmtInt(t.compareceu), 'success'],
        ['No-show',             fmtInt(t.no_show), 'danger'],
        ['Pessoas confirmadas', fmtInt(t.pessoas_confirmadas)],
        ['Pessoas compareceram', fmtInt(t.pessoas_compareceu)],
        ['Tx. confirmação',     fmtPct(r.taxa_confirmacao)],
        ['Tx. comparecimento',  fmtPct(r.taxa_comparecimento), 'success'],
        ['Tx. cancelamento',    fmtPct(r.taxa_cancelamento), 'danger'],
        ['Tx. no-show',         fmtPct(r.taxa_no_show), 'danger'],
      ];
      const grid = el('div', { class: 'kpi-grid' });
      for (const [label, value, kind] of cards) {
        grid.appendChild(el('div', { class: `kpi${kind ? ` kpi--${kind}` : ''}` }, [
          el('div', { class: 'kpi__label', text: label }),
          el('div', { class: 'kpi__value', text: value }),
        ]));
      }
      return grid;
    }

    function buildChart(porDia) {
      // SVG bar chart inline. Sem dependência externa. CSP-safe.
      const card = el('div', { class: 'card', style: 'margin-bottom:1rem;' });
      card.appendChild(el('h3', { class: 'section__title', style: 'margin:0 0 .75rem;', text: 'Reservas por dia' }));

      const max = Math.max(1, ...porDia.map((d) => d.total));
      const W = 800;       // viewBox width
      const H = 220;       // viewBox height
      const PAD_L = 36;
      const PAD_R = 12;
      const PAD_T = 12;
      const PAD_B = 38;
      const chartW = W - PAD_L - PAD_R;
      const chartH = H - PAD_T - PAD_B;
      const n = porDia.length;
      const barW = chartW / n;
      const innerW = Math.max(2, barW - 4);

      function svgEl(tag, attrs, children) {
        const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
        for (const k in attrs) {
          if (attrs[k] != null) node.setAttribute(k, attrs[k]);
        }
        if (children) {
          for (const c of children) if (c) node.appendChild(c);
        }
        return node;
      }

      const svg = svgEl('svg', {
        viewBox: `0 0 ${W} ${H}`, class: 'chart',
        role: 'img', 'aria-label': 'Reservas por dia',
      });

      // Eixo Y — 4 ticks (0, max/4, max/2, 3max/4, max).
      const ticks = [0, 0.25, 0.5, 0.75, 1];
      for (const t of ticks) {
        const y = PAD_T + chartH * (1 - t);
        const val = Math.round(max * t);
        svg.appendChild(svgEl('line', {
          x1: PAD_L, y1: y, x2: W - PAD_R, y2: y,
          class: 'chart__grid',
        }));
        svg.appendChild(svgEl('text', {
          x: PAD_L - 6, y: y + 3, 'text-anchor': 'end',
          class: 'chart__axis',
        }, [document.createTextNode(String(val))]));
      }

      // Barras + labels do eixo X (mostra ~6 labels distribuídos).
      const labelStep = Math.max(1, Math.ceil(n / 8));
      for (let i = 0; i < n; i++) {
        const d = porDia[i];
        const x = PAD_L + i * barW + 2;
        const h = chartH * (d.total / max);
        const y = PAD_T + chartH - h;
        const bar = svgEl('rect', {
          x, y, width: innerW, height: h,
          class: 'chart__bar',
        });
        // Tooltip nativo via <title>
        const title = svgEl('title', {}, [document.createTextNode(
          `${fmtDateBr(d.dia)} — ${d.total} reservas (${d.pessoas} pessoas)`
        )]);
        bar.appendChild(title);
        svg.appendChild(bar);

        // Compareceu sobrepondo (verde)
        if (d.compareceu > 0) {
          const ch = chartH * (d.compareceu / max);
          svg.appendChild(svgEl('rect', {
            x, y: PAD_T + chartH - ch, width: innerW, height: ch,
            class: 'chart__bar chart__bar--compareceu',
          }));
        }

        // Label de data
        if (i % labelStep === 0 || i === n - 1) {
          const [, mm, dd] = d.dia.split('-');
          svg.appendChild(svgEl('text', {
            x: x + innerW / 2, y: PAD_T + chartH + 16,
            'text-anchor': 'middle', class: 'chart__axis',
          }, [document.createTextNode(`${dd}/${mm}`)]));
        }
      }

      card.appendChild(svg);
      card.appendChild(el('div', { class: 'chart__legend' }, [
        el('span', { class: 'chart__legend-item' }, [
          el('span', { class: 'chart__legend-swatch chart__legend-swatch--total' }),
          document.createTextNode(' Total'),
        ]),
        el('span', { class: 'chart__legend-item' }, [
          el('span', { class: 'chart__legend-swatch chart__legend-swatch--compareceu' }),
          document.createTextNode(' Compareceram'),
        ]),
      ]));
      return card;
    }

    function buildOrigemTable(rows) {
      const card = el('div', { class: 'card', style: 'margin-bottom:1rem;' });
      card.appendChild(el('h3', { class: 'section__title', style: 'margin:0 0 .75rem;', text: 'Métricas por origem' }));
      if (!rows || !rows.length) {
        card.appendChild(el('p', { class: 'muted', style: 'margin:0;', text: 'Sem dados no período.' }));
        return card;
      }
      const wrap = el('div', { class: 'table-wrap' });
      const table = el('table', { class: 'table table--dense' });
      table.appendChild(el('thead', null, [
        el('tr', null, [
          el('th', { text: 'Origem' }),
          el('th', { text: 'Solicitadas' }),
          el('th', { text: 'Confirmadas' }),
          el('th', { text: 'Compareceram' }),
          el('th', { text: 'Canceladas' }),
          el('th', { text: 'No-show' }),
          el('th', { text: 'Tx. comparecimento' }),
        ]),
      ]));
      const tbody = el('tbody');
      for (const r of rows) {
        tbody.appendChild(el('tr', null, [
          el('td', null, [el('span', { class: `badge badge--origem-${r.origem}`, text: origemLabel(r.origem) })]),
          el('td', { text: fmtInt(r.solicitada) }),
          el('td', { text: fmtInt(r.confirmada) }),
          el('td', { text: fmtInt(r.compareceu) }),
          el('td', { text: fmtInt(r.cancelada) }),
          el('td', { text: fmtInt(r.no_show) }),
          el('td', { text: fmtPct(r.taxa_comparecimento) }),
        ]));
      }
      table.appendChild(tbody);
      wrap.appendChild(table);
      card.appendChild(wrap);
      return card;
    }

    function buildCampanhaTable(rows) {
      const card = el('div', { class: 'card', style: 'margin-bottom:1rem;' });
      card.appendChild(el('h3', { class: 'section__title', style: 'margin:0 0 .75rem;', text: 'Métricas por campanha (UTM)' }));
      if (!rows || !rows.length) {
        card.appendChild(el('p', { class: 'muted', style: 'margin:0;', text: 'Sem campanhas com dados no período.' }));
        return card;
      }
      const wrap = el('div', { class: 'table-wrap' });
      const table = el('table', { class: 'table table--dense' });
      table.appendChild(el('thead', null, [
        el('tr', null, [
          el('th', { text: 'Campanha' }),
          el('th', { text: 'Source' }),
          el('th', { text: 'Medium' }),
          el('th', { text: 'Solicitadas' }),
          el('th', { text: 'Confirmadas' }),
          el('th', { text: 'Compareceram' }),
          el('th', { text: 'Canceladas' }),
          el('th', { text: 'No-show' }),
          el('th', { text: 'Tx. comparecimento' }),
        ]),
      ]));
      const tbody = el('tbody');
      for (const r of rows) {
        tbody.appendChild(el('tr', null, [
          el('td', { text: r.campanha }),
          el('td', { class: 'mono', text: r.source }),
          el('td', { class: 'mono', text: r.medium }),
          el('td', { text: fmtInt(r.solicitada) }),
          el('td', { text: fmtInt(r.confirmada) }),
          el('td', { text: fmtInt(r.compareceu) }),
          el('td', { text: fmtInt(r.cancelada) }),
          el('td', { text: fmtInt(r.no_show) }),
          el('td', { text: fmtPct(r.taxa_comparecimento) }),
        ]));
      }
      table.appendChild(tbody);
      wrap.appendChild(table);
      card.appendChild(wrap);
      return card;
    }

    function buildHorarioTable(rows) {
      const card = el('div', { class: 'card', style: 'margin-bottom:1rem;' });
      card.appendChild(el('h3', { class: 'section__title', style: 'margin:0 0 .75rem;', text: 'Horários mais procurados' }));
      if (!rows || !rows.length) {
        card.appendChild(el('p', { class: 'muted', style: 'margin:0;', text: 'Sem dados no período.' }));
        return card;
      }
      const wrap = el('div', { class: 'table-wrap' });
      const table = el('table', { class: 'table table--dense' });
      table.appendChild(el('thead', null, [
        el('tr', null, [
          el('th', { text: 'Horário' }),
          el('th', { text: 'Reservas' }),
          el('th', { text: 'Pessoas' }),
          el('th', { text: 'Confirmadas' }),
          el('th', { text: 'Compareceram' }),
          el('th', { text: 'Tx. comparecimento' }),
          el('th', { text: 'Tx. cancelamento' }),
        ]),
      ]));
      const tbody = el('tbody');
      // Sort por total desc pra "mais procurados"
      const sorted = [...rows].sort((a, b) => (b.total || 0) - (a.total || 0));
      for (const r of sorted) {
        tbody.appendChild(el('tr', null, [
          el('td', { text: r.horario }),
          el('td', { text: fmtInt(r.total) }),
          el('td', { text: fmtInt(r.pessoas) }),
          el('td', { text: fmtInt(r.confirmada) }),
          el('td', { text: fmtInt(r.compareceu) }),
          el('td', { text: fmtPct(r.taxa_comparecimento) }),
          el('td', { text: fmtPct(r.taxa_cancelamento) }),
        ]));
      }
      table.appendChild(tbody);
      wrap.appendChild(table);
      card.appendChild(wrap);
      return card;
    }

    function origemLabel(o) {
      return ({
        lp: 'LP', manual: 'Manual', google: 'Google',
        meta: 'Meta Ads', instagram: 'Instagram', direct: 'Direto',
        organic: 'Orgânico', outro: 'Outro',
      })[o] || o;
    }

    async function exportCsv() {
      // Download via link temporário pra preservar headers (Content-Disposition).
      try {
        const r = await fetch(`/api/admin/relatorios/export?${buildQs()}`, {
          credentials: 'same-origin',
        });
        if (!r.ok) {
          let msg = `HTTP ${r.status}`;
          try { const b = await r.json(); if (b.error?.message) msg = b.error.message; } catch {}
          toast(msg, 'error');
          return;
        }
        const blob = await r.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        // Tenta extrair filename do header; senão usa default.
        const disp = r.headers.get('Content-Disposition') || '';
        const m = disp.match(/filename="?([^"]+)"?/);
        a.download = m ? m[1] : 'reservas.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast('CSV exportado.', 'success');
      } catch (e) {
        toast('Falha ao exportar CSV.', 'error');
      }
    }

    load();
  }

  // ─── Router ─────────────────────────────────────────────────────────
  // Cada rota declara a capability necessária — quem não tem é mandado
  // pra "Acesso negado". Backend re-valida tudo (frontend só esconde UI).
  const routes = [
    { re: /^\/dashboard$/,        perm: 'view_dashboard', render: () => renderDashboard() },
    { re: /^\/reservas$/,         perm: 'view_reservas',  render: () => renderReservasList() },
    { re: /^\/reservas\/nova$/,   perm: 'create_reserva', render: () => renderReservaNova() },
    { re: /^\/reservas\/(\d+)$/,  perm: 'view_reservas',  render: (m) => renderReservaDetail(m[1]) },
    { re: /^\/check-in$/,         perm: 'view_reservas',  render: () => renderCheckin() },
    { re: /^\/relatorios$/,       perm: 'view_reports',   render: () => renderRelatorios() },
    { re: /^\/usuarios$/,         perm: 'manage_users',   render: () => renderUsuarios() },
    { re: /^\/perfil$/,           perm: null,             render: () => renderPerfil() },
  ];

  function defaultRouteFor(role) {
    // Concierge não tem dashboard; cai em /reservas. Outros começam no dashboard.
    if (role === 'concierge') return '#/reservas';
    return '#/dashboard';
  }

  function router() {
    const hash = location.hash.slice(1);
    if (!hash || hash === '/' || hash === '') {
      location.hash = defaultRouteFor(session.user?.role);
      return;
    }
    renderSidebar();
    for (const route of routes) {
      const m = hash.match(route.re);
      if (m) {
        if (route.perm && !can(route.perm)) {
          renderAccessDenied();
          return;
        }
        route.render(m);
        return;
      }
    }
    setMain(el('div', { class: 'empty', text: 'Página não encontrada.' }));
  }

  // ─── Bootstrap ──────────────────────────────────────────────────────
  async function init() {
    // Carrega usuário + permissões ANTES de renderizar qualquer página.
    // Se 403 (no_account/inactive_account), mostra tela bloqueante — não tenta
    // re-auth, que voltaria pro mesmo erro.
    let me;
    try {
      me = await api('/api/admin/me');
    } catch (e) {
      if (e.kind === 'api' && e.status === 403) {
        if (e.code === 'no_account') {
          renderBlockingScreen({
            title: 'Conta não cadastrada',
            message: 'Seu acesso passou pelo Cloudflare, mas você ainda não foi cadastrado no painel. Peça ao administrador para criar seu acesso e tente novamente.',
          });
          return;
        }
        if (e.code === 'inactive_account') {
          renderBlockingScreen({
            title: 'Conta desativada',
            message: 'Sua conta no painel está desativada. Procure o administrador se acredita que isso é um erro.',
          });
          return;
        }
      }
      // Outros erros: mostra mensagem mas mantém botão de logout.
      renderBlockingScreen({
        title: 'Não foi possível carregar o painel',
        message: e.message || 'Erro inesperado. Tente recarregar a página.',
      });
      return;
    }

    session.user = me.user;
    session.perms = new Set(me.permissions || []);
    renderTopbar();

    window.addEventListener('hashchange', router);
    router();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
