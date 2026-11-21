import { renglonesDePagos } from '../venta/pagos-por-separado.ts';
import { dinero, tablaSiHay, texto, type HojaDelServidor, type Seccion } from './hoja.ts';

/**
 * DP-25 · EL CORTE LISTA CADA PAGO, POR SEPARADO (lo que DP-24 no cumplió del 1.4).
 *
 * «Métodos de pago» sigue con su total por método; debajo, cada venta con sus pagos uno por uno:
 * «Tarjeta 1», «Tarjeta 2», «Efectivo» con lo recibido y el cambio, y la propina de cada uno. Los
 * números son los del servidor (`detalleDeVentas`), en centavos; aquí sólo se ordenan y se nombran
 * con la misma regla del detalle de la venta (`venta/pagos-por-separado.ts`).
 */

export const TITULO_DE_PAGOS = 'Pagos, uno por uno';

const SIN_DATO = '—';

export function pagosUnoPorUno(hoja: HojaDelServidor): readonly Seccion[] {
  const filas = hoja.ventas.flatMap((venta) =>
    renglonesDePagos(
      (venta.pagos ?? []).map((p) => ({
        id: p.id,
        venta_id: venta.folio ?? '',
        metodo: p.metodo,
        monto: Number(p.montoCentavos),
        propina: Number(p.propinaCentavos),
        recibido: p.recibidoCentavos === null ? null : Number(p.recibidoCentavos),
        cambio: Number(p.cambioCentavos),
        estado: p.estado,
        created_date: p.creadoEn,
      })),
    ).map((r) => [
      texto(venta.folio ?? SIN_DATO),
      texto(r.devuelto ? `${r.rotulo} · devuelto` : r.rotulo),
      dinero(String(r.monto)),
      dinero(String(r.propina)),
      r.recibido === null ? texto(SIN_DATO) : dinero(String(r.recibido)),
      r.recibido === null ? texto(SIN_DATO) : dinero(String(r.cambio)),
    ]),
  );
  return tablaSiHay({
    tipo: 'tabla',
    titulo: TITULO_DE_PAGOS,
    columnas: [
      { titulo: 'Folio' },
      { titulo: 'Pago' },
      { titulo: 'Monto', numerica: true },
      { titulo: 'Propina', numerica: true },
      { titulo: 'Recibido', numerica: true },
      { titulo: 'Cambio', numerica: true },
    ],
    filas,
  });
}
