import 'server-only';

import { PAQUETES_OPERATIVOS } from '@morphiqpos/contracts';
import type { Transaccion } from '@morphiqpos/data';
import { z } from 'zod';

import { definirComando } from '../comando.ts';

/** DP-16 · La biblioteca de grupos de opciones del negocio, para el editor de Productos. */

const ROLES = ['dueno', 'administrador', 'gerente'] as const;
const TOPE_DE_GRUPOS = 300;

export interface OpcionDeLaBiblioteca {
  readonly id: string;
  readonly nombre: string;
  /** Centavos con signo, como texto (R15). */
  readonly precioCentavos: string;
  readonly activa: boolean;
}

export interface GrupoDeLaBiblioteca {
  readonly id: string;
  readonly nombre: string;
  readonly tipo: 'unica' | 'multiple';
  readonly obligatorio: boolean;
  readonly minimo: number | null;
  readonly maximo: number | null;
  readonly activo: boolean;
  readonly opciones: readonly OpcionDeLaBiblioteca[];
  /** Los productos que lo usan, para decir «se usa en 4 productos» antes de cambiarlo. */
  readonly productoIds: readonly string[];
}

export const entradaGruposDeOpciones = z.object({}).strict();

export async function leerLaBiblioteca(
  tx: Transaccion,
  organizacionId: string,
): Promise<readonly GrupoDeLaBiblioteca[]> {
  const grupos = await tx
    .selectFrom('modificadores')
    .select([
      'id',
      'nombre',
      'tipo',
      'obligatorio',
      'minimo_elecciones',
      'maximo_elecciones',
      'activo',
    ])
    .where('organizacion_id', '=', organizacionId)
    .orderBy('nombre')
    .orderBy('id')
    .limit(TOPE_DE_GRUPOS)
    .execute();
  if (grupos.length === 0) return [];
  const ids = grupos.map((g) => g.id);
  const [opciones, usos] = await Promise.all([
    tx
      .selectFrom('modificador_opciones')
      .select([
        'id',
        'modificador_id',
        'nombre',
        'delta_precio_centavos',
        'precio_extra_centavos',
        'activa',
      ])
      .where('modificador_id', 'in', ids)
      .orderBy('orden')
      .orderBy('id')
      .execute(),
    tx
      .selectFrom('producto_modificadores')
      .select(['modificador_id', 'producto_id'])
      .where('organizacion_id', '=', organizacionId)
      .where('modificador_id', 'in', ids)
      .execute(),
  ]);
  return grupos.map((g) => ({
    id: g.id,
    nombre: g.nombre,
    tipo: g.tipo === 'multiple' ? 'multiple' : 'unica',
    obligatorio: g.obligatorio,
    minimo: g.minimo_elecciones,
    maximo: g.maximo_elecciones,
    activo: g.activo,
    opciones: opciones
      .filter((o) => o.modificador_id === g.id)
      .map((o) => ({
        id: o.id,
        nombre: o.nombre,
        precioCentavos: (o.delta_precio_centavos !== 0n
          ? o.delta_precio_centavos
          : o.precio_extra_centavos
        ).toString(),
        activa: o.activa,
      })),
    productoIds: usos.filter((u) => u.modificador_id === g.id).map((u) => u.producto_id),
  }));
}

export const gruposDeOpciones = definirComando<
  Transaccion,
  typeof entradaGruposDeOpciones,
  { readonly grupos: readonly GrupoDeLaBiblioteca[] }
>({
  nombre: 'catalogo.grupos_de_opciones',
  entidad: 'modificador',
  escribe: false,
  roles: [...ROLES],
  paquetes: PAQUETES_OPERATIVOS,
  entrada: entradaGruposDeOpciones,
  async ejecutar(ctx) {
    const grupos = await ctx.paso('leer', () =>
      leerLaBiblioteca(ctx.tx, ctx.ambito.organizacionId),
    );
    return { grupos };
  },
});
