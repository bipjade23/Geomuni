/* Lógica del geovisor. Normalmente no necesitas tocar este archivo:
   todo lo configurable está en capas.js */
(function () {
  "use strict";

  document.title = CONFIG.titulo;
  document.getElementById("titulo").textContent = CONFIG.titulo;
  document.getElementById("subtitulo").textContent = CONFIG.subtitulo || "";

  /* ---------- Mapa y mapas base ---------- */
  const mapa = L.map("mapa", { zoomControl: false }).setView(CONFIG.centro, CONFIG.zoom);
  L.control.zoom({ position: "bottomright" }).addTo(mapa);
  L.control.scale({ imperial: false, position: "bottomleft" }).addTo(mapa);

  const BASES = {
    claro: {
      nombre: "Claro",
      capa: L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        maxZoom: 20, subdomains: "abcd",
        attribution: "&copy; OpenStreetMap &copy; CARTO"
      })
    },
    calles: {
      nombre: "Calles",
      capa: L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19, attribution: "&copy; OpenStreetMap"
      })
    },
    satelite: {
      nombre: "Satélite",
      capa: L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
        maxZoom: 19, attribution: "Imágenes &copy; Esri"
      })
    }
  };

  let baseActual = BASES[CONFIG.mapaBaseInicial] ? CONFIG.mapaBaseInicial : "claro";
  BASES[baseActual].capa.addTo(mapa);

  const contBases = document.getElementById("bases");
  Object.keys(BASES).forEach(function (clave) {
    const label = document.createElement("label");
    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "base";
    radio.value = clave;
    radio.checked = clave === baseActual;
    const texto = document.createElement("span");
    texto.textContent = BASES[clave].nombre;
    label.append(radio, texto);
    contBases.appendChild(label);
    radio.addEventListener("change", function () {
      mapa.removeLayer(BASES[baseActual].capa);
      baseActual = clave;
      BASES[clave].capa.addTo(mapa).bringToBack();
    });
  });

  /* ---------- Utilidades ---------- */
  function esc(valor) {
    return String(valor).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function formatear(valor, campo) {
    if (campo.formato === "numero" && !isNaN(Number(valor))) {
      return Number(valor).toLocaleString("es-PE", { maximumFractionDigits: 2 });
    }
    return valor;
  }

  function estiloDe(capa, feature) {
    const estilo = Object.assign({}, capa.estilo);
    if (capa.categorias && feature) {
      const color = capa.categorias.colores[feature.properties[capa.categorias.campo]];
      if (color) { estilo.color = color; estilo.fillColor = color; }
    }
    return estilo;
  }

  function htmlPopup(capa, props) {
    const cfg = capa.popup || {};
    const titulo = cfg.titulo && props[cfg.titulo] ? props[cfg.titulo] : capa.nombre;
    const campos = cfg.campos || Object.keys(props).map(function (k) { return { campo: k, etiqueta: k }; });
    const filas = campos
      .filter(function (c) { return props[c.campo] !== null && props[c.campo] !== undefined && props[c.campo] !== ""; })
      .map(function (c) {
        return "<tr><th>" + esc(c.etiqueta) + "</th><td>" + esc(formatear(props[c.campo], c)) + "</td></tr>";
      }).join("");
    return '<div class="pop"><h3>' + esc(titulo) + "</h3>" + (filas ? "<table>" + filas + "</table>" : "") + "</div>";
  }

  function muestra(capa, color) {
    const s = document.createElement("span");
    s.className = "muestra " + capa.tipo;
    const e = capa.estilo || {};
    const c = color || e.color;
    s.style.borderColor = c;
    s.style.background = capa.tipo === "linea" ? c : (color || e.fillColor || e.color);
    return s;
  }

  /* ---------- Panel de capas ---------- */
  const lista = document.getElementById("lista-capas");

  CAPAS.forEach(function (capa, i) {
    // Cada capa tiene su propio nivel de apilado: la primera de la lista queda arriba
    mapa.createPane(capa.id).style.zIndex = 400 + (CAPAS.length - i);

    const li = document.createElement("li");
    li.className = "capa";

    const fila = document.createElement("div");
    fila.className = "capa-fila";
    const label = document.createElement("label");
    const check = document.createElement("input");
    check.type = "checkbox";
    check.disabled = true;
    const nombre = document.createElement("span");
    nombre.className = "nombre";
    nombre.textContent = capa.nombre;
    label.append(check, muestra(capa), nombre);

    const botonZoom = document.createElement("button");
    botonZoom.type = "button";
    botonZoom.className = "acercar";
    botonZoom.textContent = "Acercar";
    botonZoom.disabled = true;
    botonZoom.title = "Acercar a esta capa";

    fila.append(label, botonZoom);
    li.appendChild(fila);

    if (capa.categorias) {
      const ley = document.createElement("ul");
      ley.className = "leyenda";
      Object.keys(capa.categorias.colores).forEach(function (valor) {
        const item = document.createElement("li");
        item.append(muestra(capa, capa.categorias.colores[valor]), document.createTextNode(valor));
        ley.appendChild(item);
      });
      li.appendChild(ley);
    }

    const aviso = document.createElement("p");
    aviso.className = "aviso";
    li.appendChild(aviso);
    lista.appendChild(li);

    capa._ui = { check: check, boton: botonZoom, aviso: aviso };
  });

  /* ---------- Carga de datos ---------- */
  function crearGrupo(capa, datos) {
    return L.geoJSON(datos, {
      pane: capa.id,
      style: function (f) { return estiloDe(capa, f); },
      pointToLayer: function (f, latlng) {
        return L.circleMarker(latlng, Object.assign({ radius: 7, pane: capa.id }, estiloDe(capa, f)));
      },
      onEachFeature: function (f, lyr) {
        lyr.bindPopup(htmlPopup(capa, f.properties || {}), { maxWidth: 300 });
      }
    });
  }

  const cargas = CAPAS.map(function (capa) {
    return fetch(capa.archivo)
      .then(function (r) {
        if (!r.ok) { throw new Error("HTTP " + r.status); }
        return r.json();
      })
      .then(function (datos) {
        capa._grupo = crearGrupo(capa, datos);
        const ui = capa._ui;
        ui.check.disabled = false;
        ui.boton.disabled = false;
        ui.check.checked = !!capa.visible;
        if (capa.visible) { capa._grupo.addTo(mapa); }

        ui.check.addEventListener("change", function () {
          if (ui.check.checked) { capa._grupo.addTo(mapa); } else { mapa.removeLayer(capa._grupo); }
        });
        ui.boton.addEventListener("click", function () {
          if (!mapa.hasLayer(capa._grupo)) { ui.check.checked = true; capa._grupo.addTo(mapa); }
          const b = capa._grupo.getBounds();
          if (b.isValid()) { mapa.fitBounds(b, { padding: [40, 40], maxZoom: 18 }); }
        });
      })
      .catch(function () {
        capa._ui.aviso.textContent = "No se pudo cargar " + capa.archivo +
          ". Revisa que el archivo exista y que el nombre coincida.";
      });
  });

  Promise.all(cargas).then(function () {
    if (!CONFIG.ajustarAlCargar) { return; }
    let limites = null;
    CAPAS.forEach(function (capa) {
      if (capa._grupo && mapa.hasLayer(capa._grupo) && capa._grupo.getBounds().isValid()) {
        limites = limites ? limites.extend(capa._grupo.getBounds()) : L.latLngBounds(capa._grupo.getBounds().getSouthWest(), capa._grupo.getBounds().getNorthEast());
      }
    });
    if (limites) { mapa.fitBounds(limites, { padding: [40, 40], maxZoom: 17 }); }
  });

  /* ---------- Botón para ocultar el panel (útil en celular) ---------- */
  const panel = document.getElementById("panel");
  const btnPanel = document.getElementById("btn-panel");
  btnPanel.addEventListener("click", function () {
    const oculto = panel.classList.toggle("oculto");
    btnPanel.textContent = oculto ? "Mostrar panel" : "Ocultar panel";
    btnPanel.setAttribute("aria-expanded", String(!oculto));
  });
})();
