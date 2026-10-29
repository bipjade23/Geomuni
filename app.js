// ====== CONFIGURACIÓN: edita aquí las capas, colores y archivos ======
const CENTRO = [-11.865, -77.075];   // Puente Piedra (ajusta a tu distrito)
const ZOOM = 13;

const MAPAS_BASE = [
  { id: 'sat', nombre: 'Satélite (Esri)', activo: true,
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attr: 'Imágenes © Esri' },
  { id: 'osm', nombre: 'Calles (OpenStreetMap)',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attr: '© OpenStreetMap' }
];

// Los grupos de capas y los campos del popup se editan en capas.js

// ====== MAPA ======
const mapa = L.map('mapa', { zoomControl: false }).setView(CENTRO, ZOOM);
L.control.zoom({ position: 'topright' }).addTo(mapa);
L.control.scale({ metric: true, imperial: false }).addTo(mapa);

const bases = {};
MAPAS_BASE.forEach(b => {
  bases[b.id] = L.tileLayer(b.url, { attribution: b.attr, maxZoom: 19 });
  if (b.activo) bases[b.id].addTo(mapa);
});

// ====== CAPAS ======
const capas = {};   // id -> L.GeoJSON

function estiloDe(def) {
  const e = def.estilo || {};
  const color = e.color || def.color || '#3388ff';
  return {
    color,
    weight: e.weight ?? 2,
    fillColor: e.fillColor || def.color || color,
    fillOpacity: e.fillOpacity ?? 0.35,
    radius: e.radius ?? 6
  };
}

function popupHtml(props, def) {
  props = props || {};
  let campos;
  if (def.popup && def.popup.campos) {
    campos = def.popup.campos;
  } else {
    const lista = (typeof POPUP_CAMPOS !== 'undefined' && POPUP_CAMPOS) || Object.keys(props);
    campos = lista.map(k => ({ campo: k, etiqueta: k }));
  }
  if (!campos.length) return 'Sin atributos';
  return '<table>' + campos.map(c =>
    `<tr><th>${c.etiqueta}</th><td>${props[c.campo] ?? ''}</td></tr>`).join('') + '</table>';
}

async function cargarCapa(def) {
  try {
    const datos = await (await fetch(def.archivo)).json();
    const est = estiloDe(def);
    capas[def.id] = L.geoJSON(datos, {
      style: f => {
        let relleno = est.fillColor;
        if (def.categorias) {
          const v = String(f.properties?.[def.categorias.campo] ?? '');
          const it = def.categorias.items.find(i => String(i.valor) === v);
          relleno = it ? it.color : '#cccccc';   // gris si no coincide ninguna categoría
        }
        return { color: est.color, weight: est.weight, fillColor: relleno, fillOpacity: est.fillOpacity };},
      pointToLayer: (f, ll) => L.circleMarker(ll, { radius: est.radius, color: est.color, weight: est.weight, fillColor: est.fillColor, fillOpacity: est.fillOpacity }),
      onEachFeature: (f, l) => l.bindPopup(popupHtml(f.properties, def))
    });
    return true;
  } catch (e) {
    console.warn('No se pudo cargar', def.archivo, e);
    return false;
  }
}
// ====== LEYENDA ======
function itemsLeyenda(def) {
  if (def.categorias) return def.categorias.items.map(i => ({ etiqueta: i.etiqueta, relleno: i.color, borde: est0(def).color }));
  const e = estiloDe(def);
  return [{ etiqueta: def.nombre, relleno: e.fillColor, borde: e.color }];
}
function est0(def) { return estiloDe(def); }

function actualizarLeyenda() {
  const cont = document.getElementById('leyenda-contenido');
  let html = '';
  GRUPOS.forEach(g => g.capas.forEach(def => {
    if (!capas[def.id] || !mapa.hasLayer(capas[def.id])) return;
    html += `<div class="leyenda-capa"><h3>${def.nombre}</h3>` +
      itemsLeyenda(def).map(i =>
        `<div class="leyenda-item"><span class="muestra" style="background:${i.relleno};border:1px solid ${i.borde}"></span><span>${i.etiqueta}</span></div>`
      ).join('') + '</div>';
  }));
  cont.innerHTML = html || '<div class="leyenda-vacia">Activa una capa para ver su leyenda.</div>';
}
// ====== PANEL ======
const cont = document.getElementById('panel-contenido');

