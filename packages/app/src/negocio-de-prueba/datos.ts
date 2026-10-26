/**
 * LA SEMILLA DEL RESTAURANTE DE PRUEBA: catálogo, insumos, recetas, proveedor y fondo.
 *
 * Sólo vive en bases desechables (el reseteo se niega fuera de `NEGOCIOS_DE_PRUEBA`). Las
 * semillas de los otros cuatro giros del maestro se fueron con ellos (DP-2).
 */

export interface ProductoDePrueba {
  readonly nombre: string;
  readonly categoria: string;
  /**
   * A donde va la comanda. Sin esto la cocina no recibe NADA: `areasDe`
   * devuelve una lista vacia, no se crea ninguna comanda, y la mesa anuncia
   * «pedido enviado» sin una sola fila en `comandas`.
   */
  readonly area?: 'cocina' | 'barra' | 'ambos' | 'ninguno';
  readonly sku: string;
  readonly codigoBarras?: string;
  readonly precioCentavos: bigint;
  readonly costoCentavos: bigint;
  readonly stock: string;
  /**
   * En qué se vende. `pieza` por omisión.
   *
   * La base sólo admite las ocho de `unidades.ts` —`pieza`, `caja`, `paquete`,
   * `kg`, `g`, `l`, `ml`, `m`—, y el insumo se da de alta en LA MISMA: así la
   * estrategia `sku` descuenta uno a uno y no hace falta un factor.
   */
  readonly unidadVenta?: 'pieza' | 'kg' | 'g' | 'l' | 'ml' | 'm';
}

export interface InsumoDePrueba {
  readonly clave: string;
  readonly nombre: string;
  readonly unidad: 'pieza' | 'g' | 'ml';
  readonly costoCentavos: bigint;
  readonly stock: string;
}

export interface RecetaDePrueba {
  readonly nombre: string;
  readonly categoria: string;
  readonly area?: 'cocina' | 'barra' | 'ambos' | 'ninguno';
  readonly precioCentavos: bigint;
  readonly ingredientes: readonly { readonly clave: string; readonly cantidad: string }[];
}

/** Un proveedor de verdad, con su día de visita (F-107). */
export interface ProveedorDePrueba {
  readonly nombre: string;
  readonly contacto: string;
  readonly telefono: string;
  /** 1 = lunes … 7 = domingo. */
  readonly diasVisita: readonly number[];
  readonly diasCredito: number;
}

export interface SemillaDePrueba {
  readonly categorias: readonly string[];
  readonly productos: readonly ProductoDePrueba[];
  readonly insumos: readonly InsumoDePrueba[];
  readonly recetas: readonly RecetaDePrueba[];
  /**
   * El proveedor con el que se surte.
   *
   * Sin uno, la pantalla de Compras y la de Entradas abren vacías y no hay forma
   * de registrar una entrada de mercancía: el comando pide proveedor.
   */
  readonly proveedor: ProveedorDePrueba;
  /**
   * El fondo con el que abre la caja.
   *
   * Sin caja abierta no se puede cobrar —`abrirCaja` es el primer paso de
   * cualquier venta—. El desglose importa: «$1,500» no dice si se puede
   * dar cambio (F-984).
   */
  readonly fondoCajaCentavos: bigint;
  readonly fondoMonedasCentavos: bigint;
  readonly fondoChicosCentavos: bigint;
  readonly fondoGrandesCentavos: bigint;
}

