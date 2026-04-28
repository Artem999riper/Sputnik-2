// DXF export of point volumes — client-side, R12 format, Windows-1251 encoding

// CP1251 encoding table for Cyrillic characters
const _CP1251 = (function(){
  const m = {};
  // А-Я → 0xC0–0xDF
  for(let i=0;i<32;i++) m[0x0410+i]=0xC0+i;
  // а-я → 0xE0–0xFF
  for(let i=0;i<32;i++) m[0x0430+i]=0xE0+i;
  // Ё / ё
  m[0x0401]=0xA8; m[0x0451]=0xB8;
  return m;
})();

function _dxfG(code, val){
  return code.toString().padStart(3,' ') + '\n' + val + '\n';
}

function _buildDxfLabel(sem, idx){
  const type = sem.type || '';
  const data = sem.data || {};
  const PREFIX = {borehole:'СКВ', pit:'Ш', ggs:'ГГС', ogs:'ОГС', repere:'Рп', benchmark:'Мк', steel_angle:'Уг', other:'Т'};
  const hasData = type==='borehole' || type==='pit';
  if(hasData){
    const name = data.label || (PREFIX[type]||'Т')+'-'+idx;
    // Все атрибуты всегда выводим, даже пустые — через запятую
    const attrs = [
      'H=' + (data.depth||''),
      'd=' + (data.diam||''),
      'УГВ=' + (data.ugv||''),
      (data.desc||'').trim()
    ];
    return name + ' (' + attrs.join(', ') + ')';
  } else {
    const name = (PREFIX[type]||'Т')+'-'+idx;
    const note = (data.note||'').trim();
    return note ? name + ' (' + note + ')' : name;
  }
}

function _dxfPolyline(coords, layer, closed){
  // R12 POLYLINE + VERTEX*N + SEQEND
  // coords = [{x, y}], x=northing, y=easting (AutoCAD: code10=Y_east, code20=X_north)
  let s = '';
  s += _dxfG(0,'POLYLINE');
  s += _dxfG(8, layer);
  s += _dxfG(66, '1');      // vertices follow
  s += _dxfG(10, '0.0') + _dxfG(20, '0.0') + _dxfG(30, '0.0');
  s += _dxfG(70, closed ? '1' : '0');
  for(const c of coords){
    const cx = parseFloat(c.x) || 0;
    const cy = parseFloat(c.y) || 0;
    s += _dxfG(0,'VERTEX');
    s += _dxfG(8, layer);
    s += _dxfG(10, cy.toFixed(3));  // DXF X = easting
    s += _dxfG(20, cx.toFixed(3));  // DXF Y = northing
    s += _dxfG(30, '0.0');
  }
  s += _dxfG(0,'SEQEND');
  return s;
}

