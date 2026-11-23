/**
 * SANCHARA - BMTC Dashboard Application
 * Orchestrates Route Planning, Leaflet Map, 8-Step Journey Progression,
 * Fare Calculation, Simulated Payment, Crowd Prediction, Alerts & Complaints.
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Determine active service mode from URL query
  const urlParams = new URLSearchParams(window.location.search);
  let currentService = (urlParams.get('service') || 'ordinary').toLowerCase(); // 'ordinary' or 'vajra'

  // Update UI service badges and toggle buttons
  updateServiceModeUI(currentService);

  // 2. Initialize Map
  window.BMTCMapController.initMap('bmtcMap');

  // 3. Tab Navigation
  initTabNavigation();

  // 4. Setup Route Planner & Autocomplete
  setupRoutePlanner();

  // 5. Setup Fare Calculator
  setupFareCalculator();

  // 6. Setup Crowd Predictor
  setupCrowdPredictor();

  // 7. Setup Alerts
  loadServiceAlerts();

  // 8. Setup Complaints Box
  setupComplaintsModule();

  // Check if URL has auto-fill origin & destination
  const autoOrigin = urlParams.get('origin');
  const autoDest = urlParams.get('destination');
  if (autoOrigin && autoDest) {
    document.getElementById('originInput').value = autoOrigin;
    document.getElementById('destInput').value = autoDest;
    executePlanRoute();
  }

  // Service toggle pill – fires cinematic transition to opposite service dashboard
  const toggleOrdBtn = document.getElementById('toggleOrdBtn');
  const toggleVajBtn = document.getElementById('toggleVajBtn');

  toggleOrdBtn?.addEventListener('click', () => {
    if (currentService === 'ordinary') return;
    if (window.BusAnimator) {
      window.BusAnimator.navigateWithBus(
        'dashboard.html?service=ordinary',
        'BMTC ORDINARY SERVICE',
        'Switching to City Fleet',
        false,
        'ordinary'
      );
    } else {
      window.location.href = 'dashboard.html?service=ordinary';
    }
  });

  toggleVajBtn?.addEventListener('click', () => {
    if (currentService === 'vajra') return;
    if (window.BusAnimator) {
      window.BusAnimator.navigateWithBus(
        'dashboard.html?service=vajra',
        'AC VOLVO VAJRA',
        'Switching to Premium AC Corridor',
        false,
        'vajra'
      );
    } else {
      window.location.href = 'dashboard.html?service=vajra';
    }
  });

  // Global helper for map popups
  window.selectAsOrigin = (name) => {
    document.getElementById('originInput').value = name;
  };
  window.selectAsDest = (name) => {
    document.getElementById('destInput').value = name;
  };
});

function updateServiceModeUI(service) {
  const isVajra = (service === 'vajra');
  const bannerTitle = document.getElementById('modeBannerTitle');
  const bannerSub = document.getElementById('modeBannerSub');
  const bannerBus = document.getElementById('modeBannerBus');
  const toggleOrd = document.getElementById('toggleOrdBtn');
  const toggleVaj = document.getElementById('toggleVajBtn');

  if (bannerTitle) bannerTitle.textContent = isVajra ? 'AC Volvo / Vajra & Vayu Vajra Corridor' : 'BMTC Ordinary City Services';
  if (bannerSub) bannerSub.textContent = isVajra ? 'Premium climate-controlled low-floor transit network' : 'Extensive Bangalore metropolitan city transit network';
  if (bannerBus) bannerBus.src = isVajra ? '/assets/img/bmtc_vajra_bus.png' : '/assets/img/bmtc_ordinary_bus.png';

  if (toggleOrd && toggleVaj) {
    toggleOrd.classList.toggle('is-selected', !isVajra);
    toggleVaj.classList.toggle('is-selected', isVajra);
  }
}

function initTabNavigation() {
  const tabs = document.querySelectorAll('.tab-btn');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('is-active'));
      tab.classList.add('is-active');

      const targetId = tab.getAttribute('data-tab');
      document.querySelectorAll('.tab-panel').forEach(p => p.style.display = 'none');
      const panel = document.getElementById(targetId);
      if (panel) panel.style.display = 'block';

      // Invalidate map size if switching to planner tab
      if (targetId === 'tabPlanner') {
        setTimeout(() => {
          window.BMTCMapController.initMap('bmtcMap').invalidateSize();
        }, 100);
      }
    });
  });
}

function setupRoutePlanner() {
  const originInput = document.getElementById('originInput');
  const destInput = document.getElementById('destInput');
  const originDrop = document.getElementById('originDropdown');
  const destDrop = document.getElementById('destDropdown');

  const onStopSelected = () => {
    checkLiveFarePreview();
    // Also sync to Fare Calculator inputs
    const fareOrig = document.getElementById('fareOriginInput');
    const fareDest = document.getElementById('fareDestInput');
    if (fareOrig && !fareOrig.value) fareOrig.value = originInput.value;
    if (fareDest && !fareDest.value) fareDest.value = destInput.value;
  };

  setupAutocomplete(originInput, originDrop, onStopSelected);
  setupAutocomplete(destInput, destDrop, onStopSelected);

  document.getElementById('swapStopsBtn')?.addEventListener('click', () => {
    const temp = originInput.value;
    originInput.value = destInput.value;
    destInput.value = temp;
    checkLiveFarePreview();
  });

  document.getElementById('clearSearchBtn')?.addEventListener('click', () => {
    originInput.value = '';
    destInput.value = '';
    document.getElementById('journeyResultsPanel').style.display = 'none';
    const liveBox = document.getElementById('liveFareNoticeBox');
    if (liveBox) liveBox.style.display = 'none';
  });

  document.getElementById('planRouteBtn')?.addEventListener('click', () => {
    executePlanRoute();
  });

  // Current Location Geolocation
  document.getElementById('useGeoBtn')?.addEventListener('click', () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        originInput.value = "Kempegowda Bus Station(Majestic/KBS)";
        checkLiveFarePreview();
        alert("Located nearest hub: Kempegowda Bus Station (Majestic).");
      },
      err => {
        alert("Location access denied or unavailable. Using default origin.");
      }
    );
  });
}

/**
 * Check live fare preview as soon as two stops are given in Route Planner
 */
