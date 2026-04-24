// ═══════════════════════════════════════════════════════════
// HTML-экспорт объёмов в выбранной области
// ═══════════════════════════════════════════════════════════

var _htmlExDraw  = false;
var _htmlExStart = null;
var _htmlExTmp   = null;
var _htmlExSiteId = null;

// ── Открыть диалог выбора области ────────────────────────
function openHtmlExportModal(siteId) {
  _htmlExSiteId = siteId;
  showModal('📄 HTML-экспорт объёмов',
    '<p style="font-size:12px;color:var(--tx2);margin-bottom:12px">Выберите область для выгрузки точечных объёмов в автономный HTML-файл.</p>'
    +'<div style="display:flex;gap:8px;flex-wrap:wrap">'
    +'<div style="flex:1;min-width:130px;padding:12px;border:1.5px solid var(--bd);border-radius:10px;cursor:pointer;transition:border-color .15s" '
    +'onclick="closeModal();_htmlExFromView()">'
    +'<div style="font-size:22px;text-align:center;margin-bottom:4px">🗺</div>'
    +'<div style="font-size:12px;font-weight:700;text-align:center">Текущий вид</div>'
    +'<div style="font-size:10px;color:var(--tx3);text-align:center;margin-top:3px">Экспорт видимой области карты</div>'
    +'</div>'
    +'<div style="flex:1;min-width:130px;padding:12px;border:1.5px solid var(--bd);border-radius:10px;cursor:pointer;transition:border-color .15s" '
    +'onclick="closeModal();_htmlExStartDraw()">'
    +'<div style="font-size:22px;text-align:center;margin-bottom:4px">✏️</div>'
    +'<div style="font-size:12px;font-weight:700;text-align:center">Нарисовать</div>'
    +'<div style="font-size:10px;color:var(--tx3);text-align:center;margin-top:3px">Выделить прямоугольник на карте</div>'
    +'</div>'
    +'</div>',
    [{label:'Отмена',cls:'bs',fn:closeModal}]
  );
}

// ── Экспорт по текущему виду карты ───────────────────────
function _htmlExFromView() {
  const bounds = map.getBounds();
  const bbox = {
    minLat: bounds.getSouth(), maxLat: bounds.getNorth(),
    minLng: bounds.getWest(),  maxLng: bounds.getEast()
  };
  generateHtmlExport(_htmlExSiteId, bbox);
}

// ── Рисование прямоугольника ──────────────────────────────
function _htmlExStartDraw() {
  _htmlExDraw  = false;
  _htmlExStart = null;
  if (_htmlExTmp) { try { map.removeLayer(_htmlExTmp); } catch(e) {} _htmlExTmp = null; }

  map.getContainer().style.cursor = 'crosshair';
  const bnr = document.getElementById('bnr');
  if (bnr) {
    bnr.className = 'show draw';
    document.getElementById('bnr-t').textContent = '📄 Кликните — первый угол области HTML-экспорта (ПКМ — отмена)';
    bnr.style.display = 'flex';
  }
  map.once('click', _htmlExFirstClick);
  map.once('contextmenu', _htmlExCancel);
}

function _htmlExFirstClick(e) {
  _htmlExDraw  = true;
  _htmlExStart = e.latlng;
  document.getElementById('bnr-t').textContent = '📄 Кликните — второй угол области';
  map.on('mousemove', _htmlExMouseMove);
  map.once('click', _htmlExSecondClick);
}

function _htmlExMouseMove(e) {
  if (!_htmlExStart) return;
  const bounds = L.latLngBounds(_htmlExStart, e.latlng);
  if (_htmlExTmp) {
    _htmlExTmp.setBounds(bounds);
  } else {
    _htmlExTmp = L.rectangle(bounds, {
      color: '#6366f1', weight: 2, dashArray: '6 4',
      fillColor: '#6366f1', fillOpacity: 0.12
    }).addTo(map);
  }
}

function _htmlExSecondClick(e) {
  map.off('mousemove', _htmlExMouseMove);
  map.off('contextmenu', _htmlExCancel);
  const bounds = L.latLngBounds(_htmlExStart, e.latlng);
  if (_htmlExTmp) { map.removeLayer(_htmlExTmp); _htmlExTmp = null; }
  map.getContainer().style.cursor = '';
  const bnr = document.getElementById('bnr');
  if (bnr) bnr.className = '';

  const bbox = {
    minLat: bounds.getSouth(), maxLat: bounds.getNorth(),
    minLng: bounds.getWest(),  maxLng: bounds.getEast()
  };
  generateHtmlExport(_htmlExSiteId, bbox);
}

