import 'server-only';

import { ErrorDominio, PAQUETES_OPERATIVOS } from '@morphiqpos/contracts';
import type { Transaccion } from '@morphiqpos/data';
import { desdeTexto } from '@morphiqpos/domain/dinero';
import { z } from 'zod';

import { definirComando } from '../comando.ts';

/**
 * DP-16 · LA BIBLIOTECA DE GRUPOS DE OPCIONES: se arman una vez y se reusan en varios productos.
 *
 * Antes cada producto guardaba su juego entero (`catalogo.guardar_modificadores`) y el precio de
 * una opción no se podía poner desde la pantalla. Ahora un grupo («Tortillas»: Maíz, Harina +$20)
 * tiene su nombre, si se elige una o varias, si es obligatorio, el mínimo y el máximo de elecciones,
 * si está activo, y cada opción su precio (+ o −). Cambiarlo cambia todos los productos que lo usan;
 * lo ya vendido conserva su instantánea (`orden_linea_modificadores`).
 */

const ROLES = ['dueno', 'administrador', 'gerente'] as const;

/** Pesos con signo y hasta dos decimales: «20», «-5.50». */
const precioConSigno = z
  .string()
  .trim()
  .regex(/^-?\d{1,7}(?:\.\d{1,2})?$/, 'El precio de la opción va en pesos, como 20 o -5.50.');

const opcion = z.object({
  id: z.uuid().optional(),
  nombre: z.string().trim().min(1).max(80),
  precio: precioConSigno.default('0'),
  activa: z.boolean().default(true),
});

export const entradaGuardarGrupo = z
  .object({
    grupoId: z.uuid().optional(),
    nombre: z.string().trim().min(1).max(80),
    tipo: z.enum(['unica', 'multiple']),
    obligatorio: z.boolean(),
    minimo: z.number().int().min(0).max(30).nullable().default(null),
    maximo: z.number().int().min(1).max(30).nullable().default(null),
    activo: z.boolean().default(true),
    opciones: z.array(opcion).min(1).max(30),
  })
  .refine((g) => g.minimo === null || g.maximo === null || g.minimo <= g.maximo, {
    message: 'El mínimo no puede ser mayor que el máximo.',
    path: ['minimo'],
  })
  .refine((g) => g.tipo === 'multiple' || (g.minimo === null && g.maximo === null), {
    message: 'El mínimo y el máximo son de los grupos donde se eligen varias.',
    path: ['tipo'],
  });

export const entradaAsignarGrupos = z.object({
  productoId: z.uuid(),
  /** En el orden en que el mesero y el comensal los ven. */
  grupoIds: z.array(z.uuid()).max(20),
});

/** «-5.50» → −550n. El precio lo convierte el servidor, nunca la pantalla. */
export function centavosConSigno(texto: string): bigint {
  const negativo = texto.startsWith('-');
  const valor: bigint = desdeTexto(negativo ? texto.slice(1) : texto);
  return negativo ? 0n - valor : valor;
}

export const guardarGrupoDeOpciones = definirComando<
  Transaccion,
  typeof entradaGuardarGrupo,
  { readonly grupoId: string; readonly opciones: number }
>({
  nombre: 'catalogo.guardar_grupo_de_opciones',
  entidad: 'modificador',
  escribe: true,
  roles: [...ROLES],
  paquetes: PAQUETES_OPERATIVOS,
  entrada: entradaGuardarGrupo,
  async ejecutar(ctx, entrada) {
    const { organizacionId } = ctx.ambito;
    const activas = entrada.opciones.filter((o) => o.activa).length;
    if (entrada.minimo !== null && entrada.minimo > activas) {
      throw new ErrorDominio(
        'CATALOGO_INVALIDO',
        `«${entrada.nombre}» pide elegir ${String(entrada.minimo)} y sólo tiene ${String(activas)} opciones activas.`,
      );
    }
    const datos = {
      nombre: entrada.nombre,
      tipo: entrada.tipo,
      obligatorio: entrada.obligatorio,
      minimo_elecciones: entrada.minimo,
      maximo_elecciones: entrada.maximo,
      activo: entrada.activo,
      updated_at: ctx.ahora,
    };
    const grupoId =
      entrada.grupoId === undefined
        ? (
            await ctx.paso('crear_grupo', () =>
              ctx.tx
                .insertInto('modificadores')
                .values({ ...datos, organizacion_id: organizacionId })
                .returning('id')
                .executeTakeFirstOrThrow(),
            )
          ).id
        : await ctx.paso('actualizar_grupo', () =>
            actualizarGrupo(ctx.tx, organizacionId, entrada.grupoId ?? '', datos),
          );

    await ctx.paso('guardar_opciones', () => guardarOpciones(ctx.tx, grupoId, entrada.opciones));
    ctx.auditar({
      entidadId: grupoId,
      payload: {
        nombre: entrada.nombre,
        opciones: entrada.opciones.length,
        nuevo: entrada.grupoId === undefined,
      },
    });
    return { grupoId, opciones: entrada.opciones.length };
  },
});