async function checkLiveFarePreview() {
  const origin = document.getElementById('originInput')?.value.trim();
  const dest = document.getElementById('destInput')?.value.trim();
  const liveBox = document.getElementById('liveFareNoticeBox');
  if (!liveBox) return;

  if (!origin || !dest) {
    liveBox.style.display = 'none';
    return;
  }

  try {
    const urlParams = new URLSearchParams(window.location.search);
    const activeService = (urlParams.get('service') || 'ordinary').toLowerCase();
    const targetService = activeService === 'vajra' ? 'Vajra' : 'Ordinary';

    const resp = await fetch('/api/calculate-fare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ origin, destination: dest, service: targetService })
    });
    const res = await resp.json();

    if (res.total_fare) {
      const distPill = document.getElementById('liveDistPill');
      const ordFare = document.getElementById('liveFareOrdinary');
      const vajFare = document.getElementById('liveFareVajra');
      const forex = document.getElementById('liveFareForex');

      if (distPill) distPill.textContent = `~${res.distance_km || 10} km • ${res.stages || 5} Stages`;
      if (ordFare) ordFare.textContent = `Ordinary: ₹${res.comparison?.ordinary_fare || res.total_fare}`;
      if (vajFare) vajFare.textContent = `AC Volvo: ₹${res.comparison?.vajra_fare || (res.total_fare + 15)}`;
      if (forex) forex.textContent = `(${res.foreigner_friendly?.usd || '$0.25'} USD / ${res.foreigner_friendly?.eur || '€0.23'} EUR)`;

      liveBox.style.display = 'block';
    }
  } catch (e) {
    console.warn('Live fare preview fetch failed:', e);
  }
}

function setupAutocomplete(inputEl, dropEl, onSelectCallback = null) {
  let debounceTimer;

  inputEl.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    const q = inputEl.value.trim();
    if (q.length < 2) {
      dropEl.style.display = 'none';
      return;
    }

    debounceTimer = setTimeout(async () => {
      try {
        const resp = await fetch(`/api/stops/search?q=${encodeURIComponent(q)}`);
        const items = await resp.json();

        if (items.length === 0) {
          dropEl.style.display = 'none';
          return;
        }

        dropEl.innerHTML = items.map(item => `
          <div class="autocomplete-item" data-name="${item.name}">
            <div>
              <div class="autocomplete-name">${item.name}</div>
              <div class="autocomplete-meta">Stop ID: ${item.id} • ${item.route_count} routes</div>
            </div>
            <span class="badge badge-ordinary">Select</span>
          </div>
        `).join('');

        dropEl.style.display = 'block';

        dropEl.querySelectorAll('.autocomplete-item').forEach(it => {
          it.addEventListener('click', () => {
            inputEl.value = it.getAttribute('data-name');
            dropEl.style.display = 'none';
            if (onSelectCallback) onSelectCallback();
          });
        });
      } catch (e) {
        console.warn('Autocomplete fetch error:', e);
      }
    }, 200);
  });

  document.addEventListener('click', (e) => {
    if (!inputEl.contains(e.target) && !dropEl.contains(e.target)) {
      dropEl.style.display = 'none';
    }
  });
}

// =========================================================
// PHASE 4: Journey Alternatives State
// =========================================================
let _lastAlternatives = [];
let _selectedAltIdx = 0;

