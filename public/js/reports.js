async function openPersonnelReport(){
  const today=new Date();
  if(!pgkWorkers||!pgkWorkers.length){try{pgkWorkers=await fetch(`${API}/pgk/workers`).then(r=>r.json());}catch(e){}}
  const todayStr=today.toISOString().split('T')[0];
  // Collect all workers from all bases
  const allWorkers=[];
  bases.forEach(b=>{
    (b.workers||[]).forEach(w=>{
      const mach=(b.machinery||[]).find(m=>m.id===w.machine_id);
      const days=w.start_date?Math.floor((today-new Date(w.start_date))/86400000):null;
      allWorkers.push({
        ...w,
        base_name:b.name,
        base_id:b.id,
        machine_name:mach?mach.name:null,
        field_days:days
      });
    });
  });
  // Include workers not assigned to any base (status=home/idle etc)
  if(pgkWorkers&&pgkWorkers.length){
    const onBaseIds=new Set(allWorkers.map(w=>w.id));
    pgkWorkers.filter(w=>!onBaseIds.has(w.id)).forEach(w=>{
      const days=w.start_date?Math.floor((today-new Date(w.start_date))/86400000):null;
      allWorkers.push({...w,base_name:'— Не на базе',base_id:null,machine_name:null,field_days:days});
    });
  }
  allWorkers.sort((a,b)=>(b.field_days||0)-(a.field_days||0));
  _personnelData=[...allWorkers];

  const total=allWorkers.length;
  const inField=allWorkers.filter(w=>w.start_date).length;
  const longField=allWorkers.filter(w=>(w.field_days||0)>=30).length;

  const html=`
    <!-- KPI -->
    <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
      <div style="flex:1;min-width:80px;background:var(--s2);border-radius:var(--rs);padding:8px 10px;text-align:center">
        <div style="font-size:22px;font-weight:800;color:var(--acc)">${total}</div>
        <div style="font-size:9px;color:var(--tx3)">Всего</div>
      </div>
      <div style="flex:1;min-width:80px;background:var(--s2);border-radius:var(--rs);padding:8px 10px;text-align:center">
        <div style="font-size:22px;font-weight:800;color:var(--grn)">${inField}</div>
        <div style="font-size:9px;color:var(--tx3)">В поле</div>
      </div>
      <div style="flex:1;min-width:80px;background:${longField?'#fef3c7':'var(--s2)'};border-radius:var(--rs);padding:8px 10px;text-align:center">
        <div style="font-size:22px;font-weight:800;color:${longField?'#92400e':'var(--tx3)'}">${longField}</div>
        <div style="font-size:9px;color:var(--tx3)">30+ дней</div>
      </div>
    </div>
    <!-- Table -->
    <div style="max-height:400px;overflow-y:auto">
      <table id="personnel-report-table" style="width:100%;border-collapse:collapse;font-size:11px">
        <thead>
          <tr style="background:var(--s2)">
            <th style="padding:5px 6px;text-align:left;border-bottom:1px solid var(--bd);cursor:pointer" onclick="sortPersonnel('name',this)">Сотрудник ↕</th>
            <th style="padding:5px 6px;text-align:left;border-bottom:1px solid var(--bd);cursor:pointer" onclick="sortPersonnel('role',this)">Должность ↕</th>
            <th style="padding:5px 6px;text-align:left;border-bottom:1px solid var(--bd);cursor:pointer" onclick="sortPersonnel('base',this)">База ↕</th>
            <th style="padding:5px 6px;text-align:left;border-bottom:1px solid var(--bd)">Техника</th>
            <th style="padding:5px 6px;text-align:center;border-bottom:1px solid var(--bd);cursor:pointer" onclick="sortPersonnel('days',this)">Дней ↕</th>
            <th style="padding:5px 6px;text-align:left;border-bottom:1px solid var(--bd)">Телефон</th>
          </tr>
        </thead>
        <tbody>
          ${allWorkers.map((w,i)=>`<tr style="background:${i%2?'var(--s2)':'var(--s)'}${(w.field_days||0)>=30?';border-left:3px solid #f59e0b':''}">
            <td style="padding:4px 6px;font-weight:600">${esc(w.name)}</td>
            <td style="padding:4px 6px;color:var(--tx2)">${esc(w.role||'—')}</td>
            <td style="padding:4px 6px">${esc(w.base_name||'—')}</td>
            <td style="padding:4px 6px;color:var(--tx3)">${esc(w.machine_name||'—')}</td>
            <td style="padding:4px 6px;text-align:center;font-weight:700;color:${(w.field_days||0)>=30?'#92400e':(w.field_days||0)>0?'var(--acc)':'var(--tx3)'}">
              ${w.field_days!==null?(w.field_days+' дн.'):'—'}
            </td>
            <td style="padding:4px 6px;color:var(--tx3)">${esc(w.phone||'—')}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;

  showModal('👷 Отчёт по персоналу',html,[
    {label:'Закрыть',cls:'bs',fn:closeModal},
    {label:'📤 Excel',cls:'bp',fn:()=>exportPersonnelExcel(allWorkers)}
  ]);
}

