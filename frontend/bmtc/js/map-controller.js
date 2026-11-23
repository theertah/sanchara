/**
 * SANCHARA - Bangalore Transport Network Cartography Map Controller (Phase 5 Redesign)
 *
 * Implements clean, low-congestion transit cartography:
 * 1. All Bus Stops:
 *    - Very small circular dots (uniform, low-contrast subtle styling).
 *    - Rendered via GPU Leaflet Canvas for smooth performance without DOM lag.
 *    - Consistent size with zoom-dependent density scaling (tiny at low zoom, crisp when zoomed in).
 *    - Selecting a stop makes that particular node prominent with active styling.
 *
 * 2. Background Route Network:
 *    - Thin lines (weight: 1.2px), light subtle slate grey (#94A3B8), low opacity (0.20).
 *    - Provides essential urban road network context without competing for commuter attention.
 *
 * 3. Recommended Routes (Selected Journey):
 *    - Dark, saturated colors: deep navy (#102B49) for primary legs, burnt orange (#C2410C) for transfers.
 *    - White halo stroke underneath for crisp separation from background lines.
 *    - Stop-count callout badge placed at the geographic midpoint of each leg.
 *    - Distinct endpoint pins for boarding (green), transfers (amber), and destination (crimson).
 *    - Non-active alternatives displayed as muted dashed polylines.
 */

