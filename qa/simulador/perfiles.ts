/**
 * LOS SIETE DÍAS DE LA SEMANA SIMULADA: su fecha del negocio, la velocidad del reloj y lo que hace
 * cada rol. Todo es dato: misma semilla y mismo perfil, mismo día.
 *
 * Los minutos (`enMinuto`) cuentan desde que el bot arranca, a las 8:00 simuladas. El día abre a las
 * 8:00, las llegadas acaban a las 18:15 y el día termina cuando, pasadas las 19:00, ya no queda
 * nadie en las mesas ni nada por cobrar (con un tope a las 20:30).
 *
 * Mínimos de un día normal (encargo DP-18, 2.4): ≥120 cuentas de mesa, ≥25 para llevar, ≥700
 * platillos, ≥60 pedidos del portal, ≥10 uniones, divisiones y cambios de mesa, ≥15
 * cancelaciones, ≥20 descuentos, ≥8 retiros, ≥3 gastos, ≥2 compras y ≥3 mermas.
 */
import type { PlanDeAlmacen } from './bots/almacen.ts';
import type { PlanDeCaja } from './bots/caja.ts';
import type { PlanDeGerente } from './bots/gerente.ts';
import type { PerfilDelDia } from './horario.ts';

export type NombreDelPerfil =
  | 'normal'
  | 'pico-fin-de-semana'
  | 'red-mala'
  | 'configuracion-en-vivo'
  | 'tranquilo'
  | 'pico-con-traslado'
  | 'pico-final';

export interface DiaDeLaSemana {
  readonly dia: number;
  readonly perfil: NombreDelPerfil;
  /** La fecha del negocio (AAAA-MM-DD, CDMX). */
  readonly fecha: string;
  /** Minutos simulados por minuto real: más bajo en los picos para que la laptop alcance. */
  readonly factor: number;
  readonly llegadas: PerfilDelDia;
  /** Cuántos teléfonos de comensales a la vez, como mucho. */
  readonly telefonos: number;
  readonly cajas: readonly PlanDeCaja[];
  readonly gerente: PlanDeGerente;
  readonly almacen: PlanDeAlmacen;
  /** Minuto del caos de la entrada (PIN equivocado, sesión vencida, cambio de usuario). */
  readonly caosEnMinuto: number;
  /** Minuto de la disputa de dos cajas por la misma cuenta. */
  readonly disputaEnMinuto: number;
}

type CaosDeCaja = NonNullable<PlanDeCaja['caos']>[number];

const CAOS_DE_SIEMPRE: readonly CaosDeCaja[] = [
  { cuentaNumero: 4, tipo: 'recargar' },
  { cuentaNumero: 9, tipo: 'doble-toque' },
];
const CAOS_DE_LA_SEGUNDA: readonly CaosDeCaja[] = [
  { cuentaNumero: 6, tipo: 'cerrar-pestana' },
  { cuentaNumero: 12, tipo: 'red' },
];
/** La red mala: cada cajera pierde la red varias veces a lo largo del día. */
const RED_MALA: readonly CaosDeCaja[] = [3, 11, 19, 27, 35, 43].map((n) => ({
  cuentaNumero: n,
  tipo: 'red' as const,
}));

function cajaUno(opciones: { caos?: readonly CaosDeCaja[]; paraLlevar?: number } = {}): PlanDeCaja {
  return {
    caja: 'Caja 1',
    persona: 'Caja',
    aparato: 'pc-1920',
    fondoCentavos: 150_000,
    retiros: [
      { enMinuto: 150, centavos: 80_000, aDondeVa: 'al banco' },
      { enMinuto: 300, centavos: 40_000, aDondeVa: 'caja fuerte' },
      { enMinuto: 390, centavos: 120_000, aDondeVa: 'al banco' },
      { enMinuto: 480, centavos: 30_000, aDondeVa: 'caja fuerte' },
      { enMinuto: 570, centavos: 90_000, aDondeVa: 'al banco' },
    ],
    entradas: [{ enMinuto: 45, centavos: 50_000 }],
    alCerrar: 'faltante',
    paraLlevar: opciones.paraLlevar ?? 0.06,
    caos: opciones.caos ?? CAOS_DE_SIEMPRE,
  };
}