function exportPersonnelExcel(workers){
  const wb=XLSX.utils.book_new();
  const today=new Date();
  const todayStr=today.toLocaleDateString('ru');

  // Group by equipment (machine), matching "Список людей.xlsx" structure
  const byMachine={};
  workers.forEach(w=>{
    const key=w.machine_name||'— Техника не указана';
    if(!byMachine[key])byMachine[key]={location:w.base_name||'',workers:[]};
    byMachine[key].workers.push(w);
  });

  const aoa=[
    ['Список специалистов ПурГеоКом'],
    ['на дату:',todayStr],
    [],
    ['Привязка специалистов к технике ПГК'],
    ['№№','Наименование техники','Местоположение','Комплектность бригады, ФИО','Должность','Дата заезда','Дней в поле','Телефон'],
  ];

  let rowNum=1;
  Object.entries(byMachine).forEach(([machineName,group])=>{
    group.workers.forEach((w,i)=>{
      aoa.push([
        i===0?rowNum++:'',
        i===0?machineName:'',
        i===0?(group.location||''):'',
        w.name||'',
        w.role||'',
        w.start_date||'',
        w.field_days!==null?w.field_days:'',
        w.phone||''
      ]);
    });
    aoa.push([]);
  });

  const ws1=XLSX.utils.aoa_to_sheet(aoa);
  ws1['!cols']=[{wch:5},{wch:20},{wch:22},{wch:28},{wch:22},{wch:14},{wch:12},{wch:16}];
  XLSX.utils.book_append_sheet(wb,ws1,'Для ПГК');

  // Summary by base
  const byBase={};
  workers.forEach(w=>{
    const bn=w.base_name||'— Без базы';
    if(!byBase[bn])byBase[bn]=[];
    byBase[bn].push(w);
  });
  const sumAoa=[
    ['Сводка по базам — '+todayStr],
    ['База','Кол-во','Ср. дней в поле','30+ дней'],
    ...Object.entries(byBase).map(([bn,ww])=>[
      bn,ww.length,
      ww.filter(w=>w.field_days!==null).length?
        Math.round(ww.filter(w=>w.field_days!==null).reduce((a,w)=>a+w.field_days,0)/ww.filter(w=>w.field_days!==null).length):0,
      ww.filter(w=>(w.field_days||0)>=30).length
    ])
  ];
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(sumAoa),'По базам');
  XLSX.writeFile(wb,'Персонал_'+todayStr.replace(/\./g,'_')+'.xlsx');
  toast('Excel сохранён','ok');
}

// ═══════════════════════════════════════════════════════════
// ОТЧЁТ ПО ТЕХНИКЕ
// ═══════════════════════════════════════════════════════════
let reportSortCol='', reportSortDir=1;
function sortReport(col, tblId){
  if(reportSortCol===col){reportSortDir*=-1;}else{reportSortCol=col;reportSortDir=1;}
  const tbl=document.getElementById(tblId);
  if(!tbl)return;
  const tbody=tbl.querySelector('tbody');
  const rows=[...tbody.querySelectorAll('tr')];
  const idx=['name','type','status','base','plate','days'].indexOf(col);
  if(idx<0)return;
  rows.sort(function(a,b){
    const av=(a.children[idx]&&a.children[idx].textContent)||'';
    const bv=(b.children[idx]&&b.children[idx].textContent)||'';
    return reportSortDir*(av.localeCompare(bv,'ru'));
  });
  rows.forEach(function(r){tbody.appendChild(r);});
  // Update sort arrows
  tbl.querySelectorAll('th[data-col]').forEach(function(th){
    th.textContent=th.textContent.replace(/ [▲▼]/,'');
    if(th.dataset.col===col)th.textContent+=(reportSortDir>0?' ▲':' ▼');
  });
}

