import 'server-only';

import type { Transaccion } from '@morphiqpos/data';

/**
 * LAS ALERGIAS Y LA CELEBRACIÓN DE UNA MESA QUE SE UNE A OTRA (DP-12.3).
 *
 * Al unir, las líneas y las comandas de la absorbida pasan a la cuenta de la principal, pero sus
 * notas de alergias y de celebración se quedaban en su mesa y en su cuenta, ocultas: las comandas
 * nuevas copian las de la principal (`comandas.ts`) y nadie volvía a ver «alergia a nueces». Es un
 * tema de inocuidad. Ahora se juntan en la principal —en la mesa, que es lo que ve el mesero, y en
 * la cuenta, de donde copia la cocina— sin repetir lo que ya decía.
 */

const SEPARADOR = ' · ';

/** Las dos notas juntas, sin vacíos ni repetidas; `null` si no queda nada. */
export function notasJuntas(...notas: readonly (string | null | undefined)[]): string | null {
  const vistas: string[] = [];
  for (const nota of notas) {
    for (const parte of (nota ?? '').split(SEPARADOR)) {
      const limpia = parte.trim();
      if (limpia !== '' && !vistas.some((v) => v.toLowerCase() === limpia.toLowerCase())) {
        vistas.push(limpia);
      }
    }
  }
  return vistas.length === 0 ? null : vistas.join(SEPARADOR);
}

interface NotasDeMesa {
  readonly notas_alergias: string | null;
  readonly celebracion_especial: boolean;
  readonly tipo_celebracion: string | null;
}

function juntas(a: NotasDeMesa | undefined, b: NotasDeMesa | undefined): NotasDeMesa {
  return {
    notas_alergias: notasJuntas(a?.notas_alergias, b?.notas_alergias),
    celebracion_especial: (a?.celebracion_especial ?? false) || (b?.celebracion_especial ?? false),
    tipo_celebracion: notasJuntas(a?.tipo_celebracion, b?.tipo_celebracion),
  };
}

/**
 * Lleva las notas de la absorbida (su mesa y su cuenta, si la tenía) a la principal (su mesa y su
 * cuenta, si la tiene). Va dentro de la transacción de unir, con las filas ya bloqueadas.
 */
export async function llevarLasNotasALaPrincipal(
  tx: Transaccion,
  organizacionId: string,
  principal: { readonly mesaId: string; readonly ordenId: string | null },
  absorbida: { readonly mesaId: string; readonly ordenId: string | null },
): Promise<void> {
  const columnas = ['id', 'notas_alergias', 'celebracion_especial', 'tipo_celebracion'] as const;
  const mesas = await tx
    .selectFrom('mesas')
    .select(columnas)
    .where('organizacion_id', '=', organizacionId)
    .where('id', 'in', [principal.mesaId, absorbida.mesaId])
    .execute();
  const ordenes = [principal.ordenId, absorbida.ordenId].filter((id): id is string => id !== null);
  const cuentas =
    ordenes.length === 0
      ? []
      : await tx
          .selectFrom('ordenes')
          .select(columnas)
          .where('organizacion_id', '=', organizacionId)
          .where('id', 'in', ordenes)
          .execute();
  const de = <T extends { readonly id: string }>(filas: readonly T[], id: string | null) =>
    id === null ? undefined : filas.find((f) => f.id === id);

  const notas = juntas(
    juntas(de(mesas, principal.mesaId), de(cuentas, principal.ordenId)),
    juntas(de(mesas, absorbida.mesaId), de(cuentas, absorbida.ordenId)),
  );
  await tx
    .updateTable('mesas')
    .set(notas)
    .where('organizacion_id', '=', organizacionId)
    .where('id', '=', principal.mesaId)
    .execute();
  if (principal.ordenId !== null) {
    await tx
      .updateTable('ordenes')
      .set(notas)
      .where('organizacion_id', '=', organizacionId)
      .where('id', '=', principal.ordenId)
      .execute();
  }
}
