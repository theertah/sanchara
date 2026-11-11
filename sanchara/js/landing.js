/* Sanchara landing page
   Adds a short fade-out before navigating to BMTC, Namma Metro or Travel Guide.
   Links still work normally without JavaScript. */

(() => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const TRANSITION_MS = 320;

  document.querySelectorAll("[data-nav]").forEach((link) => {
    link.addEventListener("click", (event) => {
      // Leave new-tab clicks, modified clicks and reduced-motion users alone
      if (
        reduceMotion.matches ||
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey || event.ctrlKey || event.shiftKey || event.altKey ||
        link.target === "_blank"
      ) {
        return;
      }

      event.preventDefault();
      document.body.classList.add("is-leaving");
      window.setTimeout(() => {
        window.location.href = link.href;
      }, TRANSITION_MS);
    });
  });

  // Coming back via the browser's back button should show the page again
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) document.body.classList.remove("is-leaving");
  });
})();