async function openMachineryReport(){
  const mach=pgkMachinery.length?pgkMachinery:await fetch(`${API}/pgk/machinery`).then(r=>r.json()).catch(()=>[]);
  const today=new Date();
  const transport=mach.filter(m=>TRANSPORT_TYPES.includes(m.type));
  const drills=mach.filter(m=>DRILL_TYPES.includes(m.type));
  const working=mach.filter(m=>m.status==='working').length;
  const broken=mach.filter(m=>m.status==='broken').length;

  const html=`
  <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
    <div style="flex:1;min-width:70px;background:var(--s2);border-radius:var(--rs);padding:8px;text-align:center"><div style="font-size:20px;font-weight:800;color:var(--acc)">${mach.length}</div><div style="font-size:9px;color:var(--tx3)">Всего</div></div>
    <div style="flex:1;min-width:70px;background:var(--s2);border-radius:var(--rs);padding:8px;text-align:center"><div style="font-size:20px;font-weight:800;color:var(--grn)">${working}</div><div style="font-size:9px;color:var(--tx3)">В работе</div></div>
    <div style="flex:1;min-width:70px;background:${broken?'#fef2f2':'var(--s2)'};border-radius:var(--rs);padding:8px;text-align:center"><div style="font-size:20px;font-weight:800;color:var(--red)">${broken}</div><div style="font-size:9px;color:var(--tx3)">Сломана</div></div>
    <div style="flex:1;min-width:70px;background:var(--s2);border-radius:var(--rs);padding:8px;text-align:center"><div style="font-size:20px;font-weight:800">${transport.length}</div><div style="font-size:9px;color:var(--tx3)">Транспорт</div></div>
    <div style="flex:1;min-width:70px;background:var(--s2);border-radius:var(--rs);padding:8px;text-align:center"><div style="font-size:20px;font-weight:800">${drills.length}</div><div style="font-size:9px;color:var(--tx3)">Буровые</div></div>
  </div>
  <div style="max-height:400px;overflow:auto">
  <table id="mach-report-tbl" style="width:100%;border-collapse:collapse;font-size:11px">
    <thead><tr style="background:var(--s2)">
      <th data-col="name" style="padding:5px 6px;text-align:left;cursor:pointer;border-bottom:1px solid var(--bd)" onclick="sortReport('name','mach-report-tbl')">Название ▲▼</th>
      <th data-col="type" style="padding:5px 6px;cursor:pointer;border-bottom:1px solid var(--bd)" onclick="sortReport('type','mach-report-tbl')">Тип</th>
      <th data-col="status" style="padding:5px 6px;cursor:pointer;border-bottom:1px solid var(--bd)" onclick="sortReport('status','mach-report-tbl')">Статус</th>
      <th data-col="base" style="padding:5px 6px;text-align:left;cursor:pointer;border-bottom:1px solid var(--bd)" onclick="sortReport('base','mach-report-tbl')">База</th>
      <th data-col="plate" style="padding:5px 6px;border-bottom:1px solid var(--bd)">Номер</th>
      <th style="padding:5px 6px;border-bottom:1px solid var(--bd)">Прикреплено</th>
    </tr></thead>
    <tbody>
      ${mach.map(function(m,i){
        const b=bases.find(x=>x.id===m.base_id);
        const drill=TRANSPORT_TYPES.includes(m.type)?mach.find(x=>x.drill_id===m.id):null;
        const host=DRILL_TYPES.includes(m.type)&&m.drill_id?mach.find(x=>x.id===m.drill_id):null;
        return`<tr style="background:${i%2?'var(--s2)':'var(--s)'}${m.status==='broken'?';border-left:3px solid var(--red)':''}">
          <td style="padding:4px 6px;font-weight:600">${MICONS[m.type]||'🔧'} ${esc(m.name)}</td>
          <td style="padding:4px 6px;text-align:center">${esc(m.type||'—')}</td>
          <td style="padding:4px 6px;text-align:center">${SL[m.status]||m.status}</td>
          <td style="padding:4px 6px">${esc(b?b.name:'—')}</td>
          <td style="padding:4px 6px;text-align:center">${esc(m.plate_number||'—')}</td>
          <td style="padding:4px 6px;font-size:10px;color:var(--tx2)">${drill?'⛏ '+esc(drill.name):host?'🚙 '+esc(host.name):'—'}</td>
        </tr>`;
      }).join('')}
    </tbody>
  </table></div>`;

  showModal('🚛 Отчёт по технике',html,[
    {label:'Закрыть',cls:'bs',fn:closeModal},
    {label:'📤 Excel',cls:'bp',fn:()=>exportMachineryExcel(mach)}
  ]);
}
function exportMachineryExcel(mach){
  const wb=XLSX.utils.book_new();
  const today=new Date().toLocaleDateString('ru');
  const aoa=[
    ['Отчёт по технике ПурГеоКом — '+today],[],
    ['Название','Тип','Категория','Статус','База','Гос. номер','Прикреплено','Координаты'],
    ...mach.map(m=>{
      const b=bases.find(x=>x.id===m.base_id);
      const drill=TRANSPORT_TYPES.includes(m.type)?mach.find(x=>x.drill_id===m.id):null;
      const host=DRILL_TYPES.includes(m.type)&&m.drill_id?mach.find(x=>x.id===m.drill_id):null;
      return[m.name,m.type||'',DRILL_TYPES.includes(m.type)?'Буровая':'Транспорт',
        SL[m.status]||m.status,b?b.name:'',m.plate_number||'',
        drill?drill.name:host?host.name:'',
        m.lat&&m.lng?m.lat.toFixed(5)+', '+m.lng.toFixed(5):''];
    })
  ];
  const ws=XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols']=[{wch:25},{wch:12},{wch:12},{wch:12},{wch:18},{wch:12},{wch:20},{wch:20}];
  XLSX.utils.book_append_sheet(wb,ws,'Техника');
  XLSX.writeFile(wb,'Техника_'+today.replace(/\./g,'_')+'.xlsx');
  toast('Excel сохранён','ok');
}

