/* =====================================================
   PLAYBOOK JS — Sidebar mobile + active nav highlight
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

});
