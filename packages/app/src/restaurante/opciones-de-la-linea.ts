import 'server-only';

import { ErrorDominio } from '@morphiqpos/contracts';
import type { Transaccion } from '@morphiqpos/data';

/**
 * DP-14.6-3 · LAS OPCIONES DE UNA LÍNEA, DECIDIDAS POR EL SERVIDOR.
 *
 * Antes sólo la pantalla del mesero pedía el relleno obligatorio: el portal, el carrito del mesero
 * y cualquier otra llamada al comando mandaban la quesadilla sin él. Aquí vive la regla, y los tres
 * caminos de escritura (`restaurante.enviar_pedido`, el envío del carrito del portal y
 * `venta.agregar_linea` de /pos) la usan:
 *
 *  - la elección llega ESTRUCTURADA (`opciones: [{ grupoId, opcionIds }]`) y queda estructurada:
 *    `orden_linea_modificadores` (consultable, la lee el cobro) y la instantánea
 *    `orden_lineas.opciones` (la del ticket);
 *  - los clientes que todavía sólo mandan texto (el mesero y el portal pliegan «Grupo: opción» en la
 *    nota) siguen valiendo: sin `opciones`, la elección se lee de esa nota. Lo estructurado manda;
 *  - un grupo obligatorio sin elección se rechaza con `OPCION_OBLIGATORIA`, y una opción que no es
 *    del platillo, repetida o de más en un grupo de elección única, con `OPCION_NO_VALIDA`.
 *
 * Sólo cuentan los grupos y opciones ACTIVOS. Un grupo obligatorio sin ninguna opción activa no
 * pide nada (no hay qué elegir), igual que el diálogo del mesero.
 */

export interface OpcionDeGrupo {
  readonly id: string;
  readonly nombre: string;
  /** DP-16 · Lo que suma (o resta) al renglón, en centavos. Cero = no cambia el precio. */
  readonly deltaCentavos: bigint;
}

export interface GrupoDeOpciones {
  readonly id: string;
  readonly nombre: string;
  readonly obligatorio: boolean;
  readonly tipo: 'unica' | 'multiple';
  /** DP-16 · Cuántas elegir como mínimo y como máximo en un grupo de varias. Nulos = sin límite. */
  readonly minimo: number | null;
  readonly maximo: number | null;
  readonly opciones: readonly OpcionDeGrupo[];
}

export interface EleccionPedida {
  readonly grupoId: string;
  readonly opcionIds: readonly string[];
}

export interface OpcionElegida {
  readonly grupoId: string;
  readonly grupo: string;
  readonly opcionId: string;
  readonly opcion: string;
  /** DP-16 · Lo que esta opción le suma al renglón (lo pone el catálogo, nunca la pantalla). */
  readonly deltaCentavos: bigint;
}

/** Lo que una línea trae para que se le decidan las opciones. */
export interface LineaParaOpciones {
  readonly productoId: string;
  readonly productoNombre: string;
  readonly notas: string | null | undefined;
  readonly opciones?: readonly EleccionPedida[] | undefined;
}

const SEPARADORES_DE_NOTA = / · | — /;

/** «Queso, Crema» contiene «Crema» pero «Salsa, verde» también contiene «verde»: se compara por comas. */
function contieneLaOpcion(resto: string, nombre: string): boolean {
  return `, ${resto}, `.includes(`, ${nombre}, `);
}

/** La elección que dice una nota armada como «Grupo: a, b · Otro: c — nota propia». */
function eleccionesDeLaNota(
  grupos: readonly GrupoDeOpciones[],
  nota: string,
): readonly EleccionPedida[] {
  const segmentos = nota.split(SEPARADORES_DE_NOTA).map((s) => s.trim());
  const salida: EleccionPedida[] = [];
  for (const grupo of grupos) {
    const prefijo = `${grupo.nombre}: `;
    const segmento = segmentos.find((s) => s.startsWith(prefijo));
    if (segmento === undefined) continue;
    const resto = segmento.slice(prefijo.length);
    const opcionIds = grupo.opciones
      .filter((o) => contieneLaOpcion(resto, o.nombre))
      .map((o) => o.id);
    if (opcionIds.length > 0) salida.push({ grupoId: grupo.id, opcionIds });
  }
  return salida;
}

function noValida(producto: string, motivo: string): ErrorDominio {
  return new ErrorDominio(
    'OPCION_NO_VALIDA',
    `Las opciones de «${producto}» no son válidas: ${motivo}.`,
    {
      producto,
    },
  );
}

