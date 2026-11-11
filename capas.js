/* =====================================================================
   capas.js  –  AQUÍ SE CONFIGURAN LAS CAPAS, SU SIMBOLOGÍA Y SUS POPUPS
   (es el único archivo que editarás casi siempre)

   ESTRUCTURA DE ESTE ARCHIVO
     1. ESTILOS  → «recetas» de simbología que puedes reutilizar en varias capas
     2. POPUPS   → «recetas» de ventana emergente que puedes reutilizar
     3. CATEGORIAS → las categorías del panel y las capas de cada una

   CADA CAPA se escribe de una de estas formas:
     'Nombre de la capa'                       → capa de EJEMPLO (cuadritos de prueba)
     { n:'Nombre', estilo:{...} }              → capa de EJEMPLO con su propia simbología
     { n:'Nombre', f:'data/archivo.geojson',   → capa REAL leída desde tu GeoJSON
       estilo:ESTILOS.algo, popup:POPUPS.algo }   (guarda tus GeoJSON en la carpeta data/)

   OPCIONES DE UNA CAPA (todas opcionales salvo n)
     f        → archivo GeoJSON
     z        → zoom mínimo para verla (ej. 15 para lotes). Si te alejas, se oculta sola.
     opacidad → opacidad inicial del deslizador, de 0.1 a 1 (por defecto 0.6)
     fuente / escala / fecha → datos de la ficha «i». Si cambias la «fecha», el navegador
                descarga el archivo de nuevo en lugar de usar una copia vieja.
     buscar   → columnas por las que se buscan elementos, ej. buscar:['NOMBRE','CODIGO']
     estilo   → simbología de ESTA capa (ver abajo). Si no lo pones, usa el color de su categoría.
     popup    → ventana emergente de ESTA capa (ver abajo).

   ---------------------------------------------------------------------
   SIMBOLOGÍA  (estilo:{ ... })  — cada capa tiene la suya, aunque compartan categoría

   Elige UNA de las tres formas de dar color:
     a) Un solo color:           { color:'#7a3db8' }
     b) Por categorías (texto):  { campo:'ZONA', colores:{ 'RDM':'#f4d03f', 'CZ':'#e74c3c' } }
     c) Por rangos (números):    { campo:'AREA_M2', rangos:[ {hasta:120, color:'#fde68a'},
                                                             {hasta:300, color:'#f59e0b'},
                                                             {color:'#b45309'} ] }
        · «hasta» incluye ese valor; el último rango, sin «hasta», recoge todo lo que sobra.

   Y estas opciones de forma, para cualquiera de las tres:
     colorBorde:'#4b1e80'   color del borde (si no lo pones, el borde usa el color de relleno)
     grosor:2               grosor del borde en píxeles (por defecto 1)
     relleno:false          solo borde, sin relleno (útil para límites)
     discontinua:'8 6'      borde de trazos: «largo vacío» (ej. '8 6', '2 5')
     radio:7                tamaño de los puntos (capas de puntos)
     defecto:'#9aa5b1'      color de lo que no entra en «colores» ni «rangos»
     etiquetas:{ 'RDM':'Residencial densidad media' }   textos de la leyenda (categorías)
     En «rangos» cada rango acepta  etiqueta:'Hasta 120 m²'  para el texto de la leyenda.

   Puedes partir de una receta y cambiar una parte:  estilo:{ ...ESTILOS.limite, grosor:5 }

   ---------------------------------------------------------------------
   POPUP  (popup:{ ... })  — qué se muestra al hacer clic en un elemento

     titulo:'Distrito {NOMBRE}'    título; {COLUMNA} se reemplaza por el valor de esa columna.
                                   Si no lo pones, se usa el nombre de la capa. titulo:false lo quita.
     campos:[ ... ]                columnas a mostrar, en este orden. Cada una puede ser:
                                     'CODIGO'                        → solo el nombre de la columna
                                     { campo:'AREA_KM2', etiqueta:'Superficie',
                                       decimales:1, prefijo:'~', sufijo:' km²' }    → con formato
                                     { campo:'USO', etiqueta:'Uso',
                                       mapa:{ V:'Vivienda', C:'Comercio' } }        → traduce códigos
                                     { campo:'FOTO', etiqueta:'Foto', imagen:true }  → muestra una imagen
                                     { campo:'FICHA', enlace:true, texto:'Ver ficha' } → enlace
                                   Si no pones «campos», se muestran todas las columnas.
     ocultar:['OBJECTID']          (sin «campos») columnas que NO quieres mostrar
     pie:'Fuente: {FUENTE}'        texto pequeño al final
     ancho:320                     ancho máximo en píxeles (por defecto 300)
     html: p => '<b>'+p.NOMBRE+'</b>'   control TOTAL: tú escribes el HTML con los datos «p» del elemento.
                                   Usa esc(valor) para insertar texto de forma segura.
     Las filas vacías no se muestran.

   ---------------------------------------------------------------------
   ORDEN DE APILAMIENTO  (campo  nivel  de cada categoría)
   Las categorías con «nivel» más alto se dibujan ENCIMA de las de nivel más bajo,
   sin importar en qué orden las enciendas. Así los lotes nunca quedan tapados por un límite.

   Si escribes mal una opción o una columna, el visor avisa (mira la consola con F12).
   ===================================================================== */

