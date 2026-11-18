/**
 * EL PERFIL `dp22`: «EL DÍA DE BOTS», un día completo de 8:00 a 19:00 con pocos aparatos TÁCTILES a la
 * vez (la Caja en Windows 1366×768 al 125 %, un mesero en teléfono, otro en tableta, la Cocina en el
 * iMin con Chromium 99, el comensal en teléfono y el dueño o la gerente en Windows 1920×1080), todo
 * por pantallas y con el dedo. No es la semana de 45 aparatos: lo que importa es la MEZCLA, el CAOS
 * programado y que el árbitro de cada hora diga que cuadra.
 *
 * Todo es dato (misma semilla y mismo perfil, mismo día). Los minutos cuentan desde las 8:00
 * simuladas. El caos es una lista con id para que el informe diga EXACTO qué se ejecutó y qué no.
 */
import type { NombreDeAparato } from './aparatos.ts';
import type { PlanDeAlmacen } from './bots/almacen.ts';
import type { PlanDeCaja } from './bots/caja.ts';
import type { PlanDeGerente } from './bots/gerente.ts';
import type { PerfilDelDia } from './horario.ts';

/** El número con el que el día de bots vive en la carpeta de salida, el libro y los id de incidente. */
export const DIA_DE_BOTS = 22;

/** Segunda vez que se corre un día: la fecha del negocio es la misma, el clon de la base es otro. */
export const FECHA_DEL_DIA_DE_BOTS = '2026-11-20';

/** Minutos simulados por minuto real. A ×6 los meseros no alcanzaban 130 grupos; aquí son ~64. */
export const FACTOR_DEL_DIA_DE_BOTS = 4;

export const LLEGADAS_DEL_DIA_DE_BOTS: PerfilDelDia = {
  cuentas: 64,
  proporcionQr: 0.45,
  celebracion: 0.08,
};

/** El árbitro corre cada hora simulada, de las 9:00 a las 19:00 (el cierre lo corre aparte). */
export const HORAS_DEL_ARBITRO: readonly number[] = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];

/** Los aparatos de cada papel (ids del arnés `pruebas/e2e/qa-final/arnes/aparatos.ts`). */
export const APARATOS_DEL_DIA = {
  caja: 'win-1366x768-125',
  meseroTelefono: 'telefono-360x800',
  meseroTableta: 'tableta-800x1280',
  cocina: 'imin-1920x1080-c99',
  comensal: 'telefono-390x844',
  dueno: 'win-1920x1080-100',
} as const satisfies Record<string, NombreDeAparato>;

/**
 * Lo que piden los bots de la semana por nombre y aquí es OTRO aparato (todos táctiles). El
 * lanzador lo aplica en `nuevoContexto`; las estaciones y los meseros se piden ya con su aparato.
 */
export const SUSTITUTOS_DEL_DIA: Readonly<Partial<Record<NombreDeAparato, NombreDeAparato>>> = {
  'pc-1920': APARATOS_DEL_DIA.dueno,
  'tableta-1024': APARATOS_DEL_DIA.caja,
  'tableta-768': APARATOS_DEL_DIA.meseroTableta,
  'android-412': APARATOS_DEL_DIA.comensal,
  iphone: APARATOS_DEL_DIA.comensal,
  'android-360': APARATOS_DEL_DIA.meseroTelefono,
};

export interface MeseroDelDia {
  readonly persona: string;
  readonly aparato: NombreDeAparato;
  readonly entra: number;
  /** Sólo el que se crea a media jornada: espera a que la dueña lo dé de alta. */
  readonly nuevoACadaMediaJornada?: true;
}

export const MESEROS_DEL_DIA: readonly MeseroDelDia[] = [
  { persona: 'Mesero 1', aparato: APARATOS_DEL_DIA.meseroTelefono, entra: 15 },
  { persona: 'Mesero 2', aparato: APARATOS_DEL_DIA.meseroTableta, entra: 18 },
  {
    persona: 'Mesero 7',
    aparato: APARATOS_DEL_DIA.meseroTelefono,
    entra: 250,
    nuevoACadaMediaJornada: true,
  },
];

export const ESTACIONES_DEL_DIA: readonly { persona: string; estacion: string }[] = [
  { persona: 'Cocina', estacion: 'Cocina' },
  { persona: 'Bebidas', estacion: 'Bebidas' },
  { persona: 'Cocina Parrilla', estacion: 'Parrilla' },
  { persona: 'Cocina Postres', estacion: 'Postres' },
  { persona: 'Cocina Pulques', estacion: 'Pulques' },
];