/**
 * Valida la elección contra los grupos del platillo y la devuelve con los nombres. Pura: sin base.
 * `pedidas === undefined` = el cliente no mandó la elección estructurada (se lee de la nota).
 */
export function elegirLasOpciones(
  producto: string,
  grupos: readonly GrupoDeOpciones[],
  pedidas: readonly EleccionPedida[] | undefined,
  nota: string,
): readonly OpcionElegida[] {
  const elecciones = pedidas ?? eleccionesDeLaNota(grupos, nota);
  const porGrupo = new Map(grupos.map((g) => [g.id, g]));
  const salida: OpcionElegida[] = [];
  const vistos = new Set<string>();

  for (const eleccion of elecciones) {
    const grupo = porGrupo.get(eleccion.grupoId);
    if (grupo === undefined) throw noValida(producto, 'un grupo que el platillo no tiene');
    if (vistos.has(grupo.id)) throw noValida(producto, `«${grupo.nombre}» viene dos veces`);
    vistos.add(grupo.id);
    const ids = new Set(eleccion.opcionIds);
    if (ids.size !== eleccion.opcionIds.length) {
      throw noValida(producto, `«${grupo.nombre}» repite una opción`);
    }
    if (grupo.tipo === 'unica' && ids.size > 1) {
      throw noValida(producto, `«${grupo.nombre}» admite una sola opción`);
    }
    if (grupo.maximo !== null && ids.size > grupo.maximo) {
      throw noValida(producto, `«${grupo.nombre}» admite hasta ${String(grupo.maximo)}`);
    }
    for (const opcionId of eleccion.opcionIds) {
      const opcion = grupo.opciones.find((o) => o.id === opcionId);
      if (opcion === undefined) {
        throw noValida(producto, `una opción que no es de «${grupo.nombre}»`);
      }
      salida.push({
        grupoId: grupo.id,
        grupo: grupo.nombre,
        opcionId,
        opcion: opcion.nombre,
        deltaCentavos: opcion.deltaCentavos,
      });
    }
  }

  for (const grupo of grupos) {
    const eligio = salida.filter((o) => o.grupoId === grupo.id).length;
    if (grupo.obligatorio && grupo.opciones.length > 0 && eligio === 0) {
      throw new ErrorDominio(
        'OPCION_OBLIGATORIA',
        `Falta elegir «${grupo.nombre}» de «${producto}».`,
        { producto, grupo: grupo.nombre },
      );
    }
    // DP-16 · El mínimo de un grupo de varias, sin pedir más de las opciones que hay activas.
    const minimo = Math.min(grupo.minimo ?? 0, grupo.opciones.length);
    if (
      grupo.tipo === 'multiple' &&
      minimo > 0 &&
      eligio < minimo &&
      (grupo.obligatorio || eligio > 0)
    ) {
      throw new ErrorDominio(
        'OPCION_OBLIGATORIA',
        `Elige al menos ${String(minimo)} de «${grupo.nombre}» en «${producto}».`,
        { producto, grupo: grupo.nombre },
      );
    }
  }
  return salida;
}

/** «Relleno: Queso · Extras: Crema, Salsa»: como se lee en la comanda, el cobro y el ticket. */
export function textoDeLasOpciones(elegidas: readonly OpcionElegida[]): string {
  const porGrupo = new Map<string, string[]>();
  for (const o of elegidas) porGrupo.set(o.grupo, [...(porGrupo.get(o.grupo) ?? []), o.opcion]);
  return [...porGrupo].map(([grupo, opciones]) => `${grupo}: ${opciones.join(', ')}`).join(' · ');
}

