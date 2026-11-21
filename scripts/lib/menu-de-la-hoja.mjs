/**
 * EL MENÚ COMO LO DICE LA HOJA DE COMANDA DE PAPEL de «La Tradicional Barbacoa de Don Poncho»
 * (DP-24 · Parte 3): las categorías con su nombre, su color y sus platillos EN ORDEN, y las opciones
 * que van dentro de los productos. Lo lee `scripts/ordenar-menu-produccion.mjs`.
 *
 * Reglas del encargo que este archivo respeta:
 *   · los productos conservan su nombre (aquí van con el nombre que ya tienen en el catálogo);
 *   · las categorías se llaman como en la hoja: `antes` lista el nombre con que existen hoy (o
 *     existían), para que el guion las encuentre aunque ya se hayan renombrado (idempotencia);
 *   · lo que NO viene en la hoja va al final de su categoría (lo decide el guion, por nombre);
 *   · lo que la hoja trae y NO existe NO se crea: se lista en `LA_HOJA_TRAE_Y_NO_EXISTE`.
 *
 * Los precios de las opciones son los del encargo de Miguel; ninguno se inventa.
 */

/** Cada categoría: su nombre FINAL, cómo se llamaba (`antes`), su color de la paleta y sus platillos. */
export const CATEGORIAS_DE_LA_HOJA = [
  {
    nombre: 'Para empezar',
    antes: ['Pa’ empezar'],
    color: 'cat-6',
    productos: [
      'Tamales de frijol',
      'Tamales de frijol con mole',
      'Tlacoyo de frijol',
      'Quesadilla',
      'Quesadilla combinada',
      'Nopales en ensalada',
      'Nopales en escabeche',
      'Guacamole',
      'Aguacate',
      'Docena de tortillas',
    ],
  },
  {
    nombre: 'Las sopas',
    antes: [],
    color: 'cat-3',
    productos: ['Consomé de carnero', 'Consomé de pollo', 'Caldo de nopal', 'Arroz', 'Sopa azteca'],
  },
  {
    nombre: 'Lo fuerte',
    antes: [],
    color: 'cat-1',
    productos: [
      'Barbacoa de horno',
      'Barbacoa preparada',
      'Cabeza preparada',
      'Mole con pollo',
      'Enchiladas de mole',
      'Tacos dorados de barbacoa',
      'Taco suave de barbacoa',
      'Tamal de nopal',
      'Cecina de Yecapixtla',
      'Mixiote de carnero',
      'Conejo al pastor',
      'Conejo enchilado',
    ],
  },
  {
    nombre: 'Lo dulce',
    antes: [],
    color: 'cat-15',
    productos: [
      'Fresas con crema',
      'Flan napolitano',
      'Pastel de la casa',
      'Cocoles de piloncillo',
      'Plátanos fritos',
      'Helado',
      'Bolsa de pan',
    ],
  },
  {
    nombre: 'Para calentar',
    antes: [],
    color: 'cat-2',
    productos: ['Café de olla', 'Atole de guayaba'],
  },
  {
    nombre: 'Bebidas',
    antes: ['Para enfriar'],
    color: 'cat-10',
    productos: [
      'Coca cola',
      'Boing',
      'Jugo',
      'Licuado',
      'Jarra de agua de sabor',
      'Copa de agua de sabor',
      'Refresco',
      'Agua mineral',
      'Agua mineral preparada',
    ],
  },
  {
    nombre: 'Bebidas preparadas',
    antes: [],
    color: 'cat-9',
    productos: [
      'Naranjada',
      'Limonada',
      'Conga',
      'Paloma',
      'Charro negro',
      'Carajillo',
      'Sangría preparada',
      'Piedra',
      'Mojito',
      'Piña colada sin alcohol',
      'Mojito litro',
      'Bull',
      'Mezcalita',
      'Cazuela tequila',
    ],
  },
  {
    nombre: 'Cerveza',
    antes: [],
    color: 'cat-4',
    productos: [
      'Corona',
      'Victoria',
      'Modelo especial',
      'Negra modelo',
      'Cerveza de barril · bola',
      'Cerveza de barril · litro',
    ],
  },
  {
    nombre: 'Tequila',
    antes: [],
    color: 'cat-5',
    productos: [
      'Maestro dobel',
      'Cuervo tradicional',
      '1800 cristalino',
      'Don Julio reposado',
      'Don Julio 70',
      'Centenario',
      'Hornitos',
    ],
  },
  {
    // La hoja une «Ron» y «Brandy». La que queda es «Ron»: se renombra y recibe a «Brandy».
    nombre: 'Ron y Brandy',
    antes: ['Ron'],
    unirCon: 'Brandy',
    color: 'cat-16',
    productos: ['Bacardí blanco', 'Havana 3 años', 'Havana 7 años', 'Torres 10'],
  },
  {
    nombre: 'Whisky',
    antes: [],
    color: 'cat-12',
    productos: ['Red label', 'Jack Daniel’s', 'Black label'],
  },
  { nombre: 'Vodka', antes: [], color: 'cat-11', productos: ['Absolut', 'Smirnoff'] },
  {
    nombre: 'Anís y licores',
    antes: [],
    color: 'cat-13',
    productos: ['Chinchón', 'Baileys', 'Licor 43'],
  },
  {
    nombre: 'Vino tinto',
    antes: [],
    color: 'cat-14',
    productos: ['Concha y toro', 'La redonda', 'Finca Las Moras'],
  },
  {
    nombre: 'Pulque',
    antes: ['Pulques'],
    color: 'cat-7',
    productos: [
      ...['básico', 'especial', 'exótico', 'premium', 'premium con licor', 'de piñón'].flatMap(
        (sabor) => [`Pulque ${sabor} · litro`, `Pulque ${sabor} · medio litro`],
      ),
      'Pulque natural · litro',
    ],
  },
  {
    nombre: 'Mezcal',
    antes: [],
    color: 'cat-8',
    productos: ['400 conejos', 'Monte lobos', 'Cazuela mezcal'],
  },
];