// ═══════════════════════════════════════════════════════════
// NAME GATE
// ═══════════════════════════════════════════════════════════
function checkNameGate(){
  const name=localStorage.getItem('pgk_username');
  if(!name||!name.trim()){
    // Новый пользователь — показываем экран входа
    const gate=document.getElementById('name-gate');
    if(gate) gate.style.display='flex';
    const inp=document.getElementById('name-gate-inp');
    if(inp) inp.focus();
    return false;
  }
  // Известный пользователь — подставляем имя сразу
  const unm=document.getElementById('unm');
  if(unm) unm.value=name;
  // Также подставляем роль если сохранена
  const role=localStorage.getItem('pgk_userrole');
  if(role){
    const roleEl=document.getElementById('unm-role');
    if(roleEl) roleEl.title=role;
  }
  return true;
}
function submitNameGate(){
  const inp=document.getElementById('name-gate-inp');
  const val=(inp&&inp.value||'').trim();
  if(!val){inp&&inp.focus();toast('Введите фамилию и имя','err');return;}
  const role=(document.getElementById('name-gate-role')&&document.getElementById('name-gate-role').value||'').trim();
  const phone=(document.getElementById('name-gate-phone')&&document.getElementById('name-gate-phone').value||'').trim();
  localStorage.setItem('pgk_username',val);
  localStorage.setItem('pgk_userrole',role);
  localStorage.setItem('pgk_userphone',phone);
  document.getElementById('unm').value=val;
  document.getElementById('name-gate').style.display='none';
  // Add to PGK workers if not already exists
  fetch(`${API}/pgk/workers`).then(r=>r.json()).then(function(workers){
    const exists=workers.find(function(w){return w.name.trim().toLowerCase()===val.toLowerCase();});
    if(!exists){
      fetch(`${API}/pgk/workers`,{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({name:val,role:role||'',phone:phone||'',status:'home'})});
    }
  }).catch(function(){});
  initApp();
}
async function initApp(){
  switchView('map');
  // Грузим основные данные (объекты, базы, слои, техника) → сайдбар и карта
  await loadAll();
  // Параллельно грузим бейджи грузов, задач и уведомлений
  await Promise.allSettled([
    fetchNotifs(),
    loadGruz(),
    loadGTasks(),
  ]);
  setTimeout(showDailyDigest, 500);
  // Автообновление каждые 30 сек
  setInterval(loadAll, 30000);
  // Обновление бейджей грузов и задач каждые 60 сек
  setInterval(function(){ try{loadGruz();}catch(e){} try{loadGTasks();}catch(e){} }, 60000);
  setTimeout(startNotifPolling, 3000);
}