type CaosDeCaja = NonNullable<PlanDeCaja['caos']>[number];

const CAOS_CAJA_UNO: readonly CaosDeCaja[] = [
  { cuentaNumero: 3, tipo: 'recargar' },
  { cuentaNumero: 7, tipo: 'doble-toque' },
  { cuentaNumero: 11, tipo: 'red' },
  { cuentaNumero: 15, tipo: 'cerrar-pestana' },
  { cuentaNumero: 21, tipo: 'red' },
];
const CAOS_CAJA_DOS: readonly CaosDeCaja[] = [
  { cuentaNumero: 3, tipo: 'red' },
  { cuentaNumero: 6, tipo: 'recargar' },
  { cuentaNumero: 9, tipo: 'doble-toque' },
];

export const CAJA_UNO: PlanDeCaja = {
  caja: 'Caja 1',
  persona: 'Caja',
  aparato: APARATOS_DEL_DIA.caja,
  fondoCentavos: 150_000,
  retiros: [
    { enMinuto: 170, centavos: 80_000, aDondeVa: 'al banco' },
    { enMinuto: 330, centavos: 40_000, aDondeVa: 'caja fuerte' },
    { enMinuto: 430, centavos: 120_000, aDondeVa: 'al banco' },
    { enMinuto: 560, centavos: 90_000, aDondeVa: 'al banco' },
  ],
  entradas: [{ enMinuto: 60, centavos: 50_000 }],
  alCerrar: 'faltante',
  paraLlevar: 0.1,
  caos: CAOS_CAJA_UNO,
};

/** La segunda caja entra a las 12:40 (el cupo pasa de 1 a 2 a las 12:30) y su aparato cambia a las 15:00. */
export const ENTRA_LA_CAJA_DOS = 280;
export const CAJA_DOS: PlanDeCaja = {
  caja: 'Caja 2',
  persona: 'Caja 2',
  aparato: APARATOS_DEL_DIA.caja,
  traslado: { aparato: APARATOS_DEL_DIA.dueno, enMinuto: 420 },
  fondoCentavos: 100_000,
  retiros: [
    { enMinuto: 340, centavos: 25_000, aDondeVa: 'pago a proveedor' },
    { enMinuto: 470, centavos: 60_000, aDondeVa: 'al banco' },
  ],
  entradas: [{ enMinuto: 360, centavos: 30_000 }],
  alCerrar: 'sobrante',
  paraLlevar: 0.08,
  cierraDespuesDe: 1,
  caos: CAOS_CAJA_DOS,
};

export const GERENTE_DEL_DIA: PlanDeGerente = {
  aparato: APARATOS_DEL_DIA.dueno,
  gastos: [
    { enMinuto: 70, pesos: 350, descripcion: 'Garrafones de agua', metodo: 'Transferencia' },
    { enMinuto: 330, pesos: 1_200, descripcion: 'Gas del día', metodo: 'Tarjeta' },
    {
      enMinuto: 500,
      pesos: 480,
      descripcion: 'Servilletas y desechables',
      metodo: 'Transferencia',
    },
  ],
  compras: [
    { enMinuto: 40, insumo: 'Carne de prueba', cantidad: 8 },
    { enMinuto: 300, insumo: 'Tortilla de prueba', cantidad: 200 },
    { enMinuto: 450, insumo: 'Pulque de prueba', cantidad: 10 },
  ],
  // Un platillo no disponible de las 12:00 a las 16:00.
  agotado: { producto: 'Flan de prueba', desdeMinuto: 240, hastaMinuto: 480 },
  // Un precio que cambia a las 13:00 y regresa a las 17:00 (lo ya pedido conserva el suyo).
  precio: {
    producto: 'Pulque curado de prueba',
    enMinuto: 300,
    antesPesos: 60,
    despuesPesos: 62,
    vuelveEnMinuto: 540,
  },
  // El menú del comensal cambia de modo de las 10:00 a las 11:30.
  modoDelMenu: { enMinuto: 120, vuelveEnMinuto: 210 },
};

