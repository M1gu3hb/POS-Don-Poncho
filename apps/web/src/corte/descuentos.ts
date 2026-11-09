import {
  AVISO_SIN_DESCUENTOS,
  EXPLICACION_SIN_DESCUENTOS,
  avisoDeLosDescuentosCortados,
  cuentaDelDescuento,
  tituloDeLosDescuentos,
  type DescuentosLeidos,
} from '~/corte-heredado/descuentos-del-corte';

import { dinero, texto, type Seccion } from './hoja.ts';

/**
 * LOS DESCUENTOS DEL CORTE, UN SOLO ARMADO (DP-15 · F2, auditoría 1 M5).
 *
 * El visor de Registros (`CorteTicket`) los pintaba con su tabla —cuenta, descuento, quién
 * autorizó, por qué— y el documento del cierre sólo decía «Descuentos $20.00». Los dos usan ahora
 * estas secciones: lo que se lee en la pantalla y lo que baja en el PDF no puede divergir.
 * Si no se pudieron leer, la sección lo DICE (una lista vacía parecería «sin descuentos»).
 */
export function seccionesDeDescuentos(leidos: DescuentosLeidos | null): readonly Seccion[] {
  if (leidos === null) return [];
  if (leidos.noSePudieronLeer) {
    return [
      {
        tipo: 'celdas',
        titulo: 'Descuentos',
        celdas: [{ etiqueta: AVISO_SIN_DESCUENTOS, valor: texto(EXPLICACION_SIN_DESCUENTOS) }],
      },
    ];
  }
  if (leidos.filas.length === 0) return [];
  const corte = avisoDeLosDescuentosCortados(leidos);
  return [
    {
      tipo: 'tabla',
      titulo: tituloDeLosDescuentos(leidos.alcance),
      columnas: [
        { titulo: 'Cuenta' },
        { titulo: 'Descuento', numerica: true },
        { titulo: 'Autorizó' },
        { titulo: 'Por qué' },
      ],
      filas: leidos.filas.map((d) => [
        texto(cuentaDelDescuento(d)),
        dinero(d.montoCentavos),
        texto(d.autorizo ?? '—'),
        texto(d.motivo ?? '—'),
      ]),
      total: [texto('Total'), dinero(leidos.totalCentavos), texto(''), texto('')],
      ...(corte === null ? {} : { nota: corte }),
    },
  ];
}