// ═══════════════════════════════════════════════════════════
// DRAGGABLE MODAL
// ═══════════════════════════════════════════════════════════
(function(){
  var modal=null,hd=null,dx=0,dy=0,dragging=false,startX=0,startY=0;
  function getModal(){return document.getElementById('modal');}
  function getHd(){return document.querySelector('.mhd');}
  document.addEventListener('mousedown',function(e){
    var h=getHd();
    if(h&&h.contains(e.target)){
      modal=getModal();
      var r=modal.getBoundingClientRect();
      dx=e.clientX-r.left;dy=e.clientY-r.top;
      dragging=true;modal.classList.add('dragging');
      e.preventDefault();
    }
  });
  document.addEventListener('mousemove',function(e){
    if(!dragging||!modal)return;
    var x=e.clientX-dx,y=e.clientY-dy;
    x=Math.max(0,Math.min(x,window.innerWidth-modal.offsetWidth));
    y=Math.max(0,Math.min(y,window.innerHeight-modal.offsetHeight));
    modal.style.position='fixed';
    modal.style.left=x+'px';modal.style.top=y+'px';
    modal.style.transform='none';modal.style.margin='0';
  });
  document.addEventListener('mouseup',function(){
    dragging=false;if(modal)modal.classList.remove('dragging');modal=null;
  });
  // Reset position when new modal opened
  var origShow=null;
  var orig=window.showModal;
  window.addEventListener('DOMContentLoaded',function(){
    var m=getModal();if(m){m.style.position='';m.style.left='';m.style.top='';m.style.transform='';}
  });
})();