function _htmlExCancel() {
  map.off('mousemove', _htmlExMouseMove);
  map.off('click', _htmlExFirstClick);
  map.off('click', _htmlExSecondClick);
  if (_htmlExTmp) { try { map.removeLayer(_htmlExTmp); } catch(e) {} _htmlExTmp = null; }
  map.getContainer().style.cursor = '';
  const bnr = document.getElementById('bnr');
  if (bnr) bnr.className = '';
}

// ── Основная функция генерации ────────────────────────────
async function generateHtmlExport(siteId, bbox) {
  toast('Готовлю HTML...', 'ok');
  const s = await fetch(`${API}/sites/${siteId}`).then(r => r.json());

  const inBbox = (lat, lng) =>
    lat >= bbox.minLat && lat <= bbox.maxLat &&
    lng >= bbox.minLng && lng <= bbox.maxLng;

  const SEM_LABEL = {
    borehole:'Скважина', pit:'Шурф',
    ggs:'Пункт ГГС', ogs:'Пункт ОГС', repere:'Репер',
    benchmark:'Марка', steel_angle:'Металлический уголок', other:'Другое'
  };

  const volMap = {};
  (s.volumes||[]).forEach(v => { volMap[v.id] = v; });

  // Точки для экспорта
  const pts = [];

  const collectFromGJ = (gjStr, volName, color, date, cat) => {
    if (!gjStr) return;
    try {
      const gj = JSON.parse(gjStr);
      const features = gj.type==='FeatureCollection' ? gj.features
                     : gj.type==='Feature'            ? [gj] : [];
      features.forEach(feat => {
        if (!feat.geometry || feat.geometry.type !== 'Point') return;
        const [lng, lat] = feat.geometry.coordinates;
        if (!inBbox(lat, lng)) return;
        const sem = (feat.properties && feat.properties.sem) || {};
        pts.push({
          lat, lng,
          color: (feat.properties && feat.properties.color) || color || '#1a56db',
          volName, date: date || '', sem, cat
        });
      });
    } catch(e) {}
  };

  // Из vol_progress (главный источник)
  (s.vol_progress||[]).forEach(p => {
    if (p.row_type && p.row_type !== 'fact') return;
    const vol = volMap[p.volume_id];
    if (!vol) return;
    collectFromGJ(p.geojson, vol.name, vol.color, p.work_date, vol.category);
  });

  // Из volumes.geojson (если заполнен)
  (s.volumes||[]).forEach(v => {
    collectFromGJ(v.geojson, v.name, v.color, null, v.category);
  });

  if (pts.length === 0) {
    toast('В выбранной области нет точечных объёмов', 'err');
    return;
  }

  const dateStr = new Date().toLocaleDateString('ru');
  const html = _buildHtmlExport(s.name, bbox, pts, SEM_LABEL, dateStr);

  const a = document.createElement('a');
  a.href = 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
  a.download = s.name.replace(/[\/\\:*?"<>|]/g,'_')
    + '_объёмы_' + new Date().toLocaleDateString('ru').replace(/\./g,'-') + '.html';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  toast('HTML сохранён: ' + pts.length + ' точек', 'ok');
}

// ── Сборка HTML-строки ────────────────────────────────────
function _buildHtmlExport(siteName, bbox, pts, SEM_LABEL, dateStr) {
  const he = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

  // Данные для карты (без esc — будет JSON.stringify)
  const mapData = pts.map((p,i) => ({
    i: i+1, lat: p.lat, lng: p.lng, color: p.color,
    n: p.volName, dt: p.date,
    cat: p.cat==='geology' ? 'Геология' : 'Геодезия',
    sl: SEM_LABEL[p.sem.type] || p.sem.type || '',
    d: p.sem.data || {}
  }));

  // Строки таблицы
  const rows = pts.map((p,i) => {
    const d = p.sem.data || {};
    const cat = p.cat==='geology' ? 'Геология' : 'Геодезия';
    const sl  = SEM_LABEL[p.sem.type] || p.sem.type || '—';
    return `<tr>
      <td>${i+1}</td>
      <td>${he(p.volName)}</td>
      <td>${he(p.date||'—')}</td>
      <td>${cat}</td>
      <td>${he(sl)}</td>
      <td>${he(d.depth||'')}</td>
      <td>${he(d.diam||'')}</td>
      <td>${he(d.ugv||'')}</td>
      <td>${he(d.date||'')}</td>
      <td>${he(d.exec||'')}</td>
      <td>${he(d.desc||d.note||'')}</td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${he(siteName)} — Объёмы</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f1f5f9;color:#1e293b}
#hdr{padding:14px 20px;background:#1e293b;color:#fff;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px}
#hdr h1{font-size:17px;font-weight:700;letter-spacing:-.3px}
#hdr .sub{font-size:11px;color:#94a3b8;margin-top:2px}
#map{height:55vh;min-height:300px;width:100%;border-bottom:2px solid #e2e8f0}
#main{padding:16px 20px}
#main h2{font-size:13px;font-weight:700;color:#334155;margin-bottom:10px}
.tbl-wrap{overflow-x:auto;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,.08);background:#fff}
table{width:100%;border-collapse:collapse;font-size:11px}
th{background:#334155;color:#fff;padding:7px 8px;text-align:left;white-space:nowrap;font-weight:600}
td{padding:5px 8px;border-bottom:1px solid #f1f5f9;vertical-align:top}
tr:last-child td{border-bottom:none}
tr:hover td{background:#f8fafc}
#footer{padding:8px 20px;font-size:10px;color:#94a3b8;text-align:center;background:#f1f5f9}
@media print{#map{height:40vh}#footer{display:none}}
</style>
</head>
<body>
<div id="hdr">
  <div>
    <h1>${he(siteName)}</h1>
    <div class="sub">Экспорт ${dateStr} · ${pts.length} точек</div>
  </div>
  <div class="sub" style="text-align:right">
    ${bbox.minLat.toFixed(5)}&thinsp;…&thinsp;${bbox.maxLat.toFixed(5)} с.ш.<br>
    ${bbox.minLng.toFixed(5)}&thinsp;…&thinsp;${bbox.maxLng.toFixed(5)} в.д.
  </div>
</div>
<div id="map"></div>
<div id="main">
  <h2>📍 Точки в области (${pts.length})</h2>
  <div class="tbl-wrap">
  <table>
    <thead><tr>
      <th>#</th><th>Объём</th><th>Дата записи</th><th>Категория</th><th>Тип</th>
      <th>Глубина (м)</th><th>Диаметр (мм)</th><th>УГВ (м)</th>
      <th>Дата</th><th>Исполнитель</th><th>Описание</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  </div>
</div>
<div id="footer">ПурГеоКом · Экспорт ${he(siteName)} · ${dateStr}</div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script>
<script>
(function(){
var PTS=${JSON.stringify(mapData)};
var map=L.map('map',{attributionControl:false});
L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',{
  subdomains:'abcd',maxZoom:20
}).addTo(map);
var markers=[];
PTS.forEach(function(p){
  var c=p.color||'#1a56db';
  var icon=L.divIcon({
    className:'',
    html:'<div style="width:14px;height:14px;border-radius:50%;background:'+c+
      ';border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.45)"></div>',
    iconSize:[14,14],iconAnchor:[7,7],popupAnchor:[0,-8]
  });
  var popup='<div style="font-size:12px;line-height:1.6;min-width:160px">'
    +'<b>'+p.n+'</b>';
  if(p.dt) popup+='<br><span style="color:#64748b;font-size:10px">'+p.dt+'</span>';
  if(p.cat) popup+='<br><span style="color:#64748b;font-size:10px">'+p.cat+'</span>';
  if(p.sl)  popup+='<br><span style="color:'+c+';font-weight:600">'+p.sl+'</span>';
  var d=p.d||{};
  if(d.depth) popup+='<br>⬇ Глубина: <b>'+d.depth+' м</b>';
  if(d.diam)  popup+='<br>⌀ Диаметр: <b>'+d.diam+' мм</b>';
  if(d.ugv)   popup+='<br>💧 УГВ: <b>'+d.ugv+' м</b>';
  if(d.date)  popup+='<br>📅 '+d.date;
  if(d.exec)  popup+='<br>👤 '+d.exec;
  if(d.desc||d.note) popup+='<br>📋 '+(d.desc||d.note);
  popup+='</div>';
  var m=L.marker([p.lat,p.lng],{icon:icon})
    .bindPopup(popup)
    .bindTooltip('#'+p.i+' '+p.n,{direction:'top',offset:[0,-8]})
    .addTo(map);
  markers.push([p.lat,p.lng]);
});
if(markers.length===1){
  map.setView(markers[0],16);
}else if(markers.length>1){
  map.fitBounds(L.latLngBounds(markers),{padding:[30,30]});
}
})();
<\/script>
</body>
</html>`;
}