function buildVolumesDXF({points, polylines, polygons, coordSys, siteName}){
  polylines = polylines || [];
  polygons  = polygons  || [];
  const axisLabel = coordSys==='wgs' ? 'LAT / LON (WGS-84)' :
                    coordSys==='msk' ? 'X(northing) / Y(easting) МСК-86/89' :
                                       'X(northing) / Y(easting) ГСК-2011';
  let s = '';
  // HEADER section
  s += _dxfG(0,'SECTION') + _dxfG(2,'HEADER');
  s += _dxfG(9,'$ACADVER') + _dxfG(1,'AC1009');
  s += _dxfG(9,'$INSUNITS') + _dxfG(70,'6');
  s += _dxfG(0,'ENDSEC');

  // TABLES section — define layers
  s += _dxfG(0,'SECTION') + _dxfG(2,'TABLES');
  s += _dxfG(0,'TABLE') + _dxfG(2,'LAYER') + _dxfG(70,'4');
  s += _dxfG(0,'LAYER') + _dxfG(2,'СКВАЖИНЫ') + _dxfG(70,'0') + _dxfG(62,'5')  + _dxfG(6,'CONTINUOUS');
  s += _dxfG(0,'LAYER') + _dxfG(2,'ПОДПИСИ')  + _dxfG(70,'0') + _dxfG(62,'2')  + _dxfG(6,'CONTINUOUS');
  s += _dxfG(0,'LAYER') + _dxfG(2,'ЛИНИИ')    + _dxfG(70,'0') + _dxfG(62,'3')  + _dxfG(6,'CONTINUOUS');
  s += _dxfG(0,'LAYER') + _dxfG(2,'КОНТУРЫ')  + _dxfG(70,'0') + _dxfG(62,'4')  + _dxfG(6,'CONTINUOUS');
  s += _dxfG(0,'ENDTAB');
  s += _dxfG(0,'ENDSEC');

  // ENTITIES section
  s += _dxfG(0,'SECTION') + _dxfG(2,'ENTITIES');

  // Points + labels
  for(const pt of points){
    const x = parseFloat(pt.x) || 0;
    const y = parseFloat(pt.y) || 0;
    const txt = pt.label || pt.type || 'Точка';
    s += _dxfG(0,'POINT');
    s += _dxfG(8,'СКВАЖИНЫ');
    s += _dxfG(10, y.toFixed(3));
    s += _dxfG(20, x.toFixed(3));
    s += _dxfG(30, '0.0');
    s += _dxfG(0,'TEXT');
    s += _dxfG(8,'ПОДПИСИ');
    s += _dxfG(10, (y + 0.5).toFixed(3));
    s += _dxfG(20, (x + 0.5).toFixed(3));
    s += _dxfG(30, '0.0');
    s += _dxfG(40, '1.5');
    s += _dxfG(1, txt || ' ');
  }

  // Polylines (LineString)
  for(const pl of polylines){
    s += _dxfPolyline(pl.coords, 'ЛИНИИ', false);
    if(pl.name){
      const first = pl.coords[0];
      if(first){
        s += _dxfG(0,'TEXT') + _dxfG(8,'ПОДПИСИ');
        s += _dxfG(10,(parseFloat(first.y)||0).toFixed(3));
        s += _dxfG(20,(parseFloat(first.x)||0).toFixed(3));
        s += _dxfG(30,'0.0') + _dxfG(40,'1.5') + _dxfG(1, pl.name);
      }
    }
  }

  // Polygons
  for(const pg of polygons){
    for(const ring of pg.rings){
      s += _dxfPolyline(ring, 'КОНТУРЫ', true);
    }
    if(pg.name && pg.rings[0] && pg.rings[0][0]){
      const first = pg.rings[0][0];
      s += _dxfG(0,'TEXT') + _dxfG(8,'ПОДПИСИ');
      s += _dxfG(10,(parseFloat(first.y)||0).toFixed(3));
      s += _dxfG(20,(parseFloat(first.x)||0).toFixed(3));
      s += _dxfG(30,'0.0') + _dxfG(40,'1.5') + _dxfG(1, pg.name);
    }
  }

  // Metadata label
  s += _dxfG(0,'TEXT') + _dxfG(8,'ПОДПИСИ');
  s += _dxfG(10,'0.0') + _dxfG(20,'0.0') + _dxfG(30,'0.0');
  s += _dxfG(40,'0.5');
  s += _dxfG(1, (siteName||'Объект') + ' | ' + axisLabel);

  s += _dxfG(0,'ENDSEC');
  s += _dxfG(0,'EOF');
  return s;
}

