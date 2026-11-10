import { grupoDelCanal, referenciaParaLlevar, sumaPorGrupo } from './canales.ts';
import {
  detalleDeVentas,
  dinero,
  tablaSiHay,
  texto,
  type HojaDelServidor,
  type Seccion,
} from './hoja.ts';

/**
 * DP-16 · EL DETALLE DE VENTAS DEL CORTE, CON LAS MESAS Y LOS PEDIDOS PARA LLEVAR APARTE.
 *
 * Sin pedidos para llevar el documento queda como siempre (un solo «Detalle de ventas»). Con
 * alguno, primero el resumen «Mesas · Para llevar» con sus cuentas e importe —que suma lo mismo que
 * el total del corte, al centavo— y luego cada detalle por su lado; el pedido para llevar se
 * reconoce por su número y su nombre, como se gritó al entregarlo.
 */
export function ventasPorCanal(hoja: HojaDelServidor): readonly Seccion[] {
  const deMesa = (v: HojaDelServidor['ventas'][number]) =>
    [v.mesa, v.cliente].filter((x) => x !== null).join(' · ') || null;
  const mesas = hoja.ventas.filter((v) => grupoDelCanal(v.canal) === 'mesas');
  const llevar = hoja.ventas.filter((v) => grupoDelCanal(v.canal) === 'llevar');
  if (llevar.length === 0) return detalleDeVentas(hoja, { titulo: 'Mesa', de: deMesa });

  const suma = sumaPorGrupo(hoja.ventas);
  const total = suma.mesas.totalCentavos + suma.llevar.totalCentavos;
  return [
    ...tablaSiHay({
      tipo: 'tabla',
      titulo: 'Mesas y para llevar',
      columnas: [
        { titulo: 'Canal' },
        { titulo: 'Cuentas', numerica: true },
        { titulo: 'Ventas', numerica: true },
      ],
      filas: [
        [texto('Mesas'), texto(suma.mesas.cuentas), dinero(suma.mesas.totalCentavos.toString())],
        [
          texto('Para llevar'),
          texto(suma.llevar.cuentas),
          dinero(suma.llevar.totalCentavos.toString()),
        ],
      ],
      total: [
        texto('TOTAL'),
        texto(suma.mesas.cuentas + suma.llevar.cuentas),
        dinero(total.toString()),
      ],
    }),
    ...detalleDeVentas(hoja, { titulo: 'Mesa', de: deMesa }, false, {
      titulo: 'Ventas en mesas',
      ventas: mesas,
    }),
    ...detalleDeVentas(
      hoja,
      { titulo: 'Pedido', de: (v) => referenciaParaLlevar(v.numeroPedido, v.nombrePedido) },
      false,
      { titulo: 'Pedidos para llevar', ventas: llevar },
    ),
  ];
}
