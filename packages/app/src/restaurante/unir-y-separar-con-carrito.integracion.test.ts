import { obtenerDb } from '@morphiqpos/data';
import { describe, expect, it } from 'vitest';

import { MAXIMO_EN_EL_CARRITO } from '../portal/carrito.ts';
import { comando } from '../produccion.ts';
import { clave, exigirOk } from '../pruebas/negocio-real.ts';
import { LARGO_DE_LAS_NOTAS, notasJuntas } from './notas-de-la-union.ts';
import { ambitoDeCaja, type Salon } from './pruebas/salon-real.ts';
import { LADO, mesa, salonEnFila, unir } from './pruebas/union-en-el-plano.ts';
import { separarMesasComando } from './union-de-mesas.ts';

/**
 * DP-13.3 · UNIR Y SEPARAR NO PIERDEN NADA DEL PORTAL, contra Postgres.
 *
 *   · Las solicitudes pendientes de la mesa que se une se van con su carrito a la principal (una
 *     sola pendiente por mesa y tipo: si la principal ya tenía una del mismo tipo, la otra se
 *     resuelve).
 *   · Juntos, los carritos no pasan del tope (DP-D56): si pasarían, la unión no se hace y se dice
 *     por qué; nada se pierde.
 *   · Al separar, el carrito y las notas se quedan en la principal, y el resultado lo dice.
 *   · Las notas juntas tienen un largo máximo.
 */

const huella = (n: number) => n.toString(16).padStart(64, '0');

async function carritoEn(salon: Salon, mesaId: string, lineas: number): Promise<void> {
  const platillo = Object.values(salon.platillos)[0] ?? '';
  if (lineas === 0) return;
  await obtenerDb()
    .insertInto('carrito_mesa_lineas')
    .values(
      Array.from({ length: lineas }, (_, i) => ({
        organizacion_id: salon.negocio.organizacionId,
        mesa_id: mesaId,
        dispositivo_huella: huella(i + 1),
        producto_id: platillo,
        cantidad: '1',
      })),
    )
    .execute();
}

async function solicitud(salon: Salon, mesaId: string, tipo: string): Promise<string> {
  const { id } = await obtenerDb()
    .insertInto('solicitudes_qr')
    .values({
      organizacion_id: salon.negocio.organizacionId,
      mesa_id: mesaId,
      tipo,
      estado: 'pendiente',
      origen: 'portal_qr',
      ruteo_modo: 'general',
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  return id;
}

const pendientesDe = (salon: Salon) =>
  obtenerDb()
    .selectFrom('solicitudes_qr')
    .select(['id', 'mesa_id', 'tipo', 'estado'])
    .where('organizacion_id', '=', salon.negocio.organizacionId)
    .orderBy('created_at')
    .execute();

describe('al unir, las solicitudes van con el carrito', () => {
  it('la pendiente de la unida pasa a la principal; si ya había una del mismo tipo, se resuelve', async () => {
    const salon = await salonEnFila('Salón de las solicitudes', 2);
    const [uno, dos] = [mesa(salon, 0), mesa(salon, 1)];
    const ayudaEnLaUno = await solicitud(salon, uno, 'ayuda');
    const ayudaEnLaDos = await solicitud(salon, dos, 'ayuda');
    const ordenarEnLaDos = await solicitud(salon, dos, 'ordenar');
    exigirOk(await unir(salon, 0, [1], [{ i: 1, x: 100 + LADO, y: 100 }]), 'unir');
    const despues = await pendientesDe(salon);
    const de = (id: string) => despues.find((s) => s.id === id);
    expect(de(ayudaEnLaUno)).toMatchObject({ mesa_id: uno, estado: 'pendiente' });
    expect(de(ordenarEnLaDos)).toMatchObject({ mesa_id: uno, estado: 'pendiente' });
    expect(de(ayudaEnLaDos)?.estado).toBe('resuelta');
  });
});

describe('juntos, los carritos no pasan del tope (DP-D56)', () => {
  it('si pasarían, no se unen, se dice por qué, y nada se pierde', async () => {
    const salon = await salonEnFila('Salón del tope', 2);
    const [uno, dos] = [mesa(salon, 0), mesa(salon, 1)];
    await carritoEn(salon, uno, MAXIMO_EN_EL_CARRITO - 5);
    await carritoEn(salon, dos, 10);
    const r = await unir(salon, 0, [1], [{ i: 1, x: 100 + LADO, y: 100 }]);
    expect(r.ok ? null : r.error.datos?.['regla']).toBe('QR_CARRITO_LLENO');
    const lineas = await obtenerDb()
      .selectFrom('carrito_mesa_lineas')
      .select('mesa_id')
      .where('organizacion_id', '=', salon.negocio.organizacionId)
      .execute();
    expect(lineas.filter((l) => l.mesa_id === uno)).toHaveLength(MAXIMO_EN_EL_CARRITO - 5);
    expect(lineas.filter((l) => l.mesa_id === dos)).toHaveLength(10);
  });
});

describe('al separar, el carrito y las notas se quedan en la principal, y se dice', () => {
  it('el resultado de separar cuenta lo que se quedó en la principal', async () => {
    const salon = await salonEnFila('Salón que se separa', 2);
    const [, dos] = [mesa(salon, 0), mesa(salon, 1)];
    await carritoEn(salon, dos, 3);
    const { unionId } = exigirOk(
      await unir(salon, 0, [1], [{ i: 1, x: 100 + LADO, y: 100 }]),
      'unir',
    );
    const separado = exigirOk(
      await comando(separarMesasComando, {
        entrada: { unionId },
        ambito: ambitoDeCaja(salon),
        idempotencyKey: clave(),
      }),
      'separar',
    );
    expect(separado).toMatchObject({ lineasDelPortalEnLaPrincipal: 3 });
    expect(separado.aviso).toMatch(/se quedó en la mesa 1/);
  });
});

describe('las notas juntas tienen un largo máximo', () => {
  it('dos notas largas no pasan del máximo, y se nota que se cortó', () => {
    const larga = (letra: string) => `${letra.repeat(LARGO_DE_LAS_NOTAS - 10)} fin`;
    const juntas = notasJuntas(larga('a'), larga('b')) ?? '';
    expect(juntas.length).toBeLessThanOrEqual(LARGO_DE_LAS_NOTAS);
    expect(juntas.endsWith('…')).toBe(true);
  });

  it('las cortas siguen enteras', () => {
    expect(notasJuntas('Sin cacahuate', 'Sin gluten')).toBe('Sin cacahuate · Sin gluten');
  });
});
