// ═══════════════════════════════════════════════════════════
// TERRAIN — слои рельефа ArcticDEM (официальные сервисы PGC/Esri)
// ═══════════════════════════════════════════════════════════

// ── Официальные тайловые сервисы ArcticDEM ────────────────
// ImageServer с серверными функциями (hillshade, контуры и т.д.)
// Источник: elevation2.arcgis.com — официальный хостинг PGC
const ARCTICDEM_IMAGE_SERVER =
  'https://elevation2.arcgis.com/arcgis/rest/services/Polar/ArcticDEM/ImageServer';

// Функция для построения URL тайла ImageServer с рендер-функцией
function arcticdemTile(renderRule) {
  // ArcGIS ImageServer экспортирует тайлы через /exportImage
  // Leaflet использует TileLayer.WMS — подключаем через WMS интерфейс
  return `${ARCTICDEM_IMAGE_SERVER}/WMSServer?`;
}

const TERRAIN_LAYERS = {
  // ── Отмывка рельефа (многонаправленная) ──────────────────
  hillshadeMulti: {
    id:      'hillshadeMulti',
    label:   '🏔 Отмывка (многонаправленная)',
    title:   'ArcticDEM — многонаправленная отмывка, наилучшее отображение рельефа',
    type:    'wms',
    url:     `${ARCTICDEM_IMAGE_SERVER}/WMSServer`,
    layers:  'ArcticDEM',
    params:  { renderingRule: JSON.stringify({ rasterFunction: 'Hillshade Multidirectional' }) },
    opts:    { opacity: 0.6, maxZoom: 17 },
    zIndex:  210,
  },
  // ── Обычная отмывка ───────────────────────────────────────
  hillshadeGray: {
    id:      'hillshadeGray',
    label:   '🌫 Отмывка (серая)',
    title:   'ArcticDEM — стандартная отмывка рельефа',
    type:    'wms',
    url:     `${ARCTICDEM_IMAGE_SERVER}/WMSServer`,
    layers:  'ArcticDEM',
    params:  { renderingRule: JSON.stringify({ rasterFunction: 'Hillshade Gray' }) },
    opts:    { opacity: 0.5, maxZoom: 17 },
    zIndex:  210,
  },
  // ── Цветная по высоте ─────────────────────────────────────
  elevationTinted: {
    id:      'elevationTinted',
    label:   '🌈 Высоты (цветная раскраска)',
    title:   'ArcticDEM — цветное отображение высот (синий=низко, красный=высоко)',
    type:    'wms',
    url:     `${ARCTICDEM_IMAGE_SERVER}/WMSServer`,
    layers:  'ArcticDEM',
    params:  { renderingRule: JSON.stringify({ rasterFunction: 'Hillshade Elevation Tinted' }) },
    opts:    { opacity: 0.7, maxZoom: 17 },
    zIndex:  215,
  },
  // ── Горизонтали (сглаженные) ──────────────────────────────
  contourSmoothed: {
    id:      'contourSmoothed',
    label:   '📍 Горизонтали сглаженные (25м)',
    title:   'ArcticDEM — сглаженные горизонтали через 25м, динамически генерируются на сервере PGC',
    type:    'wms',
    url:     `${ARCTICDEM_IMAGE_SERVER}/WMSServer`,
    layers:  'ArcticDEM',
    params:  { renderingRule: JSON.stringify({ rasterFunction: 'Contour Smoothed 25' }) },
    opts:    { opacity: 1.0, maxZoom: 17 },
    zIndex:  220,
  },
  // ── Горизонтали (точные) ──────────────────────────────────
  contour: {
    id:      'contour',
    label:   '📐 Горизонтали точные (25м)',
    title:   'ArcticDEM — точные горизонтали через 25м без сглаживания',
    type:    'wms',
    url:     `${ARCTICDEM_IMAGE_SERVER}/WMSServer`,
    layers:  'ArcticDEM',
    params:  { renderingRule: JSON.stringify({ rasterFunction: 'Contour 25' }) },
    opts:    { opacity: 1.0, maxZoom: 17 },
    zIndex:  220,
  },
  // ── Уклон ─────────────────────────────────────────────────
  slope: {
    id:      'slope',
    label:   '📊 Уклон поверхности',
    title:   'ArcticDEM — углы уклона в градусах (0-90°)',
    type:    'wms',
    url:     `${ARCTICDEM_IMAGE_SERVER}/WMSServer`,
    layers:  'ArcticDEM',
    params:  { renderingRule: JSON.stringify({ rasterFunction: 'Slope Degrees' }) },
    opts:    { opacity: 0.7, maxZoom: 17 },
    zIndex:  215,
  },
};

// ── Состояние ──────────────────────────────────────────────
const _terrainActive  = {};  // id -> L.layer
let   _terrainVisible = {};  // id -> bool

function _terrainStateLoad() {
  try { _terrainVisible = JSON.parse(localStorage.getItem('pgk_terrain') || '{}'); } catch(e) {}
}
function _terrainStateSave() {
  try { localStorage.setItem('pgk_terrain', JSON.stringify(_terrainVisible)); } catch(e) {}
}