async function executePlanRoute() {
  const origin = document.getElementById('originInput').value.trim();
  const dest = document.getElementById('destInput').value.trim();
  const urlParams = new URLSearchParams(window.location.search);
  const activeService = (urlParams.get('service') || 'ordinary').toLowerCase();
  const serviceCategory = activeService === 'vajra' ? 'Vajra' : 'Ordinary';
  const routingMode = document.getElementById('routingModeSelect')?.value || 'fastest';

  const resultsPanel = document.getElementById('journeyResultsPanel');
  const errorBox = document.getElementById('plannerErrorBox');
  const fallbackBox = document.getElementById('vajraFallbackBox');

  errorBox.style.display = 'none';
  fallbackBox.style.display = 'none';

  if (!origin || !dest) {
    errorBox.textContent = "Please provide both origin and destination stops.";
    errorBox.style.display = 'block';
    return;
  }

  // Loading state
  const planBtn = document.getElementById('planRouteBtn');
  planBtn.textContent = "Scanning Routes & Transfers...";
  planBtn.disabled = true;

  try {
    const resp = await fetch('/api/plan-route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        origin: origin,
        destination: dest,
        service_category: serviceCategory,
        mode: routingMode
      })
    });

    const res = await resp.json();
    planBtn.textContent = "Find My Journey →";
    planBtn.disabled = false;

    if (!res.success) {
      if (res.code === 'NO_AC_ROUTE') {
        // Trigger AC Volvo Fallback Notification
        showACFallbackNotice(res);
      } else {
        errorBox.textContent = res.error || "Unable to find route.";
        errorBox.style.display = 'block';
      }
      resultsPanel.style.display = 'none';
      return;
    }

    // Store alternatives for card selection
    _lastAlternatives = res.alternatives || [res];
    window._lastAlternatives = _lastAlternatives;
    _selectedAltIdx = 0;

    // Render successful journey
    resultsPanel.style.display = 'block';

    // Render alternative cards (Phase 4)
    renderAlternativeCards(_lastAlternatives, 0);

    // Render primary journey details
    renderJourneySummary(res);
    render8StepTimeline(res);

    // Render polyline on Leaflet map
    window.BMTCMapController.displayJourney(res);

  } catch (e) {
    console.error('Plan route failure:', e);
    planBtn.textContent = "Find My Journey →";
    planBtn.disabled = false;
    errorBox.textContent = "Network error connecting to transit routing engine.";
    errorBox.style.display = 'block';
  }
}

/**
 * PHASE 4: Render journey alternative cards for comparison
 */
function renderAlternativeCards(alternatives, selectedIdx) {
  const list = document.getElementById('alternativesCardsList');
  const badge = document.getElementById('alternativesCountBadge');
  const section = document.getElementById('journeyAlternativesSection');
  if (!list) return;

  if (!alternatives || alternatives.length === 0) {
    if (section) section.style.display = 'none';
    return;
  }
  if (section) section.style.display = 'block';
  if (badge) badge.textContent = alternatives.length + ' Option' + (alternatives.length !== 1 ? 's' : '');

  list.innerHTML = alternatives.map(function(alt, idx) {
    var isSelected = (idx === selectedIdx);
    var transfers = alt.transfers || 0;
    var cardClass = transfers === 0 ? 'card-direct' : (transfers === 1 ? 'card-transfer' : 'card-multi-transfer');
    var badgeClass = alt.transfer_badge_class || (transfers === 0 ? 'badge-direct' : (transfers === 1 ? 'badge-transfer' : 'badge-multi-transfer'));
    var typeLabel = alt.transfer_type || (transfers === 0 ? 'Direct Journey' : transfers + ' Transfer' + (transfers > 1 ? 's' : ''));
    var fare = alt.total_fare || (alt.fare_breakdown ? alt.fare_breakdown.total_fare : null) || '—';
    var legs = alt.legs || [];
    var service = legs.length > 0 ? legs[0].service : '';
    var svcBadgeClass = service === 'Ordinary' ? 'badge-ordinary' : (service === 'Vayu Vajra' ? 'badge-vayu' : 'badge-vajra');
    var routeLabel = alt.route_label || (alt.route_numbers ? alt.route_numbers.join(' ➔ ') : '');
    var transferNote = alt.transfer_stop || '';
    var boardStop = alt.boarding_stop || alt.origin || '';
    var alightStop = alt.destination_stop || alt.destination || '';
    var stopCount = alt.stop_count || (alt.full_stop_sequence ? alt.full_stop_sequence.length : '—');
    var measureMethod = alt.measurement_method || '';
    var distKm = alt.total_distance_km || '—';
    var durMin = alt.total_duration_min || '—';
    var rank = alt.rank || (idx + 1);

    return '<div class="alternative-card ' + cardClass + (isSelected ? ' is-selected' : '') + '" ' +
           'data-alt-idx="' + idx + '" onclick="selectAlternative(' + idx + ')">' +
      '<div class="alt-card-header">' +
        '<div class="alt-route-title">' +
          '<span class="alt-rank-badge">#' + rank + '</span>' +
          '<span>' + routeLabel + '</span>' +
          (isSelected ? '<span class="alt-selected-pill">● Active</span>' : '') +
        '</div>' +
        '<div class="alt-badges-group">' +
          '<span class="badge ' + svcBadgeClass + '">' + service + '</span>' +
          '<span class="badge ' + badgeClass + '">' + typeLabel + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="alt-metrics-row">' +
        '<div class="alt-metric-cell">' +
          '<span class="alt-metric-label">Distance</span>' +
          '<span class="alt-metric-val">' + distKm + ' km</span>' +
        '</div>' +
        '<div class="alt-metric-cell">' +
          '<span class="alt-metric-label">Duration</span>' +
          '<span class="alt-metric-val">' + durMin + ' min</span>' +
        '</div>' +
        '<div class="alt-metric-cell">' +
          '<span class="alt-metric-label">Stops</span>' +
          '<span class="alt-metric-val">' + stopCount + '</span>' +
        '</div>' +
        '<div class="alt-metric-cell">' +
          '<span class="alt-metric-label">Est. Fare</span>' +
          '<span class="alt-metric-val" style="color:#2E7D32;">₹' + fare + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="alt-endpoints-row">' +
        '<span style="font-weight:700; color:#173B64;">' + boardStop + '</span>' +
        '<span style="color:#94A3B8;">→</span>' +
        '<span style="font-weight:700; color:#173B64;">' + alightStop + '</span>' +
      '</div>' +
      (transferNote ? '<div class="alt-transfer-note">⇄ Transfer at ' + transferNote + '</div>' : '') +
      (measureMethod ? '<div style="font-size:0.70rem; color:#94A3B8; margin-top:4px;">' + measureMethod + '</div>' : '') +
    '</div>';
  }).join('');
}

