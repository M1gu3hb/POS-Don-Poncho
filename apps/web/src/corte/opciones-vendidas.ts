import { dinero, tablaSiHay, texto, type HojaDelServidor, type Seccion } from './hoja.ts';

export const TITULO_DE_OPCIONES = 'Opciones vendidas · cuánto sumaron';

/**
 * DP-16 · LAS OPCIONES COBRADAS, en el corte.
 *
 * El total de cada platillo ya trae sus opciones; esta tabla dice de dónde salió: cuántas veces se
 * pidió «Extras: Queso» y cuánto sumó, cuánto restó «Sin crema». Sin opciones con precio no hay
 * sección. Vive aparte de `hoja.ts` para no crecerlo más.
 */
export function opcionesVendidas(hoja: HojaDelServidor): readonly Seccion[] {
  return tablaDeOpciones(hoja.opciones ?? [], TITULO_DE_OPCIONES);
}

/** DP-17 · La misma tabla con otras filas y otro título (las del día, en el Cierre del día). */
export function tablaDeOpciones(
  opciones: NonNullable<HojaDelServidor['opciones']>,
  titulo: string,
): readonly Seccion[] {
  return tablaSiHay({
    tipo: 'tabla',
    titulo,
    columnas: [
      { titulo: 'Grupo' },
      { titulo: 'Opción' },
      { titulo: 'Veces', numerica: true },
      { titulo: 'Sumó', numerica: true },
    ],
    filas: opciones.map((o) => [
      texto(o.grupo),
      texto(o.opcion),
      texto(o.veces),
      dinero(o.importeCentavos),
    ]),
  });
}
