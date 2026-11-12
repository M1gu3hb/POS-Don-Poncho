/**
 * LO QUE EL DUEÑO DEJA LISTO EN EL DÍA 0. Todo con nombres «de prueba» para que el árbitro y el
 * informe los distingan de los platillos reales. Los PIN no están aquí: los genera `pines.ts`.
 */

export type Puesto = 'Mesero' | 'Cajero' | 'Gerente' | 'Almacén' | 'Cocina';

export interface UsuarioDeAlta {
  readonly nombre: string;
  readonly puesto: Puesto;
  /** Sólo para cocina: la estación que ve. */
  readonly estacion?: string;
}

/** Los que faltan en la copia (ya hay Mesero 1 y 2, Caja y Caja 2, Gerente, Almacén, Cocina y Bebidas). */
export const USUARIOS: readonly UsuarioDeAlta[] = [
  { nombre: 'Mesero 3', puesto: 'Mesero' },
  { nombre: 'Mesero 4', puesto: 'Mesero' },
  { nombre: 'Mesero 5', puesto: 'Mesero' },
  { nombre: 'Mesero 6', puesto: 'Mesero' },
  { nombre: 'Caja 3', puesto: 'Cajero' },
  { nombre: 'Cocina Parrilla', puesto: 'Cocina', estacion: 'Parrilla' },
  { nombre: 'Cocina Postres', puesto: 'Cocina', estacion: 'Postres' },
  { nombre: 'Cocina Pulques', puesto: 'Cocina', estacion: 'Pulques' },
];

export const ESTACIONES_NUEVAS = ['Parrilla', 'Postres', 'Pulques'] as const;

/** Categoría → estación. `Del carbón` se crea; las demás ya existen. */
export const CATEGORIA_A_ESTACION: readonly {
  readonly categoria: string;
  readonly estacion: string;
  readonly crear?: true;
}[] = [
  { categoria: 'Del carbón', estacion: 'Parrilla', crear: true },
  { categoria: 'Lo dulce', estacion: 'Postres' },
  { categoria: 'Pulques', estacion: 'Pulques' },
];

export const ZONA_NUEVA = 'Terraza';
/** Las 10 mesas de la zona nueva (las 10 de «Salón» ya existen: 20 en total). */
export const MESAS_NUEVAS: readonly number[] = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
export const MESAS_EN_TOTAL = 20;

export type TipoDePrueba =
  | 'pieza'
  | 'peso_con_presentaciones'
  | 'peso_libre'
  | 'solo_presentaciones'
  | 'porcion'
  | 'opcion_unica'
  | 'opcion_multiple'
  | 'con_foto'
  | 'sin_foto_con_fondo'
  | 'sin_opciones';

export interface OpcionDePrueba {
  readonly nombre: string;
  readonly deltaPesos: number;
}

export interface GrupoDePrueba {
  readonly nombre: string;
  readonly tipo: 'unica' | 'multiple';
  readonly obligatorio: boolean;
  readonly minimo?: number;
  readonly maximo?: number;
  readonly opciones: readonly OpcionDePrueba[];
}

export interface ProductoDePrueba {
  readonly tipo: TipoDePrueba;
  readonly nombre: string;
  readonly categoria: string;
  readonly precioPesos: number;
  readonly grupos: readonly GrupoDePrueba[];
  /** Presentaciones en kg (peso) o ml (porción). */
  readonly presentaciones?: readonly number[];
  readonly soloPresentaciones?: boolean;
  readonly conFoto?: boolean;
  /** Para los de peso y porción: el insumo del que sale lo que se vende (kg → g, ml). */
  readonly ingredienteBase?: string;
  /** Insumo → cantidad en unidad BASE por unidad vendida (receta que descuenta). */
  readonly receta?: Readonly<Record<string, number>>;
}

