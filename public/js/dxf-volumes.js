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

function buildVolumesDXF({points, coordSys, siteName}){
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
  s += _dxfG(0,'TABLE') + _dxfG(2,'LAYER') + _dxfG(70,'2');
  // Layer СКВАЖИНЫ (blue=5)
  s += _dxfG(0,'LAYER') + _dxfG(2,'СКВАЖИНЫ') + _dxfG(70,'0') + _dxfG(62,'5') + _dxfG(6,'CONTINUOUS');
  // Layer ПОДПИСИ (yellow=2)
  s += _dxfG(0,'LAYER') + _dxfG(2,'ПОДПИСИ') + _dxfG(70,'0') + _dxfG(62,'2') + _dxfG(6,'CONTINUOUS');
  s += _dxfG(0,'ENDTAB');
  s += _dxfG(0,'ENDSEC');

  // ENTITIES section
  s += _dxfG(0,'SECTION') + _dxfG(2,'ENTITIES');

  for(const pt of points){
    const x = parseFloat(pt.x) || 0;
    const y = parseFloat(pt.y) || 0;
    const label = pt.label || pt.type || 'Точка';
    const depth = pt.depth ? ` (${pt.depth}м)` : '';
    const txt = label + depth;

    // POINT entity
    s += _dxfG(0,'POINT');
    s += _dxfG(8,'СКВАЖИНЫ');
    s += _dxfG(10, x.toFixed(3));
    s += _dxfG(20, y.toFixed(3));
    s += _dxfG(30, '0.0');

    // TEXT entity for label
    s += _dxfG(0,'TEXT');
    s += _dxfG(8,'ПОДПИСИ');
    s += _dxfG(10, (x + 0.5).toFixed(3));
    s += _dxfG(20, (y + 0.5).toFixed(3));
    s += _dxfG(30, '0.0');
    s += _dxfG(40, '1.5');
    s += _dxfG(1, txt);
  }

  // Comment with metadata
  s += _dxfG(0,'TEXT');
  s += _dxfG(8,'ПОДПИСИ');
  s += _dxfG(10,'0.0'); s += _dxfG(20,'0.0'); s += _dxfG(30,'0.0');
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

function _collectDxfPoints(site, sys){
  const points = [];
  const vols = site.volumes || [];
  let idx = 0;

  for(const vol of vols){
    // Check vol.geojson (planned points)
    const gjSets = [];
    if(vol.geojson) gjSets.push(vol.geojson);

    for(const gj of gjSets){
      let fc;
      try{ fc = typeof gj==='string'? JSON.parse(gj) : gj; }catch(e){ continue; }
      if(!fc || fc.type!=='FeatureCollection') continue;
      for(const feat of (fc.features||[])){
        if(!feat.geometry || feat.geometry.type!=='Point') continue;
        const [lng, lat] = feat.geometry.coordinates;
        const sem = feat.properties?.sem || {};
        const data = sem.data || {};
        const label = data.label || data.note || `Т-${++idx}`;
        const depth = data.depth || '';
        const type = sem.type || vol.name || '';
        const coords = _convertCoords(lat, lng, sys);
        points.push({x:coords.x, y:coords.y, label, depth, type});
      }
    }

    // Also check vol_progress entries for this volume
    for(const vp of (site.vol_progress||[])){
      if(vp.volume_id !== vol.id) continue;
      if(!vp.geojson) continue;
      let fc;
      try{ fc = typeof vp.geojson==='string'? JSON.parse(vp.geojson) : vp.geojson; }catch(e){ continue; }
      if(!fc || fc.type!=='FeatureCollection') continue;
      for(const feat of (fc.features||[])){
        if(!feat.geometry || feat.geometry.type!=='Point') continue;
        const [lng, lat] = feat.geometry.coordinates;
        const sem = feat.properties?.sem || {};
        const data = sem.data || {};
        const label = (data.label || data.note || `Ф-${++idx}`) + ' (факт)';
        const depth = data.depth || '';
        const type = sem.type || vol.name || '';
        const coords = _convertCoords(lat, lng, sys);
        points.push({x:coords.x, y:coords.y, label, depth, type});
      }
    }
  }
  return points;
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

  const points = _collectDxfPoints(site, sys);
  if(!points.length){
    toast('Нет точечных объёмов для экспорта','err');
    return;
  }

  const dxf = buildVolumesDXF({points, coordSys:sys, siteName:site.name||''});
  const fname = (site.name||'объект').replace(/[\\/:*?"<>|]/g,'_') + '_объёмы.dxf';
  _dxfDownload(dxf, fname);
  toast(`DXF сохранён (${points.length} точек)`, 'ok');
}
