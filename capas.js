// ====== CAPAS DEL GEOVISOR ======
// Edita este archivo para agregar, quitar o renombrar capas.
// - nombre:  texto que se ve en el panel
// - archivo: ruta del GeoJSON dentro de la carpeta data/
// - color:   color del relleno, el borde y la muestra del panel (hex)
// - id:      identificador único, sin espacios ni tildes
// Para una capa nueva, copia una línea existente y cambia sus valores.
// Para un grupo nuevo, copia un bloque { nombre: ..., capas: [...] }.

// Cada grupo tiene capas; cada capa apunta a un GeoJSON en /data
const GRUPOS = [
  { nombre: 'Ámbitos Urbanos', capas: [
    {
    id: "COFOPRI",
    nombre: "COFOPRI",
    archivo: "data/COFOPRI.geojson",
    tipo: "poligono",
    visible: true,
    estilo: { color: "#00ff00", fillColor: "#f39d1279", weight: 2, fillOpacity: 0.95, radius: 8 },
    popup: {
      titulo: "nombre",
      campos: [
        { campo: "AMBITO", etiqueta: "Nombre" },
        { campo: "SECTOR", etiqueta: "Sector" },
        { campo: "PARTIDA_R", etiqueta: "Partida Registral" },
      ]
        }
    },
    {
    id: "HAB_URBANA",
    nombre: "Habilitaciones Urbanas",
    archivo: "data/HAB_URBANA.geojson",
    tipo: "poligono",
    visible: true,
    estilo: { color: "#00ff00", fillColor: "#2ecc407e", weight: 2, fillOpacity: 0.95, radius: 8 },
    popup: {
      titulo: "nombre",
      campos: [
        { campo: "AMBITO", etiqueta: "Nombre" },
        { campo: "SECTOR", etiqueta: "Sector" },
        { campo: "PARTIDA_R", etiqueta: "Partida Registral" },
      ]
    }
  },
  {
    id: "ORD_038",
    nombre: "Ordenanza N.º038",
    archivo: "data/ORD_038.geojson",
    tipo: "poligono",
    visible: true,
    estilo: { color: "#ffff00", fillColor: "#ffff007a", weight: 0.5, fillOpacity: 0.95, radius: 8 },
    popup: {
      titulo: "nombre",
      campos: [
        { campo: "AMBITO", etiqueta: "Nombre" },
        { campo: "SECTOR", etiqueta: "Sector" }
      ]
    }
  },
  ]},
  { nombre: 'Vias', capas: [
    { id: 'Vias Locales', nombre: 'Parques y áreas verdes', archivo: 'data/parques.geojson', color: '#2e8b57' },
    { id: 'parques', nombre: 'Parques y áreas verdes', archivo: 'data/parques.geojson', color: '#2e8b57' }
  ]},
  { nombre: 'Espacios públicos', capas: [] },
  { nombre: 'Espacios públicos', capas: [] }   // agrega capas aquí

];

// Campos que se muestran en el popup (si no existe, se muestran todos)
//const POPUP_CAMPOS = null; // ejemplo: ['nombre', 'area_m2']