const CENTRO = [-11.865, -77.075];   // [latitud, longitud] del centro inicial
const ZOOM   = 12;                   // zoom inicial

/* ---------------------------------------------------------------------
   1. ESTILOS (recetas reutilizables). Crea las tuyas copiando una y cambiando los datos.
   --------------------------------------------------------------------- */
const ESTILOS = {
  // Un solo color, solo borde grueso
  COFOPRI:{ color:'#e9681288', colorBorde:'#fc7100', grosor:2, relleno:true},
  HAB_URBANA:{ color:'#19e9128c', colorBorde:'#04f804', grosor:2, relleno:true},
  ORD_038:{ color:'#f4f8098c', colorBorde:'#f4f806', grosor:2, relleno:true},
  P_RUSTICA:{ color:'#b409f87a', colorBorde:'#d908f5', grosor:2, relleno:true},
  // Por categorías: un color por cada valor de la columna ZONA
  zonificacion:{
    campo:'ZONA',
    colores:{ 'RDM':'#f4d03f', 'RDA':'#e67e22', 'CZ':'#e74c3c', 'I1':'#8e44ad', 'ZRP':'#27ae60' },
    etiquetas:{ 'RDM':'Residencial densidad media', 'RDA':'Residencial densidad alta',
                'CZ':'Comercio zonal', 'I1':'Industria elemental', 'ZRP':'Recreación pública' },
    colorBorde:'#555', grosor:1, defecto:'#cfd8dc'
  },

  // Por rangos numéricos: colores según la columna AREA_M2
  lotesPorArea:{
    campo:'AREA_M2',
    rangos:[
      { hasta:120, color:'#fde68a', etiqueta:'Hasta 120 m²' },
      { hasta:300, color:'#f59e0b', etiqueta:'120 – 300 m²' },
      {            color:'#b45309', etiqueta:'Más de 300 m²' }
    ],
    colorBorde:'#6b7280', grosor:1
  },

  // Puntos: círculos naranjas con borde blanco
  puntos:{ color:'#d9822b', colorBorde:'#ffffff', grosor:2, radio:7 },

  // Línea de trazos (ej. vías en proyecto)
  proyecto:{ color:'#e11d48', grosor:3, relleno:false, discontinua:'8 6' }
};

/* ---------------------------------------------------------------------
   2. POPUPS (recetas reutilizables)
   --------------------------------------------------------------------- */
const POPUPS = {
  // Funciona con el archivo de ejemplo limite_distrital.geojson (columnas NOMBRE, CODIGO, AREA_KM2)
  distrito:{
    titulo:'COFOPRI',
    campos:[ { campo:'AMBITO', etiqueta:'Nombre' },
             { campo:'AREA_KM2', etiqueta:'Superficie', decimales:1, sufijo:' km²' } ],
    pie:'Fuente: Municipalidad (ejemplo)'
  },

  // Para lotes: ficha con códigos traducidos y área con formato
  lote:{
    titulo:'Lote {COD_LOTE}',
    campos:[ { campo:'DIRECCION', etiqueta:'Dirección' },
             { campo:'USO', etiqueta:'Uso', mapa:{ V:'Vivienda', C:'Comercio', E:'Equipamiento' } },
             { campo:'AREA_M2', etiqueta:'Área', decimales:1, sufijo:' m²' },
             { campo:'FICHA', enlace:true, texto:'Ver ficha catastral', etiqueta:'Ficha' } ],
    ancho:320
  },

  // Ejemplo de control total con HTML propio (usa esc() para los textos)
  zona:{
    html: p => '<div class="pu"><h4 class="pu-t">' + esc(p.ZONA) + '</h4>' +
               '<div>' + esc(p.DESCRIPCION || 'Sin descripción') + '</div></div>'
  }
};