/** Los grupos ACTIVOS (con sus opciones activas) de cada platillo, en una sola consulta. */
export async function gruposDeLosPlatillos(
  tx: Transaccion,
  organizacionId: string,
  productoIds: readonly string[],
): Promise<ReadonlyMap<string, readonly GrupoDeOpciones[]>> {
  const salida = new Map<string, GrupoDeOpciones[]>();
  if (productoIds.length === 0) return salida;
  const filas = await tx
    .selectFrom('producto_modificadores as pm')
    .innerJoin('modificadores as m', (union) =>
      union
        .onRef('m.id', '=', 'pm.modificador_id')
        .onRef('m.organizacion_id', '=', 'pm.organizacion_id'),
    )
    .innerJoin('modificador_opciones as mo', 'mo.modificador_id', 'm.id')
    .select([
      'pm.producto_id as producto_id',
      'm.id as grupo_id',
      'm.nombre as grupo',
      'm.obligatorio as obligatorio',
      'm.tipo as tipo',
      'mo.id as opcion_id',
      'mo.nombre as opcion',
      'mo.delta_precio_centavos as delta',
      'mo.precio_extra_centavos as extra',
      'm.minimo_elecciones as minimo',
      'm.maximo_elecciones as maximo',
    ])
    .where('pm.organizacion_id', '=', organizacionId)
    .where('pm.producto_id', 'in', [...new Set(productoIds)])
    .where('m.activo', '=', true)
    .where('mo.activa', '=', true)
    .orderBy('pm.producto_id')
    .orderBy('pm.orden')
    .orderBy('m.nombre')
    .orderBy('mo.orden')
    .execute();
  for (const f of filas) {
    const grupos = salida.get(f.producto_id) ?? [];
    const i = grupos.findIndex((g) => g.id === f.grupo_id);
    // El firmado manda (084); si es cero, el viejo `precio_extra` (>= 0) de la 002.
    const opcion = {
      id: f.opcion_id,
      nombre: f.opcion,
      deltaCentavos: f.delta !== 0n ? f.delta : f.extra,
    };
    if (i >= 0) {
      const previo = grupos[i];
      if (previo !== undefined) grupos[i] = { ...previo, opciones: [...previo.opciones, opcion] };
    } else {
      grupos.push({
        id: f.grupo_id,
        nombre: f.grupo,
        obligatorio: f.obligatorio,
        tipo: f.tipo === 'multiple' ? 'multiple' : 'unica',
        minimo: f.minimo,
        maximo: f.maximo,
        opciones: [opcion],
      });
    }
    salida.set(f.producto_id, grupos);
  }
  return salida;
}

/**
 * Decide las opciones de cada línea (en el mismo orden). Lanza en la primera que no cumple: todo o
 * nada, antes de escribir ninguna.
 */
export async function prepararLasOpciones(
  tx: Transaccion,
  organizacionId: string,
  lineas: readonly LineaParaOpciones[],
): Promise<readonly (readonly OpcionElegida[])[]> {
  const grupos = await gruposDeLosPlatillos(
    tx,
    organizacionId,
    lineas.map((l) => l.productoId),
  );
  return lineas.map((l) =>
    elegirLasOpciones(l.productoNombre, grupos.get(l.productoId) ?? [], l.opciones, l.notas ?? ''),
  );
}

/** La instantánea para `orden_lineas.opciones` (la del ticket): por grupo, con nombres. */
export function instantaneaDeLasOpciones(elegidas: readonly OpcionElegida[]): string | null {
  if (elegidas.length === 0) return null;
  const porGrupo = new Map<
    string,
    {
      grupoId: string;
      grupo: string;
      opciones: { id: string; nombre: string; precioCentavos: string }[];
    }
  >();
  for (const o of elegidas) {
    const g = porGrupo.get(o.grupoId) ?? { grupoId: o.grupoId, grupo: o.grupo, opciones: [] };
    // DP-16 · Con su precio: el ticket y la precuenta dicen cuánto sumó cada opción.
    g.opciones.push({
      id: o.opcionId,
      nombre: o.opcion,
      precioCentavos: o.deltaCentavos.toString(),
    });
    porGrupo.set(o.grupoId, g);
  }
  return JSON.stringify([...porGrupo.values()]);
}

/** Escribe `orden_linea_modificadores` de las líneas ya insertadas (sin filas si no hay opciones). */
export async function guardarLosModificadores(
  tx: Transaccion,
  lineas: readonly { readonly lineaId: string; readonly elegidas: readonly OpcionElegida[] }[],
): Promise<void> {
  const filas = lineas.flatMap(({ lineaId, elegidas }) =>
    elegidas.map((o) => ({
      orden_linea_id: lineaId,
      modificador_id: o.grupoId,
      modificador_nombre: o.grupo,
      opcion_id: o.opcionId,
      opcion_nombre: o.opcion,
      // `precio_extra_centavos` es `>= 0` (003): guarda lo positivo; la cuenta usa el firmado.
      precio_extra_centavos: o.deltaCentavos > 0n ? o.deltaCentavos : 0n,
      delta_precio_centavos: o.deltaCentavos,
    })),
  );
  if (filas.length === 0) return;
  await tx.insertInto('orden_linea_modificadores').values(filas).execute();
}