/** Los platillos que la hoja trae y que NO existen en el catálogo: NO se crean, Miguel decide. */
export const LA_HOJA_TRAE_Y_NO_EXISTE = [
  'Campechanas',
  'Panqués',
  'Café americano',
  'Café capuchino',
  'Cuervo especial',
  'Bacardí añejo',
];

/**
 * Los 4 «(extra)» de Cerveza: el michelado y compañía que se vendían como productos sueltos. Con el
 * grupo «Prepárala» ya no hacen falta: se APAGAN (no se borran), y sólo si ninguna cuenta abierta
 * los trae.
 */
export const EXTRAS_DE_CERVEZA = [
  'Michelado (extra)',
  'Cubano (extra)',
  'Con clamato (extra)',
  'Con clamato cubano (extra)',
];

/**
 * Los grupos de opciones nuevos (menú impreso, `apps/web/public/menu-qr/*.webp`) y a qué productos
 * van. `opciones[].precio` va en pesos, como lo recibe `catalogo.guardar_grupo_de_opciones`.
 */
export const GRUPOS_DE_OPCIONES_NUEVOS = [
  {
    nombre: 'Prepárala',
    tipo: 'unica',
    obligatorio: false,
    opciones: [
      { nombre: 'Michelado', precio: '15' },
      { nombre: 'Cubano', precio: '20' },
      { nombre: 'Con clamato', precio: '30' },
      { nombre: 'Con clamato cubano', precio: '35' },
    ],
    productos: [
      'Corona',
      'Victoria',
      'Modelo especial',
      'Negra modelo',
      'Cerveza de barril · bola',
      'Cerveza de barril · litro',
    ],
  },
  {
    nombre: 'Preparación',
    tipo: 'multiple',
    obligatorio: false,
    opciones: [
      { nombre: 'Sin chile cuaresmeño', precio: '0' },
      { nombre: 'Sin cilantro', precio: '0' },
      { nombre: 'Sin cebolla', precio: '0' },
    ],
    productos: ['Barbacoa preparada', 'Cabeza preparada'],
  },
];

/**
 * Lo que el menú impreso dice y NO se carga: «El tequila (o el alcohol) de su agrado es adicional».
 * Sin el precio, el comando de opciones se niega a guardarlo (y no se inventa): Miguel da el costo.
 */
export const OPCIONES_QUE_FALTAN_DE_PRECIO = [
  { producto: 'Paloma', texto: 'El tequila de su agrado es adicional' },
  { producto: 'Charro negro', texto: 'El tequila de su agrado es adicional' },
  { producto: 'Piña colada sin alcohol', texto: 'El alcohol de su agrado es adicional' },
];
