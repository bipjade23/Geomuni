/* =====================================================================
   app.js  –  FUNCIONAMIENTO DEL GEOVISOR (se toca poco)
   Lee la configuración de capas.js y construye mapa, panel, búsqueda y herramientas.
   ===================================================================== */

// ---------- 0. Utilidades y elementos de la página ----------
// Convierte texto en texto seguro para insertarlo dentro de HTML (evita que un dato rompa la página).
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, ch =>
  ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
// Minúsculas y sin tildes: para buscar «Ñ», «á», etc. sin importar cómo se escriban.
const norm = s => String(s == null ? '' : s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

// Busca un elemento por su id. Si no existe en index.html, avisa con un error claro.
const $ = id => {
  const e = document.getElementById(id);
  if(!e) throw new Error('Falta en index.html el elemento con id="' + id + '"');
  return e;
};
const base = $('base'), bHome = $('bHome'), bShare = $('bShare'), bClear = $('bClear'),
      q = $('q'), tAll = $('tAll'), tAct = $('tAct'), res = $('res'), list = $('list'),
      zi = $('zi'), zo = $('zo'), bMed = $('bMed'), bLoc = $('bLoc'),
      med = $('med'), mD = $('mD'), mA = $('mA'), mr = $('mr'), mU = $('mU'), mB = $('mB'), mX = $('mX'),
      leg = $('leg'), legh = $('legh'), legb = $('legb'),
      co = $('co'), zm = $('zm'), ac = $('ac'), msg = $('msg'),
      modal = $('modal'), mt = $('mt'), mb = $('mb'), mc = $('mc'),
      cargando = $('cargando'), ct = $('ct'), cb = $('cb');

// Estado que viene en el enlace (#v=lat,lon,zoom&c=capas&b=base) para abrir el visor tal como se compartió.
const inicio = new URLSearchParams(location.hash.replace(/^#/, ''));
let listo = false;   // pasa a true cuando ya se restauró lo que traía el enlace

// ---------- 1. Convertir la configuración en una lista de capas ----------
// Si una categoría no trae «nivel», se usa su posición en la lista.
CATEGORIAS.forEach((c, i) => { if(c.nivel == null) c.nivel = i + 1; });

// Opciones que reconoce cada bloque de capas.js. Si escribes una distinta (ej. «colr»), la consola avisa.
const OPC_CAPA   = ['n','f','z','fuente','escala','fecha','buscar','estilo','popup','opacidad'];
const OPC_ESTILO = ['color','colorBorde','grosor','relleno','discontinua','radio','campo','colores','etiquetas','rangos','defecto'];
const OPC_POPUP  = ['titulo','campos','ocultar','pie','ancho','html'];
function revisarOpciones(nombre, obj, validas, donde){
  Object.keys(obj || {}).forEach(k => { if(!validas.includes(k))
    console.warn('Capa «' + nombre + '»: la opción «' + k + '» (en ' + donde + ') no existe. Opciones válidas: ' + validas.join(', ')); });
}

const CAPAS = [], slugsUsados = new Set();
CATEGORIAS.forEach(c => c.capas.forEach(x => {
  const o = typeof x === 'string' ? { n:x } : x;
  const e = o.estilo || {};
  revisarOpciones(o.n, o, OPC_CAPA, 'la capa'); revisarOpciones(o.n, e, OPC_ESTILO, 'estilo'); revisarOpciones(o.n, o.popup, OPC_POPUP, 'popup');
  let slug = norm(o.n).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'capa';   // nombre corto para el enlace
  while(slugsUsados.has(slug)) slug += '-2';
  slugsUsados.add(slug);
  CAPAS.push({
    cat:c, name:o.n, slug, file:o.f || null, minZoom:o.z || 0, buscar:o.buscar || null, popup:o.popup || null,
    fuente:o.fuente || 'Municipalidad', escala:o.escala || '—', fecha:o.fecha || '—',
    formato:o.f ? 'GeoJSON' : 'Demo', op:o.opacidad != null ? Math.min(1, Math.max(.1, o.opacidad)) : .6, on:false, g:null, oculta:false,
    est:{
      color:       e.color || c.color,      // color de relleno (si no hay campo con colores/rangos)
      colorBorde:  e.colorBorde || null,    // color del borde (si no se indica, es el mismo del relleno)
      campo:       e.campo || null,         // columna que decide el color
      colores:     e.colores || null,       // por categorías: { valor: '#color' }
      etiquetas:   e.etiquetas || {},       // { valor: 'texto para la leyenda' }
      rangos:      e.rangos || null,        // por rangos numéricos: [ {hasta, color, etiqueta}, ... ]
      defecto:     e.defecto || '#9aa5b1',  // color de lo que no entra en «colores» o «rangos»
      grosor:      e.grosor || 1,
      relleno:     e.relleno !== false,
      discontinua: e.discontinua || null,   // línea de trazos, ej. '6 4'
      radio:       e.radio || 5             // tamaño de los puntos

    }
  });
}));

// ---------- 2. Mapa, mapas base y control de escala ----------
const hv = (inicio.get('v') || '').split(',').map(Number);
const vistaInicial = hv.length === 3 && hv.every(isFinite) ? hv : null;
const map = L.map('map', {
  zoomControl:false, preferCanvas:true,
  center: vistaInicial ? [hv[0], hv[1]] : CENTRO,
  zoom:   vistaInicial ? hv[2] : ZOOM
});

// OJO: los servidores públicos de teselas tienen condiciones de uso. tile.openstreetmap.org no está pensado
// para uso intensivo o institucional diario: antes de publicar, revisa sus términos o cambia a un proveedor
// con plan propio (solo hay que reemplazar la URL y la atribución de abajo).
const BASES = {
  osm: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom:19,
    attribution:'© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors' }),
  sat: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom:19,
    attribution:'Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community' }),
  none: null
};
let baseActual = null;
function setBase(k){ if(baseActual) map.removeLayer(baseActual); baseActual = BASES[k]; if(baseActual){ baseActual.addTo(map); baseActual.bringToBack(); } }
base.onchange = () => { setBase(base.value); guardarHash(); };
base.value = BASES.hasOwnProperty(inicio.get('b')) ? inicio.get('b') : 'osm';
setBase(base.value);

