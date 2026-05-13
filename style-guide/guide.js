/* =====================================================
   GUIDE JS — STYLE GUIDE · FLOR DE SAL BISTRÔ & BAR
   ===================================================== */

document.addEventListener('DOMContentLoaded', () => {

  /* ── SIDEBAR MOBILE TOGGLE ─────────────────────── */
  const toggle = document.querySelector('.sg-mobile-toggle');
  const sidebar = document.querySelector('.sg-sidebar');
  const overlay = document.createElement('div');
  overlay.className = 'sg-overlay';
  overlay.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,.5);
    z-index:190;opacity:0;pointer-events:none;transition:opacity 250ms ease;
  `;
  document.body.appendChild(overlay);

  function openSidebar() {
    if (!sidebar) return;
    sidebar.classList.add('is-open');
    overlay.style.opacity = '1';
    overlay.style.pointerEvents = 'auto';
  }

  function closeSidebar() {
    if (!sidebar) return;
    sidebar.classList.remove('is-open');
    overlay.style.opacity = '0';
    overlay.style.pointerEvents = 'none';
  }

  toggle && toggle.addEventListener('click', () => {
    sidebar.classList.contains('is-open') ? closeSidebar() : openSidebar();
  });

  overlay.addEventListener('click', closeSidebar);


  /* ── ACTIVE NAV HIGHLIGHT ──────────────────────── */
  const sections = document.querySelectorAll('.sg-section[id]');
  const navLinks = document.querySelectorAll('.sg-nav__item[href^="#"]');

  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        navLinks.forEach(link => {
          link.classList.toggle(
            'is-active',
            link.getAttribute('href') === '#' + entry.target.id
          );
        });
      }
    });
  }, { rootMargin: '-30% 0px -60% 0px', threshold: 0 });

  sections.forEach(s => io.observe(s));

  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const target = document.querySelector(link.getAttribute('href'));
      if (target) {
        target.scrollIntoView({ behavior: 'smooth' });
        if (window.innerWidth < 960) closeSidebar();
      }
    });
  });


  /* ── ACCORDION ─────────────────────────────────── */
  document.querySelectorAll('.fs-accordion-trigger').forEach(trigger => {
    trigger.addEventListener('click', () => {
      const expanded = trigger.getAttribute('aria-expanded') === 'true';
      const content = trigger.nextElementSibling;

      // Fecha todos
      document.querySelectorAll('.fs-accordion-trigger').forEach(t => {
        t.setAttribute('aria-expanded', 'false');
        t.nextElementSibling.classList.remove('is-open');
      });

      // Abre o clicado se estava fechado
      if (!expanded) {
        trigger.setAttribute('aria-expanded', 'true');
        content.classList.add('is-open');
      }
    });
  });

  // Abre o primeiro item por padrão
  const firstTrigger = document.querySelector('.fs-accordion-trigger');
  if (firstTrigger) {
    firstTrigger.setAttribute('aria-expanded', 'true');
    firstTrigger.nextElementSibling.classList.add('is-open');
  }


  /* ── CHECKLIST INTERATIVO ──────────────────────── */
  document.querySelectorAll('.sg-checklist-item').forEach(item => {
    item.addEventListener('click', () => {
      item.classList.toggle('checked');
    });
  });


  /* ── COPY TOKEN ────────────────────────────────── */
  document.querySelectorAll('.sg-token-name').forEach(el => {
    el.style.cursor = 'copy';
    el.title = 'Clique para copiar';
    el.addEventListener('click', () => {
      copyText(el.textContent.trim()).then(() => {
        const orig = el.textContent;
        el.textContent = 'copiado!';
        el.style.background = 'rgba(78,102,69,0.15)';
        el.style.color = 'var(--fs-musgo-deep)';
        setTimeout(() => {
          el.textContent = orig;
          el.style.background = '';
          el.style.color = '';
        }, 1200);
      });
    });
  });

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    return Promise.resolve();
  }


  /* ── HOVER DEMO NOS BOTÕES ─────────────────────── */
  document.querySelectorAll('.fs-btn').forEach(btn => {
    if (!btn.classList.contains('fs-btn--disabled') && !btn.disabled) {
      btn.addEventListener('mouseenter', () => {
        btn.style.transition = 'all var(--fs-transition-base)';
      });
    }
  });

});