/**
 * PHASE 4: Select an alternative journey and update summary, timeline, and map
 */
function selectAlternative(idx) {
  if (idx < 0 || idx >= _lastAlternatives.length) return;
  _selectedAltIdx = idx;
  var alt = _lastAlternatives[idx];
  if (!alt) return;

  // Re-render cards with new selection
  renderAlternativeCards(_lastAlternatives, idx);

  // Update summary, timeline, and map for the selected alternative
  renderJourneySummary(alt);
  render8StepTimeline(alt);
  if (window.BMTCMapController) {
    window.BMTCMapController.displayJourney(alt);
  }

  // Scroll the selected card into view
  var selectedCard = document.querySelector('.alternative-card.is-selected');
  if (selectedCard) {
    selectedCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

// Expose selectAlternative globally for onclick handlers
window.selectAlternative = selectAlternative;

function showACFallbackNotice(data) {
  const fallbackBox = document.getElementById('vajraFallbackBox');
  fallbackBox.style.display = 'block';
  fallbackBox.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:start;">
      <div>
        <h4 style="color:#D97662; margin-bottom:6px; font-size:1.15rem;">No Direct AC Vajra Service Available</h4>
        <p style="color:#202B38; font-size:0.92rem; margin-bottom:12px;">
          No direct AC Vajra connection currently operates between <b>${data.origin}</b> and <b>${data.destination}</b>.
          However, Ordinary BMTC services offer frequent, verified connections for this journey.
        </p>
        <button id="exploreBmtcAltBtn" class="btn-primary" style="background:#173B64; padding:8px 16px; font-size:0.88rem;">
          Explore BMTC Alternatives →
        </button>
      </div>
      <img src="/assets/img/bmtc_ordinary_bus.png" style="width:140px; height:auto; margin-left:14px;" />
    </div>
  `;

  document.getElementById('exploreBmtcAltBtn').addEventListener('click', () => {
    // Animate bus traveling back to Ordinary dashboard, preserving origin and dest!
    const targetUrl = `dashboard.html?service=ordinary&origin=${encodeURIComponent(data.origin)}&destination=${encodeURIComponent(data.destination)}`;
    window.BusAnimator.navigateWithBus(
      targetUrl,
      'SWITCHING TO BMTC ORDINARY',
      'Preserving Search • Loading Direct City Routes',
      true,
      'ordinary'
    );
  });
}

function renderJourneySummary(journey) {
  const summaryEl = document.getElementById('journeySummaryMetrics');
  const fare = journey.fare_breakdown || {};

  summaryEl.innerHTML = `
    <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:12px; background:#FAF8F5; padding:16px; border-radius:8px; border:1px solid #E6DFD2; margin-bottom:18px;">
      <div>
        <div style="font-size:0.75rem; color:#77808C; font-weight:700;">TOTAL DISTANCE</div>
        <div style="font-size:1.3rem; font-weight:800; color:#173B64;">${journey.total_distance_km} km</div>
      </div>
      <div>
        <div style="font-size:0.75rem; color:#77808C; font-weight:700;">EST. TIME</div>
        <div style="font-size:1.3rem; font-weight:800; color:#173B64;">${journey.total_duration_min} min</div>
      </div>
      <div>
        <div style="font-size:0.75rem; color:#77808C; font-weight:700;">TRANSFERS</div>
        <div style="font-size:1.3rem; font-weight:800; color:${journey.transfers > 0 ? '#D97662' : '#2E7D32'};">
          ${journey.transfers === 0 ? 'Direct Bus' : journey.transfers + ' Transfer(s)'}
        </div>
      </div>
      <div>
        <div style="font-size:0.75rem; color:#77808C; font-weight:700;">EST. FARE</div>
        <div style="display:flex; align-items:baseline; gap:6px;">
          <span style="font-size:1.3rem; font-weight:800; color:#2E7D32;">₹${fare.total_fare || '20'}</span>
          <span style="font-size:0.78rem; font-weight:700; color:#64748B;">($${((fare.total_fare || 20) / 86.0).toFixed(2)} USD)</span>
        </div>
      </div>
    </div>
  `;
}

/**
 * COMPLETE 8-STEP COMMUTER JOURNEY PROGRESSION TIMELINE
 */
function render8StepTimeline(journey) {
  const timelineEl = document.getElementById('eightStepTimeline');
  const legs = journey.legs;
  const firstLeg = legs[0];
  const lastLeg = legs[legs.length - 1];
  const isMultiBus = (legs.length > 1);

  let html = '';

  // STEP 1: Walk to Boarding Stop
  html += `
    <div class="timeline-step">
      <div class="step-marker step-walk">01</div>
      <div class="step-content">
        <div class="step-title">
          <span>Walk to Boarding Stop</span>
          <span class="step-badge" style="background:#E2E8F0; color:#475569;">~250m • 3 mins</span>
        </div>
        <p style="font-size:0.88rem; color:#64748B; margin-top:4px;">
          Head towards <b>${firstLeg.board_stop}</b>. Follow pedestrian signage towards bus shelter.
        </p>
      </div>
    </div>
  `;

  // STEP 2: Boarding Stop Hub & Crowd Details
  html += `
    <div class="timeline-step">
      <div class="step-marker step-board">02</div>
      <div class="step-content">
        <div class="step-title">
          <span>Boarding Stop: ${firstLeg.board_stop}</span>
          <span class="step-badge badge-ordinary">Transit Hub</span>
        </div>
        <div style="font-size:0.85rem; color:#475569; margin-top:6px; display:flex; gap:16px;">
          <span>Crowd Level: <b style="color:#2E7D32;">Moderate (Seats Open)</b></span>
          <span>Platform: <b>Bay A / Main Road</b></span>
        </div>
      </div>
    </div>
  `;

  // STEP 3: Bus Identification
  const step3BadgeClass = firstLeg.service === 'Ordinary' ? 'badge-ordinary' : (firstLeg.service === 'Vayu Vajra' ? 'badge-vayu' : 'badge-vajra');
  html += `
    <div class="timeline-step">
      <div class="step-marker" style="background:#173B64;">03</div>
      <div class="step-content">
        <div class="step-title">
          <span>Identify Bus: Route ${firstLeg.route_name}</span>
          <span class="step-badge ${step3BadgeClass}">${firstLeg.service}</span>
        </div>
        <p style="font-size:0.88rem; color:#475569; margin-top:4px;">
          Board bus with LED destination board reading <b>${firstLeg.route_name}</b>.
        </p>
      </div>
    </div>
  `;

  // STEP 4: Onboard Leg & Intermediate Stops
  html += `
    <div class="timeline-step">
      <div class="step-marker" style="background:#173B64;">04</div>
      <div class="step-content">
        <div class="step-title">
          <span>Ride Leg 1: ${firstLeg.board_stop} ➔ ${firstLeg.alight_stop}</span>
          <span class="step-badge" style="background:#F1F5F9; color:#0F172A;">${firstLeg.distance_km} km • ${firstLeg.duration_min} min</span>
        </div>
        <details style="margin-top:8px; font-size:0.85rem; color:#475569;">
          <summary style="cursor:pointer; font-weight:700; color:#173B64;">View ${firstLeg.stop_count} intermediate stop(s)</summary>
          <ul style="padding-left:18px; margin-top:6px;">
            ${firstLeg.intermediate_stops.map(s => `<li>${s}</li>`).join('')}
          </ul>
        </details>
      </div>
    </div>
  `;

  if (isMultiBus) {
    // STEP 5: Transfer Interchange Guide
    html += `
      <div class="timeline-step">
        <div class="step-marker step-transfer">05</div>
        <div class="step-content">
          <div class="step-title">
            <span style="color:#D97662;">Transfer Interchange: ${firstLeg.alight_stop}</span>
            <span class="step-badge" style="background:#FDE8E5; color:#D97662;">Wait ~10 mins</span>
          </div>
          <p style="font-size:0.88rem; color:#475569; margin-top:4px;">
            Alight from Bus ${firstLeg.route_name}. Move to Connecting Bay for <b>Bus ${legs[1].route_name}</b>.
          </p>
        </div>
      </div>
    `;

    // STEP 6: Connecting Bus Leg
    html += `
      <div class="timeline-step">
        <div class="step-marker" style="background:#D97662;">06</div>
        <div class="step-content">
          <div class="step-title">
            <span>Board Connecting Bus: Route ${legs[1].route_name}</span>
            <span class="step-badge" style="background:#F1F5F9; color:#0F172A;">${legs[1].distance_km} km • ${legs[1].duration_min} min</span>
          </div>
          <p style="font-size:0.88rem; color:#475569; margin-top:4px;">
            Ride from <b>${legs[1].board_stop}</b> to <b>${legs[1].alight_stop}</b> (${legs[1].stop_count} stops).
          </p>
        </div>
      </div>
    `;
  } else {
    // Steps 5 & 6 as direct express progress
    html += `
      <div class="timeline-step">
        <div class="step-marker" style="background:#2E7D32;">05</div>
        <div class="step-content">
          <div class="step-title">
            <span>Direct Service • No Bus Transfer Required</span>
            <span class="step-badge" style="background:#E8F5E9; color:#2E7D32;">Express Transit</span>
          </div>
          <p style="font-size:0.88rem; color:#475569; margin-top:4px;">
            Stay seated in Bus ${firstLeg.route_name}. This single bus operates directly to your destination.
          </p>
        </div>
      </div>
    `;
  }

  // STEP 7: Approaching Destination Alert Beacon
  html += `
    <div class="timeline-step">
      <div class="step-marker" style="background:#F57C00;">07</div>
      <div class="step-content">
        <div class="step-title">
          <span>Approaching Destination Alert</span>
          <span class="step-badge" style="background:#FFF3E0; color:#E65100;">Next Stop Warning</span>
        </div>
        <div class="approaching-alert">
          <span style="font-size:1.3rem;">🔔</span>
          <div style="font-size:0.88rem; color:#BF360C; font-weight:600;">
            Bell Indicator: When conductor announces <b>${lastLeg.alight_stop}</b>, move towards rear door for safe alighting.
          </div>
        </div>
      </div>
    </div>
  `;

  // STEP 8: Final Destination & Alighting
  html += `
    <div class="timeline-step">
      <div class="step-marker step-dest">08</div>
      <div class="step-content">
        <div class="step-title">
          <span>Arrive at Destination: ${lastLeg.alight_stop}</span>
          <span class="step-badge" style="background:#E8F5E9; color:#2E7D32;">Journey Complete</span>
        </div>
        <p style="font-size:0.88rem; color:#475569; margin-top:4px;">
          Alight safely on the designated passenger platform. Welcome to ${lastLeg.alight_stop}!
        </p>
      </div>
    </div>
  `;

  timelineEl.innerHTML = html;
}

/**
 * FARE CALCULATOR & SIMULATED DIGITAL PAYMENT
 */
/**
 * FARE CALCULATOR & SIMULATED DIGITAL PAYMENT (STOP-BASED & FOREIGNER FRIENDLY)
 */
function setupFareCalculator() {
  const calcBtn = document.getElementById('calculateFareBtn');
  const serviceSel = document.getElementById('fareServiceSelect');
  const distInput = document.getElementById('fareDistInput');
  const passSel = document.getElementById('farePassengerCount');
  const concSel = document.getElementById('fareConcessionSelect');

  const fareOrigInput = document.getElementById('fareOriginInput');
  const fareDestInput = document.getElementById('fareDestInput');
  const fareOrigDrop = document.getElementById('fareOriginDropdown');
  const fareDestDrop = document.getElementById('fareDestDropdown');

  const updateFareCalc = async () => {
    try {
      const origin = fareOrigInput?.value.trim() || '';
      const dest = fareDestInput?.value.trim() || '';

      const resp = await fetch('/api/calculate-fare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin: origin,
          destination: dest,
          service: serviceSel.value,
          distance_km: parseFloat(distInput.value) || 10.0,
          passenger_count: parseInt(passSel.value) || 1,
          concession: concSel.value
        })
      });

      const res = await resp.json();

      // Update Total Fare and Schedule Details
      document.getElementById('calcTotalFareDisplay').textContent = `₹${res.total_fare}`;
      document.getElementById('calcScheduleName').textContent = res.schedule_name;
      document.getElementById('calcStageBreakdown').textContent = `${res.stages} Stages • Base ₹${res.base_unit_fare} • ${res.concession_desc}`;

      // Update distance if calculated from stops
      if (res.distance_km && distInput) {
        distInput.value = res.distance_km;
      }

      // Update Foreigner-Friendly Currency Pills
      if (res.foreigner_friendly) {
        const usdEl = document.getElementById('forexUsdBadge');
        const eurEl = document.getElementById('forexEurBadge');
        const gbpEl = document.getElementById('forexGbpBadge');
        if (usdEl) usdEl.textContent = `💵 ${res.foreigner_friendly.usd} USD`;
        if (eurEl) eurEl.textContent = `💶 ${res.foreigner_friendly.eur} EUR`;
        if (gbpEl) gbpEl.textContent = `💷 ${res.foreigner_friendly.gbp} GBP`;
      }

      // Update Comparative Ordinary vs AC Volvo Displays
      if (res.comparison) {
        const compOrd = document.getElementById('compOrdDisplay');
        const compVaj = document.getElementById('compVajDisplay');
        if (compOrd) compOrd.textContent = `₹${res.comparison.ordinary_fare}`;
        if (compVaj) compVaj.textContent = `₹${res.comparison.vajra_fare}`;
      }

      // Update Stop Pair Badge
      const stopBadge = document.getElementById('fareStopPairBadge');
      if (stopBadge) {
        if (origin && dest) {
          stopBadge.textContent = `${origin} ➔ ${dest}`;
          stopBadge.title = `${res.distance_km} km`;
        } else {
          stopBadge.textContent = `Distance: ${res.distance_km} km`;
        }
      }

    } catch (e) {
      console.warn('Fare calc failed:', e);
    }
  };

  // Wire up stop autocompletes
  if (fareOrigInput && fareOrigDrop) {
    setupAutocomplete(fareOrigInput, fareOrigDrop, () => {
      if (fareDestInput && fareDestInput.value.trim()) {
        updateFareCalc();
      }
    });
  }

  if (fareDestInput && fareDestDrop) {
    setupAutocomplete(fareDestInput, fareDestDrop, () => {
      if (fareOrigInput && fareOrigInput.value.trim()) {
        updateFareCalc();
      }
    });
  }

  calcBtn?.addEventListener('click', updateFareCalc);
  serviceSel?.addEventListener('change', updateFareCalc);
  distInput?.addEventListener('input', updateFareCalc);
  passSel?.addEventListener('change', updateFareCalc);
  concSel?.addEventListener('change', updateFareCalc);

  // Initial calculation on load
  updateFareCalc();

  // Simulated Payment Trigger
  document.getElementById('simPaymentBtn')?.addEventListener('click', async () => {
    const origin = fareOrigInput?.value.trim() || document.getElementById('originInput').value || 'Kempegowda Bus Station(Majestic/KBS)';
    const dest = fareDestInput?.value.trim() || document.getElementById('destInput').value || 'Hebbala';
    const totalFare = parseInt(document.getElementById('calcTotalFareDisplay').textContent.replace('₹', '')) || 25;

    try {
      const resp = await fetch('/api/simulate-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin: origin,
          destination: dest,
          service: serviceSel.value,
          total_fare: totalFare,
          passenger_count: parseInt(passSel.value) || 1,
          payment_method: 'UPI / Namma Pass'
        })
      });

      const ticket = await resp.json();
      showTicketModal(ticket);
    } catch (e) {
      alert("Simulated payment failed.");
    }
  });

  document.getElementById('closeTicketModalBtn')?.addEventListener('click', () => {
    document.getElementById('ticketModal').classList.remove('is-open');
  });
}

function showTicketModal(ticket) {
  const modal = document.getElementById('ticketModal');
  const detailsEl = document.getElementById('ticketModalContent');

  detailsEl.innerHTML = `
    <div class="digital-ticket-wrapper">
      <div class="ticket-header">
        <h3 style="color:#173B64; margin:0 0 4px; font-size:1.4rem;">BMTC DIGITAL m-TICKET</h3>
        <p style="font-size:0.75rem; color:#77808C; margin:0;">GOVERNMENT OF KARNATAKA TRANSIT PASS</p>
      </div>

      <div style="font-size:0.85rem; margin-bottom:12px; display:flex; justify-content:space-between;">
        <span>Ticket ID: <b>${ticket.ticket_id}</b></span>
        <span style="color:#2E7D32; font-weight:700;">${ticket.status}</span>
      </div>

      <div style="border-top:1px solid #E6DFD2; border-bottom:1px solid #E6DFD2; padding:12px 0; margin-bottom:12px;">
        <div style="font-size:0.9rem; margin-bottom:4px;">From: <b>${ticket.origin}</b></div>
        <div style="font-size:0.9rem; margin-bottom:4px;">To: <b>${ticket.destination}</b></div>
        <div style="font-size:0.82rem; color:#77808C;">Service: ${ticket.service} • Passengers: ${ticket.passenger_count}</div>
      </div>

      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div>
          <div style="font-size:0.75rem; color:#77808C;">TOTAL FARE PAID</div>
          <div style="font-size:1.6rem; font-weight:800; color:#173B64;">₹${ticket.fare_paid}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:0.75rem; color:#77808C;">VALID UNTIL</div>
          <div style="font-size:0.85rem; font-weight:700; color:#C62828;">${ticket.valid_until}</div>
        </div>
      </div>

      <div class="ticket-qr-box">
        <div style="text-align:center;">
          <div style="font-size:2.4rem;">📱</div>
          <div style="font-size:0.75rem; color:#64748B; font-weight:700; margin-top:4px;">BMTC VERIFIED QR</div>
        </div>
      </div>

      <button onclick="window.print()" class="btn-outline" style="width:100%; margin-top:10px;">
        Print / Save m-Ticket 🖨️
      </button>
    </div>
  `;

  modal.classList.add('is-open');
}

/**
 * CROWD PREDICTOR
 */
function setupCrowdPredictor() {
  const fetchBtn = document.getElementById('checkCrowdBtn');
  const stopInput = document.getElementById('crowdStopInput');
  const routeInput = document.getElementById('crowdRouteInput');

  fetchBtn?.addEventListener('click', async () => {
    const stop = stopInput.value.trim() || 'Kempegowda Bus Station(Majestic/KBS)';
    const route = routeInput.value.trim();

    try {
      const resp = await fetch(`/api/crowd?stop=${encodeURIComponent(stop)}&route=${encodeURIComponent(route)}`);
      const res = await resp.json();

      document.getElementById('crowdIndexDial').textContent = res.crowd_index;
      document.getElementById('crowdIndexDial').style.backgroundColor = res.color;
      document.getElementById('crowdStatusText').textContent = res.status_text;
      document.getElementById('crowdAdviceText').textContent = res.advice;
      document.getElementById('crowdPeriodBadge').textContent = res.peak_period;
    } catch (e) {
      console.warn('Crowd query failed:', e);
    }
  });

  // Commuter Feedback
  document.getElementById('submitCrowdReportBtn')?.addEventListener('click', async () => {
    const stop = stopInput.value.trim() || 'Majestic';
    const route = routeInput.value.trim() || '500-D';
    const level = document.getElementById('reportCrowdLevelSelect').value;

    try {
      const resp = await fetch('/api/crowd/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stop_name: stop, route_no: route, crowd_level: level })
      });
      const res = await resp.json();
      alert(res.message || "Crowd observation recorded!");
    } catch (e) {
      alert("Error submitting feedback.");
    }
  });
}

/**
 * SMART SERVICE ALERTS
 */
async function loadServiceAlerts() {
  const container = document.getElementById('alertsListContainer');
  if (!container) return;

  try {
    const resp = await fetch('/api/alerts');
    const alerts = await resp.json();

    if (alerts.length === 0) {
      container.innerHTML = '<p style="color:#77808C;">No active service disruptions reported. All corridors running on regular schedule.</p>';
      return;
    }

    container.innerHTML = alerts.map(a => `
      <div class="card-panel" style="margin-bottom:14px; border-left:4px solid ${a.severity === 'High' ? '#D97662' : '#F57C00'};">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <h4 style="margin:0; font-size:1.1rem; color:#102B49;">${a.title}</h4>
          <span class="badge ${a.severity === 'High' ? 'badge-alert' : 'badge-ordinary'}">${a.severity} Priority</span>
        </div>
        <p style="font-size:0.9rem; color:#475569; margin-bottom:8px;">${a.message}</p>
        <div style="font-size:0.8rem; color:#77808C;">
          Affected Routes: <b>${a.affected_routes.join(', ')}</b> • Active until: ${a.active_to || 'Notice'}
        </div>
      </div>
    `).join('');
  } catch (e) {
    console.warn('Alerts loading failed:', e);
  }
}

/**
 * COMPLAINTS MODULE
 */
function setupComplaintsModule() {
  const fileForm = document.getElementById('fileGrievanceForm');
  const trackBtn = document.getElementById('trackTicketBtn');

  fileForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      commuter_name: document.getElementById('cmpName').value,
      contact: document.getElementById('cmpContact').value,
      service_type: document.getElementById('cmpService').value,
      route_no: document.getElementById('cmpRoute').value,
      bus_no: document.getElementById('cmpBusNo').value,
      category: document.getElementById('cmpCategory').value,
      description: document.getElementById('cmpDescription').value
    };

    try {
      const resp = await fetch('/api/complaints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const res = await resp.json();
      if (res.success) {
        document.getElementById('cmpSuccessBox').style.display = 'block';
        document.getElementById('cmpTicketIdDisplay').textContent = res.ticket_id;
        fileForm.reset();
      }
    } catch (err) {
      alert("Error filing grievance.");
    }
  });

  trackBtn?.addEventListener('click', async () => {
    const tid = document.getElementById('trackTicketInput').value.trim();
    if (!tid) return;

    try {
      const resp = await fetch(`/api/complaints/${encodeURIComponent(tid)}`);
      const res = await resp.json();
      const statusBox = document.getElementById('trackStatusResult');

      if (res.success && res.complaint) {
        const c = res.complaint;
        statusBox.style.display = 'block';
        statusBox.innerHTML = `
          <div style="background:#FAF8F5; border:1px solid #E6DFD2; border-radius:8px; padding:16px;">
            <div style="display:flex; justify-content:space-between;">
              <h4 style="margin:0; color:#173B64;">Ticket: ${c.ticket_id}</h4>
              <span class="badge ${c.status === 'Resolved' ? 'badge-ordinary' : 'badge-alert'}">${c.status}</span>
            </div>
            <p style="font-size:0.88rem; color:#475569; margin:8px 0;"><b>Category:</b> ${c.category} • <b>Route:</b> ${c.route_no}</p>
            <p style="font-size:0.85rem; color:#64748B;">"${c.description}"</p>
            <div style="font-size:0.75rem; color:#94A3B8; margin-top:8px;">Lodged on: ${c.created_at}</div>
          </div>
        `;
      } else {
        statusBox.style.display = 'block';
        statusBox.innerHTML = `<p style="color:#C62828;">No grievance record found with ID: ${tid}</p>`;
      }
    } catch (err) {
      alert("Failed to track complaint.");
    }
  });
}
