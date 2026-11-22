/**
 * El PLAN de `agregar-jugo-mixto-produccion.mjs` (DP-25 · Parte 8.2): de cómo está el negocio a la
 * entrada del comando que agrega «Mixto» (+$0) al grupo «Sabor del jugo» del producto «Jugo».
 *
 * `catalogo.guardar_grupo_de_opciones` guarda el grupo ENTERO y borra las opciones que no vienen, así
 * que el plan manda las que ya hay, con su `id` y su precio, y «Mixto» al final. Es puro: no lee ni
 * escribe nada, y se prueba sin base.
 */

export const PRODUCTO = 'Jugo';
export const GRUPO = 'Sabor del jugo';
export const OPCION = 'Mixto';

const normal = (texto) => String(texto).trim().toLowerCase();

/** Centavos → pesos con dos decimales y signo, como los pide el comando («5.50», «-5.50»). */
export function pesosConSigno(centavos) {
  const total = BigInt(centavos);
  const abs = total < 0n ? -total : total;
  const enteros = (abs / 100n).toString();
  const cents = (abs % 100n).toString().padStart(2, '0');
  return `${total < 0n ? '-' : ''}${enteros}.${cents}`;
}

const problema = (mensaje) => ({ accion: 'problema', mensaje });

/** El producto «Jugo» activo, su grupo «Sabor del jugo» y las opciones de ese grupo, o el problema. */
function resolver({ productos, grupos, asignaciones, opciones }) {
  const jugos = productos.filter((p) => p.activo && p.nombre === PRODUCTO);
  if (jugos.length !== 1) {
    return problema(
      jugos.length === 0
        ? `No hay un producto activo llamado «${PRODUCTO}».`
        : `Hay ${String(jugos.length)} productos activos llamados «${PRODUCTO}»: no sé cuál.`,
    );
  }
  const suyos = new Set(
    asignaciones.filter((a) => a.producto_id === jugos[0].id).map((a) => a.modificador_id),
  );
  const delJugo = grupos.filter((g) => suyos.has(g.id) && g.nombre === GRUPO);
  if (delJugo.length !== 1) {
    return problema(
      delJugo.length === 0
        ? `«${PRODUCTO}» no tiene el grupo de opciones «${GRUPO}».`
        : `«${PRODUCTO}» tiene ${String(delJugo.length)} grupos «${GRUPO}»: no sé cuál.`,
    );
  }
  const grupo = delJugo[0];
  const suyas = opciones
    .filter((o) => o.modificador_id === grupo.id)
    .sort((a, b) => a.orden - b.orden);
  return { grupo, opciones: suyas };
}

/**
 * `agregar` (con la `entrada` del comando), `nada` (ya está «Mixto») o `problema` (algo no casa y no
 * se escribe nada). Siempre con un `mensaje` para decirlo.
 */
export function planDelJugoMixto(estado) {
  const hallado = resolver(estado);
  if (hallado.accion === 'problema') return hallado;
  const { grupo, opciones } = hallado;
  const yaEsta = opciones.find((o) => normal(o.nombre) === normal(OPCION));
  if (yaEsta !== undefined) {
    const ojo =
      yaEsta.activa && BigInt(yaEsta.delta_precio_centavos) === 0n
        ? ''
        : ` (ojo: está ${yaEsta.activa ? 'activa' : 'inactiva'} y cuesta ${pesosConSigno(yaEsta.delta_precio_centavos)}; no se toca)`;
    return {
      accion: 'nada',
      mensaje: `«${OPCION}» ya está en «${GRUPO}»: no se hace nada${ojo}.`,
    };
  }
  return {
    accion: 'agregar',
    mensaje: `Agregaría «${OPCION}» (+$0) a «${GRUPO}», después de ${opciones.map((o) => o.nombre).join(', ')}.`,
    entrada: {
      grupoId: grupo.id,
      nombre: grupo.nombre,
      tipo: grupo.tipo,
      obligatorio: grupo.obligatorio,
      minimo: grupo.minimo_elecciones ?? null,
      maximo: grupo.maximo_elecciones ?? null,
      activo: grupo.activo,
      opciones: [
        ...opciones.map((o) => ({
          id: o.id,
          nombre: o.nombre,
          precio: pesosConSigno(o.delta_precio_centavos),
          activa: o.activa,
        })),
        { nombre: OPCION, precio: '0', activa: true },
      ],
    },
  };
}