export const ALMACEN_DEL_DIA: PlanDeAlmacen = {
  compras: [{ enMinuto: 100, insumo: 'Pan de prueba', cantidad: 40 }],
  mermas: [
    { enMinuto: 140, insumo: 'Pan de prueba', cantidadBase: 2, motivo: 'Pan duro del turno' },
    { enMinuto: 350, insumo: 'Leche de prueba', cantidadBase: 500, motivo: 'Leche cortada' },
    { enMinuto: 520, insumo: 'Tortilla de prueba', cantidadBase: 12, motivo: 'Tortillas rotas' },
  ],
  conteos: [{ enMinuto: 600, insumo: 'Leche de prueba', faltanteBase: 250 }],
};

export type TipoDeCaos =
  'configuracion' | 'salon' | 'catalogo' | 'personal' | 'portal' | 'caja' | 'red' | 'aparato';

/** Quién lo hace: la dueña en su pantalla (`dueno`), otro bot que ya existía (`bot`) o el propio plan de una caja. */
export type QuienHaceElCaos = 'dueno' | 'gerente' | 'caja' | 'mesero' | 'caos-de-entrada';

export interface PasoDeCaos {
  readonly id: string;
  readonly enMinuto: number;
  readonly tipo: TipoDeCaos;
  readonly que: string;
  readonly quien: QuienHaceElCaos;
  /** Un ajuste previo del día (no cuenta como caos): deja el negocio como lo encontró el bot. */
  readonly preparacion?: true;
}

/**
 * El calendario del caos. Lo que hace la dueña (`quien: 'dueno'`) lo ejecuta `bots/caos-dp22.ts`; lo
 * demás ya lo hacían la gerente, las cajas y los meseros (sus planes de arriba) y aquí se lista para
 * que el informe lo cuente por su id.
 */
