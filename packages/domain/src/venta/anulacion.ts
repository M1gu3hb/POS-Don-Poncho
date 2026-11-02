import { CODIGOS_ERROR, ErrorDominio } from '@morphiqpos/contracts/errores';

import {
  aDiezmilesimas,
  deDiezmilesimas,
  repartirPorPesos,
  type Centavos,
} from '../dinero/index.ts';

/**
 * F-324 · Partir una línea para anular parte de ella.
 *
 * ── El hueco que cierra ────────────────────────────────────────────────────
 * F-221 cancela la venta entera y F-202 descuenta la línea, pero ninguna
 * resuelve «de las tres hamburguesas, una salió mal». Hoy el mesero borra la
 * línea completa y la vuelve a capturar con dos, y en ese borrado desaparece el
 * rastro de que hubo un error de cocina y de quién lo autorizó.
 *
 * ── Anular no es borrar ────────────────────────────────────────────────────
 * La parte anulada SE QUEDA, con su sello, su motivo y su responsable. Lo que
 * cambia es que deja de cobrarse. Borrar la línea haría desaparecer del sistema
 * comida que sí se preparó y sí salió del almacén, que es justamente lo que
 * convierte la merma de una cocina en un misterio a fin de mes.
 *
 * ── Por qué es dominio puro ────────────────────────────────────────────────
 * Entra una línea y una cantidad, salen dos porciones. Sin base y sin
 * transacción, así que la aritmética —que es dinero— se puede barrer con
 * cientos de casos en un segundo.
 */

/** Una línea de la cuenta, tal como vive en `orden_lineas`. */
export interface LineaAnulable {
  /** `numeric(14,4)` tal como llega de Postgres: texto, para no perder precisión. */
  readonly cantidad: string;
  readonly subtotalCentavos: bigint;
  readonly descuentoCentavos: bigint;
  readonly totalCentavos: bigint;
}

export interface PorcionDeLinea {
  readonly cantidad: string;
  readonly subtotalCentavos: bigint;
  readonly descuentoCentavos: bigint;
  readonly totalCentavos: bigint;
}

export interface LineaPartida {
  readonly anulada: PorcionDeLinea;
  /** `null` cuando se anula entera: no queda nada que cobrar de esa línea. */
  readonly restante: PorcionDeLinea | null;
}

/**
 * Parte una línea en la porción que se anula y la que sigue cobrándose.
 *
 * `cantidadAnulada` sin dar significa la línea entera, que es el caso común: el
 * platillo salió mal y se anula completo.
 *
 * ── Lo que garantiza, y es lo único que importa ────────────────────────────
 * **Las dos porciones suman exactamente lo que sumaba la línea**, en las tres
 * columnas de dinero y en la cantidad. Un reparto que pierda un centavo en cada
 * anulación descuadra el corte todas las noches por poquito, que es peor que
 * descuadrar por mucho porque nadie lo investiga.
 *
 * Los tres importes se reparten por separado con los MISMOS pesos. En el caso
 * pathológico de una línea que llegara con `total ≠ subtotal − descuento`, la
 * identidad puede quedar desviada un centavo en una de las dos porciones; las
 * tres sumas siguen siendo exactas, que es lo que cobra el cliente. Hoy no
 * puede ocurrir: `agregarLinea` y `actualizarImportesDeLinea` escriben
 * `descuento_centavos` en su `default 0` y `total = subtotal`.
 */
