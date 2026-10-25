import 'server-only';

import {
  ErrorDominio,
  PAQUETES_MOSTRADOR,
  plantillaDeOrganizacion,
  type Rol,
} from '@morphiqpos/contracts';
import type { Transaccion } from '@morphiqpos/data';
import { diasHastaLaVisita, sugerirPedido } from '@morphiqpos/domain/inventario';
import { z } from 'zod';

import { sinCostosSiNoLosVe } from './sin-costos.ts';
import { definirComando } from '../../definicion.ts';
import * as consultas from './consultas.ts';
import { devolucionesDelCorte, type DevolucionDelCorte } from './devoluciones.ts';
import * as extras from './extras.ts';

/**
 * LA HOJA DEL CORTE (F-234, C.6 de la 2.4): todo lo que su PDF enseña, en una lectura.
 *
 * Las pantallas nuevas sólo exportaban CSV y el restaurante decía «descargar el PDF del
 * cierre» sin que existiera generador. Cada `02-DINERO-Y-CAJA.md` §9.3 describe su corte
 * sección por sección; éste es el dato de todas, y la pantalla de cada giro arma SU
 * documento con él (`apps/web/src/corte/`).
 *
 * ── Quién ve costos ──────────────────────────────────────────────────────
 * Dirección siempre; el cajero sólo si el negocio encendió `mostrar_costos_a_caja`. El
 * resto recibe los costos en nulo y el documento sale sin utilidad ni insumos, que es el
 * `sinCostos` del corte de Miguel. Cocina no entra: no es un rol de caja.
 *
 * ── Qué no hace ──────────────────────────────────────────────────────────
 * No calcula el esperado: lo lee de la sesión, que lo guardó al cerrar (D-16). Un corte
 * abierto lo trae en nulo y el documento lo dice.
 */

const ROLES_DE_CAJA = ['cajero', 'gerente', 'administrador', 'dueno'] as const;
const VEN_COSTOS: readonly Rol[] = ['dueno', 'administrador', 'gerente'];

export const entradaHojaDelCorte = z.object({ sesionCajaId: z.uuid() });

export interface NegocioDelCorte {
  readonly nombre: string;
  readonly direccion: string | null;
  readonly telefono: string | null;
  readonly correo: string | null;
  readonly rfc: string | null;
  readonly logoUrl: string | null;
  readonly marca: string;
  readonly pie: string | null;
  readonly descargarAlCerrar: boolean;
  /**
   * La tasa de la terminal bancaria, en puntos base SIN IVA, o nula si no se declaró. Con ella
   * el corte ESTIMA la comisión —y lo rotula—; sin ella no la inventa (C.10 de la 2.4).
   */
  readonly comisionTerminalBp: number | null;
}

/**
 * Lo propio del giro en el corte. POS Don Poncho sirve un solo giro (DP-2): el restaurante y
 * su propina por mesero. Las variantes de los otros cuatro giros se fueron con ellos.
 */
export interface ExtrasDelCorte {
  readonly plantilla: 'restaurante';
  readonly propinasPorMesero: readonly extras.PropinaDeMesero[];
}

export interface HojaDelCorte {
  readonly verCostos: boolean;
  readonly negocio: NegocioDelCorte;
  readonly sesion: consultas.SesionDelCorte;
  readonly movimientos: readonly consultas.MovimientoAgrupado[];
  readonly conteo: readonly consultas.PiezasContadas[];
  readonly metodos: readonly consultas.VentasPorMetodo[];
  readonly resumen: Omit<consultas.ResumenDeVentas, 'costoCentavos'> & {
    readonly costoCentavos: string | null;
  };
  readonly ventas: readonly consultas.VentaDelDetalle[];
  readonly productos: readonly (Omit<
    consultas.ProductoVendido,
    'costoCentavos' | 'margenObjetivoBp'
  > & {
    readonly costoCentavos: string | null;
    /** Con el precio, el margen objetivo DA el costo: se oculta igual. */
    readonly margenObjetivoBp: number | null;
  })[];
  readonly porPersona: readonly consultas.VentasDePersona[];
  readonly gastos: readonly consultas.GastoDelCorte[];
  readonly cancelaciones: readonly consultas.Cancelacion[];
  /**
   * Lo devuelto EN ESTA CAJA, de ventas de hoy o de otro día: resta de la venta del día en
   * que se hace. El costo de lo que regresó al almacén sólo para quien ve costos.
   */
  readonly devoluciones: readonly (Omit<DevolucionDelCorte, 'costoDevueltoCentavos'> & {
    readonly costoDevueltoCentavos: string | null;
  })[];
  readonly descuentosPorUsuario: readonly consultas.DescuentoDeUsuario[];
  readonly alertas: readonly AlertaDelCorte[];
  /** Consumo teórico de insumo. `null` para quien no ve costos. */
  readonly insumos: readonly consultas.InsumoConsumido[] | null;
  readonly salidasSinVenta: readonly (Omit<consultas.SalidaSinVenta, 'costoCentavos'> & {
    readonly costoCentavos: string | null;
  })[];
  readonly extras: ExtrasDelCorte;
}