function cajaDos(
  opciones: { traslado?: boolean; caos?: readonly CaosDeCaja[]; paraLlevar?: number } = {},
): PlanDeCaja {
  return {
    caja: 'Caja 2',
    persona: 'Caja 2',
    aparato: 'tableta-1024',
    fondoCentavos: 100_000,
    ...(opciones.traslado === false ? {} : { traslado: { aparato: 'tableta-768', enMinuto: 330 } }),
    retiros: [
      { enMinuto: 200, centavos: 25_000, aDondeVa: 'pago a proveedor' },
      { enMinuto: 360, centavos: 60_000, aDondeVa: 'al banco' },
      { enMinuto: 450, centavos: 35_000, aDondeVa: 'caja fuerte' },
      { enMinuto: 540, centavos: 70_000, aDondeVa: 'al banco' },
    ],
    entradas: [{ enMinuto: 240, centavos: 30_000 }],
    alCerrar: 'sobrante',
    paraLlevar: opciones.paraLlevar ?? 0.05,
    cierraDespuesDe: 1,
    caos: opciones.caos ?? CAOS_DE_LA_SEGUNDA,
  };
}

function gerenteDe(opciones: { enVivo: boolean }): PlanDeGerente {
  return {
    aparato: 'tableta-1024',
    gastos: [
      { enMinuto: 60, pesos: 350, descripcion: 'Garrafones de agua', metodo: 'Transferencia' },
      { enMinuto: 270, pesos: 1_200, descripcion: 'Gas del día', metodo: 'Tarjeta' },
      {
        enMinuto: 500,
        pesos: 480,
        descripcion: 'Servilletas y desechables',
        metodo: 'Transferencia',
      },
    ],
    compras: [
      { enMinuto: 30, insumo: 'Carne de prueba', cantidad: 8 },
      { enMinuto: 240, insumo: 'Tortilla de prueba', cantidad: 200 },
      { enMinuto: 420, insumo: 'Pulque de prueba', cantidad: 10 },
    ],
    agotado: { producto: 'Flan de prueba', desdeMinuto: 300, hastaMinuto: 600 },
    ...(opciones.enVivo
      ? {
          modoDelMenu: { enMinuto: 180, vuelveEnMinuto: 420 },
          precio: {
            producto: 'Pulque curado de prueba',
            enMinuto: 240,
            antesPesos: 60,
            despuesPesos: 62,
          },
        }
      : {}),
  };
}

const ALMACEN: PlanDeAlmacen = {
  compras: [{ enMinuto: 90, insumo: 'Pan de prueba', cantidad: 40 }],
  mermas: [
    { enMinuto: 120, insumo: 'Pan de prueba', cantidadBase: 2, motivo: 'Pan duro del turno' },
    { enMinuto: 330, insumo: 'Leche de prueba', cantidadBase: 500, motivo: 'Leche cortada' },
    { enMinuto: 560, insumo: 'Tortilla de prueba', cantidadBase: 12, motivo: 'Tortillas rotas' },
  ],
  conteos: [{ enMinuto: 600, insumo: 'Leche de prueba', faltanteBase: 250 }],
};

const NORMAL = { cuentas: 130, proporcionQr: 0.55, celebracion: 0.07 } as const;