export const PRODUCTOS_DE_PRUEBA: readonly ProductoDePrueba[] = [
  {
    tipo: 'pieza',
    nombre: 'Taco de prueba',
    categoria: 'Lo fuerte',
    precioPesos: 35,
    grupos: [],
    receta: { 'Tortilla de prueba': 2, 'Carne de prueba': 60 },
  },
  {
    tipo: 'peso_con_presentaciones',
    nombre: 'Barbacoa por kilo de prueba',
    categoria: 'Del carbón',
    precioPesos: 795,
    grupos: [],
    presentaciones: [0.25, 0.5, 1],
    ingredienteBase: 'Carne de prueba',
  },
  {
    tipo: 'peso_libre',
    nombre: 'Arrachera por peso de prueba',
    categoria: 'Del carbón',
    precioPesos: 420,
    grupos: [],
    ingredienteBase: 'Carne de prueba',
  },
  {
    tipo: 'solo_presentaciones',
    nombre: 'Costillar de prueba',
    categoria: 'Del carbón',
    precioPesos: 360,
    grupos: [],
    presentaciones: [0.5, 1],
    soloPresentaciones: true,
    ingredienteBase: 'Carne de prueba',
  },
  {
    tipo: 'porcion',
    nombre: 'Shot de tequila de prueba',
    categoria: 'Tequila',
    precioPesos: 45,
    grupos: [],
    presentaciones: [45],
    ingredienteBase: 'Tequila de prueba',
  },
  {
    tipo: 'opcion_unica',
    nombre: 'Pozole de prueba',
    categoria: 'Las sopas',
    precioPesos: 95,
    receta: { 'Maíz pozolero de prueba': 150 },
    grupos: [
      {
        nombre: 'Tamaño',
        tipo: 'unica',
        obligatorio: true,
        opciones: [
          { nombre: 'Chico', deltaPesos: 0 },
          { nombre: 'Grande', deltaPesos: 25 },
        ],
      },
    ],
  },
  {
    tipo: 'opcion_multiple',
    nombre: 'Hamburguesa de prueba',
    categoria: 'Lo fuerte',
    precioPesos: 110,
    receta: { 'Carne de prueba': 150, 'Pan de prueba': 1 },
    grupos: [
      {
        nombre: 'Extras',
        tipo: 'multiple',
        obligatorio: true,
        minimo: 1,
        maximo: 3,
        opciones: [
          { nombre: 'Queso', deltaPesos: 15 },
          { nombre: 'Tocino', deltaPesos: 20 },
          { nombre: 'Sin cebolla', deltaPesos: -5 },
          { nombre: 'Sin cambios', deltaPesos: 0 },
        ],
      },
    ],
  },
  {
    tipo: 'con_foto',
    nombre: 'Flan de prueba',
    categoria: 'Lo dulce',
    precioPesos: 55,
    grupos: [],
    conFoto: true,
    receta: { 'Leche de prueba': 200 },
  },
  {
    tipo: 'sin_foto_con_fondo',
    nombre: 'Pulque curado de prueba',
    categoria: 'Pulques',
    precioPesos: 60,
    grupos: [],
    receta: { 'Pulque de prueba': 500 },
  },
  {
    tipo: 'sin_opciones',
    nombre: 'Agua fresca de prueba',
    categoria: 'Para enfriar',
    precioPesos: 30,
    grupos: [],
  },
];

/** Opciones con precio en productos REALES: los tarros de la cerveza. */
export const OPCIONES_EN_REALES: readonly {
  readonly categoria: string;
  readonly grupo: GrupoDePrueba;
}[] = [
  {
    categoria: 'Cerveza',
    grupo: {
      nombre: 'Tarro',
      tipo: 'unica',
      obligatorio: false,
      opciones: [
        { nombre: 'Botella', deltaPesos: 0 },
        { nombre: 'Tarro helado', deltaPesos: 15 },
        { nombre: 'Tarro michelado', deltaPesos: 25 },
      ],
    },
  },
];

/** La unidad BASE de un insumo es la del inventario (g, ml, pieza); se compra en kg, litro o pieza. */
export interface InsumoDePrueba {
  readonly nombre: string;
  readonly base: 'g' | 'ml' | 'pieza';
  readonly unidadDeCompra: 'kg' | 'litro' | 'pieza';
  /** Lo que entra al inventario por una compra el día 0, en la unidad de compra. */
  readonly compra: number;
  readonly costoTotalPesos: number;
  /** Merma del día 0 en la unidad BASE. */
  readonly mermaBase: number;
}

/** Cuántas unidades base trae una unidad de compra. */
export const BASE_POR_COMPRA: Readonly<Record<InsumoDePrueba['unidadDeCompra'], number>> = {
  kg: 1000,
  litro: 1000,
  pieza: 1,
};

export const INSUMOS: readonly InsumoDePrueba[] = [
  {
    nombre: 'Tortilla de prueba',
    base: 'pieza',
    unidadDeCompra: 'pieza',
    compra: 600,
    costoTotalPesos: 900,
    mermaBase: 10,
  },
  {
    nombre: 'Carne de prueba',
    base: 'g',
    unidadDeCompra: 'kg',
    compra: 40,
    costoTotalPesos: 7200,
    mermaBase: 1500,
  },
  {
    nombre: 'Maíz pozolero de prueba',
    base: 'g',
    unidadDeCompra: 'kg',
    compra: 12,
    costoTotalPesos: 540,
    mermaBase: 500,
  },
  {
    nombre: 'Pan de prueba',
    base: 'pieza',
    unidadDeCompra: 'pieza',
    compra: 80,
    costoTotalPesos: 480,
    mermaBase: 3,
  },
  {
    nombre: 'Leche de prueba',
    base: 'ml',
    unidadDeCompra: 'litro',
    compra: 20,
    costoTotalPesos: 480,
    mermaBase: 1000,
  },
  {
    nombre: 'Pulque de prueba',
    base: 'ml',
    unidadDeCompra: 'litro',
    compra: 60,
    costoTotalPesos: 1200,
    mermaBase: 2000,
  },
  {
    nombre: 'Tequila de prueba',
    base: 'ml',
    unidadDeCompra: 'litro',
    compra: 3,
    costoTotalPesos: 1200,
    mermaBase: 100,
  },
];

export const CONFIGURACION = {
  cajas: 2,
  retiroConPinArribaDePesos: 500,
  alertaAmbarMinutos: 10,
  alertaRojoMinutos: 18,
  modoDelMenu: 'Menú digital',
} as const;