function plegable(titulo, cuerpo, abierto, extraCab) {
  const g = document.createElement('div');
  g.className = 'grupo' + (abierto ? '' : ' cerrado');
  g.innerHTML = `<div class="grupo-cab"><button class="plegar" type="button">${abierto ? '−' : '+'}</button><span class="nombre">${titulo}</span></div><div class="grupo-cuerpo"></div>`;
  const cab = g.querySelector('.grupo-cab');
  if (extraCab) cab.appendChild(extraCab);
  g.querySelector('.grupo-cuerpo').appendChild(cuerpo);
  g.querySelector('.plegar').onclick = e => {
    const cerrado = g.classList.toggle('cerrado');
    e.target.textContent = cerrado ? '+' : '−';
  };
  return g;
}

// Mapas base (radio)
const cuerpoBase = document.createElement('div');
MAPAS_BASE.forEach(b => {
  const f = document.createElement('label');
  f.className = 'capa';
  f.innerHTML = `<input type="radio" name="base" ${b.activo ? 'checked' : ''}><span class="nombre">${b.nombre}</span>`;
  f.querySelector('input').onchange = () => {
    Object.values(bases).forEach(l => mapa.removeLayer(l));
    bases[b.id].addTo(mapa).bringToBack();
  };
  cuerpoBase.appendChild(f);
});
cont.appendChild(plegable('Mapa base', cuerpoBase, false));

// Grupos de capas
GRUPOS.forEach(grupo => {
  const cuerpo = document.createElement('div');
  const checks = [];

  grupo.capas.forEach(def => {
    const fila = document.createElement('div');
    fila.className = 'capa';
    const est = estiloDe(def);
    const fondo = def.categorias
      ? `linear-gradient(90deg, ${def.categorias.items.slice(0, 5).map(i => i.color).join(',')})`
      : est.fillColor;
    fila.innerHTML = `<input type="checkbox" aria-label="${def.nombre}"><span class="muestra" style="background:${fondo};border:${Math.max(est.weight, 1)}px solid ${est.color}"></span><span class="nombre">${def.nombre}</span>`;
    const chk = fila.querySelector('input');
    checks.push(chk);

    chk.onchange = async () => {
      if (chk.checked) {
        if (!capas[def.id] && !(await cargarCapa(def))) { chk.checked = false; return; }
        capas[def.id].addTo(mapa);
      } else if (capas[def.id]) {
        mapa.removeLayer(capas[def.id]);
      }
      actualizarGrupo();
      actualizarLeyenda();
    };
    cuerpo.appendChild(fila);
  });

  // Casilla del grupo: activa/desactiva todas sus capas
  const chkGrupo = document.createElement('input');
  chkGrupo.type = 'checkbox';
  chkGrupo.setAttribute('aria-label', grupo.nombre);
  chkGrupo.onchange = () => checks.forEach(c => { if (c.checked !== chkGrupo.checked) { c.checked = chkGrupo.checked; c.onchange(); } });
  function actualizarGrupo() { chkGrupo.checked = checks.length > 0 && checks.every(c => c.checked); }

  cont.appendChild(plegable(grupo.nombre, cuerpo, false, chkGrupo));
});

// Panel en celular
document.getElementById('btn-panel').onclick = () => document.getElementById('panel').classList.toggle('oculto');
if (window.innerWidth <= 640) document.getElementById('panel').classList.add('oculto');

// Botón superior derecho: personaliza su acción aquí
document.getElementById('btn-extra').onclick = () => alert('Botón de ejemplo');

const panelLeyenda = document.getElementById('leyenda');
document.getElementById('btn-leyenda').onclick = () => panelLeyenda.classList.toggle('oculto');
if (window.innerWidth <= 640) panelLeyenda.classList.add('oculto');
actualizarLeyenda();
