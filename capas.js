/* =====================================================================
   CONFIGURACIÓN DEL GEOVISOR
   Este es el único archivo que necesitas editar para cambiar el título,
   agregar capas, cambiar colores o decidir qué se muestra en los pop-ups.
   ===================================================================== */

const CONFIG = {
  titulo: "Geovisor municipal",
  subtitulo: "Datos territoriales",
  centro: [-11.8690, -77.0711],   // [latitud, longitud] de la vista inicial
  zoom: 14,
  ajustarAlCargar: true,        // true = el mapa se acerca a las capas visibles
  mapaBaseInicial: "claro"      // "claro", "calles" o "satelite"
};

/* ---------------------------------------------------------------------
   LISTA DE CAPAS
   El orden de la lista es el orden del panel y del apilado en el mapa:
   la primera capa queda por encima de las demás.

   Campos de cada capa:
     id         nombre corto, sin espacios ni tildes, único
     nombre     texto que se ve en el panel
     archivo    ruta del GeoJSON (en EPSG:4326)
     tipo       "poligono", "linea" o "punto" (solo para el ícono del panel)
     visible    true = aparece activada al abrir el visor
     estilo     color, fillColor, weight, fillOpacity (radius para puntos)
     categorias (opcional) colorea según un campo de la tabla
     popup      titulo = campo usado como título
                campos = lista de campos que se muestran, con su etiqueta
   --------------------------------------------------------------------- */

const CAPAS = [
  {
    id: "COFOPRI",
    nombre: "COFOPRI",
    archivo: "data/COFOPRI.geojson",
    tipo: "poligono",
    visible: true,
    estilo: { color: "#F59C27", fillColor: "#e39b2d", weight: 2, fillOpacity: 15, radius: 8 },
    popup: {
      titulo: "COFOPRI",
      campos: [
        { campo: "AMBITO", etiqueta: "Ambito" },
        { campo: "SECTOR", etiqueta: "Sector" },
        { campo: "PARTIDA", etiqueta: "Partida Registral" }
      ]
    }
  },
  {
    id: "vias",
    nombre: "Vías",
    archivo: "data/vias.geojson",
    tipo: "linea",
    visible: true,
    estilo: { color: "#555555", weight: 4 },
    categorias: {
      campo: "estado",
      colores: { "Bueno": "#2f7d4f", "Regular": "#d19a1f", "Malo": "#b3392b" }
    },
    popup: {
      titulo: "nombre",
      campos: [
        { campo: "estado", etiqueta: "Estado" },
        { campo: "longitud_m", etiqueta: "Longitud (m)", formato: "numero" }
      ]
    }
  },
  {
    id: "parques",
    nombre: "Parques y áreas verdes",
    archivo: "data/parques.geojson",
    tipo: "poligono",
    visible: true,
    estilo: { color: "#2f7d4f", fillColor: "#6fbf8b", weight: 1.5, fillOpacity: 0.45 },
    popup: {
      titulo: "nombre",
      campos: [
        { campo: "tipo", etiqueta: "Tipo" },
        { campo: "area_m2", etiqueta: "Área (m²)", formato: "numero" }
      ]
    }
  }
];
