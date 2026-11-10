import { dinero, hora, tablaSiHay, texto, type HojaDelServidor, type Seccion } from './hoja.ts';

/**
 * DP-16 (encargo 1.4) · LOS RETIROS CON PIN DE GERENTE, en el corte.
 *
 * Un retiro de la cajera arriba del umbral lo autoriza un gerente, administrador o dueño con su
 * PIN; el corte dice quién retiró, quién autorizó y a dónde fue el dinero. Sin retiros con PIN no
 * hay sección. Vive aparte de `hoja.ts` para no mezclarse con el resto del armado.
 */
export function retirosConPin(hoja: HojaDelServidor): readonly Seccion[] {
  const retiros = hoja.retirosConPin ?? [];
  return tablaSiHay({
    tipo: 'tabla',
    titulo: 'Retiros con PIN de gerente · quién autorizó',
    columnas: [
      { titulo: 'Hora' },
      { titulo: 'Retiró' },
      { titulo: 'Autorizó' },
      { titulo: 'A dónde va' },
      { titulo: 'Monto', numerica: true },
    ],
    filas: retiros.map((r) => [
      hora(r.registradoEn),
      texto(r.quien ?? 'Sin registrar'),
      texto(r.autorizo ?? 'Sin registrar'),
      texto(r.motivo === null || r.motivo.trim() === '' ? 'SIN MOTIVO' : r.motivo),
      dinero(r.montoCentavos),
    ]),
  });
}