export function partirLineaParaAnular(
  linea: LineaAnulable,
  cantidadAnulada?: string,
): LineaPartida {
  const total = aDiezmilesimas(linea.cantidad);
  if (total <= 0n) {
    throw new ErrorDominio(
      CODIGOS_ERROR.CANTIDAD_INVALIDA,
      'Esa línea no tiene cantidad que anular.',
      { cantidad: linea.cantidad },
    );
  }

  const anulada = cantidadAnulada === undefined ? total : aDiezmilesimas(cantidadAnulada);
  if (anulada <= 0n) {
    throw new ErrorDominio(
      CODIGOS_ERROR.CANTIDAD_INVALIDA,
      'Anular cero no es anular: para dejar la línea como está, no la anules.',
      { cantidad: cantidadAnulada ?? linea.cantidad },
    );
  }
  if (anulada > total) {
    throw new ErrorDominio(
      CODIGOS_ERROR.CANTIDAD_INVALIDA,
      'No se puede anular más de lo que la línea tiene.',
      { pedido: cantidadAnulada ?? linea.cantidad, disponible: linea.cantidad },
    );
  }

  if (anulada === total) {
    return {
      anulada: {
        cantidad: deDiezmilesimas(total),
        subtotalCentavos: linea.subtotalCentavos,
        descuentoCentavos: linea.descuentoCentavos,
        totalCentavos: linea.totalCentavos,
      },
      restante: null,
    };
  }

  // Los pesos son las diezmilésimas, no las unidades: una línea de 0.350 kg a
  // la que se le anulan 0.120 se parte igual de exacta que tres hamburguesas.
  const pesos = [Number(anulada), Number(total - anulada)];
  const [subA = 0n, subR = 0n] = repartirPorPesos(linea.subtotalCentavos as Centavos, pesos);
  const [descA = 0n, descR = 0n] = repartirPorPesos(linea.descuentoCentavos as Centavos, pesos);
  const [totA = 0n, totR = 0n] = repartirPorPesos(linea.totalCentavos as Centavos, pesos);

  return {
    anulada: {
      cantidad: deDiezmilesimas(anulada),
      subtotalCentavos: subA,
      descuentoCentavos: descA,
      totalCentavos: totA,
    },
    restante: {
      cantidad: deDiezmilesimas(total - anulada),
      subtotalCentavos: subR,
      descuentoCentavos: descR,
      totalCentavos: totR,
    },
  };
}

/**
 * Los motivos de una anulación, cerrados a propósito.
 *
 * No es burocracia: **cada motivo apunta a un responsable y a una cuenta
 * distinta.** Un platillo que se rehace por error de cocina es merma del
 * negocio; uno que se anula porque el mesero lo capturó en la mesa equivocada
 * es un error de captura y no debería salir del almacén; una cortesía es una
 * decisión comercial que alguien autorizó. Un campo de texto libre los mezcla
 * los tres y a fin de mes no se puede contestar cuánto costó cada cosa.
 */
export const MOTIVOS_ANULACION = [
  'error_cocina',
  'error_mesero',
  'cortesia',
  'cliente_cambio',
] as const;

export type MotivoAnulacion = (typeof MOTIVOS_ANULACION)[number];

/**
 * DP-12.4 · Las palabras con que el corte y Registros dicen el motivo de una anulación.
 *
 * La clave viaja a la base (`error_mesero`) y NO es lo que el dueño debe leer en un papel: el
 * corte de caja del servidor y el heredado de la Caja salían con la clave cruda. Una sola tabla
 * aquí, en el dominio, para que las dos hojas y Registros digan lo mismo.
 */
const ETIQUETA_DEL_MOTIVO: Readonly<Record<MotivoAnulacion, string>> = {
  error_cocina: 'Error de cocina',
  error_mesero: 'Error del mesero al tomar la orden',
  cortesia: 'Cortesía de la casa',
  cliente_cambio: 'El cliente cambió de opinión',
};

function esMotivoDeAnulacion(texto: string): texto is MotivoAnulacion {
  return (MOTIVOS_ANULACION as readonly string[]).includes(texto);
}

/**
 * El motivo en palabras: el del enum, con su etiqueta; cualquier otro texto (el que el cajero
 * escribió al cancelar una cuenta) tal cual; y nada si no hay motivo, sin inventar uno.
 */
export function etiquetaDelMotivoDeAnulacion(motivo: string | null): string | null {
  if (motivo === null) return null;
  const limpio = motivo.trim();
  if (limpio === '') return null;
  return esMotivoDeAnulacion(limpio) ? ETIQUETA_DEL_MOTIVO[limpio] : limpio;
}

/**
 * Si el consumo de la porción anulada se perdió de verdad.
 *
 * Es la pregunta que decide si el insumo vuelve al almacén o se queda fuera:
 * un platillo que la cocina ya preparó **no vuelve a la olla**, aunque nadie lo
 * pague. Uno que nunca se comandó, sí.
 *
 * Lo que decide es el estado de la preparación, no el motivo: un error de
 * mesero descubierto antes de que cocina lo tomara no cuesta insumo, y el mismo
 * error descubierto con el plato ya emplatado cuesta el plato entero.
 */
export function elConsumoSePerdio(estadoPreparacion: string): boolean {
  return estadoPreparacion !== 'pendiente';
}