export const CAOS_DEL_DIA: readonly PasoDeCaos[] = [
  // — Preparación (no es caos): las tres casillas de propina encendidas y UNA sola caja —
  {
    id: 'P1',
    enMinuto: 2,
    tipo: 'configuracion',
    que: 'Propina: la eligen comensales, mesero y Caja',
    quien: 'dueno',
    preparacion: true,
  },
  {
    id: 'P2',
    enMinuto: 3,
    tipo: 'caja',
    que: 'Cupo de cajas a 1',
    quien: 'dueno',
    preparacion: true,
  },
  {
    id: 'P3',
    enMinuto: 4,
    tipo: 'salon',
    que: 'Repartir las 20 mesas entre Mesero 1 y Mesero 2',
    quien: 'dueno',
    preparacion: true,
  },
  // — Configuración a media operación, y su regreso —
  {
    id: 'C1',
    enMinuto: 90,
    tipo: 'configuracion',
    que: 'IVA de 16 % a 8 % con cuentas abiertas',
    quien: 'dueno',
  },
  { id: 'C1r', enMinuto: 150, tipo: 'configuracion', que: 'IVA de vuelta a 16 %', quien: 'dueno' },
  {
    id: 'C2',
    enMinuto: 105,
    tipo: 'configuracion',
    que: 'Propina: el mesero deja de elegirla',
    quien: 'dueno',
  },
  {
    id: 'C2r',
    enMinuto: 165,
    tipo: 'configuracion',
    que: 'Propina: el mesero vuelve a elegirla',
    quien: 'dueno',
  },
  {
    id: 'C3',
    enMinuto: 120,
    tipo: 'configuracion',
    que: 'El menú del comensal pasa a «A la carta»',
    quien: 'gerente',
  },
  {
    id: 'C3r',
    enMinuto: 210,
    tipo: 'configuracion',
    que: 'El menú del comensal vuelve a «Menú digital»',
    quien: 'gerente',
  },
  {
    id: 'C4',
    enMinuto: 240,
    tipo: 'catalogo',
    que: 'Un platillo no disponible (Flan de prueba)',
    quien: 'gerente',
  },
  {
    id: 'C4r',
    enMinuto: 480,
    tipo: 'catalogo',
    que: 'El platillo vuelve a estar disponible',
    quien: 'gerente',
  },
  {
    id: 'C5',
    enMinuto: 300,
    tipo: 'catalogo',
    que: 'Un precio cambia (Pulque curado de $60 a $62)',
    quien: 'gerente',
  },
  { id: 'C5r', enMinuto: 540, tipo: 'catalogo', que: 'El precio regresa a $60', quien: 'gerente' },
  {
    id: 'C6',
    enMinuto: 270,
    tipo: 'caja',
    que: 'Cupo de cajas de 1 a 2 (entra la Caja 2 a las 12:40)',
    quien: 'dueno',
  },
  {
    id: 'C7',
    enMinuto: 480,
    tipo: 'caja',
    que: 'La Caja 1 se llama «Mostrador» con las dos cajas abiertas',
    quien: 'dueno',
  },
  { id: 'C7r', enMinuto: 570, tipo: 'caja', que: 'La Caja 1 recupera su nombre', quien: 'dueno' },
  {
    id: 'C8',
    enMinuto: 420,
    tipo: 'portal',
    que: 'El portal del comensal se apaga con carritos abiertos',
    quien: 'dueno',
  },
  {
    id: 'C8r',
    enMinuto: 423,
    tipo: 'portal',
    que: 'El portal se enciende otra vez',
    quien: 'dueno',
  },
  // — Salón, catálogo y personal —
  {
    id: 'S1',
    enMinuto: 200,
    tipo: 'salon',
    que: 'Mover las mesas 3 y 14 de lugar en el editor',
    quien: 'dueno',
  },
  {
    id: 'S1r',
    enMinuto: 330,
    tipo: 'salon',
    que: 'Regresar las mesas 3 y 14 a su lugar',
    quien: 'dueno',
  },
  {
    id: 'K1',
    enMinuto: 180,
    tipo: 'catalogo',
    que: 'Una estación y una categoría nuevas a las 11:00',
    quien: 'dueno',
  },
  {
    id: 'K2',
    enMinuto: 360,
    tipo: 'catalogo',
    que: 'La categoría «Lo dulce» pasa de Postres a Cocina a las 14:00',
    quien: 'dueno',
  },
  {
    id: 'K2r',
    enMinuto: 450,
    tipo: 'catalogo',
    que: 'La categoría «Lo dulce» vuelve a Postres',
    quien: 'dueno',
  },
  {
    id: 'M1',
    enMinuto: 240,
    tipo: 'personal',
    que: 'Un mesero nuevo (Mesero 7) entra a medio día',
    quien: 'dueno',
  },
  {
    id: 'M2',
    enMinuto: 255,
    tipo: 'salon',
    que: 'Repartir mesas con el mesero nuevo',
    quien: 'dueno',
  },
  {
    id: 'M3',
    enMinuto: 540,
    tipo: 'personal',
    que: 'Un mesero (Mesero 2) se desactiva con mesas abiertas',
    quien: 'dueno',
  },
  // — Cajas, red y aparatos —
  {
    id: 'R1',
    enMinuto: 420,
    tipo: 'caja',
    que: 'La Caja 2 se trae de un aparato a otro («Trasladar aquí»)',
    quien: 'caja',
  },
  {
    id: 'N1',
    enMinuto: 0,
    tipo: 'red',
    que: 'Cortes de red de 30 a 60 s en el cobro de las cajas',
    quien: 'caja',
  },
  {
    id: 'N2',
    enMinuto: 0,
    tipo: 'red',
    que: 'Recargas y pestaña cerrada con el cobro abierto',
    quien: 'caja',
  },
  {
    id: 'A1',
    enMinuto: 330,
    tipo: 'aparato',
    que: 'La tableta del Mesero 2 se apaga 20 minutos y vuelve',
    quien: 'dueno',
  },
  {
    id: 'A2',
    enMinuto: 200,
    tipo: 'aparato',
    que: 'PIN equivocado, sesión vencida y cambio de usuario en un aparato',
    quien: 'caos-de-entrada',
  },
];

/** Quién se desactiva y cuándo se dan de alta los nuevos (para el caos de la dueña). */
export const PERSONAL_DEL_CAOS = {
  meseroNuevo: 'Mesero 7',
  meseroQueSeVa: 'Mesero 2',
  meseroQueSeApaga: 'Mesero 2',
  apagonEnMinuto: 330,
  apagonDura: 20,
  mesasQueSeMueven: [3, 14],
  estacionNueva: 'Estación de apoyo',
  categoriaNueva: 'Antojitos nuevos',
  categoriaQueSeReasigna: 'Lo dulce',
  estacionOriginal: 'Postres',
  estacionTemporal: 'Cocina',
  nombreDeLaCaja: 'Mostrador',
} as const;

/** El minuto del día (desde la medianoche) de un minuto del perfil (desde las 8:00). */
export const minutoDelReloj = (enMinuto: number): number => 8 * 60 + enMinuto;
