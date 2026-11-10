import {
  ajustesDeCaja,
  arqueo,
  centavos,
  datosDelCorte,
  dinero,
  folioDe,
  gastos,
  insumosConsumidos,
  inventarioBajo,
  metodosConPropina,
  nombreDeArchivo,
  productosVendidos,
  resumenFinanciero,
  tituloDelResumen,
  ventasDelDia,
  tablaSiHay,
  texto,
  totalDePropinas,
  type DocumentoDelCorte,
  type ExtrasDelServidor,
  type HojaDelServidor,
  type Seccion,
} from './hoja.ts';
import { cancelaciones } from './cancelaciones.ts';
import { ventasPorCanal } from './por-canal.ts';
import { retirosConPin } from './retiros-con-pin.ts';
import { devolucionesDelDia } from './devoluciones.ts';
import { seccionesDeDescuentos } from './descuentos.ts';
import type { DescuentosLeidos } from '~/corte-heredado/descuentos-del-corte';

/**
 * EL CORTE DEL RESTAURANTE (C.6 de la 2.4): ¿cuadró la caja, y cuánto le toca a cada mesero?
 *
 * Sigue, en orden, el §9.3 de su `02-DINERO-Y-CAJA.md`. Lo que se repite vive en `hoja.ts`.
 * POS Don Poncho (DP-2) sirve un solo giro: los cortes de los otros cuatro se fueron con ellos.
 */

function documento(
  hoja: HojaDelServidor,
  titulo: string,
  secciones: readonly Seccion[],
  firmaDeCaja = 'Responsable de caja',
): DocumentoDelCorte {
  const folio = folioDe(hoja.sesion);
  return {
    titulo,
    negocio: hoja.negocio,
    folio,
    secciones,
    firmaDeCaja,
    responsable: hoja.sesion.cerro,
    nombreDeArchivo: nombreDeArchivo(hoja.negocio.nombre, titulo, folio),
  };
}

// ── Restaurante ─────────────────────────────────────────────────────────────

export function corteDeRestaurante(
  hoja: HojaDelServidor,
  extras: ExtrasDelServidor,
  descuentos: DescuentosLeidos | null = null,
): DocumentoDelCorte {
  const propinas = totalDePropinas(hoja);
  const ventas = centavos(hoja.resumen.totalCentavos);
  const seccionesDePropina: Seccion[] =
    propinas === 0
      ? []
      : [
          {
            tipo: 'celdas',
            titulo: 'Propinas',
            celdas: [
              { etiqueta: 'Total propinas', valor: dinero(propinas), fuerte: true },
              { etiqueta: 'Ventas reales sin propina', valor: dinero(ventas) },
              {
                etiqueta: 'Total cobrado con propina',
                valor: dinero(ventas + propinas),
                fuerte: true,
              },
            ],
          },
          ...tablaSiHay({
            tipo: 'tabla',
            titulo: 'Propinas por mesero',
            columnas: [
              { titulo: 'Mesero' },
              { titulo: 'Cuentas', numerica: true },
              { titulo: 'Propinas', numerica: true },
            ],
            filas: extras.propinasPorMesero.map((m) => [
              texto(m.mesero ?? 'Sin mesero'),
              texto(m.cuentas),
              dinero(m.propinaCentavos),
            ]),
          }),
        ];
  return documento(hoja, 'CORTE DE CAJA', [
    datosDelCorte(hoja, 'Cierre diario'),
    ...arqueo(hoja, 'Apertura y fondo'),
    ...ajustesDeCaja(hoja),
    ...retirosConPin(hoja),
    ...ventasDelDia(hoja),
    resumenFinanciero(hoja, tituloDelResumen(hoja)),
    ...metodosConPropina(hoja),
    ...seccionesDePropina,
    // DP-16 · Mesas y pedidos para llevar, por separado.
    ...ventasPorCanal(hoja),
    ...productosVendidos(hoja),
    ...insumosConsumidos(hoja),
    ...gastos(hoja),
    ...inventarioBajo(hoja),
    ...cancelaciones(hoja),
    // DP-15 · Cada descuento con quién lo autorizó y por qué: el mismo armado que el visor.
    ...seccionesDeDescuentos(descuentos),
    ...devolucionesDelDia(hoja),
  ]);
}

// ── Cuál ────────────────────────────────────────────────────────────────────

export function documentoDelCorte(
  hoja: HojaDelServidor,
  descuentos: DescuentosLeidos | null = null,
): DocumentoDelCorte {
  return corteDeRestaurante(hoja, hoja.extras, descuentos);
}
