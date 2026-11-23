/* SANCHARA landing page – Phase 2
   BMTC card fires cinematic bus overlay.
   Metro card uses standard fade.
   Both transitions are fully isolated. */

(() => {
  const reduceMotion   = window.matchMedia('(prefers-reduced-motion: reduce)');
  const TRANSITION_MS  = 320;

  document.querySelectorAll('[data-nav]').forEach((link) => {
    link.addEventListener('click', (event) => {
      if (
        reduceMotion.matches ||
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey || event.ctrlKey || event.shiftKey || event.altKey ||
        link.target === '_blank'
      ) return;

      /* ── BMTC card: cinematic bus overlay ── */
      if (link.classList.contains('card--bus') && window.BusAnimator) {
        event.preventDefault();
        window.BusAnimator.navigateWithBus(
          link.href,
          'BOARDING BMTC',
          'Entering Bangalore City Transit',
          false,
          'ordinary'
        );
        return;
      }

      /* ── Metro / Travel Guide: standard fade ── */
      event.preventDefault();
      document.body.classList.add('is-leaving');
      window.setTimeout(() => {
        window.location.href = link.href;
      }, TRANSITION_MS);
    });
  });

  /* Restore page when user navigates back */
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) document.body.classList.remove('is-leaving');
  });
})();