/* ---------------------------------------------------------------------
   3. CATEGORÍAS Y CAPAS
   --------------------------------------------------------------------- */
const CATEGORIAS = [
  // Aquí cada capa de «Ámbitos» tiene su propia simbología (mira el cuadrito del panel).
  { id:'ambitos', nombre:'Ámbitos urbanos', color:'#7a3db8', nivel:1, s:.05, p:.8, capas:[
    { n:'Límite provincial',    estilo:{ color:'#7a3db8', grosor:3, relleno:false, discontinua:'6 5' } },

    // CAPA REAL: usa una receta de estilo y otra de popup, con su ficha «i» y búsqueda por columnas
    { n:'COFOPRI', f:'data/COFOPRI3.geojson', fuente:'Municipalidad', escala:'1:25 000', fecha:'2026-11-01',
      buscar:['AMBITO'], estilo:ESTILOS.COFOPRI, popup:POPUPS.distrito },
    { n:'Habilitación', f:'data/COFOPRI-GJ.geojson', fuente:'Municipalidad', escala:'1:25 000', fecha:'2026-11-01',
      buscar:['AMBITO'], estilo:ESTILOS.HAB_URBANA, popup:POPUPS.distrito },
    { n:'Ordenanza N°038', f:'data/COFOPRI-GJ.geojson', fuente:'Municipalidad', escala:'1:25 000', fecha:'2026-11-01',
      buscar:['AMBITO'], estilo:ESTILOS.ORD_038, popup:POPUPS.distrito },
    { n:'Parcelación', f:'data/COFOPRI-GJ.geojson', fuente:'Municipalidad', escala:'1:25 000', fecha:'2026-11-01',
      buscar:['AMBITO'], estilo:ESTILOS.P_RUSTICA, popup:POPUPS.distrito }]},

  { id:'urbanos', nombre:'Urbanos', color:'#d9822b', nivel:2, s:.02, p:.5, capas:[
    'Área urbana', 'Expansión urbana', 'Centros poblados', 'Vías principales',
    // Ejemplo de una capa de puntos con receta:
    // { n:'Equipamientos', f:'data/equipamientos.geojson', estilo:ESTILOS.puntos, popup:{ titulo:'{NOMBRE}', campos:['TIPO','DIRECCION'] } },
    'Equipamientos' ]},

  { id:'normativa', nombre:'Información normativa', color:'#3366cc', nivel:3, s:.015, p:.45, capas:[
    // Ejemplo de zonificación (colores por categoría, con búsqueda por zona):
    // { n:'Zonificación', f:'data/zonificacion.geojson', fecha:'2026-11-01', buscar:['ZONA'],
    //   estilo:ESTILOS.zonificacion, popup:POPUPS.zona },
    'Zonificación', 'Parámetros urbanísticos', 'Áreas de riesgo', 'Zonas de reglamentación especial',
    'Retiros viales', 'Áreas de reserva', 'Patrimonio cultural', 'Plan de desarrollo urbano' ]},

  { id:'manzanas', nombre:'Manzanas', color:'#2a9d8f', nivel:4, s:.008, p:.35, capas:[
    'Manzanas catastrales', 'Manzanas por zonificación', 'Manzanas con servicios',
    'Manzanas en riesgo', 'Manzanas sin habilitar' ]},

  { id:'lotes', nombre:'Lotes', color:'#c0392b', nivel:5, s:.003, p:.25, capas:[
    // Ejemplo de una capa pesada, coloreada por área, con su ficha y búsqueda por código de lote:
    // { n:'Lotes catastrales', f:'data/lotes.geojson', z:15, fecha:'2026-11-01',
    //   buscar:['COD_LOTE'], estilo:ESTILOS.lotesPorArea, popup:POPUPS.lote },
    'Lotes catastrales', 'Lotes vacíos', 'Lotes de uso público', 'Lotes por uso de suelo',
    'Lotes con edificación', 'Lotes subutilizados', 'Lotes con habilitación pendiente' ]}
];