export const hojaDelCorte = definirComando<Transaccion, typeof entradaHojaDelCorte, HojaDelCorte>({
  nombre: 'caja.hoja_del_corte',
  entidad: 'sesion_caja',
  escribe: false,
  roles: [...ROLES_DE_CAJA],
  paquetes: PAQUETES_MOSTRADOR,
  sucursal: { sesionCajaId: 'sesiones_caja' },
  entrada: entradaHojaDelCorte,
  async ejecutar(ctx, entrada) {
    const { organizacionId, rol } = ctx.ambito;
    const { tx } = ctx;

    const sesion = await ctx.paso('leer_sesion', () =>
      consultas.leerSesion(tx, organizacionId, entrada.sesionCajaId),
    );
    // Una sesión de otro negocio se ve igual que una que no existe.
    if (sesion === null) {
      throw new ErrorDominio('PUENTE_NO_ENCONTRADO', 'Ese corte no existe en este negocio.');
    }
    const crudo = await ctx.paso('leer_negocio', () => consultas.leerNegocio(tx, organizacionId));
    const valores = objetoDe(crudo.valores);
    const plantilla = plantillaDeOrganizacion(crudo.giro, crudo.paquete);
    const verCostos =
      VEN_COSTOS.includes(rol) || (rol === 'cajero' && valores['mostrar_costos_a_caja'] === true);

    const id = sesion.id;
    const [movimientos, conteo, metodos, resumen, ventas, productos, porPersona, gastos] =
      await ctx.paso('leer_tronco', () =>
        Promise.all([
          consultas.movimientosPorTipo(tx, organizacionId, id),
          consultas.conteoDelCierre(tx, organizacionId, id),
          consultas.ventasPorMetodo(tx, organizacionId, id),
          consultas.resumenDeVentas(tx, organizacionId, id),
          consultas.detalleDeVentas(tx, organizacionId, id),
          consultas.productosVendidos(tx, organizacionId, id),
          consultas.ventasPorPersona(tx, organizacionId, id),
          consultas.gastosDelCorte(tx, organizacionId, id),
        ]),
      );
    const [cancelaciones, descuentosPorUsuario, alertas, insumos, salidas, devoluciones] =
      await ctx.paso('leer_control', () =>
        Promise.all([
          consultas.cancelacionesDelCorte(tx, organizacionId, sesion),
          consultas.descuentosPorUsuario(tx, organizacionId, id),
          consultas.alertasDeInventario(tx, organizacionId, sesion.cerradaEn ?? ctx.ahora),
          consultas.insumosConsumidos(tx, organizacionId, id),
          consultas.salidasSinVenta(tx, organizacionId, sesion),
          devolucionesDelCorte(tx, organizacionId, id),
        ]),
      );
    const delGiro = await ctx.paso('leer_extras', () =>
      extrasDe(tx, organizacionId, plantilla, sesion),
    );

    // La última pasada: sin un solo costo para quien no los ve, por campo que se
    // olvidara arriba (`sin-costos.ts`).
    return sinCostosSiNoLosVe(
      {
        verCostos,
        negocio: negocioDe(crudo.nombre, valores, sesion),
        sesion,
        movimientos,
        conteo,
        metodos,
        resumen: { ...resumen, costoCentavos: verCostos ? resumen.costoCentavos : null },
        ventas,
        productos: productos.map((p) => ({
          ...p,
          costoCentavos: verCostos ? p.costoCentavos : null,
          margenObjetivoBp: verCostos ? p.margenObjetivoBp : null,
        })),
        porPersona,
        gastos,
        cancelaciones,
        devoluciones: devoluciones.map((d) => ({
          ...d,
          costoDevueltoCentavos: verCostos ? d.costoDevueltoCentavos : null,
        })),
        descuentosPorUsuario,
        alertas: alertas.map((a) =>
          alertaDelCorte(
            verCostos ? a : { ...a, costoUnitarioCentavos: null },
            sesion.cerradaEn ?? ctx.ahora,
          ),
        ),
        insumos: verCostos ? insumos : null,
        salidasSinVenta: salidas.map((s) => ({
          ...s,
          costoCentavos: verCostos ? s.costoCentavos : null,
        })),
        extras: delGiro,
      },
      verCostos,
    );
  },
});

