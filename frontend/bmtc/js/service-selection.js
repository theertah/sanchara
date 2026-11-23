/**
 * SANCHARA – BMTC Service Selection Controller  (Phase 2)
 *
 * Orchestrates:
 *  1. Sequential left-side entrance animation for both buses.
 *  2. Synchronized hover interactions (bus ↔ card).
 *  3. Single-bus departure when a service is selected:
 *       – Selected bus: focus → headlights → accelerate → off-screen.
 *       – Other bus: fades away simultaneously.
 *       – Full-screen cinematic overlay fires, then navigates to dashboard.
 */

document.addEventListener('DOMContentLoaded', () => {
  const busOrdinary  = document.getElementById('busLaneOrdinary');
  const busVajra     = document.getElementById('busLaneVajra');
  const cardOrdinary = document.getElementById('cardOrdinary');
  const cardVajra    = document.getElementById('cardVajra');
  const btnOrdinary  = document.getElementById('btnOrdinary');
  const btnVajra     = document.getElementById('btnVajra');

  let isNavigating = false;

  // ──────────────────────────────────────────────
  // 1. ENTRANCE ANIMATION – buses slide in from left
  // ──────────────────────────────────────────────
  if (busOrdinary && busVajra) {
    busOrdinary.classList.add('entrance-animate', 'is-rolling');
    busVajra.classList.add('entrance-animate', 'is-rolling');

    // Wheels stop as buses settle into bays
    setTimeout(() => busOrdinary.classList.remove('is-rolling'), 1200);
    setTimeout(() => busVajra.classList.remove('is-rolling'),    1450);
  }

  // ──────────────────────────────────────────────
  // 2. HOVER INTERACTIONS
  // ──────────────────────────────────────────────
  function highlightOrdinary() {
    if (isNavigating) return;
    busOrdinary?.classList.add('is-hovered');
    busVajra?.classList.add('is-dimmed');
    cardOrdinary?.classList.add('hover-active');
  }
  function unhighlightOrdinary() {
    if (isNavigating) return;
    busOrdinary?.classList.remove('is-hovered');
    busVajra?.classList.remove('is-dimmed');
    cardOrdinary?.classList.remove('hover-active');
  }
  function highlightVajra() {
    if (isNavigating) return;
    busVajra?.classList.add('is-hovered');
    busOrdinary?.classList.add('is-dimmed');
    cardVajra?.classList.add('hover-active');
  }
  function unhighlightVajra() {
    if (isNavigating) return;
    busVajra?.classList.remove('is-hovered');
    busOrdinary?.classList.remove('is-dimmed');
    cardVajra?.classList.remove('hover-active');
  }

  // Card & button hover → bus highlight
  cardOrdinary?.addEventListener('mouseenter', highlightOrdinary);
  cardOrdinary?.addEventListener('mouseleave', unhighlightOrdinary);
  btnOrdinary?.addEventListener('mouseenter',  highlightOrdinary);
  btnOrdinary?.addEventListener('mouseleave',  unhighlightOrdinary);

  cardVajra?.addEventListener('mouseenter', highlightVajra);
  cardVajra?.addEventListener('mouseleave', unhighlightVajra);
  btnVajra?.addEventListener('mouseenter',  highlightVajra);
  btnVajra?.addEventListener('mouseleave',  unhighlightVajra);

  // Bus hover → card highlight
  busOrdinary?.addEventListener('mouseenter', highlightOrdinary);
  busOrdinary?.addEventListener('mouseleave', unhighlightOrdinary);
  busVajra?.addEventListener('mouseenter',    highlightVajra);
  busVajra?.addEventListener('mouseleave',    unhighlightVajra);

  // ──────────────────────────────────────────────
  // 3. DEPARTURE HELPER
  // ──────────────────────────────────────────────
  /**
   * @param {string} selectedService  'ordinary' | 'vajra'
   * @param {HTMLElement} selectedBus  the bus lane that departs
   * @param {HTMLElement} otherBus     the bus lane that fades away
   */
  function departureCinematic(selectedService, selectedBus, otherBus) {
    if (isNavigating) return;
    isNavigating = true;

    // Clear entrance animation so CSS transitions take over cleanly
    busOrdinary?.classList.remove('entrance-animate');
    busVajra?.classList.remove('entrance-animate');

    // Clear hover states
    busOrdinary?.classList.remove('is-hovered', 'is-dimmed');
    busVajra?.classList.remove('is-hovered', 'is-dimmed');
    cardOrdinary?.classList.remove('hover-active');
    cardVajra?.classList.remove('hover-active');

    // ── Stage A: Focus selected bus, start headlights ──────────────────
    selectedBus.classList.add('is-selected-focus', 'is-rolling');
    otherBus.classList.add('is-dimmed');

    // ── Stage B: 400 ms later – other bus fades, selected bus departs ──
    setTimeout(() => {
      otherBus.classList.remove('is-dimmed');
      otherBus.classList.add('is-fading-away');

      selectedBus.classList.remove('is-selected-focus');
      selectedBus.classList.add('is-departing');
    }, 420);

    // ── Stage C: 650 ms after departure starts – fire overlay ──────────
    setTimeout(() => {
      const isVajra  = selectedService === 'vajra';
      const headsign = isVajra ? 'BOARDING AC VOLVO' : 'BOARDING BMTC';
      const subtext  = isVajra
        ? 'AC Vajra Corridor — Climate Control Active'
        : 'Entering Bangalore City Transit Network';

      if (window.BusAnimator) {
        window.BusAnimator.navigateWithBus(
          `service-hub.html?service=${selectedService}`,
          headsign,
          subtext,
          false,
          selectedService
        );
      } else {
        // Fallback: plain navigate if animator unavailable
        window.location.href = `service-hub.html?service=${selectedService}`;
      }
    }, 1070);
  }

  // ──────────────────────────────────────────────
  // 4. SELECT ORDINARY BMTC
  // ──────────────────────────────────────────────
  function selectOrdinary() {
    departureCinematic('ordinary', busOrdinary, busVajra);
  }

  btnOrdinary?.addEventListener('click', (e) => {
    e.stopPropagation();
    selectOrdinary();
  });
  cardOrdinary?.addEventListener('click', selectOrdinary);
  busOrdinary?.addEventListener('click',  selectOrdinary);

  // ──────────────────────────────────────────────
  // 5. SELECT AC VOLVO / VAJRA
  // ──────────────────────────────────────────────
  function selectVajra() {
    departureCinematic('vajra', busVajra, busOrdinary);
  }

  btnVajra?.addEventListener('click', (e) => {
    e.stopPropagation();
    selectVajra();
  });
  cardVajra?.addEventListener('click', selectVajra);
  busVajra?.addEventListener('click',  selectVajra);
});