// ── Включить / выключить слой ──────────────────────────────
function terrainToggle(id) {
  const cfg = TERRAIN_LAYERS[id];
  if (!cfg || !map) return;

  if (_terrainActive[id]) {
    try { map.removeLayer(_terrainActive[id]); } catch(e) {}
    delete _terrainActive[id];
    _terrainVisible[id] = false;
  } else {
    let lyr;
    if (cfg.type === 'wms') {
      // Параметры WMS запроса
      const wmsParams = {
        service:     'WMS',
        version:     '1.3.0',
        request:     'GetMap',
        layers:      cfg.layers,
        format:      'image/png',
        transparent: true,
        attribution: '© Polar Geospatial Center, Esri',
        ...cfg.params,
      };
      lyr = L.tileLayer.wms(cfg.url, {
        ...wmsParams,
        ...cfg.opts,
      });
    } else {
      lyr = L.tileLayer(cfg.tile, { ...cfg.opts });
    }
    lyr.addTo(map);
    lyr.setZIndex(cfg.zIndex || 250);
    _terrainActive[id] = lyr;
    _terrainVisible[id] = true;
  }
  _terrainStateSave();
  renderTerrainPanel();
}

// ── Прозрачность ───────────────────────────────────────────
function terrainSetOpacity(id, val) {
  const v = parseFloat(val);
  if (_terrainActive[id]) _terrainActive[id].setOpacity(v);
  if (TERRAIN_LAYERS[id]) TERRAIN_LAYERS[id].opts.opacity = v;
  const lbl = document.getElementById('t-op-' + id);
  if (lbl) lbl.textContent = Math.round(v * 100) + '%';
}

// ── Скрыть все слои рельефа ────────────────────────────────
function terrainHideAll() {
  Object.keys(TERRAIN_LAYERS).forEach(id => {
    if (_terrainActive[id]) terrainToggle(id);
  });
  renderTerrainPanel();
}

// ── Рендер панели ──────────────────────────────────────────
function renderTerrainPanel() {
  const el = document.getElementById('terrain-section');
  if (!el) return;

  const anyActive = Object.keys(_terrainActive).length > 0;

  let html = `
    <div style="padding:5px 9px 3px;font-size:9px;font-weight:800;letter-spacing:.7px;
                text-transform:uppercase;color:var(--tx3);background:var(--s2);
                border-bottom:1px solid var(--bd);display:flex;align-items:center;
                justify-content:space-between">
      <span>❄️ ArcticDEM Рельеф</span>
      <button onclick="terrainHideAll()"
        style="background:${anyActive ? 'var(--redl)' : 'var(--grnl)'};
               color:${anyActive ? 'var(--red)' : 'var(--grn)'};
               border:1px solid ${anyActive ? '#fca5a5' : '#a7f3d0'};
               border-radius:4px;font-size:9px;padding:1px 7px;cursor:pointer;font-weight:700">
        ${anyActive ? '⊘ Скрыть все' : '✓ Все скрыты'}
      </button>
    </div>`;

  Object.values(TERRAIN_LAYERS).forEach(cfg => {
    const on = !!_terrainActive[cfg.id];
    const op = cfg.opts.opacity ?? 0.7;
    html += `
      <div style="padding:5px 9px;border-bottom:1px solid var(--bd)">
        <div style="display:flex;align-items:center;gap:6px">
          <button class="lp-v ${on ? 'on' : ''}"
            onclick="terrainToggle('${cfg.id}')"
            title="${cfg.title}"
            style="flex-shrink:0">${on ? '👁' : '🚫'}</button>
          <div style="flex:1;font-size:11px;font-weight:${on ? '700' : '400'};
               color:${on ? 'var(--tx)' : 'var(--tx3)'};overflow:hidden;
               text-overflow:ellipsis;white-space:nowrap"
               title="${cfg.title}">
            ${cfg.label}
          </div>
        </div>
        ${on ? `
        <div style="display:flex;align-items:center;gap:5px;padding:3px 0 1px 26px">
          <span style="font-size:9px;color:var(--tx3);white-space:nowrap">Прозрачность</span>
          <input type="range" min="0.1" max="1" step="0.05" value="${op}"
            style="flex:1;accent-color:var(--acc);cursor:pointer;height:3px"
            oninput="terrainSetOpacity('${cfg.id}',this.value)">
          <span id="t-op-${cfg.id}"
            style="font-size:9px;color:var(--acc);min-width:26px;text-align:right">
            ${Math.round(op * 100)}%
          </span>
        </div>` : ''}
      </div>`;
  });

  html += `<div style="padding:5px 9px;font-size:9px;color:var(--tx3);border-top:1px solid var(--bd)">
    Источник: <a href="https://arcticdem.apps.pgc.umn.edu/" target="_blank"
    style="color:var(--acc)">ArcticDEM Explorer (PGC/Esri)</a>
  </div>`;

  el.innerHTML = html;
}

// ── Инициализация ──────────────────────────────────────────
function initTerrain() {
  _terrainStateLoad();
  Object.keys(_terrainVisible).forEach(id => {
    if (_terrainVisible[id] && TERRAIN_LAYERS[id]) terrainToggle(id);
  });
  renderTerrainPanel();
}
