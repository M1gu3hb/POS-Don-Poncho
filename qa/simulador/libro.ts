/**
 * EL LIBRO ESPERADO: lo que cada bot SABE que hizo y lo que DEBE pasar. Nunca lo que dice el
 * servidor: el árbitro compara esto contra el sistema al cerrar el día, al centavo y al gramo.
 *
 * Un JSONL por día (`<salida>/dia-N/libro.jsonl`), una línea por asiento, con el día, la hora
 * simulada y el bot. Se escribe al momento (append): si el día se corta, lo anotado queda.
 */
import { appendFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';

export type Canal = 'mesa' | 'llevar' | 'portal';
export type Metodo = 'efectivo' | 'tarjeta' | 'transferencia';

export type Asiento =
  | {
      readonly tipo: 'linea';
      readonly cuenta: string;
      readonly producto: string;
      readonly cantidad: number;
      readonly opciones: readonly string[];
      readonly importeCentavos: number;
      readonly estacion: string;
      readonly canal: Canal;
    }
  | {
      readonly tipo: 'cancelacion';
      readonly cuenta: string;
      readonly producto: string;
      readonly importeCentavos: number;
      readonly motivo: string;
    }
  | {
      readonly tipo: 'descuento';
      readonly cuenta: string;
      readonly centavos: number;
      readonly conPin: boolean;
    }
  | {
      readonly tipo: 'cobro';
      readonly caja: string;
      readonly cuenta: string;
      readonly folio: string;
      readonly canal: 'mesa' | 'llevar';
      readonly totalCentavos: number;
      readonly propinaCentavos: number;
      readonly descuentoCentavos: number;
      readonly pagos: Readonly<Record<Metodo, number>>;
      readonly cambioCentavos: number;
    }
  | {
      readonly tipo: 'retiro' | 'entrada';
      readonly caja: string;
      readonly centavos: number;
      readonly conPin: boolean;
      readonly motivo: string;
    }
  | {
      readonly tipo: 'gasto';
      readonly centavos: number;
      readonly metodo: string;
      readonly descripcion: string;
    }
  | {
      readonly tipo: 'compra';
      readonly insumo: string;
      readonly cantidad: number;
      readonly unidad: string;
      readonly costoCentavos: number;
    }
  | {
      readonly tipo: 'merma';
      readonly insumo: string;
      readonly cantidad: number;
      readonly unidad: string;
    }
  | {
      readonly tipo: 'apertura' | 'corte';
      readonly caja: string;
      readonly contadoCentavos: number;
      readonly esperadoCentavos?: number;
    }
  | { readonly tipo: 'traslado'; readonly caja: string; readonly de: string; readonly a: string }
  | {
      readonly tipo: 'cambio_en_vivo';
      readonly que: string;
      readonly antes: string;
      readonly despues: string;
    };

export interface AsientoFechado {
  readonly dia: number;
  readonly horaSim: string;
  readonly bot: string;
  readonly asiento: Asiento;
}

export interface Libro {
  anotar(bot: string, asiento: Asiento): void;
  leer(): readonly AsientoFechado[];
}

export function abrirLibro(ruta: string, dia: number, horaSim: () => Date): Libro {
  mkdirSync(dirname(ruta), { recursive: true });
  return {
    anotar(bot, asiento) {
      const fila: AsientoFechado = { dia, horaSim: horaSim().toISOString(), bot, asiento };
      appendFileSync(ruta, `${JSON.stringify(fila)}\n`);
    },
    leer() {
      if (!existsSync(ruta)) return [];
      return readFileSync(ruta, 'utf8')
        .split('\n')
        .filter((l) => l.trim() !== '')
        .map((l) => JSON.parse(l) as AsientoFechado);
    },
  };
}

/** El precio esperado de una línea: por pieza, (precio + opciones) × piezas; por peso o porción, una vez. */
export function importeEsperado(
  tipoVenta: string,
  precioCentavos: number,
  cantidad: number,
  deltasDeOpciones: readonly number[],
): number {
  const delta = deltasDeOpciones.reduce((s, d) => s + d, 0);
  if (tipoVenta === 'variable_medida' || tipoVenta === 'porcion_contenedor') {
    return Math.max(0, Math.round(precioCentavos * cantidad) + delta);
  }
  return Math.max(0, (precioCentavos + delta) * cantidad);
}