// ═══════════════════════════════════════════════════════════
// KML / GPX PER SITE
// ═══════════════════════════════════════════════════════════
async function openSiteKMLPanel(siteId){
  let siteLayers=[]; try{siteLayers=await fetch(`${API}/sites/${siteId}/layers`).then(r=>{if(!r.ok)return[];return r.json();});}catch(e){}
  // Populate siteLayerCache for instant toggle without extra fetches
  siteLayers.forEach(function(l){ siteLayerCache[l.id]=l; });
  const html='<div style="margin-bottom:10px">'
    +'<label class="btn bp bsm" style="cursor:pointer">📂 Импортировать KML/GPX'
    +'<input type="file" accept=".kml,.gpx" style="display:none" data-site-id="'+siteId+'" onchange="importSiteKMLEvt(event)">'
    +'</label></div>'
    +'<div id="site-kml-list">'
    +(siteLayers.length?siteLayers.map(function(l){
      // Use siteLayerVisibility if user has toggled, else use server value
      const isVis=siteLayerVisibility.hasOwnProperty(l.id)?siteLayerVisibility[l.id]:!!(l.visible);
      return'<div class="li" style="padding:5px 8px">'
        +'<div class="lim"><div class="lin">'+esc(l.name)+'</div></div>'
        +'<div class="lia">'
        +'<button class="btn bg bxs" data-lid="'+l.id+'" data-sid="'+siteId+'" data-vis="'+(isVis?'1':'0')+'" onclick="toggleSiteLayerBtn(this)" title="'+(isVis?'Скрыть':'Показать')+'">'+(isVis?'👁':'🚫')+'</button>'
        +'<button class="btn bd bxs" data-lid="'+l.id+'" data-sid="'+siteId+'" onclick="deleteSiteLayerBtn(this)">✕</button>'
        +'</div></div>';
    }).join(''):'<div class="empty">Нет слоёв</div>')
    +'</div>';
  showModal('🗺 Слои KML/GPX — '+esc((currentObj&&currentObj.name)||''),html,[{label:'Закрыть',cls:'bs',fn:closeModal}]);
}
function importSiteKMLEvt(ev){const siteId=ev.target.dataset.siteId;importSiteKML(ev,siteId);}
async function importSiteKML(ev,siteId){
  const file=ev.target.files[0];if(!file)return;
  const text=await file.text();
  const ext=file.name.split('.').pop().toLowerCase();
  let gj;
  try{gj=ext==='gpx'?gpxToGJ(text):kmlToGJ(text);}catch(e){toast('Ошибка разбора файла','err');return;}
  const color=['#1a56db','#0891b2','#057a55','#7e3af2','#e02424'][Math.floor(Math.random()*5)];
  await fetch(`${API}/sites/${siteId}/layers`,{method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({name:file.name.replace(/\.[^.]+$/,''),geojson:JSON.stringify(gj),color})});
  // Reload layers
  let layers=[]; try{layers=await fetch(`${API}/sites/${siteId}/layers`).then(r=>{if(!r.ok)return[];return r.json();});}catch(e){}
  // Render them on map
  layers.forEach(function(l){
    if(l.visible&&l.geojson){
      try{
        L.geoJSON(JSON.parse(l.geojson),{style:{color:l.color,weight:2.5,opacity:.85,fillOpacity:.2},
          pointToLayer:function(f,ll){return L.circleMarker(ll,{radius:6,fillColor:l.color,color:'#fff',weight:2,fillOpacity:.9});}
        }).addTo(map);
      }catch(e){}
    }
  });
  closeModal();
  openSiteKMLPanel(siteId);
  toast('Слой импортирован','ok');
}
function deleteSiteLayerBtn(btn){deleteSiteLayer(btn.dataset.lid,btn.dataset.sid);}
async function deleteSiteLayer(layerId,siteId){
  if(!confirm('Удалить слой?'))return;
  await fetch(`${API}/layers/${layerId}`,{method:'DELETE'});
  closeModal();openSiteKMLPanel(siteId);
}





























function toggleSiteLayerBtn(btn){
  const lid=btn.dataset.lid;
  const nowVisible=btn.dataset.vis==='1';
  const newVis=!nowVisible;
  // Persist user choice in local cache (survives modal reopen)
  siteLayerVisibility[lid]=newVis;
  // Update button instantly
  btn.dataset.vis=newVis?'1':'0';
  btn.textContent=newVis?'👁':'🚫';
  btn.title=newVis?'Скрыть':'Показать';
  // Update map layer instantly using cached geojson
  if(newVis){
    const cached=siteLayerCache[lid];
    if(cached&&cached.geojson){
      if(lGroups['s_'+lid]){try{map.removeLayer(lGroups['s_'+lid]);}catch(e){}}
      try{
        lGroups['s_'+lid]=L.geoJSON(JSON.parse(cached.geojson),{
          style:{color:cached.color||'#1a56db',weight:2.5,opacity:.85,fillOpacity:.2},
          pointToLayer:function(f,ll){return L.circleMarker(ll,{radius:6,fillColor:cached.color||'#1a56db',color:'#fff',weight:2,fillOpacity:.9});}
        }).addTo(map);
      }catch(e){}
    }
  } else {
    if(lGroups['s_'+lid]){try{map.removeLayer(lGroups['s_'+lid]);}catch(e){}delete lGroups['s_'+lid];}
  }
  // Save to server in background (no extra GET needed — use cached name/color)
  if(siteLayerCache[lid]) siteLayerCache[lid].visible=newVis?1:0;
  const cached=siteLayerCache[lid]||{};
  fetch(`${API}/layers/${lid}`,{method:'PUT',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({name:cached.name||lid,color:cached.color||'#1a56db',visible:newVis?1:0})
  }).catch(function(){ toast('Ошибка сохранения видимости слоя','err'); });
}

function toggleSiteLayer(layerId,vis){
  fetch(`${API}/layers/${layerId}`,{method:'PUT',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({visible:vis?1:0})});
}

// ═══════════════════════════════════════════════════════════
// MATERIALS ACTUALIZATION
// ═══════════════════════════════════════════════════════════