L.control.scale({ imperial:false, position:'bottomright' }).addTo(map);

map.on('mousemove', e => co.textContent = 'Lat ' + e.latlng.lat.toFixed(5) + '° · Lon ' + e.latlng.lng.toFixed(5) + '°');
map.on('zoomend', () => zm.textContent = 'Zoom ' + map.getZoom());
zm.textContent = 'Zoom ' + map.getZoom();
zi.onclick = () => map.zoomIn();
zo.onclick = () => map.zoomOut();
bHome.onclick = () => map.setView(CENTRO, ZOOM);

// ---------- 3. Estilo (simbología) de cada capa ----------
const numero = v => (v == null || v === '') ? NaN : typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));

// Color de un elemento: único, según el valor de un campo (categorías) o según un rango numérico.
function colorDe(l, props){
  const e = l.est, v = props && e.campo ? props[e.campo] : null;
  if(e.campo && e.rangos){
    const n = numero(v);
    if(isNaN(n)) return e.defecto;
    const r = e.rangos.find(r => r.hasta == null || n <= r.hasta);
    return r ? r.color : e.defecto;
  }
  if(e.campo && e.colores){
    const clave = v == null ? '' : String(v).trim();
    return e.colores[clave] || e.defecto;
  }
  return e.color;
}

// Estilo completo de Leaflet para un elemento (f = feature del GeoJSON, o null en capas de ejemplo).
function estilo(l, f){
  const e = l.est, col = colorDe(l, f && f.properties);
  return {
    color:e.colorBorde || col, weight:e.grosor, dashArray:e.discontinua,
    fill:e.relleno, fillColor:col, fillOpacity:e.relleno ? l.op : 0,
    opacity:Math.min(1, l.op + .3)
  };
}

// ---------- 4. Capas auxiliares y orden de apilamiento ----------
const gMed = L.featureGroup();              // dibujo de la medición
const gUbic = L.featureGroup().addTo(map);  // mi ubicación
let resalte = null, tResalte = null;        // elemento resaltado desde el buscador

// Lo auxiliar (medición, ubicación, resalte) siempre va encima de las capas de datos.
function arriba(){ [resalte, gMed, gUbic].forEach(g => g && map.hasLayer(g) && g.bringToFront()); }

// Las capas de categorías con «nivel» mayor quedan encima. Solo se reordena lo necesario.
function ordenar(l){
  const n = x => x.cat.nivel;
  const otras = CAPAS.filter(x => x !== l && x.on && x.g && map.hasLayer(x.g));
  const encima = otras.filter(x => n(x) > n(l)).sort((a, b) => n(a) - n(b));
  if(encima.length){
    if(encima.length === otras.length) l.g.bringToBack();      // todas las demás van encima: mando solo la nueva al fondo
    else encima.forEach(x => x.g.bringToFront());              // subo las que deben ir encima, de menor a mayor nivel
  }
  arriba();
}

// ---------- 5. Indicador de carga ----------
const cargasEnCurso = new Set();
// pct = número 0-100 para barra con avance; null para barra «en movimiento» (no se sabe cuánto falta).
function progreso(l, texto, pct){
  cargasEnCurso.add(l);
  ct.textContent = texto;
  cargando.classList.toggle('indef', pct == null);
  cb.style.width = pct == null ? '' : pct + '%';
  cargando.hidden = false;
}
function finProgreso(l){ cargasEnCurso.delete(l); if(!cargasEnCurso.size) cargando.hidden = true; }
const pausa = () => new Promise(r => setTimeout(r));   // cede un instante al navegador para que pinte

function aviso(t){ msg.textContent = t; setTimeout(() => { if(msg.textContent === t) msg.textContent = ''; }, Math.max(5000, t.length * 70)); }

// ---------- 6. Carga de capas ----------
// Capa de ejemplo (cuadritos). Se usa cuando la capa no tiene archivo 'f'.
let semilla = 7;
const azar = () => (semilla = (semilla * 16807) % 2147483647) / 2147483647;
function demo(l){
  const c = l.cat, g = L.featureGroup(), h = Math.max(2, Math.round(.12 / c.s)), b = c.s * .08;
  for(let x = -h/2; x < h/2; x++) for(let y = -h/2; y < h/2; y++) if(azar() < c.p)
    L.rectangle([[CENTRO[0] + y*c.s + b, CENTRO[1] + x*c.s + b], [CENTRO[0] + (y+1)*c.s - b, CENTRO[1] + (x+1)*c.s - b]],
      estilo(l, null))
      .bindPopup('<b>' + esc(l.name) + '</b><br>Dato de ejemplo').addTo(g);
  return g;
}