async function actualizarGrupo(
  tx: Transaccion,
  organizacionId: string,
  grupoId: string,
  datos: Record<string, unknown>,
): Promise<string> {
  const fila = await tx
    .updateTable('modificadores')
    .set(datos)
    .where('organizacion_id', '=', organizacionId)
    .where('id', '=', grupoId)
    .returning('id')
    .executeTakeFirst();
  if (fila === undefined)
    throw new ErrorDominio('CATALOGO_INVALIDO', 'Ese grupo de opciones ya no existe.');
  return fila.id;
}

/**
 * Las opciones del grupo, en su orden: las que traen `id` se actualizan, las nuevas se crean y las
 * que ya no vienen se borran (lo vendido conserva su nombre: la llave de la instantánea es
 * `on delete set null`).
 */
async function guardarOpciones(
  tx: Transaccion,
  grupoId: string,
  opciones: z.output<typeof entradaGuardarGrupo>['opciones'],
): Promise<void> {
  const conId = opciones.flatMap((o) => (o.id === undefined ? [] : [o.id]));
  let borrar = tx.deleteFrom('modificador_opciones').where('modificador_id', '=', grupoId);
  if (conId.length > 0) borrar = borrar.where('id', 'not in', conId);
  await borrar.execute();
  for (const [orden, o] of opciones.entries()) {
    const delta = centavosConSigno(o.precio);
    const fila = {
      nombre: o.nombre,
      orden,
      activa: o.activa,
      delta_precio_centavos: delta,
      // La columna vieja es `>= 0`: guarda lo positivo, por compatibilidad.
      precio_extra_centavos: delta > 0n ? delta : 0n,
    };
    if (o.id === undefined) {
      await tx
        .insertInto('modificador_opciones')
        .values({ ...fila, modificador_id: grupoId })
        .execute();
      continue;
    }
    const r = await tx
      .updateTable('modificador_opciones')
      .set(fila)
      .where('modificador_id', '=', grupoId)
      .where('id', '=', o.id)
      .executeTakeFirst();
    if (Number(r.numUpdatedRows) !== 1) {
      throw new ErrorDominio('CATALOGO_INVALIDO', `La opción «${o.nombre}» no es de este grupo.`);
    }
  }
}

export const asignarGruposAlProducto = definirComando<
  Transaccion,
  typeof entradaAsignarGrupos,
  { readonly productoId: string; readonly grupos: number }
>({
  nombre: 'catalogo.asignar_grupos_de_opciones',
  entidad: 'modificador',
  escribe: true,
  roles: [...ROLES],
  paquetes: PAQUETES_OPERATIVOS,
  entrada: entradaAsignarGrupos,
  async ejecutar(ctx, entrada) {
    const { organizacionId } = ctx.ambito;
    const unicos = [...new Set(entrada.grupoIds)];
    const producto = await ctx.paso('verificar_producto', () =>
      ctx.tx
        .selectFrom('productos')
        .select('id')
        .where('organizacion_id', '=', organizacionId)
        .where('id', '=', entrada.productoId)
        .executeTakeFirst(),
    );
    if (producto === undefined)
      throw new ErrorDominio('CATALOGO_INVALIDO', 'El producto no existe.');
    if (unicos.length > 0) {
      const suyos = await ctx.paso('verificar_grupos', () =>
        ctx.tx
          .selectFrom('modificadores')
          .select('id')
          .where('organizacion_id', '=', organizacionId)
          .where('id', 'in', unicos)
          .execute(),
      );
      if (suyos.length !== unicos.length) {
        throw new ErrorDominio('CATALOGO_INVALIDO', 'Uno de los grupos de opciones ya no existe.');
      }
    }
    await ctx.paso('soltar', () =>
      ctx.tx
        .deleteFrom('producto_modificadores')
        .where('organizacion_id', '=', organizacionId)
        .where('producto_id', '=', entrada.productoId)
        .execute(),
    );
    if (unicos.length > 0) {
      await ctx.paso('unir', () =>
        ctx.tx
          .insertInto('producto_modificadores')
          .values(
            unicos.map((modificador_id, orden) => ({
              organizacion_id: organizacionId,
              producto_id: entrada.productoId,
              modificador_id,
              orden,
            })),
          )
          .execute(),
      );
    }
    ctx.auditar({ entidadId: entrada.productoId, payload: { grupos: unicos.length } });
    return { productoId: entrada.productoId, grupos: unicos.length };
  },
});
