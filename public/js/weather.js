// ═══════════════════════════════════════════════════════════
// WEATHER — OpenWeatherMap tile overlay
// ═══════════════════════════════════════════════════════════

const OWM_LAYERS = [
  { id: 'precipitation_new', label: '🌧 Осадки' },
  { id: 'clouds_new',        label: '☁️ Облачность' },
  { id: 'temp_new',          label: '🌡 Температура' },
  { id: 'wind_new',          label: '💨 Ветер' },
];

let _weatherActive = false;
let _weatherTileLayer = null;
let _weatherType = 'precipitation_new';
let _weatherPanel = null;

function toggleWeather() {
  if (_weatherActive) {
    _hideWeather();
  } else {
    const key = localStorage.getItem('owm_key') || '';
    if (!key) {
      _showOwmKeyModal();
    } else {
      _showWeather(key);
    }
  }
}

function _showWeather(key) {
  _weatherActive = true;
  document.getElementById('tool-weather').classList.add('on');
  _applyWeatherLayer(key);
  _renderWeatherPanel(key);
}

function _hideWeather() {
  _weatherActive = false;
  document.getElementById('tool-weather').classList.remove('on');
  if (_weatherTileLayer) { map.removeLayer(_weatherTileLayer); _weatherTileLayer = null; }
  if (_weatherPanel) { _weatherPanel.remove(); _weatherPanel = null; }
}

function _applyWeatherLayer(key) {
  if (_weatherTileLayer) map.removeLayer(_weatherTileLayer);
  _weatherTileLayer = L.tileLayer(
    `https://tile.openweathermap.org/map/${_weatherType}/{z}/{x}/{y}.png?appid=${key}`,
    { opacity: 0.7, zIndex: 500 }
  ).addTo(map);
}

function _renderWeatherPanel(key) {
  if (_weatherPanel) _weatherPanel.remove();

  const panel = document.createElement('div');
  panel.id = 'weather-panel';
  panel.style.cssText = [
    'position:fixed','bottom:48px','left:50%','transform:translateX(-50%)',
    'background:var(--s)','border:1.5px solid var(--bd)','border-radius:10px',
    'box-shadow:var(--shm)','display:flex','align-items:center','gap:6px',
    'padding:6px 10px','z-index:1400','font-size:12px'
  ].join(';');

  const btns = OWM_LAYERS.map(l => {
    const b = document.createElement('button');
    b.className = 'btn bsm' + (l.id === _weatherType ? ' bp' : ' bs');
    b.textContent = l.label;
    b.style.cssText = 'padding:4px 10px;font-size:11px;white-space:nowrap';
    b.onclick = () => {
      _weatherType = l.id;
      _applyWeatherLayer(key);
      panel.querySelectorAll('button').forEach((el, i) => {
        el.className = 'btn bsm ' + (OWM_LAYERS[i].id === _weatherType ? 'bp' : 'bs');
      });
    };
    return b;
  });

  const sep = document.createElement('div');
  sep.style.cssText = 'width:1px;height:18px;background:var(--bd);margin:0 4px;flex-shrink:0';

  const settBtn = document.createElement('button');
  settBtn.className = 'btn bsm bs';
  settBtn.title = 'Изменить API-ключ';
  settBtn.textContent = '🔑';
  settBtn.style.cssText = 'padding:4px 8px;font-size:11px';
  settBtn.onclick = () => { _hideWeather(); _showOwmKeyModal(); };

  btns.forEach(b => panel.appendChild(b));
  panel.appendChild(sep);
  panel.appendChild(settBtn);
  document.body.appendChild(panel);
  _weatherPanel = panel;
}

function _showOwmKeyModal() {
  const saved = localStorage.getItem('owm_key') || '';
  showModal('Погода — OpenWeatherMap API',
    `<div class="fgr fone">
      <div class="fg">
        <label>API-ключ</label>
        <input id="owm-key-inp" type="text" value="${esc(saved)}" placeholder="Вставьте ключ сюда" autocomplete="off">
      </div>
      <div style="font-size:10px;color:var(--tx3);margin-top:6px;line-height:1.5">
        Бесплатный ключ: зарегистрируйтесь на <b>openweathermap.org</b> →<br>
        My API keys → скопируйте Default key.<br>
        Ключ активируется через ~10 минут после регистрации.
      </div>
    </div>`,
    [
      { label: 'Отмена', cls: 'bs', fn: closeModal },
      { label: '⛅ Включить погоду', cls: 'bp', fn: () => {
        const k = (document.getElementById('owm-key-inp').value || '').trim();
        if (!k) { toast('Введите API-ключ', 'err'); return; }
        localStorage.setItem('owm_key', k);
        closeModal();
        _showWeather(k);
      }},
    ]
  );
}