window.BMTCMapController = (() => {
  let map = null;
  let canvasRenderer = null;
  let networkLayerGroup = null;
  let stopsLayerGroup = null;
  let alternativesLayerGroup = null;
  let journeyLayerGroup = null;
  let highlightLayerGroup = null;
  let allStopsData = {};
  let stopCircleMarkers = [];

  // Bangalore center coordinates and default zoom
  const BANGALORE_COORDS = [12.9716, 77.5946];
  const LEG_COLORS = ['#102B49', '#C2410C', '#0284C7', '#16A34A', '#7C3AED'];

  function initMap(containerId = 'bmtcMap') {
    if (map) return map;

    map = L.map(containerId, {
      center: BANGALORE_COORDS,
      zoom: 11,
      minZoom: 9,
      maxZoom: 18,
      preferCanvas: true
    });

    // Standard OpenStreetMap tiles with clean contrast
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | BMTC Sanchara',
      maxZoom: 19
    }).addTo(map);

    // Initialize Leaflet Canvas renderer for hardware-accelerated vector rendering
    canvasRenderer = L.canvas({ padding: 0.5 });

    // Dedicated layer groups in strict visual z-order
    networkLayerGroup = L.featureGroup().addTo(map);     // 1. Bottom: background lines
    stopsLayerGroup = L.featureGroup().addTo(map);       // 2. Middle: subtle stop dots
    alternativesLayerGroup = L.featureGroup().addTo(map);// 3. Muted alternative routes
    journeyLayerGroup = L.featureGroup().addTo(map);     // 4. Active journey + badges
    highlightLayerGroup = L.featureGroup().addTo(map);   // 5. User selected stop highlight

    // Zoom-dependent stop density listener
    map.on('zoomend', handleZoomChange);

    // Load full background network lines and geocoded stops
    loadNetworkLines();
    loadGeocodedStops();

    return map;
  }

  /**
   * PART 7-B: Background route network
   * Display complete available route network using:
   * - Thin lines (weight: 1.2px)
   * - Light colours (slate #94A3B8)
   * - Low opacity (0.20)
   * - Subtle visual weight, interactive: false
   */
  async function loadNetworkLines() {
    try {
      const resp = await fetch('/api/routes/network');
      const lines = await resp.json();

      if (!lines || !Array.isArray(lines)) return;

      networkLayerGroup.clearLayers();

      lines.forEach(pathCoords => {
        if (pathCoords && pathCoords.length >= 2) {
          L.polyline(pathCoords, {
            renderer: canvasRenderer,
            color: '#94A3B8',
            weight: 1.2,
            opacity: 0.20,
            lineCap: 'round',
            lineJoin: 'round',
            interactive: false
          }).addTo(networkLayerGroup);
        }
      });

      console.log(`[Map] Rendered ${lines.length} background network lines (clean subtle slate).`);
    } catch (e) {
      console.warn('[Map] Could not fetch transit network lines:', e);
    }
  }

  /**
   * PART 7-A: All bus stops
   * Display all valid bus stops as:
   * - Very small circular dots
   * - Subtle, low-contrast styling (#64748B, opacity: 0.55)
   * - Consistent sizes
   * - Dynamic density scaling on zoom
   * - Clicking a stop highlights it and presents "Set Origin" / "Set Dest"
   */
  async function loadGeocodedStops() {
    try {
      const resp = await fetch('/api/stops/all');
      allStopsData = await resp.json();
      stopCircleMarkers = [];
      stopsLayerGroup.clearLayers();

      const zoom = map ? map.getZoom() : 11;
      const initialRadius = getStopRadiusForZoom(zoom);
      const initialOpacity = getStopOpacityForZoom(zoom);

      for (const sid in allStopsData) {
        const s = allStopsData[sid];
        if (s.lat && s.lng) {
          const circle = L.circleMarker([s.lat, s.lng], {
            renderer: canvasRenderer,
            radius: initialRadius,
            fillColor: '#64748B',
            fillOpacity: initialOpacity,
            color: '#475569',
            weight: 0.7,
            bubblingMouseEvents: false
          });

          circle.stopData = s;

          circle.bindPopup(`
            <div class="map-stop-popup">
              <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">
                <span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:#173B64;"></span>
                <span style="font-size:10px; font-weight:800; color:#173B64; text-transform:uppercase; letter-spacing:0.06em;">BMTC Transit Stop</span>
              </div>
              <h4 style="margin:0 0 4px; color:#102B49; font-size:13px; font-weight:700;">${s.name}</h4>
              <p style="margin:0 0 8px; font-size:11px; color:#77808C;">Stop ID: <code>${s.id}</code></p>
              <div style="display:flex; gap:6px;">
                <button onclick="window.selectAsOrigin('${s.name.replace(/'/g, "\\'")}')" style="flex:1; background:#173B64; color:#fff; border:none; padding:5px 8px; border-radius:4px; font-size:11px; font-weight:700; cursor:pointer;">Set Origin</button>
                <button onclick="window.selectAsDest('${s.name.replace(/'/g, "\\'")}')" style="flex:1; background:#D97662; color:#fff; border:none; padding:5px 8px; border-radius:4px; font-size:11px; font-weight:700; cursor:pointer;">Set Dest</button>
              </div>
            </div>
          `);

          circle.on('click', () => {
            highlightStopMarker(s.lat, s.lng, s.name);
          });

          circle.addTo(stopsLayerGroup);
          stopCircleMarkers.push(circle);
        }
      }

      console.log(`[Map] Rendered ${stopCircleMarkers.length} low-contrast stop dots.`);
    } catch (e) {
      console.warn('[Map] Could not fetch all geocoded stops:', e);
    }
  }

  function getStopRadiusForZoom(zoom) {
    if (zoom < 12) return 1.6;
    if (zoom < 14) return 2.4;
    return 3.6;
  }

  function getStopOpacityForZoom(zoom) {
    if (zoom < 12) return 0.35;
    if (zoom < 14) return 0.60;
    return 0.85;
  }

  function handleZoomChange() {
    if (!map) return;
    const currentZoom = map.getZoom();
    const newRadius = getStopRadiusForZoom(currentZoom);
    const newOpacity = getStopOpacityForZoom(currentZoom);

    stopCircleMarkers.forEach(circle => {
      circle.setRadius(newRadius);
      circle.setStyle({ fillOpacity: newOpacity });
    });
  }

  /**
   * Prominently highlight a user-selected stop
   */
  function highlightStopMarker(lat, lng, name) {
    if (!map || !highlightLayerGroup) return;
    highlightLayerGroup.clearLayers();

    // Outer pulsating halo ring
    L.circleMarker([lat, lng], {
      radius: 12,
      fillColor: '#102B49',
      fillOpacity: 0.18,
      color: '#102B49',
      weight: 2,
      interactive: false
    }).addTo(highlightLayerGroup);

    // Inner prominent focal circle
    L.circleMarker([lat, lng], {
      radius: 6,
      fillColor: '#102B49',
      fillOpacity: 1,
      color: '#F59E0B',
      weight: 2.5,
      interactive: false
    }).addTo(highlightLayerGroup);
  }

  /**
   * PART 7-C: Recommended routes
   * Display recommended routes using:
   * - Darker, more saturated colours (#102B49, #C2410C)
   * - High visual prominence with white halo boundary
   * - Clear visual distinction from background network
   * - Stop-count callout badge at path midpoint
   * - Visual pins for boarding, transfer, and destination
   */
  function displayJourney(journey) {
    if (!map || !journeyLayerGroup) return;
    journeyLayerGroup.clearLayers();
    alternativesLayerGroup.clearLayers();

    if (!journey || !journey.legs || journey.legs.length === 0) return;

    const bounds = L.latLngBounds();

    // 1. If alternatives exist in global state, display non-active ones in muted dashed styling
    if (window._lastAlternatives && window._lastAlternatives.length > 1) {
      window._lastAlternatives.forEach((alt, altIdx) => {
        // Skip currently selected journey
        const isCurrent = (alt.alternative_id === journey.alternative_id) ||
                          (alt.rank === journey.rank && alt.route_label === journey.route_label);
        if (isCurrent) return;

        if (alt.legs) {
          alt.legs.forEach(altLeg => {
            const altCoords = altLeg.path_coordinates || [];
            if (altCoords.length > 1) {
              const altLine = L.polyline(altCoords, {
                color: '#94A3B8',
                weight: 3.2,
                opacity: 0.45,
                dashArray: '6, 8',
                lineCap: 'round',
                lineJoin: 'round'
              }).addTo(alternativesLayerGroup);

              altLine.bindTooltip(`Alt #${alt.rank || altIdx + 1}: ${alt.route_label || altLeg.route_name} (${alt.total_duration_min} min)`, {
                sticky: true
              });
            }
          });
        }
      });
    }

    // 2. Render ACTIVE selected journey with dark, saturated colors and white contrast halo
    journey.legs.forEach((leg, index) => {
      const color = LEG_COLORS[index % LEG_COLORS.length];
      const coords = leg.path_coordinates || [];

      if (coords.length > 1) {
        // Crisp white halo underneath separating route from background lines
        L.polyline(coords, {
          color: '#FFFFFF',
          weight: 9.5,
          opacity: 0.95,
          lineCap: 'round',
          lineJoin: 'round',
          interactive: false
        }).addTo(journeyLayerGroup);

        // Dark, saturated foreground route line
        const polyline = L.polyline(coords, {
          color: color,
          weight: 5.5,
          opacity: 0.98,
          lineCap: 'round',
          lineJoin: 'round',
          dashArray: leg.service === 'Walking' ? '8, 8' : null
        }).addTo(journeyLayerGroup);

        polyline.bindTooltip(`Bus ${leg.route_name} (${leg.distance_km} km • ${leg.duration_min} min • ${leg.service})`, {
          sticky: true
        });

        coords.forEach(pt => bounds.extend(pt));

        // PART 7-C: Stop-count callout badge at the geographic midpoint of each leg
        const midIdx = Math.floor(coords.length / 2);
        const midPt = coords[midIdx];
        const stopCount = leg.stop_count || (leg.intermediate_stops ? leg.intermediate_stops.length + 1 : 1);
        const legDuration = Math.round(leg.duration_min || 0);

        const calloutIcon = L.divIcon({
          className: 'callout-container',
          html: `
            <div class="route-stop-count-callout">
              <span class="callout-bus-icon">🚌</span>
              <span class="callout-route-name">${leg.route_name}</span>
              <span class="callout-stop-badge">${stopCount} Stops</span>
              <span class="callout-duration">${legDuration}m</span>
            </div>
          `,
          iconSize: [160, 28],
          iconAnchor: [80, 14]
        });

        L.marker(midPt, { icon: calloutIcon, zIndexOffset: 850 })
          .addTo(journeyLayerGroup)
          .bindPopup(`<b>Route ${leg.route_name}</b><br>${leg.board_stop} ➔ ${leg.alight_stop}<br><b>${stopCount} Stops</b> • ${leg.distance_km} km • ~${legDuration} mins`);
      }

      // Add leg boarding / transfer point pin
      if (coords.length > 0) {
        const startPt = coords[0];
        const isFirstLeg = (index === 0);
        const pinClass = isFirstLeg ? 'pin-board' : 'pin-transfer';
        const pinIconSymbol = isFirstLeg ? '🟢' : '⇄';
        const pinLabel = isFirstLeg ? `BOARD: ${leg.board_stop}` : `TRANSFER: ${leg.board_stop}`;

        const pinIcon = L.divIcon({
          className: 'journey-pin-container',
          html: `<div class="journey-endpoint-pin ${pinClass}"><span>${pinIconSymbol}</span><span>${pinLabel}</span></div>`,
          iconSize: [150, 26],
          iconAnchor: [75, 13]
        });

        L.marker(startPt, { icon: pinIcon, zIndexOffset: 900 })
          .addTo(journeyLayerGroup)
          .bindPopup(`<b>${isFirstLeg ? 'Boarding Stop' : 'Transfer Point'}</b>: ${leg.board_stop}<br>Board Bus: <b>${leg.route_name}</b> (${leg.service})`);
      }

      // Add final destination pin at end of journey
      if (index === journey.legs.length - 1 && coords.length > 0) {
        const endPt = coords[coords.length - 1];
        const destIcon = L.divIcon({
          className: 'journey-pin-container',
          html: `<div class="journey-endpoint-pin pin-dest"><span>🏁</span><span>DEST: ${leg.alight_stop}</span></div>`,
          iconSize: [150, 26],
          iconAnchor: [75, 13]
        });

        L.marker(endPt, { icon: destIcon, zIndexOffset: 900 })
          .addTo(journeyLayerGroup)
          .bindPopup(`<b>Final Destination</b>: ${leg.alight_stop}<br>Journey Complete!`);
      }
    });

    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [65, 65], maxZoom: 15 });
    }
  }

  function highlightSingleStop(lat, lng, name) {
    if (!map) return;
    map.setView([lat, lng], 15);
    highlightStopMarker(lat, lng, name);
    L.popup()
      .setLatLng([lat, lng])
      .setContent(`
        <div class="map-stop-popup">
          <h4 style="margin:0 0 4px; color:#102B49; font-size:13px; font-weight:700;">${name}</h4>
          <div style="display:flex; gap:6px; margin-top:6px;">
            <button onclick="window.selectAsOrigin('${name.replace(/'/g, "\\'")}')" style="flex:1; background:#173B64; color:#fff; border:none; padding:4px 6px; border-radius:4px; font-size:10px; font-weight:700; cursor:pointer;">Set Origin</button>
            <button onclick="window.selectAsDest('${name.replace(/'/g, "\\'")}')" style="flex:1; background:#D97662; color:#fff; border:none; padding:4px 6px; border-radius:4px; font-size:10px; font-weight:700; cursor:pointer;">Set Dest</button>
          </div>
        </div>
      `)
      .openOn(map);
  }

  return {
    initMap,
    displayJourney,
    highlightSingleStop,
    highlightStopMarker
  };
})();