const RESTAURANTE: SemillaDePrueba = {
  categorias: ['Entradas', 'Platos fuertes', 'Tacos', 'Postres', 'Bebidas', 'Cervezas'],
  productos: [
    {
      nombre: 'Agua embotellada 600 ml',
      categoria: 'Bebidas',
      area: 'barra',
      sku: 'BEB-001',
      codigoBarras: '7501055300012',
      precioCentavos: 2500n,
      costoCentavos: 900n,
      stock: '48',
    },
    {
      nombre: 'Refresco de cola 355 ml',
      categoria: 'Bebidas',
      area: 'barra',
      sku: 'BEB-002',
      codigoBarras: '7501055363513',
      precioCentavos: 3500n,
      costoCentavos: 1400n,
      stock: '60',
    },
    {
      nombre: 'Cerveza clara 355 ml',
      categoria: 'Cervezas',
      area: 'barra',
      sku: 'CER-001',
      codigoBarras: '7501064191114',
      precioCentavos: 5500n,
      costoCentavos: 2200n,
      stock: '72',
    },
    {
      nombre: 'Cerveza oscura 355 ml',
      categoria: 'Cervezas',
      area: 'barra',
      sku: 'CER-002',
      codigoBarras: '7501064191121',
      precioCentavos: 6000n,
      costoCentavos: 2500n,
      stock: '36',
    },
    {
      nombre: 'Agua mineral 355 ml',
      categoria: 'Bebidas',
      sku: 'AGM-355',
      codigoBarras: '7501055300011',
      precioCentavos: 3500n,
      costoCentavos: 1850n,
      stock: '48',
      area: 'barra',
    },
    {
      nombre: 'Refresco de toronja 355 ml',
      categoria: 'Bebidas',
      sku: 'REF-TOR-355',
      codigoBarras: '7501055300028',
      precioCentavos: 3500n,
      costoCentavos: 1780n,
      stock: '36',
      area: 'barra',
    },
    {
      nombre: 'Limonada natural 500 ml',
      categoria: 'Bebidas',
      sku: 'LIM-500',
      precioCentavos: 4500n,
      costoCentavos: 1600n,
      stock: '30',
      area: 'barra',
    },
    {
      nombre: 'Michelada preparada 500 ml',
      categoria: 'Cervezas',
      sku: 'MIC-500',
      precioCentavos: 8900n,
      costoCentavos: 3400n,
      stock: '24',
      area: 'barra',
    },
    {
      nombre: 'Flan napolitano',
      categoria: 'Postres',
      sku: 'FLA-001',
      precioCentavos: 7500n,
      costoCentavos: 2900n,
      stock: '12',
      area: 'cocina',
    },
    {
      nombre: 'Pastel de tres leches',
      categoria: 'Postres',
      sku: 'TRE-001',
      precioCentavos: 8900n,
      costoCentavos: 3600n,
      stock: '10',
      area: 'cocina',
    },
  ],
  insumos: [
    { clave: 'arrachera', nombre: 'Arrachera', unidad: 'g', costoCentavos: 32n, stock: '18000' },
    { clave: 'pollo', nombre: 'Pechuga de pollo', unidad: 'g', costoCentavos: 14n, stock: '22000' },
    { clave: 'pastor', nombre: 'Carne al pastor', unidad: 'g', costoCentavos: 19n, stock: '15000' },
    {
      clave: 'tortilla',
      nombre: 'Tortilla de maíz',
      unidad: 'pieza',
      costoCentavos: 70n,
      stock: '600',
    },
    { clave: 'queso', nombre: 'Queso Oaxaca', unidad: 'g', costoCentavos: 22n, stock: '9000' },
    { clave: 'aguacate', nombre: 'Aguacate', unidad: 'g', costoCentavos: 12n, stock: '7000' },
    { clave: 'jitomate', nombre: 'Jitomate', unidad: 'g', costoCentavos: 4n, stock: '12000' },
    { clave: 'cebolla', nombre: 'Cebolla blanca', unidad: 'g', costoCentavos: 3n, stock: '10000' },
    {
      clave: 'frijol',
      nombre: 'Frijol bayo cocido',
      unidad: 'g',
      costoCentavos: 5n,
      stock: '14000',
    },
    { clave: 'arroz', nombre: 'Arroz rojo', unidad: 'g', costoCentavos: 3n, stock: '13000' },
    { clave: 'totopo', nombre: 'Totopo de maíz', unidad: 'g', costoCentavos: 9n, stock: '5000' },
    { clave: 'crema', nombre: 'Crema ácida', unidad: 'ml', costoCentavos: 6n, stock: '6000' },
    { clave: 'limon', nombre: 'Limón', unidad: 'pieza', costoCentavos: 150n, stock: '200' },
    { clave: 'azucar', nombre: 'Azúcar', unidad: 'g', costoCentavos: 3n, stock: '9000' },
    { clave: 'jamaica', nombre: 'Flor de jamaica', unidad: 'g', costoCentavos: 28n, stock: '2500' },
    {
      clave: 'chocolate',
      nombre: 'Chocolate de mesa',
      unidad: 'g',
      costoCentavos: 24n,
      stock: '3000',
    },
    { clave: 'harina', nombre: 'Harina de trigo', unidad: 'g', costoCentavos: 3n, stock: '11000' },
    { clave: 'huevo', nombre: 'Huevo', unidad: 'pieza', costoCentavos: 380n, stock: '180' },
    {
      clave: 'camaron',
      nombre: 'Camarón mediano limpio',
      unidad: 'g',
      costoCentavos: 48n,
      stock: '3000',
    },
    {
      clave: 'pulpo',
      nombre: 'Pulpo cocido',
      unidad: 'g',
      costoCentavos: 62n,
      stock: '2000',
    },
    {
      clave: 'chile_poblano',
      nombre: 'Chile poblano',
      unidad: 'pieza',
      costoCentavos: 1200n,
      stock: '30',
    },
    {
      clave: 'elote',
      nombre: 'Grano de elote',
      unidad: 'g',
      costoCentavos: 6n,
      stock: '5000',
    },
    {
      clave: 'nopal',
      nombre: 'Nopal limpio',
      unidad: 'g',
      costoCentavos: 4n,
      stock: '4000',
    },
  ],
  recetas: [
    {
      nombre: 'Guacamole con totopos',
      categoria: 'Entradas',
      area: 'cocina',
      precioCentavos: 12500n,
      ingredientes: [
        { clave: 'aguacate', cantidad: '180' },
        { clave: 'jitomate', cantidad: '60' },
        { clave: 'cebolla', cantidad: '30' },
        { clave: 'limon', cantidad: '1' },
        { clave: 'totopo', cantidad: '80' },
      ],
    },
    {
      nombre: 'Queso fundido',
      categoria: 'Entradas',
      area: 'cocina',
      precioCentavos: 14500n,
      ingredientes: [
        { clave: 'queso', cantidad: '220' },
        { clave: 'tortilla', cantidad: '4' },
      ],
    },
    {
      nombre: 'Arrachera al carbón',
      categoria: 'Platos fuertes',
      area: 'cocina',
      precioCentavos: 32900n,
      ingredientes: [
        { clave: 'arrachera', cantidad: '280' },
        { clave: 'frijol', cantidad: '150' },
        { clave: 'arroz', cantidad: '150' },
        { clave: 'tortilla', cantidad: '4' },
      ],
    },
    {
      nombre: 'Pollo a la plancha',
      categoria: 'Platos fuertes',
      area: 'cocina',
      precioCentavos: 21500n,
      ingredientes: [
        { clave: 'pollo', cantidad: '260' },
        { clave: 'arroz', cantidad: '150' },
        { clave: 'jitomate', cantidad: '80' },
      ],
    },
    {
      nombre: 'Enchiladas de pollo',
      categoria: 'Platos fuertes',
      area: 'cocina',
      precioCentavos: 18900n,
      ingredientes: [
        { clave: 'pollo', cantidad: '150' },
        { clave: 'tortilla', cantidad: '4' },
        { clave: 'queso', cantidad: '60' },
        { clave: 'crema', cantidad: '60' },
        { clave: 'jitomate', cantidad: '120' },
      ],
    },
    {
      nombre: 'Orden de tacos al pastor',
      categoria: 'Tacos',
      area: 'cocina',
      precioCentavos: 11900n,
      ingredientes: [
        { clave: 'pastor', cantidad: '180' },
        { clave: 'tortilla', cantidad: '5' },
        { clave: 'cebolla', cantidad: '40' },
        { clave: 'limon', cantidad: '1' },
      ],
    },
    {
      nombre: 'Orden de tacos de arrachera',
      categoria: 'Tacos',
      area: 'cocina',
      precioCentavos: 16500n,
      ingredientes: [
        { clave: 'arrachera', cantidad: '160' },
        { clave: 'tortilla', cantidad: '5' },
        { clave: 'cebolla', cantidad: '40' },
      ],
    },
    {
      nombre: 'Agua de jamaica 1 L',
      categoria: 'Bebidas',
      area: 'barra',
      precioCentavos: 7500n,
      ingredientes: [
        { clave: 'jamaica', cantidad: '30' },
        { clave: 'azucar', cantidad: '90' },
      ],
    },
    {
      nombre: 'Churros con chocolate',
      categoria: 'Postres',
      area: 'cocina',
      precioCentavos: 9900n,
      ingredientes: [
        { clave: 'harina', cantidad: '120' },
        { clave: 'azucar', cantidad: '40' },
        { clave: 'huevo', cantidad: '1' },
        { clave: 'chocolate', cantidad: '40' },
      ],
    },
    {
      nombre: 'Flan de la casa',
      categoria: 'Postres',
      area: 'cocina',
      precioCentavos: 8500n,
      ingredientes: [
        { clave: 'huevo', cantidad: '2' },
        { clave: 'azucar', cantidad: '70' },
        { clave: 'crema', cantidad: '80' },
      ],
    },
    {
      nombre: 'Sopa de tortilla',
      categoria: 'Entradas',
      precioCentavos: 11500n,
      area: 'cocina',
      ingredientes: [
        { clave: 'tortilla', cantidad: '3' },
        { clave: 'jitomate', cantidad: '150' },
        { clave: 'crema', cantidad: '40' },
      ],
    },
    {
      nombre: 'Coctel de camarón',
      categoria: 'Entradas',
      precioCentavos: 18900n,
      area: 'cocina',
      ingredientes: [
        { clave: 'camaron', cantidad: '180' },
        { clave: 'jitomate', cantidad: '120' },
        { clave: 'cebolla', cantidad: '50' },
        { clave: 'aguacate', cantidad: '120' },
      ],
    },
    {
      nombre: 'Tacos de camarón (orden de 3)',
      categoria: 'Tacos',
      precioCentavos: 16900n,
      area: 'cocina',
      ingredientes: [
        { clave: 'camaron', cantidad: '150' },
        { clave: 'tortilla', cantidad: '3' },
        { clave: 'cebolla', cantidad: '30' },
      ],
    },
    {
      nombre: 'Tacos de nopal (orden de 3)',
      categoria: 'Tacos',
      precioCentavos: 10900n,
      area: 'cocina',
      ingredientes: [
        { clave: 'nopal', cantidad: '180' },
        { clave: 'tortilla', cantidad: '3' },
        { clave: 'cebolla', cantidad: '30' },
      ],
    },
    {
      nombre: 'Chiles rellenos de queso',
      categoria: 'Platos fuertes',
      precioCentavos: 21900n,
      area: 'cocina',
      ingredientes: [
        { clave: 'chile_poblano', cantidad: '2' },
        { clave: 'queso', cantidad: '120' },
        { clave: 'jitomate', cantidad: '150' },
      ],
    },
    {
      nombre: 'Pulpo a las brasas',
      categoria: 'Platos fuertes',
      precioCentavos: 32900n,
      area: 'cocina',
      ingredientes: [
        { clave: 'pulpo', cantidad: '220' },
        { clave: 'cebolla', cantidad: '60' },
        { clave: 'elote', cantidad: '120' },
      ],
    },
    {
      nombre: 'Esquites con queso',
      categoria: 'Entradas',
      precioCentavos: 8900n,
      area: 'cocina',
      ingredientes: [
        { clave: 'elote', cantidad: '250' },
        { clave: 'queso', cantidad: '40' },
        { clave: 'crema', cantidad: '30' },
      ],
    },
  ],
  proveedor: {
    nombre: 'Central de Abasto · bodega 214',
    contacto: 'Chuy Gaytán',
    telefono: '5512349876',
    diasVisita: [1, 3, 5],
    diasCredito: 15,
  },
  fondoCajaCentavos: 300000n,
  fondoMonedasCentavos: 50000n,
  fondoChicosCentavos: 150000n,
  fondoGrandesCentavos: 100000n,
};

/**
 * ESTÉTICA · el arquetipo A3, que vende TIEMPO y no piezas.
 *
 * Hasta el 17-09-2026 este giro caía en la semilla de abarrotes: una estética de
 * demostración abría con tortillas, frijol y huevo en su catálogo. No era un
 * detalle cosmético — las doce pantallas del modelo leen servicios con duración,
 * y sin una sola fila en `servicios` la agenda no tiene nada que colocar y el
 * catálogo abre vacío.
 *
 * Los precios son de un salón de barrio en septiembre de 2026, y las duraciones
 * están tomadas de la tabla de `04-INTERFAZ.md §4.2` del modelo.
 */

/** La semilla del restaurante de prueba. */
export function semillaDePrueba(): SemillaDePrueba {
  return RESTAURANTE;
}