/** La semana: del viernes 20 al jueves 26 de noviembre de 2026 (el día 0 es el jueves 19). */
export const SEMANA: readonly DiaDeLaSemana[] = [
  {
    dia: 1,
    perfil: 'normal',
    fecha: '2026-11-20',
    factor: 3,
    llegadas: NORMAL,
    telefonos: 20,
    cajas: [cajaUno(), cajaDos()],
    gerente: gerenteDe({ enVivo: false }),
    almacen: ALMACEN,
    caosEnMinuto: 200,
    disputaEnMinuto: 350,
  },
  {
    dia: 2,
    perfil: 'pico-fin-de-semana',
    fecha: '2026-11-21',
    factor: 2.5,
    llegadas: { cuentas: 260, proporcionQr: 0.6, celebracion: 0.12 },
    telefonos: 25,
    cajas: [cajaUno({ paraLlevar: 0.1 }), cajaDos({ paraLlevar: 0.08 })],
    gerente: gerenteDe({ enVivo: false }),
    almacen: ALMACEN,
    caosEnMinuto: 240,
    disputaEnMinuto: 400,
  },
  {
    dia: 3,
    perfil: 'red-mala',
    fecha: '2026-11-22',
    factor: 3,
    llegadas: NORMAL,
    telefonos: 20,
    cajas: [
      cajaUno({ caos: [...CAOS_DE_SIEMPRE, ...RED_MALA] }),
      cajaDos({ caos: [...CAOS_DE_LA_SEGUNDA, ...RED_MALA] }),
    ],
    gerente: gerenteDe({ enVivo: false }),
    almacen: ALMACEN,
    caosEnMinuto: 200,
    disputaEnMinuto: 350,
  },
  {
    dia: 4,
    perfil: 'configuracion-en-vivo',
    fecha: '2026-11-23',
    factor: 3,
    llegadas: NORMAL,
    telefonos: 20,
    cajas: [cajaUno(), cajaDos()],
    gerente: gerenteDe({ enVivo: true }),
    almacen: ALMACEN,
    caosEnMinuto: 200,
    disputaEnMinuto: 350,
  },
  {
    dia: 5,
    perfil: 'tranquilo',
    fecha: '2026-11-24',
    factor: 4,
    llegadas: { cuentas: 70, proporcionQr: 0.5, celebracion: 0.05 },
    telefonos: 15,
    cajas: [cajaUno({ paraLlevar: 0.05 }), cajaDos({ traslado: false, paraLlevar: 0.04 })],
    gerente: gerenteDe({ enVivo: false }),
    almacen: ALMACEN,
    caosEnMinuto: 200,
    disputaEnMinuto: 350,
  },
  {
    dia: 6,
    perfil: 'pico-con-traslado',
    fecha: '2026-11-25',
    factor: 2.5,
    llegadas: { cuentas: 200, proporcionQr: 0.6, celebracion: 0.08 },
    telefonos: 25,
    cajas: [cajaUno({ paraLlevar: 0.08 }), cajaDos({ traslado: true, paraLlevar: 0.08 })],
    gerente: gerenteDe({ enVivo: false }),
    almacen: ALMACEN,
    caosEnMinuto: 240,
    disputaEnMinuto: 380,
  },
  {
    dia: 7,
    perfil: 'pico-final',
    fecha: '2026-11-26',
    factor: 2.5,
    llegadas: { cuentas: 260, proporcionQr: 0.6, celebracion: 0.12 },
    telefonos: 25,
    cajas: [
      cajaUno({ caos: [...CAOS_DE_SIEMPRE, ...RED_MALA.slice(0, 3)], paraLlevar: 0.1 }),
      cajaDos({ caos: [...CAOS_DE_LA_SEGUNDA, ...RED_MALA.slice(3)], paraLlevar: 0.08 }),
    ],
    gerente: gerenteDe({ enVivo: true }),
    almacen: ALMACEN,
    caosEnMinuto: 240,
    disputaEnMinuto: 400,
  },
];

export function diaDeLaSemana(dia: number): DiaDeLaSemana {
  const encontrado = SEMANA.find((d) => d.dia === dia);
  if (encontrado === undefined) throw new Error(`No hay día ${String(dia)} en la semana (1 a 7).`);
  return encontrado;
}
