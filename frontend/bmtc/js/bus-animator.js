/**
 * SANCHARA – Bus Animator  (Phase 3 — Urban Bengaluru Streetscape)
 * Manages the full-screen cinematic transit overlay.
 *
 * Usage:
 *   window.BusAnimator.navigateWithBus(url, headsign, subtext, isReverse, busType)
 *   busType: 'ordinary' | 'vajra'
 *
 * The overlay is BMTC-only. Metro transitions remain completely separate.
 * Phase 3: Animated Bengaluru street environment with buildings scrolling past.
 */

window.BusAnimator = (() => {
  let overlay = null;

  /* ------------------------------------------------------------------ */
  /* Bengaluru cityscape SVG: a repeating strip of buildings & trees     */
  /* Includes: shops, hospital, school, police station, library,         */
  /* bus stop, supermarket — all in Royal Blue / Cream / Coral palette.  */
  /* ------------------------------------------------------------------ */
  function buildCityscapeSVG() {
    // We build two identical halves for seamless looping.
    // Width of one full "block" of buildings: 1400px × 2 = 2800px
    const segment = `
      <!-- ════ TREE ════ -->
      <g transform="translate(10,0)">
        <rect x="12" y="130" width="8" height="90" fill="#5C4A28" rx="2"/>
        <ellipse cx="16" cy="120" rx="22" ry="28" fill="#2D7A3A"/>
        <ellipse cx="16" cy="108" rx="16" ry="20" fill="#38A047"/>
      </g>

      <!-- ════ HOSPITAL ════ -->
      <g transform="translate(50,0)">
        <rect x="0" y="40" width="130" height="180" fill="#EEF3FA" stroke="#B8C8E8" stroke-width="2" rx="4"/>
        <rect x="0" y="20" width="130" height="30" fill="#173B64" rx="4 4 0 0"/>
        <text x="65" y="41" font-family="Manrope,sans-serif" font-size="11" font-weight="800" fill="#FAF5EB" text-anchor="middle" letter-spacing="1">HOSPITAL</text>
        <!-- Cross sign -->
        <rect x="52" y="30" width="26" height="8" rx="2" fill="#D43F52"/>
        <rect x="62" y="20" width="6" height="28" rx="2" fill="#D43F52"/>
        <!-- Windows -->
        <rect x="12" y="60" width="30" height="30" fill="#A8C8E8" rx="2" stroke="#7AAAC8" stroke-width="1"/>
        <rect x="52" y="60" width="30" height="30" fill="#A8C8E8" rx="2" stroke="#7AAAC8" stroke-width="1"/>
        <rect x="90" y="60" width="30" height="30" fill="#A8C8E8" rx="2" stroke="#7AAAC8" stroke-width="1"/>
        <rect x="12" y="102" width="30" height="30" fill="#A8C8E8" rx="2" stroke="#7AAAC8" stroke-width="1"/>
        <rect x="52" y="102" width="30" height="30" fill="#A8C8E8" rx="2" stroke="#7AAAC8" stroke-width="1"/>
        <rect x="90" y="102" width="30" height="30" fill="#A8C8E8" rx="2" stroke="#7AAAC8" stroke-width="1"/>
        <!-- Door -->
        <rect x="47" y="168" width="36" height="52" fill="#173B64" rx="3"/>
        <rect x="51" y="172" width="12" height="40" fill="#A8C8E8" rx="1"/>
        <rect x="68" y="172" width="12" height="40" fill="#A8C8E8" rx="1"/>
        <!-- Flag pole -->
        <line x1="65" y1="20" x2="65" y2="0" stroke="#8FA0B4" stroke-width="2"/>
        <rect x="65" y="0" width="22" height="12" fill="#D43F52" rx="1"/>
      </g>

      <!-- ════ TREE ════ -->
      <g transform="translate(192,0)">
        <rect x="12" y="150" width="6" height="70" fill="#5C4A28" rx="2"/>
        <ellipse cx="15" cy="140" rx="18" ry="22" fill="#38A047"/>
        <ellipse cx="15" cy="128" rx="13" ry="16" fill="#4FC25A"/>
      </g>

      <!-- ════ POLICE STATION ════ -->
      <g transform="translate(218,0)">
        <rect x="0" y="55" width="118" height="165" fill="#C5392B" stroke="#8B1F14" stroke-width="2" rx="3"/>
        <rect x="0" y="30" width="118" height="32" fill="#8B1F14" rx="3 3 0 0"/>
        <text x="59" y="51" font-family="Manrope,sans-serif" font-size="11" font-weight="800" fill="#FAF5EB" text-anchor="middle" letter-spacing="1">POLICE</text>
        <!-- Badge star shape -->
        <circle cx="59" cy="12" r="14" fill="#C9A84C" stroke="#FAF5EB" stroke-width="1"/>
        <text x="59" y="17" font-family="serif" font-size="13" fill="#8B1F14" text-anchor="middle" font-weight="900">★</text>
        <!-- Windows -->
        <rect x="12" y="72" width="28" height="36" fill="#FAD5A5" rx="2" stroke="#C9A84C" stroke-width="1"/>
        <rect x="48" y="72" width="22" height="36" fill="#FAD5A5" rx="2" stroke="#C9A84C" stroke-width="1"/>
        <rect x="80" y="72" width="28" height="36" fill="#FAD5A5" rx="2" stroke="#C9A84C" stroke-width="1"/>
        <rect x="12" y="120" width="28" height="28" fill="#FAD5A5" rx="2" stroke="#C9A84C" stroke-width="1"/>
        <rect x="80" y="120" width="28" height="28" fill="#FAD5A5" rx="2" stroke="#C9A84C" stroke-width="1"/>
        <!-- Door -->
        <rect x="43" y="162" width="32" height="58" fill="#8B1F14" rx="3"/>
        <line x1="59" y1="162" x2="59" y2="220" stroke="#C9A84C" stroke-width="1.5"/>
        <!-- Flag -->
        <line x1="59" y1="30" x2="59" y2="2" stroke="#FAF5EB" stroke-width="2"/>
        <rect x="59" y="2" width="28" height="16" fill="#173B64" rx="1"/>
        <rect x="59" y="6" width="28" height="4" fill="#FAF5EB"/>
      </g>

      <!-- ════ TREE ════ -->
      <g transform="translate(348,0)">
        <rect x="10" y="140" width="8" height="80" fill="#5C4A28" rx="2"/>
        <ellipse cx="14" cy="128" rx="20" ry="25" fill="#2D7A3A"/>
        <ellipse cx="14" cy="115" rx="14" ry="18" fill="#38A047"/>
      </g>

      <!-- ════ BUS STOP ════ -->
      <g transform="translate(378,0)">
        <!-- Lamp post -->
        <rect x="8" y="60" width="5" height="160" fill="#173B64" rx="2"/>
        <rect x="4" y="60" width="13" height="8" fill="#D43F52" rx="2"/>
        <circle cx="10" cy="56" r="8" fill="#FAF5EB" stroke="#173B64" stroke-width="1.5"/>
        <circle cx="10" cy="56" r="4" fill="#FFD700" opacity="0.9"/>
        <!-- Shelter frame -->
        <rect x="22" y="80" width="80" height="8" fill="#C9A84C" rx="2"/>
        <rect x="22" y="80" width="6" height="130" fill="#173B64" rx="2"/>
        <rect x="96" y="80" width="6" height="130" fill="#173B64" rx="2"/>
        <!-- Glass back -->
        <rect x="28" y="88" width="68" height="90" fill="rgba(16,43,73,0.25)" stroke="#173B64" stroke-width="1" rx="2"/>
        <!-- Sign -->
        <rect x="34" y="62" width="56" height="20" fill="#173B64" rx="4"/>
        <text x="62" y="76" font-family="Manrope,sans-serif" font-size="8" font-weight="800" fill="#FAF5EB" text-anchor="middle" letter-spacing="1">BUS STOP</text>
        <!-- Info boards -->
        <rect x="34" y="96" width="22" height="28" fill="#D43F52" rx="2"/>
        <rect x="62" y="96" width="22" height="28" fill="#D43F52" rx="2"/>
        <!-- Bench -->
        <rect x="28" y="184" width="70" height="10" fill="#C9A84C" rx="2"/>
        <rect x="34" y="194" width="8" height="16" fill="#C9A84C" rx="1"/>
        <rect x="80" y="194" width="8" height="16" fill="#C9A84C" rx="1"/>
        <!-- Bin -->
        <rect x="104" y="176" width="16" height="22" fill="#8FA0B4" rx="2"/>
        <rect x="102" y="172" width="20" height="6" fill="#173B64" rx="2"/>
      </g>

      <!-- ════ TREE ════ -->
      <g transform="translate(488,0)">
        <rect x="12" y="145" width="7" height="75" fill="#5C4A28" rx="2"/>
        <ellipse cx="15.5" cy="133" rx="19" ry="24" fill="#38A047"/>
        <ellipse cx="15.5" cy="120" rx="13" ry="17" fill="#4FC25A"/>
      </g>

      <!-- ════ SCHOOL ════ -->
      <g transform="translate(518,0)">
        <rect x="0" y="45" width="140" height="175" fill="#C87832" stroke="#8B4A14" stroke-width="2" rx="4"/>
        <rect x="0" y="20" width="140" height="32" fill="#8B4A14" rx="4 4 0 0"/>
        <text x="70" y="41" font-family="Manrope,sans-serif" font-size="11" font-weight="800" fill="#FAF5EB" text-anchor="middle" letter-spacing="1">SCHOOL</text>
        <!-- Flag -->
        <line x1="70" y1="20" x2="70" y2="-2" stroke="#FAF5EB" stroke-width="2"/>
        <rect x="70" y="-2" width="26" height="14" fill="#D43F52" rx="1"/>
        <!-- Clock -->
        <circle cx="70" cy="66" r="18" fill="#FAF5EB" stroke="#8B4A14" stroke-width="2"/>
        <circle cx="70" cy="66" r="14" fill="#FAF5EB"/>
        <line x1="70" y1="66" x2="70" y2="55" stroke="#173B64" stroke-width="2.5" stroke-linecap="round"/>
        <line x1="70" y1="66" x2="78" y2="66" stroke="#173B64" stroke-width="2" stroke-linecap="round"/>
        <!-- Windows -->
        <rect x="12" y="92" width="30" height="32" fill="#A8C8E8" rx="2" stroke="#7AAAC8" stroke-width="1"/>
        <rect x="56" y="92" width="28" height="32" fill="#A8C8E8" rx="2" stroke="#7AAAC8" stroke-width="1"/>
        <rect x="98" y="92" width="30" height="32" fill="#A8C8E8" rx="2" stroke="#7AAAC8" stroke-width="1"/>
        <rect x="12" y="135" width="30" height="28" fill="#A8C8E8" rx="2" stroke="#7AAAC8" stroke-width="1"/>
        <rect x="98" y="135" width="30" height="28" fill="#A8C8E8" rx="2" stroke="#7AAAC8" stroke-width="1"/>
        <!-- Door arch -->
        <path d="M 50,220 L 50,172 Q 50,158 70,158 Q 90,158 90,172 L 90,220 Z" fill="#8B4A14"/>
        <path d="M 54,220 L 54,174 Q 54,163 70,163 Q 86,163 86,174 L 86,220 Z" fill="#A8C8E8"/>
        <!-- Steps -->
        <rect x="40" y="218" width="60" height="4" fill="#FAF5EB"/>
      </g>

      <!-- ════ TREE ════ -->
      <g transform="translate(670,0)">
        <rect x="10" y="140" width="8" height="80" fill="#5C4A28" rx="2"/>
        <ellipse cx="14" cy="128" rx="20" ry="25" fill="#2D7A3A"/>
        <ellipse cx="14" cy="115" rx="14" ry="18" fill="#38A047"/>
      </g>

      <!-- ════ LIBRARY / BOOKSHOP ════ -->
      <g transform="translate(702,0)">
        <rect x="0" y="55" width="120" height="165" fill="#173B64" stroke="#0D233A" stroke-width="2" rx="4"/>
        <rect x="0" y="28" width="120" height="34" fill="#102B49" rx="4 4 0 0"/>
        <text x="60" y="50" font-family="Manrope,sans-serif" font-size="10" font-weight="800" fill="#FAF5EB" text-anchor="middle" letter-spacing="1">LIBRARY</text>
        <!-- Arch windows -->
        <path d="M 10,120 L 10,80 Q 10,65 25,65 Q 40,65 40,80 L 40,120 Z" fill="#7AAAC8" stroke="#0D233A" stroke-width="1"/>
        <path d="M 50,120 L 50,80 Q 50,65 65,65 Q 80,65 80,80 L 80,120 Z" fill="#7AAAC8" stroke="#0D233A" stroke-width="1"/>
        <path d="M 80,120 L 80,80 Q 80,65 95,65 Q 110,65 110,80 L 110,120 Z" fill="#7AAAC8" stroke="#0D233A" stroke-width="1"/>
        <!-- Shelves inside windows -->
        <line x1="12" y1="90" x2="38" y2="90" stroke="#FAF5EB" stroke-width="1.5" opacity="0.5"/>
        <line x1="12" y1="102" x2="38" y2="102" stroke="#FAF5EB" stroke-width="1.5" opacity="0.5"/>
        <line x1="52" y1="90" x2="78" y2="90" stroke="#FAF5EB" stroke-width="1.5" opacity="0.5"/>
        <line x1="82" y1="90" x2="108" y2="90" stroke="#FAF5EB" stroke-width="1.5" opacity="0.5"/>
        <!-- Book spines -->
        <rect x="13" y="93" width="4" height="10" fill="#D43F52"/>
        <rect x="19" y="93" width="4" height="10" fill="#C9A84C"/>
        <rect x="25" y="93" width="4" height="10" fill="#FAF5EB"/>
        <!-- Smaller windows lower -->
        <rect x="12" y="130" width="28" height="24" fill="#7AAAC8" rx="2" stroke="#0D233A" stroke-width="1"/>
        <rect x="80" y="130" width="28" height="24" fill="#7AAAC8" rx="2" stroke="#0D233A" stroke-width="1"/>
        <!-- Door -->
        <rect x="44" y="168" width="32" height="52" fill="#C9A84C" rx="3"/>
        <rect x="48" y="172" width="10" height="38" fill="#A8C8E8" rx="1"/>
        <rect x="62" y="172" width="10" height="38" fill="#A8C8E8" rx="1"/>
        <!-- Steps -->
        <rect x="34" y="216" width="52" height="4" fill="#FAF5EB"/>
      </g>

      <!-- ════ TREE ════ -->
      <g transform="translate(834,0)">
        <rect x="12" y="150" width="6" height="70" fill="#5C4A28" rx="2"/>
        <ellipse cx="15" cy="140" rx="18" ry="22" fill="#38A047"/>
        <ellipse cx="15" cy="128" rx="13" ry="16" fill="#4FC25A"/>
      </g>

      <!-- ════ SUPERMARKET ════ -->
      <g transform="translate(862,0)">
        <rect x="0" y="50" width="150" height="170" fill="#FAF5EB" stroke="#D4CAB5" stroke-width="2" rx="4"/>
        <rect x="0" y="22" width="150" height="36" fill="#D43F52" rx="4 4 0 0"/>
        <text x="75" y="45" font-family="Manrope,sans-serif" font-size="10" font-weight="800" fill="#FAF5EB" text-anchor="middle" letter-spacing="1">SUPERMARKET</text>
        <!-- Awning stripes -->
        <rect x="0" y="58" width="150" height="22" fill="#173B64"/>
        <rect x="12" y="58" width="12" height="22" fill="#D43F52"/>
        <rect x="36" y="58" width="12" height="22" fill="#D43F52"/>
        <rect x="60" y="58" width="12" height="22" fill="#D43F52"/>
        <rect x="84" y="58" width="12" height="22" fill="#D43F52"/>
        <rect x="108" y="58" width="12" height="22" fill="#D43F52"/>
        <rect x="132" y="58" width="12" height="22" fill="#D43F52"/>
        <!-- Large shop windows -->
        <rect x="8" y="88" width="62" height="62" fill="#A8C8E8" rx="3" stroke="#7AAAC8" stroke-width="1.5"/>
        <rect x="80" y="88" width="62" height="62" fill="#A8C8E8" rx="3" stroke="#7AAAC8" stroke-width="1.5"/>
        <!-- Price tags -->
        <rect x="16" y="96" width="20" height="10" fill="#D43F52" rx="1"/>
        <text x="26" y="105" font-family="sans-serif" font-size="6" fill="#fff" text-anchor="middle" font-weight="700">SALE</text>
        <!-- Double door -->
        <rect x="46" y="168" width="58" height="52" fill="#173B64" rx="3"/>
        <rect x="50" y="172" width="22" height="40" fill="#A8C8E8" rx="1"/>
        <rect x="78" y="172" width="22" height="40" fill="#A8C8E8" rx="1"/>
        <!-- OPEN sign -->
        <rect x="104" y="94" width="30" height="14" fill="#2D7A3A" rx="2"/>
        <text x="119" y="105" font-family="sans-serif" font-size="7" fill="#fff" text-anchor="middle" font-weight="800">OPEN</text>
      </g>

      <!-- ════ TREE ════ -->
      <g transform="translate(1024,0)">
        <rect x="10" y="140" width="8" height="80" fill="#5C4A28" rx="2"/>
        <ellipse cx="14" cy="128" rx="20" ry="25" fill="#2D7A3A"/>
        <ellipse cx="14" cy="115" rx="14" ry="18" fill="#38A047"/>
      </g>

      <!-- ════ SHOPS (small row) ════ -->
      <g transform="translate(1054,0)">
        <!-- Shop 1: Bakery style -->
        <rect x="0" y="80" width="80" height="140" fill="#FAF5EB" stroke="#D4CAB5" stroke-width="1.5" rx="3"/>
        <rect x="0" y="55" width="80" height="30" fill="#D43F52" rx="3 3 0 0"/>
        <text x="40" y="75" font-family="Manrope,sans-serif" font-size="9" font-weight="800" fill="#FAF5EB" text-anchor="middle">BAKERY</text>
        <rect x="10" y="88" width="60" height="45" fill="#A8C8E8" rx="2"/>
        <rect x="20" y="148" width="40" height="52" fill="#173B64" rx="2"/>
        <rect x="24" y="152" width="14" height="38" fill="#A8C8E8" rx="1"/>
        <rect x="44" y="152" width="14" height="38" fill="#A8C8E8" rx="1"/>
        <!-- Shop 2: Tea shop -->
        <rect x="88" y="90" width="72" height="130" fill="#EEF3FA" stroke="#B8C8E8" stroke-width="1.5" rx="3"/>
        <rect x="88" y="62" width="72" height="32" fill="#173B64" rx="3 3 0 0"/>
        <text x="124" y="82" font-family="Manrope,sans-serif" font-size="8" font-weight="800" fill="#C9A84C" text-anchor="middle">CHAI SHOP</text>
        <rect x="96" y="98" width="56" height="40" fill="#A8C8E8" rx="2"/>
        <rect x="104" y="150" width="34" height="50" fill="#102B49" rx="2"/>
        <rect x="108" y="154" width="12" height="36" fill="#A8C8E8" rx="1"/>
        <rect x="124" y="154" width="12" height="36" fill="#A8C8E8" rx="1"/>
      </g>

      <!-- ════ TREE ════ -->
      <g transform="translate(1234,0)">
        <rect x="12" y="145" width="7" height="75" fill="#5C4A28" rx="2"/>
        <ellipse cx="15.5" cy="133" rx="19" ry="24" fill="#38A047"/>
        <ellipse cx="15.5" cy="120" rx="13" ry="17" fill="#4FC25A"/>
      </g>

      <!-- ════ TALLER BUILDING (apartment/office) ════ -->
      <g transform="translate(1264,0)">
        <rect x="0" y="0" width="120" height="220" fill="#173B64" stroke="#0D233A" stroke-width="2" rx="4"/>
        <rect x="0" y="0" width="120" height="22" fill="#D43F52" rx="4 4 0 0"/>
        <text x="60" y="16" font-family="Manrope,sans-serif" font-size="8" font-weight="800" fill="#FAF5EB" text-anchor="middle" letter-spacing="1">SANCHARA HOUSE</text>
        <!-- Window grid -->
        <rect x="8"  y="30" width="20" height="20" fill="#7AAAC8" rx="1"/>
        <rect x="34" y="30" width="20" height="20" fill="#7AAAC8" rx="1"/>
        <rect x="60" y="30" width="20" height="20" fill="#FAD5A5" rx="1"/>
        <rect x="86" y="30" width="20" height="20" fill="#7AAAC8" rx="1"/>
        <rect x="8"  y="58" width="20" height="20" fill="#7AAAC8" rx="1"/>
        <rect x="34" y="58" width="20" height="20" fill="#FAD5A5" rx="1"/>
        <rect x="60" y="58" width="20" height="20" fill="#7AAAC8" rx="1"/>
        <rect x="86" y="58" width="20" height="20" fill="#FAD5A5" rx="1"/>
        <rect x="8"  y="86" width="20" height="20" fill="#FAD5A5" rx="1"/>
        <rect x="34" y="86" width="20" height="20" fill="#7AAAC8" rx="1"/>
        <rect x="60" y="86" width="20" height="20" fill="#7AAAC8" rx="1"/>
        <rect x="86" y="86" width="20" height="20" fill="#7AAAC8" rx="1"/>
        <rect x="8"  y="114" width="20" height="20" fill="#7AAAC8" rx="1"/>
        <rect x="34" y="114" width="20" height="20" fill="#7AAAC8" rx="1"/>
        <rect x="60" y="114" width="20" height="20" fill="#FAD5A5" rx="1"/>
        <rect x="86" y="114" width="20" height="20" fill="#7AAAC8" rx="1"/>
        <rect x="8"  y="142" width="20" height="20" fill="#FAD5A5" rx="1"/>
        <rect x="34" y="142" width="20" height="20" fill="#7AAAC8" rx="1"/>
        <rect x="60" y="142" width="20" height="20" fill="#7AAAC8" rx="1"/>
        <rect x="86" y="142" width="20" height="20" fill="#FAD5A5" rx="1"/>
        <!-- BMTC logo flag -->
        <line x1="60" y1="0" x2="60" y2="-18" stroke="#C9A84C" stroke-width="2"/>
        <rect x="60" y="-18" width="30" height="12" fill="#C9A84C" rx="1"/>
        <text x="75" y="-9" font-family="serif" font-size="6" fill="#173B64" text-anchor="middle" font-weight="800">BMTC</text>
        <!-- Ground entrance -->
        <rect x="40" y="168" width="40" height="52" fill="#C9A84C" rx="3"/>
        <path d="M 42,168 Q 60,152 78,168 Z" fill="#C9A84C"/>
        <rect x="44" y="172" width="14" height="38" fill="#A8C8E8" rx="1"/>
        <rect x="62" y="172" width="14" height="38" fill="#A8C8E8" rx="1"/>
      </g>

      <!-- ════ TREE ════ -->
      <g transform="translate(1396,0)">
        <rect x="10" y="140" width="8" height="80" fill="#5C4A28" rx="2"/>
        <ellipse cx="14" cy="128" rx="20" ry="25" fill="#2D7A3A"/>
        <ellipse cx="14" cy="115" rx="14" ry="18" fill="#38A047"/>
      </g>
    `;

    return `
      <svg xmlns="http://www.w3.org/2000/svg"
           viewBox="0 0 2800 220"
           width="2800" height="220"
           style="display:block; flex-shrink:0;"
           aria-hidden="true">
        <!-- Block 1 -->
        <g transform="translate(0, 0)">${segment}</g>
        <!-- Block 2 (identical, seamless repeat) -->
        <g transform="translate(1400, 0)">${segment}</g>
      </svg>
    `;
  }

  /* ------------------------------------------------------------------ */
  /* Build the overlay DOM once                                           */
  /* ------------------------------------------------------------------ */
  function ensureOverlay() {
    if (overlay && document.body.contains(overlay)) return overlay;

    overlay = document.createElement('div');
    overlay.className = 'bus-transition-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = `
      <!-- Speed-warp streaks -->
      <div class="speed-warp-container">
        <div class="speed-streak"></div>
        <div class="speed-streak"></div>
        <div class="speed-streak"></div>
      </div>

      <!-- Bengaluru roadside environment (poles + buildings) -->
      <div class="road-environment">
        <div class="env-light-pole"></div>
        <div class="env-light-pole"></div>
        <div class="env-light-pole"></div>
        <div class="env-light-pole"></div>

        <!-- Scrolling cityscape strip -->
        <div class="city-streetscape" id="cityStreetscape"></div>
      </div>

      <!-- Transit Status HUD -->
      <div class="transit-status-msg">
        <span class="transit-headsign-title" id="transitHeadsign">BOARDING BMTC</span>
        <span class="transit-subtext" id="transitSubtext">Entering Transit Network</span>
      </div>

      <!-- Highway Road Corridor -->
      <div class="highway-track" aria-hidden="true">
        <div class="road-dash-lines"></div>
      </div>

      <!-- The traveling bus -->
      <div class="traveling-bus-wrapper" id="travelingBusContainer">
        <img src="/assets/svg/transition-bus-express.svg"
             id="transitionBusImg"
             alt="BMTC Transit Bus" />
      </div>
    `;

    document.body.appendChild(overlay);

    // Inject cityscape SVG
    const cityEl = overlay.querySelector('#cityStreetscape');
    if (cityEl) cityEl.innerHTML = buildCityscapeSVG();

    return overlay;
  }

  /* ------------------------------------------------------------------ */
  /* Main public API                                                      */
  /* ------------------------------------------------------------------ */
  function navigateWithBus(
    targetUrl,
    headsign   = 'BOARDING BMTC',
    subtext    = 'Entering Transit Network',
    isReverse  = false,
    busType    = 'ordinary'   // 'ordinary' | 'vajra'
  ) {
    const el      = ensureOverlay();
    const titleEl = el.querySelector('#transitHeadsign');
    const subEl   = el.querySelector('#transitSubtext');
    const busImg  = el.querySelector('#transitionBusImg');

    /* Content */
    if (titleEl) titleEl.textContent = headsign;
    if (subEl)   subEl.textContent   = subtext;

    /* Bus asset */
    if (busImg) {
      busImg.src = (busType === 'vajra')
        ? '/assets/svg/transition-bus-vajra.svg'
        : '/assets/svg/transition-bus-express.svg';
      busImg.alt = (busType === 'vajra')
        ? 'AC Volvo Vajra Transit Bus'
        : 'BMTC Express Transit Bus';
    }

    /* Vajra: cyan streaks + cyan road accent */
    if (busType === 'vajra') {
      el.classList.add('is-vajra');
    } else {
      el.classList.remove('is-vajra');
    }

    /* Reverse direction */
    if (isReverse) {
      el.classList.add('is-reverse');
    } else {
      el.classList.remove('is-reverse');
    }

    /* Force reflow so CSS animations restart cleanly */
    void el.offsetWidth;
    el.classList.add('is-active');

    /* Navigate after the bus sweeps across (2.1 s animation + 100 ms buffer) */
    setTimeout(() => {
      window.location.href = targetUrl;
    }, 2000);
  }

  /* ------------------------------------------------------------------ */
  /* Dismiss overlay (e.g. if navigation is cancelled)                   */
  /* ------------------------------------------------------------------ */
  function dismiss() {
    if (overlay) {
      overlay.classList.remove('is-active');
      setTimeout(() => {
        if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
        overlay = null;
      }, 400);
    }
  }

  return { navigateWithBus, ensureOverlay, dismiss };
})();