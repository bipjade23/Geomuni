/* =====================================================================
   CONFIGURACIÓN DEL GEOVISOR
   Este es el único archivo que necesitas editar para cambiar el título,
   agregar capas, cambiar colores o decidir qué se muestra en los pop-ups.
   ===================================================================== */

const CONFIG = {
  titulo: "Geovisor municipal",
  subtitulo: "Datos territoriales",
  centro: [-12.046, -77.043],   // [latitud, longitud] de la vista inicial
  zoom: 14,
  ajustarAlCargar: true,        // true = el mapa se acerca a las capas visibles
  mapaBaseInicial: "claro",     // "claro", "calles" o "satelite"
  gruposColapsados: [],         // nombres de grupos que arrancan cerrados, ej. ["Red vial"]
  panelOcultoEnCelular: true    // en pantallas pequeñas el panel arranca oculto
};

/* ---------------------------------------------------------------------
   LISTA DE CAPAS
   El orden de la lista define el apilado en el mapa: la primera capa
   queda por encima de las demás. En el panel, las capas se agrupan según
   su campo "grupo" (los grupos se pueden desplegar y marcar de una vez).

   Campos de cada capa:
     id         nombre corto, sin espacios ni tildes, único
     nombre     texto que se ve en el panel
     grupo      (opcional) nombre del grupo desplegable del panel
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
    grupo: "Ambitos Urbanos",
    archivo: "data/COFOPRI.geojson",
    tipo: "poligono",
    visible: true,
    estilo: { color: "#7a3e00", fillColor: "#e9a23785", weight: 2, fillOpacity: 0.95, radius: 8 },
    popup: {
      titulo: "COFOPRI",
      campos: [
        { campo: "AMBITO", etiqueta: "Nombre" },
        { campo: "SECTOR", etiqueta: "Sector" },
        { campo: "PARTIDA_R", etiqueta: "Partida Registral" }
      ]
    }
  },

  {
    id: "HAB_URBANA",
    nombre: "Habilitaciones Urbanas",
    grupo: "Ambitos Urbanos",
    archivo: "data/Habilitaciones_Urbanas.geojson",
    tipo: "poligono",
    visible: true,
    estilo: { color: "#22db09", fillColor: "#55e93783", weight: 2, fillOpacity: 0.95, radius: 8 },
    popup: {
      titulo: "Hab. Urbanas",
      campos: [
        { campo: "AMBITO", etiqueta: "Nombre" },
        { campo: "SECTOR", etiqueta: "Sector" },
        { campo: "TIPO", etiqueta: "Tipo" },
        { campo: "PROCESO", etiqueta: "Proceso" },
        { campo: "ANIO", etiqueta: "Año" },
        { campo: "PARTIDA_R", etiqueta: "Partida Registral" }
      ]
    }
  },

  {
    id: "parques",
    nombre: "Parques y áreas verdes",
    grupo: "Equipamiento y espacios públicos",
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
