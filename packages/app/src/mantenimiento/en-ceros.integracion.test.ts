import { obtenerDb } from '@morphiqpos/data';
import { beforeAll, describe, expect, it } from 'vitest';

import { comando } from '../produccion.ts';
import { clave, exigirOk } from '../pruebas/negocio-real.ts';
import { purgarSeccionDelHistorico, purgarVentas } from './comandos.ts';
import {
  loQueHayParaDejarEnCeros,
  motivosParaNoDejarEnCeros,
  reiniciarFolios,
} from './en-ceros.ts';
import { sembrarUnDia, type DiaSembrado } from './pruebas/dia-completo.ts';

/**
 * DP-18 · 1.6 · DEJAR EN CEROS (lo que hace `scripts/dejar-en-ceros.mjs`, por sus comandos).
 *
 * Un día de ventas de prueba: el guion cuenta lo que hay y lo que hay de antes (para negarse si algo
 * no es de prueba); purga las ventas y las cajas; y reinicia los folios, que sólo se dejan reiniciar
 * cuando ya no hay una cuenta ni un corte con folio. La auditoría se queda.
 */

let dia: DiaSembrado;
let nombre = '';
const org = () => dia.salon.negocio.organizacionId;
const hoyEnCdmx = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date());

beforeAll(async () => {
  dia = await sembrarUnDia('En ceros');
  nombre = (
    await obtenerDb()
      .selectFrom('organizaciones')
      .select('nombre')
      .where('id', '=', org())
      .executeTakeFirstOrThrow()
  ).nombre;
});

describe('DP-18 · 1.6 · dejar en ceros', () => {
  it('cuenta lo de hoy y lo de antes; se niega con algo de antes o con más cobradas de las dichas', async () => {
    const hay = await loQueHayParaDejarEnCeros(obtenerDb(), org(), hoyEnCdmx());
    expect(hay.conteos.cuentas).toBeGreaterThan(0);
    expect(hay.conteos.cajas).toBeGreaterThan(0);
    expect(hay.anteriores).toEqual({ cuentas: 0, cajas: 0, pagos: 0 });
    expect(motivosParaNoDejarEnCeros(hay, hay.conteos.cobradas)).toEqual([]);
    expect(motivosParaNoDejarEnCeros(hay, hay.conteos.cobradas - 1).join()).toMatch(
      /cuentas cobradas/,
    );
    // «Desde mañana»: todo lo de hoy es «de antes».
    const manana = new Date(Date.now() + 86_400_000);
    const desdeManana = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Mexico_City',
    }).format(manana);
    const antes = await loQueHayParaDejarEnCeros(obtenerDb(), org(), desdeManana);
    expect(motivosParaNoDejarEnCeros(antes, 999).join()).toMatch(/cuentas de antes/);
  });

  it('los folios no se reinician mientras haya cuentas o cortes con folio', async () => {
    const r = await comando(reiniciarFolios, {
      ambito: dia.plataforma,
      entrada: { confirmacionNombreNegocio: nombre },
      idempotencyKey: clave(),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.mensaje).toMatch(/purga primero las ventas y los cortes/);
  });

  it('purgadas las ventas y las cajas, el siguiente ticket es el 1 y la auditoría se queda', async () => {
    const auditoriaAntes = await obtenerDb()
      .selectFrom('auditoria')
      .select((eb) => eb.fn.countAll<string>().as('n'))
      .where('organizacion_id', '=', org())
      .executeTakeFirstOrThrow();
    exigirOk(
      await comando(purgarVentas, {
        ambito: dia.plataforma,
        entrada: { confirmacionNombreNegocio: nombre, revertirInventario: true },
        idempotencyKey: clave(),
      }),
      'mantenimiento.purgar_ventas',
    );
    exigirOk(
      await comando(purgarSeccionDelHistorico, {
        ambito: dia.plataforma,
        entrada: { confirmacionNombreNegocio: nombre, seccion: 'cortes' },
        idempotencyKey: clave(),
      }),
      'mantenimiento.purgar_seccion',
    );
    const r = exigirOk(
      await comando(reiniciarFolios, {
        ambito: dia.plataforma,
        entrada: { confirmacionNombreNegocio: nombre },
        idempotencyKey: clave(),
      }),
      'mantenimiento.reiniciar_folios',
    );
    expect(r.borrado['folios']).toBeGreaterThan(0);
    const folios = await obtenerDb()
      .selectFrom('folios')
      .select('siguiente')
      .where('organizacion_id', '=', org())
      .execute();
    expect(folios.every((f) => BigInt(f.siguiente) === 1n)).toBe(true);
    const despues = await loQueHayParaDejarEnCeros(obtenerDb(), org(), hoyEnCdmx());
    expect(Object.values(despues.conteos).every((n) => n === 0)).toBe(true);
    const auditoriaDespues = await obtenerDb()
      .selectFrom('auditoria')
      .select((eb) => eb.fn.countAll<string>().as('n'))
      .where('organizacion_id', '=', org())
      .executeTakeFirstOrThrow();
    // Lo de antes sigue, y se le suman los tres pasos.
    expect(Number(auditoriaDespues.n)).toBe(Number(auditoriaAntes.n) + 3);
  });
});
