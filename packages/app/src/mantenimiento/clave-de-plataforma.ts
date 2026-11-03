import { createHash } from 'node:crypto';

/**
 * LA CLAVE DE IDEMPOTENCIA DE LA MARCA DE PLATAFORMA (DP-13.3b), para el guion que la pone o la
 * quita (`scripts/marcar-plataforma.mjs`).
 *
 * `comando()` contesta con la respuesta guardada a toda llamada que repite clave y entrada, sin
 * ejecutar nada. Si la clave sólo dependiera de QUIÉN pide, marcar → quitar → volver a marcar
 * repetiría la clave de la primera vez y la tercera llamada devolvería «ya quedó marcado» sin
 * marcar a nadie. Por eso la clave lleva el ESTADO que la petición va a producir:
 *
 *   · un hash de la lista de plataforma RESULTANTE (distingue «voy a dejar a estos dos» de «voy a
 *     dejar a ese uno»), y
 *   · la VERSIÓN del documento de configuración de la que parte, que sube con cada escritura.
 *     La lista sola no alcanza: marcar → quitar → marcar da la MISMA lista resultante las dos
 *     veces, y es la versión la que las distingue.
 *
 * Reintentar la MISMA petición (mismo estado de partida) sigue dando la misma clave: un corte de
 * red a mitad de la respuesta no ejecuta dos veces.
 */
export type AccionDePlataforma = 'marcar' | 'quitar';

export interface PlanDePlataforma {
  readonly accion: AccionDePlataforma;
  readonly organizacionId: string;
  /** El empleo que se marca, o al que se le quita la marca. */
  readonly empleoId: string;
  /** Al quitar: el empleo que recibe la marca en su lugar. */
  readonly reemplazarPor?: string;
  /** La lista de plataforma ANTES de la petición. */
  readonly antes: readonly string[];
  /** La versión del documento de configuración ANTES de la petición. */
  readonly version: number;
}

type PlanSinVersion = Omit<PlanDePlataforma, 'version'>;

/** La lista que queda tras la petición, sin repetidos y en un orden que no depende de cómo llegó. */
export function listaResultante(plan: PlanSinVersion): readonly string[] {
  const conservados = plan.antes.filter((e) => plan.accion === 'marcar' || e !== plan.empleoId);
  const nuevos =
    plan.accion === 'marcar'
      ? [plan.empleoId]
      : plan.reemplazarPor === undefined
        ? []
        : [plan.reemplazarPor];
  return [...new Set([...conservados, ...nuevos])].sort();
}

export function claveDePlataforma(plan: PlanDePlataforma): string {
  const lista = createHash('sha256')
    .update(JSON.stringify(listaResultante(plan)))
    .digest('hex')
    .slice(0, 12);
  return `plataforma:${plan.accion}:${plan.organizacionId}:${plan.empleoId}:${lista}:v${String(plan.version)}`;
}
