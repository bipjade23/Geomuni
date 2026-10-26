/* Lógica del geovisor. Normalmente no necesitas tocar este archivo:
   todo lo configurable está en capas.js */
(function () {
  "use strict";

  document.title = CONFIG.titulo;

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

  /* ---------- Mapa y mapas base ---------- */
  const mapa = L.map("mapa", { zoomControl: false }).setView(CONFIG.centro, CONFIG.zoom);
  L.control.zoom({ position: "bottomright" }).addTo(mapa);
  L.control.scale({ imperial: false, position: "bottomleft" }).addTo(mapa);

  const BASES = {
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
  const baseInicial = BASES[CONFIG.mapaBaseInicial] ? CONFIG.mapaBaseInicial : "claro";

  /* ---------- Capas: se crean vacías y se llenan al cargar los GeoJSON ---------- */
  CAPAS.forEach(function (capa, i) {
    // Cada capa tiene su propio nivel de apilado: la primera de la lista queda arriba
    mapa.createPane(capa.id).style.zIndex = 400 + (CAPAS.length - i);

    capa._grupo = L.geoJSON(null, {
      pane: capa.id,
      style: function (f) { return estiloDe(capa, f); },
      pointToLayer: function (f, latlng) {
        return L.circleMarker(latlng, Object.assign({ radius: 7, pane: capa.id }, estiloDe(capa, f)));
      },
      onEachFeature: function (f, lyr) {
        lyr.bindPopup(htmlPopup(capa, f.properties || {}), { maxWidth: 300 });
      }
    });
  });

  /* ---------- Panel de capas (plugin Leaflet Panel Layers) ---------- */
  const colapsados = CONFIG.gruposColapsados || [];

  function definicion(capa) {
    return {
      name: esc(capa.nombre),
      icon: muestra(capa).outerHTML,
      layer: capa._grupo,
      active: !!capa.visible,
      _capa: capa
    };
  }

  // Agrupa las capas según su campo "grupo", respetando el orden de aparición
  const overlays = [];
  const gruposPorNombre = {};
  CAPAS.forEach(function (capa) {
    if (!capa.grupo) { overlays.push(definicion(capa)); return; }
    if (!gruposPorNombre[capa.grupo]) {
      gruposPorNombre[capa.grupo] = {
        group: capa.grupo,
        collapsed: colapsados.indexOf(capa.grupo) !== -1,
        layers: []
      };
      overlays.push(gruposPorNombre[capa.grupo]);
    }
    gruposPorNombre[capa.grupo].layers.push(definicion(capa));
  });

  const baseLayers = [{
    group: "Mapa base",
    collapsed: true,
    layers: Object.keys(BASES).map(function (clave) {
      return { name: esc(BASES[clave].nombre), layer: BASES[clave].capa, active: clave === baseInicial };
    })
  }];

  // Contenido extra de cada capa: leyenda, botón "Acercar" y mensaje de error
  function contenidoExtra(obj) {
    const capa = obj._capa;
    if (!capa) { return document.createDocumentFragment(); }

    const cont = document.createElement("div");
    cont.className = "capa-extra";

    if (capa.categorias) {
      const ley = document.createElement("ul");
      ley.className = "leyenda";
      Object.keys(capa.categorias.colores).forEach(function (valor) {
        const li = document.createElement("li");
        li.append(muestra(capa, capa.categorias.colores[valor]), document.createTextNode(valor));
        ley.appendChild(li);
      });
      cont.appendChild(ley);
    }

    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "acercar";
    boton.textContent = "Acercar";
    boton.title = "Acercar a esta capa";
    boton.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      // Si la capa está apagada, se enciende con su propia casilla
      const item = boton.closest(".leaflet-panel-layers-item");
      const casilla = item && item.querySelector("input.leaflet-panel-layers-selector");
      if (casilla && !casilla.checked) { casilla.click(); }
      const b = capa._grupo.getBounds();
      if (b.isValid()) { mapa.fitBounds(b, { padding: [40, 40], maxZoom: 18 }); }
    });
    cont.appendChild(boton);

    const aviso = document.createElement("p");
    aviso.className = "capa-aviso";
    aviso.setAttribute("data-capa", capa.id);
    aviso.textContent = capa._error || "";
    cont.appendChild(aviso);

    return cont;
  }

  const panel = L.control.panelLayers(baseLayers, overlays, {
    position: "topleft",
    compact: true,
    compactOffset: 70,
    collapsibleGroups: true,   // los grupos se pueden desplegar y cerrar
    selectorGroup: true,       // casilla en cada grupo para encender o apagar todo
    autoZIndex: false,
    className: "panel-geovisor",
    title: esc(CONFIG.titulo),
    buildItem: contenidoExtra
  }).addTo(mapa);

  const contenedor = panel.getContainer();
  if (CONFIG.subtitulo) {
    const sub = document.createElement("p");
    sub.className = "subtitulo";
    sub.textContent = CONFIG.subtitulo;
    const titulo = contenedor.querySelector(".leaflet-panel-layers-title");
    titulo.insertAdjacentElement("afterend", sub);
  }

  /* ---------- Botón para ocultar el panel ---------- */
  const btnPanel = document.getElementById("btn-panel");
  function mostrarPanel(mostrar) {
    contenedor.classList.toggle("oculto", !mostrar);
    btnPanel.textContent = mostrar ? "Ocultar panel" : "Mostrar panel";
    btnPanel.setAttribute("aria-expanded", String(mostrar));
  }
  btnPanel.addEventListener("click", function () {
    mostrarPanel(contenedor.classList.contains("oculto"));
  });
  if (CONFIG.panelOcultoEnCelular && window.matchMedia("(max-width: 640px)").matches) {
    mostrarPanel(false);
  }

  /* ---------- Carga de datos ---------- */
  const cargas = CAPAS.map(function (capa) {
    return fetch(capa.archivo)
      .then(function (r) {
        if (!r.ok) { throw new Error("HTTP " + r.status); }
        return r.json();
      })
      .then(function (datos) { capa._grupo.addData(datos); })
      .catch(function () {
        capa._error = "No se pudo cargar " + capa.archivo + ". Revisa que el archivo exista y que el nombre coincida.";
        const aviso = document.querySelector('.capa-aviso[data-capa="' + capa.id + '"]');
        if (aviso) { aviso.textContent = capa._error; }
      });
  });

  Promise.all(cargas).then(function () {
    if (!CONFIG.ajustarAlCargar) { return; }
    let limites = null;
    CAPAS.forEach(function (capa) {
      const b = capa._grupo.getBounds();
      if (mapa.hasLayer(capa._grupo) && b.isValid()) {
        limites = limites ? limites.extend(b) : L.latLngBounds(b.getSouthWest(), b.getNorthEast());
      }
    });
    if (limites) { mapa.fitBounds(limites, { padding: [40, 40], maxZoom: 17 }); }
  });
})();