/** Días de colchón sobre la visita del proveedor: el mismo del sugerido de compras. */
const DIAS_DE_COLCHON = 1;

export interface AlertaDelCorte extends consultas.Alerta {
  readonly diasHastaLaVisita: number | null;
  /** Presentaciones de compra que sugiere el mismo cálculo de «Entradas». */
  readonly presentacionesSugeridas: number;
  /** Cuántos días alcanza lo que queda al ritmo de un día como hoy. `null` sin consumo. */
  readonly diasQueAlcanza: number | null;
}

/**
 * Qué pedir y cuánto alcanza, con las MISMAS funciones del sugerido de compras
 * (`abarrotes/sugerencia.ts`): dos pantallas que dijeran cifras distintas para el mismo
 * insumo serían dos verdades.
 */
export function alertaDelCorte(alerta: consultas.Alerta, ahora: Date): AlertaDelCorte {
  const visita = diasHastaLaVisita(alerta.diaVisita ?? [], ahora);
  const factor =
    alerta.factorCompra !== null && Number(alerta.factorCompra) > 0 ? alerta.factorCompra : '1';
  const sugerencia = sugerirPedido({
    existenciaBase: alerta.existencia,
    stockMinimo: alerta.minimo,
    ventaDelPeriodoBase: alerta.ventaDeCatorceDias,
    diasDelPeriodo: 14,
    diasDeCobertura: (visita ?? 7) + DIAS_DE_COLCHON,
    factorCompra: factor,
  });
  const diario = Number(alerta.consumoDelMismoDia);
  return {
    ...alerta,
    diasHastaLaVisita: visita,
    presentacionesSugeridas: sugerencia.presentacionesSugeridas,
    diasQueAlcanza: diario > 0 ? Math.floor(Number(alerta.existencia) / diario) : null,
  };
}

async function extrasDe(
  tx: Transaccion,
  organizacionId: string,
  plantilla: string,
  sesion: consultas.SesionDelCorte,
): Promise<ExtrasDelCorte> {
  // Un negocio que no es restaurante no lo sirve este sistema: decirlo, no inventar un corte.
  if (plantilla !== 'restaurante') {
    throw new ErrorDominio(
      'CONFIGURACION_INVALIDA',
      'Este sistema sólo arma el corte de un restaurante.',
    );
  }
  return {
    plantilla,
    propinasPorMesero: await extras.propinasPorMesero(tx, organizacionId, sesion.id),
  };
}

function objetoDe(valor: unknown): Readonly<Record<string, unknown>> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
    ? (valor as Record<string, unknown>)
    : {};
}

function textoDe(valor: unknown): string | null {
  return typeof valor === 'string' && valor.trim() !== '' ? valor.trim() : null;
}

/**
 * Los datos del encabezado. El nombre es el de `organizaciones`, como en toda la
 * facturación; dirección y teléfono caen a los de la sucursal si la configuración no los
 * trae, porque un corte sin de quién es no se puede mandar al contador.
 */
export function negocioDe(
  nombre: string,
  valores: Readonly<Record<string, unknown>>,
  sesion: Pick<consultas.SesionDelCorte, 'sucursalDireccion' | 'sucursalTelefono'>,
): NegocioDelCorte {
  return {
    nombre,
    direccion: textoDe(valores['direccion']) ?? sesion.sucursalDireccion,
    telefono: textoDe(valores['telefono']) ?? sesion.sucursalTelefono,
    correo: textoDe(valores['correo']),
    rfc: textoDe(valores['rfc']),
    logoUrl: textoDe(valores['logo_pdf_url']) ?? textoDe(valores['logo_url']),
    marca: textoDe(valores['platform_brand']) ?? 'MorphiqPOS',
    pie: textoDe(valores['pdf_footer']),
    descargarAlCerrar: valores['descargar_pdf_corte_auto'] !== false,
    comisionTerminalBp: tasaDe(valores['comision_terminal_bp']),
  };
}

function tasaDe(valor: unknown): number | null {
  return typeof valor === 'number' && Number.isInteger(valor) && valor >= 0 && valor <= 1000
    ? valor
    : null;
}