// ---- Capas pesadas (ej. lotes) ----
// Una capa con más elementos que UMBRAL_VISTA no se dibuja entera: solo los de la zona visible
// (más un margen). Al mover o acercar el mapa se agregan y quitan elementos.
const UMBRAL_VISTA = 3000;    // desde cuántos elementos se activa el modo «vista»
const MAX_VISTA    = 15000;   // máximo de elementos dibujados a la vez en ese modo

// ---- Ventana emergente (popup) de cada capa; se configura con «popup» en capas.js ----
// Solo se aceptan textos que parezcan enlace o ruta (https://…, mailto:, data/foto.jpg); así un valor como
// «SIN PLANO» se muestra como texto normal en vez de un enlace roto. Los esquemas peligrosos se bloquean.
const urlSegura = u => {
  const t = String(u).trim();
  if(/^(javascript|data|vbscript):/i.test(t)) return '';
  return /^(https?:\/\/|mailto:|tel:|\.{0,2}\/)\S+$/i.test(t) || /^[^\s\/]+(\/[^\s\/]+)*\.[a-z0-9]{2,5}([?#]\S*)?$/i.test(t) ? t : '';
};
// Reemplaza {COLUMNA} por el valor de esa columna (todo se escapa, así que es seguro).
const rellenar = (txt, p) => esc(String(txt).replace(/\{([^{}]+)\}/g, (m, k) => { const v = p[k.trim()]; return v == null ? '' : v; }));

function formatoValor(v, c){
  const clave = String(v).trim();
  let t = c.mapa && c.mapa[clave] != null ? c.mapa[clave] : v;                 // traducción de códigos
  if(c.decimales != null && isFinite(numero(t)))
    t = numero(t).toLocaleString('es-PE', { minimumFractionDigits:c.decimales, maximumFractionDigits:c.decimales });
  return (c.prefijo || '') + t + (c.sufijo || '');
}
function filaPopup(c, p){
  const v = p[c.campo];
  if(v == null || String(v).trim() === '') return '';                           // las filas vacías no se muestran
  const etiqueta = c.etiqueta || c.campo;
  // Es enlace si lo pides con enlace:true, o si el valor empieza con http:// o https:// (enlace:false lo evita).
  const esEnlace = !c.imagen && c.enlace !== false && (c.enlace || /^https?:\/\/\S+$/i.test(String(v).trim()));
  const u = (c.imagen || esEnlace) ? urlSegura(v) : '';
  let celda;
  if(c.imagen)       celda = u ? '<img src="' + esc(u) + '" alt="' + esc(etiqueta) + '">' : '';
  else if(esEnlace)  celda = u ? '<a href="' + esc(u) + '" target="_blank" rel="noopener">' + esc(c.texto || 'Abrir enlace') + '</a>' : esc(v);   // si no es enlace válido, se muestra el texto tal cual
  else              celda = esc(formatoValor(v, c));
  return celda ? '<tr><td>' + esc(etiqueta) + '</td><td>' + celda + '</td></tr>' : '';
}
function popupHtml(l, f){
  const p = f.properties || {}, cfg = l.popup || {};
  if(typeof cfg.html === 'function'){                                           // control total: tú escribes el HTML
    try{ return cfg.html(p, f); }catch(err){ console.error('Error en popup.html de «' + l.name + '»', err); }
  }
  const campos = cfg.campos
    ? cfg.campos.map(c => typeof c === 'string' ? { campo:c } : c)
    : Object.keys(p).filter(k => !(cfg.ocultar || []).includes(k)).map(k => ({ campo:k }));
  const filas = campos.map(c => filaPopup(c, p)).join('');
  const titulo = cfg.titulo === false ? '' : rellenar(cfg.titulo != null ? cfg.titulo : l.name, p);
  return '<div class="pu">' + (titulo ? '<h4 class="pu-t">' + titulo + '</h4>' : '') +
    (filas ? '<table class="pu-tb">' + filas + '</table>' : '<div class="pu-v">Sin datos para mostrar</div>') +
    (cfg.pie ? '<div class="pu-pie">' + rellenar(cfg.pie, p) + '</div>' : '') + '</div>';
}
function abrirPopup(l, f, latlng){
  const ancho = (l.popup && l.popup.ancho) || 300;
  L.popup({ maxWidth:ancho, minWidth:Math.min(180, ancho) }).setLatLng(latlng).setContent(popupHtml(l, f)).openOn(map);
}

// Error con un mensaje pensado para el usuario (se muestra tal cual en el pie de página).
class ErrorCapa extends Error {}

// El visor trabaja con grados (WGS84, EPSG:4326). Si el archivo trae metros (Web Mercator, UTM…), la capa
// «se enciende» pero queda a miles de kilómetros y no se ve: mejor detectarlo y explicarlo.
function verificarCoordenadas(l, feats){
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  feats.slice(0, 50).forEach(f => {
    const [a, b, c, d] = bboxDe(f.geometry);
    if(a < x0) x0 = a; if(b < y0) y0 = b; if(c > x1) x1 = c; if(d > y1) y1 = d;
  });
  if(Math.abs(x0) > 180 || Math.abs(x1) > 180 || Math.abs(y0) > 90 || Math.abs(y1) > 90){
    const m = '«' + l.name + '»: las coordenadas no están en grados (X de ' + Math.round(x0) + ' a ' + Math.round(x1) +
      '; Y de ' + Math.round(y0) + ' a ' + Math.round(y1) + '). Reproyecta el archivo a WGS84 (EPSG:4326).';
    console.error(m + ' En QGIS: clic derecho en la capa → Exportar → Guardar entidades como… → GeoJSON, con CRS EPSG:4326.');
    throw new ErrorCapa(m);
  }
}

// Avisa si capas.js pide una columna que no existe en el GeoJSON (error muy común al escribir el nombre).
function verificarCampos(l, feats){
  if(!feats || !feats.length) return;
  const cols = new Set();
  feats.slice(0, 50).forEach(f => Object.keys(f.properties || {}).forEach(k => cols.add(k)));
  const pedidos = [l.est.campo].concat(l.buscar || [], (l.popup && l.popup.campos || []).map(c => typeof c === 'string' ? c : c.campo));
  const faltan = [...new Set(pedidos)].filter(c => c && !cols.has(c));
  if(faltan.length){
    console.warn('Capa «' + l.name + '»: no existe(n) la(s) columna(s) ' + faltan.map(c => '«' + c + '»').join(', ') + '. Columnas disponibles: ' + [...cols].join(', '));
    aviso('Revisa capas.js: la columna «' + faltan[0] + '» no existe en «' + l.name + '» (detalle en la consola)');
  }
}

// Un solo manejador de clic por capa (en vez de un popup por elemento). No actúa mientras se mide.
function conFicha(l, g){
  g.on('click', e => {
    if(midiendo) return;
    const f = e.layer && e.layer.feature;
    if(f) abrirPopup(l, f, e.latlng);
  });
  return g;
}

// Caja envolvente [oeste, sur, este, norte] de una geometría.
function bboxDe(g){
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  (function rec(c){
    if(typeof c[0] === 'number'){
      if(c[0] < x0) x0 = c[0]; if(c[0] > x1) x1 = c[0];
      if(c[1] < y0) y0 = c[1]; if(c[1] > y1) y1 = c[1];
    } else for(const k of c) rec(k);
  })(g.type === 'GeometryCollection' ? g.geometries.map(x => x.coordinates) : g.coordinates);
  return [x0, y0, x1, y1];
}

async function cargarVista(l, feats, opts){
  const bb = new Float64Array(feats.length * 4);
  for(let i = 0; i < feats.length; i++){
    bb.set(bboxDe(feats[i].geometry), i * 4);
    if(i % 10000 === 9999){ progreso(l, 'Preparando ' + l.name + '… ' + Math.round(i / feats.length * 100) + '%', i / feats.length * 100); await pausa(); }
  }
  // Extensión total de la capa (sirve para «Zoom a la capa», aunque solo se dibuje lo visible).
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  for(let i = 0; i < feats.length; i++){
    const k = i * 4;
    if(bb[k] < w) w = bb[k]; if(bb[k + 1] < s) s = bb[k + 1];
    if(bb[k + 2] > e) e = bb[k + 2]; if(bb[k + 3] > n) n = bb[k + 3];
  }
  l.limites = L.latLngBounds([[s, w], [n, e]]);

  const g = L.geoJSON(null, opts), dentro = new Map();    // dentro: posición → capa dibujada
  l.limpiar = () => { g.clearLayers(); dentro.clear(); };
  l.vista = () => {
    if(!map.hasLayer(g)) return;
    const b = map.getBounds().pad(.3), bw = b.getWest(), bs = b.getSouth(), be = b.getEast(), bn = b.getNorth();
    const vis = [];
    for(let i = 0; i < feats.length; i++){
      const k = i * 4;
      if(bb[k] <= be && bb[k + 2] >= bw && bb[k + 1] <= bn && bb[k + 3] >= bs) vis.push(i);
    }
    if(vis.length > MAX_VISTA){
      if(!l.demasiados){ l.demasiados = true; aviso('Hay demasiados elementos en pantalla: acércate para ver «' + l.name + '»'); }
      l.limpiar(); return;
    }
    l.demasiados = false;
    const quedan = new Set(vis);
    for(const [i, capa] of dentro) if(!quedan.has(i)){ g.removeLayer(capa); dentro.delete(i); }
    let nuevas = 0;
    for(const i of vis){
      if(dentro.has(i)) continue;
      const f = feats[i], capa = L.GeoJSON.geometryToLayer(f, g.options);
      if(!capa) continue;
      capa.feature = L.GeoJSON.asFeature(f); capa.defaultOptions = capa.options; g.resetStyle(capa);
      g.addLayer(capa); dentro.set(i, capa); nuevas++;
    }
    if(nuevas) ordenar(l);    // lo recién dibujado queda arriba: se reacomoda según el nivel
  };
  return conFicha(l, g);
}

// Capa real: descarga el GeoJSON y lo dibuja.
async function cargar(l){
  if(!l.file) return demo(l);
  progreso(l, 'Descargando ' + l.name + '…', null);
  // Si la capa tiene «fecha», se agrega ?v=fecha: al actualizar la fecha se evita la copia vieja en caché.
  const url = l.file + (l.fecha !== '—' ? (l.file.includes('?') ? '&' : '?') + 'v=' + encodeURIComponent(l.fecha) : '');
  const r = await fetch(url);
  if(!r.ok) throw new Error('HTTP ' + r.status);
  const datos = await r.json();
  progreso(l, 'Procesando ' + l.name + '…', null);
  await pausa();
  const feats = datos.type === 'FeatureCollection' ? (datos.features || []).filter(f => f && f.geometry)
              : datos.type === 'Feature' && datos.geometry ? [datos] : null;
  l.feats = feats || [];                 // los elementos quedan disponibles para el buscador
  l.n = feats ? feats.length : 1;
  if(feats) verificarCoordenadas(l, feats);
  verificarCampos(l, feats);
  const opts = {
    style: f => estilo(l, f),
    pointToLayer: (f, ll) => L.circleMarker(ll, { ...estilo(l, f), radius:l.est.radio })
  };
  if(feats && feats.length > UMBRAL_VISTA) return cargarVista(l, feats, opts);
  return conFicha(l, L.geoJSON(datos, opts));
}

// Garantiza que la capa esté descargada. Si se pide dos veces a la vez (doble clic, búsqueda + activar),
// la descarga se hace una sola vez porque todos esperan la misma promesa.
async function asegurar(l){
  if(l.g) return l.g;
  l.carga = l.carga || cargar(l);
  try{ l.g = await l.carga; }
  catch(e){ l.carga = null; throw e; }
  finally{ finProgreso(l); }
  return l.g;
}

// Agrega la capa al mapa en su lugar correcto (y, si es pesada, dibuja lo visible).
function mostrar(l){
  l.g.addTo(map);
  if(l.vista) l.vista(); else ordenar(l);
}

async function toggle(l, on){
  if(on && map.getZoom() < l.minZoom){ aviso('Acércate al zoom ' + l.minZoom + ' para ver «' + l.name + '»'); return refresh(); }
  l.on = on;
  if(on){
    try{
      await asegurar(l);
      if(l.on) mostrar(l);
    }catch(e){
      console.error(e);
      l.on = false; aviso(e instanceof ErrorCapa ? e.message : 'No se pudo cargar ' + l.file + ' (¿estás usando un servidor local?)');
    }
  } else {
    l.oculta = false;
    if(l.g){ map.removeLayer(l.g); if(l.limpiar) l.limpiar(); }   // libera memoria; al volver a encender se redibuja
  }
  refresh();
}

// Al terminar de mover o acercar el mapa:
//  · las capas con zoom mínimo se ocultan si te alejas (se ponen en gris en el panel) y reaparecen al acercarte;
//  · las capas pesadas actualizan lo que dibujan;
//  · se actualiza el enlace compartible.
map.on('moveend', () => {
  let cambio = false;
  CAPAS.forEach(l => {
    if(!l.on || !l.g){ if(l.oculta){ l.oculta = false; cambio = true; } return; }
    const ok = map.getZoom() >= l.minZoom;
    if(!ok){
      if(map.hasLayer(l.g)){
        map.removeLayer(l.g); if(l.limpiar) l.limpiar();
        aviso('«' + l.name + '» se oculta por debajo del zoom ' + l.minZoom);
      }
    } else if(!map.hasLayer(l.g)) mostrar(l);
    else if(l.vista) l.vista();
    if(!!l.oculta === ok){ l.oculta = !ok; cambio = true; }
  });
  if(cambio) render();
  guardarHash();
});

function setOp(l, v){
  l.op = v;
  if(l.g) l.g.eachLayer(r => r.setStyle && r.setStyle(estilo(l, r.feature)));
}

// ---------- 7. Enlace compartible ----------
// El enlace guarda la vista, el mapa base y las capas activas: #v=lat,lon,zoom&c=capa1,capa2&b=sat
function guardarHash(){
  if(!listo) return;   // mientras se restaura un enlace, no se pisa
  const p = new URLSearchParams(), ce = map.getCenter();
  p.set('v', ce.lat.toFixed(5) + ',' + ce.lng.toFixed(5) + ',' + map.getZoom());
  const c = CAPAS.filter(l => l.on).map(l => l.slug).join(',');
  if(c) p.set('c', c);
  if(base.value !== 'osm') p.set('b', base.value);
  try{ history.replaceState(null, '', '#' + p.toString().replace(/%2C/g, ',')); }catch(e){ /* algunos navegadores lo bloquean en file:// */ }
}
bShare.onclick = async () => {
  guardarHash();
  try{ await navigator.clipboard.writeText(location.href); aviso('Enlace copiado: pégalo donde quieras compartirlo'); }
  catch(e){ prompt('Copia este enlace:', location.href); }
};

// ---------- 8. Herramientas: medir y ubicación ----------
let midiendo = false, modoMed = 'dist', ptsMed = [];
const fmtDist = m => m >= 1000 ? (m / 1000).toFixed(2) + ' km' : m.toFixed(1) + ' m';
const fmtArea = m2 => m2 >= 10000 ? (m2 / 10000).toFixed(2) + ' ha (' + Math.round(m2).toLocaleString('es-PE') + ' m²)' : m2.toFixed(1) + ' m²';

// Área de un polígono sobre la esfera terrestre (suficiente para parcelas y manzanas).
function areaGeodesica(pts){
  const R = 6378137, rad = Math.PI / 180;
  let s = 0;
  for(let i = 0; i < pts.length; i++){
    const a = pts[i], b = pts[(i + 1) % pts.length];
    s += (b.lng - a.lng) * rad * (2 + Math.sin(a.lat * rad) + Math.sin(b.lat * rad));
  }
  return Math.abs(s * R * R / 2);
}
const largo = pts => pts.reduce((t, p, i) => i ? t + pts[i - 1].distanceTo(p) : 0, 0);

function dibujarMed(){
  gMed.clearLayers();
  const st = { color:'#ff4d00', weight:3, interactive:false };
  const poligono = modoMed === 'area' && ptsMed.length >= 3;
  if(ptsMed.length >= 2) (poligono ? L.polygon(ptsMed, { ...st, fillOpacity:.15 }) : L.polyline(ptsMed, st)).addTo(gMed);
  ptsMed.forEach(p => L.circleMarker(p, { radius:4, color:'#ff4d00', weight:2, fillColor:'#fff', fillOpacity:1, interactive:false }).addTo(gMed));
  let t = 'Haz clic en el mapa para marcar puntos.';
  if(modoMed === 'dist' && ptsMed.length >= 2) t = 'Distancia: <b>' + fmtDist(largo(ptsMed)) + '</b>';
  if(poligono) t = 'Área: <b>' + fmtArea(areaGeodesica(ptsMed)) + '</b><br>Perímetro: <b>' + fmtDist(largo(ptsMed.concat([ptsMed[0]]))) + '</b>';
  mr.innerHTML = t;
  arriba();
}
function modoMedicion(m){
  modoMed = m; mD.classList.toggle('on', m === 'dist'); mA.classList.toggle('on', m === 'area'); dibujarMed();
}
function abrirMed(){
  midiendo = true; ptsMed = [];
  med.hidden = false; bMed.classList.add('on');
  map.closePopup(); map.doubleClickZoom.disable();
  map.getContainer().style.cursor = 'crosshair';
  gMed.addTo(map); dibujarMed();
}
function cerrarMed(){
  midiendo = false; ptsMed = [];
  med.hidden = true; bMed.classList.remove('on');
  map.doubleClickZoom.enable();
  map.getContainer().style.cursor = '';
  gMed.clearLayers(); map.removeLayer(gMed);
}
bMed.onclick = () => midiendo ? cerrarMed() : abrirMed();
mD.onclick = () => modoMedicion('dist');
mA.onclick = () => modoMedicion('area');
mU.onclick = () => { ptsMed.pop(); dibujarMed(); };
mB.onclick = () => { ptsMed = []; dibujarMed(); };
mX.onclick = cerrarMed;
map.on('click', e => { if(midiendo){ ptsMed.push(e.latlng); dibujarMed(); } });

// Mi ubicación (el navegador pide permiso; necesita https o localhost)
bLoc.onclick = () => {
  if(bLoc.classList.contains('on')){ gUbic.clearLayers(); bLoc.classList.remove('on'); return; }
  aviso('Buscando tu ubicación…');
  map.locate({ setView:true, maxZoom:17, enableHighAccuracy:true });
};
map.on('locationfound', e => {
  gUbic.clearLayers();
  L.circle(e.latlng, { radius:e.accuracy, interactive:false, color:'#1769d6', weight:1, fillOpacity:.1 }).addTo(gUbic);
  L.circleMarker(e.latlng, { radius:6, color:'#fff', weight:2, fillColor:'#1769d6', fillOpacity:1, interactive:false }).addTo(gUbic);
  bLoc.classList.add('on'); arriba();
});
map.on('locationerror', e => aviso('No se pudo obtener tu ubicación: ' + e.message));

// ---------- 9. Zoom a la capa y buscador de elementos ----------
function limitesDe(l){
  if(l.limites) return l.limites;                                   // capas pesadas
  if(l.g && l.g.getBounds){ const b = l.g.getBounds(); return b.isValid() ? b : null; }
  return null;
}
// Encuadra un conjunto de límites, sin bajar del zoom mínimo de la capa (si no, la capa se ocultaría).
function encuadrar(b, minZoom, margen){
  const z = Math.min(Math.max(map.getBoundsZoom(b) - (margen || 0), minZoom || 0), 19);
  map.setView(b.getCenter(), z, { animate:false });
}
async function zoomCapa(l){
  try{ await asegurar(l); }catch(e){ return aviso('No se pudo cargar ' + l.file); }
  const b = limitesDe(l);
  if(b) encuadrar(b, l.minZoom);
}

function quitarResalte(){ clearTimeout(tResalte); if(resalte){ map.removeLayer(resalte); resalte = null; } }
function resaltar(f){
  quitarResalte();
  const col = '#ffb000';
  resalte = L.geoJSON(f, {
    interactive:false, style:{ color:col, weight:4, fill:true, fillOpacity:.15 },
    pointToLayer: (ft, ll) => L.circleMarker(ll, { radius:10, color:col, weight:4, fillOpacity:.15, interactive:false })
  }).addTo(map);
  arriba();
  tResalte = setTimeout(quitarResalte, 6000);
}

// Lleva el mapa a un elemento encontrado: acerca, enciende su capa si hace falta, lo resalta y muestra sus datos.
async function irAElemento(l, f){
  const [w, s, e, n] = bboxDe(f.geometry);
  const b = L.latLngBounds([[s, w], [n, e]]);
  encuadrar(b, l.minZoom, 1);
  if(!l.on) await toggle(l, true);
  resaltar(f);
  abrirPopup(l, f, b.getCenter());
}

const MAX_RES = 40, MAX_POR_CAPA = 15;
let tBusca = null, buscaId = 0;

function etiquetaDe(l, f){
  return l.buscar.map(c => (f.properties || {})[c]).filter(v => v != null && v !== '').join(' · ') || l.name;
}
function indiceDe(l){
  if(!l.idx) l.idx = l.feats.map(f => norm(l.buscar.map(c => (f.properties || {})[c]).join(' | ')));
  return l.idx;
}

function buscarElementos(){
  clearTimeout(tBusca);
  const id = ++buscaId, t = norm(q.value.trim());
  if(t.length < 2){ res.hidden = true; res.innerHTML = ''; return; }
  tBusca = setTimeout(async () => {
    const capas = CAPAS.filter(l => l.buscar && l.file);
    if(!capas.length){ res.hidden = true; return; }
    const pend = capas.filter(l => !l.g);
    let fallos = 0;
    if(pend.length){
      res.hidden = false; res.innerHTML = '<div class="rs-m">Preparando la búsqueda…</div>';
      const r = await Promise.allSettled(pend.map(asegurar));
      fallos = r.filter(x => x.status === 'rejected').length;
      if(id !== buscaId) return;   // el usuario siguió escribiendo: otra búsqueda tomó el relevo
    }
    const palabras = t.split(/\s+/);
    const hallados = []; let hayMas = false;
    for(const l of capas){
      if(!l.feats) continue;
      const idx = indiceDe(l); let n = 0;
      for(let i = 0; i < idx.length; i++){
        if(!palabras.every(p => idx[i].includes(p))) continue;
        if(n >= MAX_POR_CAPA || hallados.length >= MAX_RES){ hayMas = true; break; }
        hallados.push({ l, f:l.feats[i] }); n++;
      }
    }
    res.innerHTML = '';
    if(!hallados.length && !fallos){ res.hidden = true; return; }
    res.hidden = false;
    const tit = document.createElement('div');
    tit.className = 'rs-t';
    tit.textContent = hallados.length ? 'Elementos encontrados (' + hallados.length + (hayMas ? '+' : '') + ')' : 'Sin elementos coincidentes';
    res.appendChild(tit);
    hallados.forEach(({ l, f }) => {
      const b = document.createElement('button');
      b.className = 'rs';
      b.innerHTML = '<b>' + esc(etiquetaDe(l, f)) + '</b><small>' + esc(l.name) + '</small>';
      b.onclick = () => irAElemento(l, f);
      res.appendChild(b);
    });
    if(hayMas){ const m = document.createElement('div'); m.className = 'rs-m'; m.textContent = 'Hay más resultados: escribe más letras para afinar.'; res.appendChild(m); }
    if(fallos){ const m = document.createElement('div'); m.className = 'rs-m'; m.textContent = 'Alguna capa no se pudo cargar para la búsqueda.'; res.appendChild(m); }
  }, 250);
}

// ---------- 10. Panel de capas, ficha de información y leyenda ----------
function info(l){
  mt.textContent = l.name;
  mb.innerHTML = [['Categoría', l.cat.nombre], ['Fuente', l.fuente], ['Escala', l.escala], ['Actualización', l.fecha], ['Formato', l.formato]]
    .concat(l.n ? [['Elementos', l.n.toLocaleString('es-PE')]] : [])
    .map(r => '<tr><td>' + esc(r[0]) + '</td><td>' + esc(r[1]) + '</td></tr>').join('');
  modal.style.display = 'flex';
}
mc.onclick = () => modal.style.display = 'none';
modal.onclick = e => { if(e.target == modal) mc.onclick(); };

const ICONO_ZOOM = '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="4.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 0v3M8 13v3M0 8h3M13 8h3" stroke="currentColor" stroke-width="1.6"/></svg>';

let soloActivas = false;
const abiertas = new Set(['lotes']);   // categorías desplegadas: se recuerdan aunque el panel se redibuje

function render(){
  const t = q.value.toLowerCase().trim();
  const forzada = !!t || soloActivas;  // con búsqueda o en «Activas» se despliega todo, sin tocar lo recordado
  const y = list.scrollTop;            // posición del scroll, para no saltar al inicio
  list.innerHTML = '';
  CATEGORIAS.forEach(c => {
    const ls = CAPAS.filter(l => l.cat === c && l.name.toLowerCase().includes(t) && (!soloActivas || l.on));
    if(!ls.length) return;
    const d = document.createElement('details');
    d.className = 'cat'; d.open = forzada || abiertas.has(c.id);
    d.ontoggle = () => { if(forzada) return; if(d.open) abiertas.add(c.id); else abiertas.delete(c.id); };
    d.innerHTML = '<summary><span class="dot" style="background:' + esc(c.color) + '"></span>' + esc(c.nombre) +
                  '<span class="badge">' + ls.filter(l => l.on).length + '/' + ls.length + '</span></summary>';
    ls.forEach(l => {
      const gris = l.on && l.oculta;   // encendida pero oculta por estar muy lejos
      const r = document.createElement('div');
      r.className = 'ly' + (gris ? ' gris' : '');
      r.innerHTML = '<label><input type="checkbox" ' + (l.on ? 'checked' : '') + '>' + chipDe(l) + '<span>' + esc(l.name) + '</span>' +
        (l.on ? '<button class="z" title="Zoom a la capa" aria-label="Zoom a la capa">' + ICONO_ZOOM + '</button>' : '') +
        '<button class="i" title="Información" aria-label="Información">i</button></label>' +
        (l.minZoom ? '<div class="nota">' + (gris ? 'Oculta: acércate al zoom ' + l.minZoom + ' o más' : 'Visible desde el zoom ' + l.minZoom) + '</div>' : '') +
        (l.on ? '<label class="opl">Opacidad<input type="range" min="0.1" max="1" step="0.05" value="' + l.op + '" title="Opacidad"></label>' : '');
      r.querySelector('input').onchange = e => toggle(l, e.target.checked);
      r.querySelector('.i').onclick = e => { e.preventDefault(); info(l); };
      const z = r.querySelector('.z');
      if(z) z.onclick = e => { e.preventDefault(); zoomCapa(l); };
      const s = r.querySelector('[type=range]');
      if(s){
        const pct = v => ((v - .1) / .9 * 100) + '%';
        s.style.setProperty('--p', pct(l.op));
        s.oninput = e => { setOp(l, +e.target.value); s.style.setProperty('--p', pct(+e.target.value)); };
      }
      d.appendChild(r);
    });
    list.appendChild(d);
  });
  if(!list.children.length) list.innerHTML = '<div class="empty">' + (soloActivas ? 'No hay capas activas. Actívalas desde la pestaña Todas.' : 'Ninguna capa coincide con la búsqueda.') + '</div>';
  list.scrollTop = y;
}

// Muestra de color de la leyenda (los colores llegan como variables CSS --c y --b; ver style.css)
const muestra = (color, relleno, borde, trazos) => '<i class="sw' + (relleno ? '' : ' lin') + (trazos ? ' dash' : '') +
  '" style="--c:' + esc(color) + (borde ? ';--b:' + esc(borde) : '') + '"></i>';

// Texto de cada rango: el que escribas en «etiqueta», o uno automático («≤ 120», «120 – 300», «> 300»).
function etiquetasRangos(e){
  const f = n => Number(n).toLocaleString('es-PE');
  return e.rangos.map((r, i) => r.etiqueta || (r.hasta == null ? (i ? '> ' + f(e.rangos[i - 1].hasta) : 'Todos')
                                                              : (i ? f(e.rangos[i - 1].hasta) + ' – ' + f(r.hasta) : '≤ ' + f(r.hasta))));
}

// Leyenda de una capa: un cuadro si es de un solo color, o una fila por categoría o rango.
function leyendaDe(l){
  const e = l.est, sw = col => muestra(col, e.relleno, e.colorBorde, e.discontinua);
  if(e.campo && (e.rangos || e.colores)){
    const et = e.rangos ? etiquetasRangos(e) : null;
    const items = e.rangos ? e.rangos.map((r, i) => [r.color, et[i]]) : Object.entries(e.colores).map(([v, col]) => [col, e.etiquetas[v] || v]);
    return '<p>' + esc(l.name) + '</p><div class="lg-t">Según «' + esc(e.campo) + '»</div>' +
           items.map(([col, txt]) => '<div class="lg">' + sw(col) + '<span>' + esc(txt) + '</span></div>').join('') +
           '<div class="lg">' + sw(e.defecto) + '<span>Otros / sin dato</span></div>';
  }
  return '<p>' + esc(l.name) + '</p>' + sw(e.color);
}

// Cuadrito de color al lado del nombre de cada capa en el panel: así se ve la simbología propia de cada una.
function chipDe(l){
  const e = l.est;
  const cols = e.campo && e.rangos ? e.rangos.map(r => r.color) : e.campo && e.colores ? Object.values(e.colores) : null;
  let st = '--c:' + esc(e.color) + (e.colorBorde ? ';--b:' + esc(e.colorBorde) : '');
  if(cols && cols.length){
    const t = cols.slice(0, 4), n = t.length;
    st = '--c:' + esc(t[0]) + ';background:linear-gradient(90deg,' + t.map((c, i) => esc(c) + ' ' + (i * 100 / n) + '% ' + ((i + 1) * 100 / n) + '%').join(',') + ')';
  }
  return '<i class="mini' + (!cols && !e.relleno ? ' lin' : '') + (e.discontinua ? ' dash' : '') + '" style="' + st + '"></i>';
}

function refresh(){
  const a = CAPAS.filter(l => l.on);
  tAct.textContent = 'Activas (' + a.length + ')';
  ac.textContent = a.length + ' capas activas';
  legb.innerHTML = a.length
    ? CATEGORIAS.filter(c => a.some(l => l.cat === c)).map(c =>
        '<h4>' + esc(c.nombre.toUpperCase()) + '</h4>' + a.filter(l => l.cat === c).map(leyendaDe).join('')
      ).join('')
    : '<span class="empty">Sin capas activas</span>';
  render();
  guardarHash();
}

q.oninput = () => { render(); buscarElementos(); };
tAll.onclick = () => { soloActivas = false; tAll.className = 'on'; tAct.className = ''; render(); };
tAct.onclick = () => { soloActivas = true; tAct.className = 'on'; tAll.className = ''; render(); };
legh.onclick = () => leg.classList.toggle('shut');
bClear.onclick = () => CAPAS.filter(l => l.on).forEach(l => toggle(l, false));
refresh();

// Si el enlace traía capas activas, se encienden ahora.
(async () => {
  const pedidas = (inicio.get('c') || '').split(',').filter(Boolean);
  await Promise.all(CAPAS.filter(l => pedidas.includes(l.slug)).map(l => toggle(l, true)));
  listo = true; guardarHash();
})();