function _dxfDownload(dxfStr, filename){
  const buf = new Uint8Array(dxfStr.length);
  for(let i=0;i<dxfStr.length;i++){
    const c = dxfStr.charCodeAt(i);
    buf[i] = c < 0x80 ? c : (_CP1251[c] || 0x3F);
  }
  const blob = new Blob([buf], {type:'application/dxf'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function _collectDxfFeatures(site, sys){
  const points = [], polylines = [], polygons = [];
  const vols = site.volumes || [];
  let idx = 0;

  const processGJ = (gjRaw, volName, isFact) => {
    let fc;
    try{ fc = typeof gjRaw==='string'? JSON.parse(gjRaw) : gjRaw; }catch(e){ return; }
    if(!fc || fc.type!=='FeatureCollection') return;
    for(const feat of (fc.features||[])){
      if(!feat.geometry) continue;
      const geomType = feat.geometry.type;
      const sem = feat.properties?.sem || {};
      const suffix = isFact ? ' (факт)' : '';

      if(geomType === 'Point'){
        const [lng, lat] = feat.geometry.coordinates;
        const label = _buildDxfLabel(sem, ++idx) + suffix;
        const c = _convertCoords(lat, lng, sys);
        points.push({x:c.x, y:c.y, label});

      } else if(geomType === 'LineString'){
        const name = (feat.properties?.name || volName || '') + suffix;
        const coords = feat.geometry.coordinates.map(([lng,lat])=>{
          const c = _convertCoords(lat,lng,sys); return {x:c.x,y:c.y};
        });
        polylines.push({coords, name});

      } else if(geomType === 'MultiLineString'){
        const name = (feat.properties?.name || volName || '') + suffix;
        for(const line of feat.geometry.coordinates){
          const coords = line.map(([lng,lat])=>{const c=_convertCoords(lat,lng,sys);return{x:c.x,y:c.y};});
          polylines.push({coords, name});
        }

      } else if(geomType === 'Polygon'){
        const name = (feat.properties?.name || volName || '') + suffix;
        const rings = feat.geometry.coordinates.map(ring =>
          ring.map(([lng,lat])=>{const c=_convertCoords(lat,lng,sys);return{x:c.x,y:c.y};})
        );
        polygons.push({rings, name});

      } else if(geomType === 'MultiPolygon'){
        const name = (feat.properties?.name || volName || '') + suffix;
        for(const poly of feat.geometry.coordinates){
          const rings = poly.map(ring =>
            ring.map(([lng,lat])=>{const c=_convertCoords(lat,lng,sys);return{x:c.x,y:c.y};})
          );
          polygons.push({rings, name});
        }
      }
    }
  };

  for(const vol of vols){
    if(vol.geojson) processGJ(vol.geojson, vol.name, false);
    for(const vp of (site.vol_progress||[])){
      if(vp.volume_id !== vol.id || !vp.geojson) continue;
      processGJ(vp.geojson, vol.name, true);
    }
  }
  return {points, polylines, polygons};
}

function _convertCoords(lat, lng, sys){
  if(sys === 'msk'){
    const r = wgsToMsk(lat, lng);
    return {x: r.northing, y: r.easting};
  } else if(sys === 'gsk'){
    const r = wgsToGsk(lat, lng);
    return {x: r.northing, y: r.easting};
  }
  return {x: lat, y: lng};
}

function _askDxfCoordSys(){
  return new Promise(resolve=>{
    const overlay = document.createElement('div');
    overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center';
    overlay.innerHTML=`
      <div style="background:var(--s);border-radius:var(--r);padding:24px 28px;min-width:280px;box-shadow:var(--shl)">
        <div style="font-size:14px;font-weight:700;margin-bottom:14px">📐 Экспорт DXF — выбор СК</div>
        <div style="display:flex;flex-direction:column;gap:10px;font-size:13px">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
            <input type="radio" name="dxf_cs" value="wgs" checked> WGS-84 (широта / долгота)
          </label>
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
            <input type="radio" name="dxf_cs" value="msk"> МСК-86/89 (X northing / Y easting)
          </label>
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
            <input type="radio" name="dxf_cs" value="gsk"> ГСК-2011 (X northing / Y easting)
          </label>
        </div>
        <div style="display:flex;gap:8px;margin-top:18px;justify-content:flex-end">
          <button class="btn bs bsm" id="_dxf_cancel">Отмена</button>
          <button class="btn bp bsm" id="_dxf_ok">Экспорт</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#_dxf_ok').onclick=()=>{
      const val=overlay.querySelector('input[name=dxf_cs]:checked')?.value||'wgs';
      document.body.removeChild(overlay);
      resolve(val);
    };
    overlay.querySelector('#_dxf_cancel').onclick=()=>{
      document.body.removeChild(overlay);
      resolve(null);
    };
    overlay.addEventListener('click',e=>{if(e.target===overlay){document.body.removeChild(overlay);resolve(null);}});
  });
}

async function exportVolumesDXF(siteId){
  const sys = await _askDxfCoordSys();
  if(!sys) return;

  let site;
  try{
    const r = await fetch(`${API}/sites/${siteId}`);
    if(!r.ok) throw new Error();
    site = await r.json();
  }catch(e){
    toast('Ошибка загрузки объекта','err');
    return;
  }

  const {points, polylines, polygons} = _collectDxfFeatures(site, sys);
  if(!points.length && !polylines.length && !polygons.length){
    toast('Нет геометрии объёмов для экспорта','err');
    return;
  }

  const dxf = buildVolumesDXF({points, polylines, polygons, coordSys:sys, siteName:site.name||''});
  const fname = (site.name||'объект').replace(/[\\/:*?"<>|]/g,'_') + '_объёмы.dxf';
  _dxfDownload(dxf, fname);
  toast(`DXF сохранён (${points.length} точек, ${polylines.length} линий, ${polygons.length} контуров)`, 'ok');
}
