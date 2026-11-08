import { obtenerDb } from '@morphiqpos/data';
import { beforeAll, describe, expect, it } from 'vitest';

import { comando } from '../produccion.ts';
import { clave, exigirOk } from '../pruebas/negocio-real.ts';
import { anularLineaComando } from './anulacion-linea.ts';
import { transicionarPedido } from './preparacion.ts';
import {
  ARRACHERA_CENTAVOS,
  CERVEZA_CENTAVOS,
  GUACAMOLE_CENTAVOS,
  abrirLasCajas,
  ambitoDeCaja,
  cobrarExacto,
  dividirEn,
  lineasDe,
  mesaPersistida,
  pedirLaCuenta,
  pedirMas,
  sembrarSalon,
  sentarYPedir,
  type Salon,
} from './pruebas/salon-real.ts';

/**
 * DP-15 · F1 · LOS ESTADOS DE LA MESA Y LAS COMANDAS QUE SIGUEN DESPUÉS DE COBRAR (Postgres real).
 *
 * M1: con varias estaciones la mesa no llegaba a «Esperando entrega»: la última comanda que pasaba
 * a «listo» veía a las demás, también «listo», como «activas» y no movía la mesa.
 *
 * M2: al cobrar, lo que la cocina ya tenía «listo» se quedaba en su pantalla («Esperando que el
 * mesero recoja») y el platillo QUITADO seguía pintado en la comanda. Decisión: al cobrar, lo
 * «listo» se da por entregado; lo «nuevo» o «en preparación» NO se cierra (es comida que quizá se
 * va a servir): sigue visible y la pantalla lo marca «cuenta cobrada».
 */

let salon: Salon;
const POR_COMANDOS = 120_000;

beforeAll(async () => {
  salon = await sembrarSalon({ nombre: 'Fonda de las dos estaciones', mesas: 8, terminales: 2 });
  // La cerveza sale por la barra: su comanda es otra, con su propia pantalla.
  await obtenerDb()
    .updateTable('productos')
    .set({ area_preparacion: 'barra' })
    .where('id', '=', salon.platillos.cerveza)
    .execute();
  await abrirLasCajas(salon);
}, POR_COMANDOS);

const db = () => obtenerDb();

/** Las comandas de la cuenta, de la más vieja a la más nueva, con su área y sus platillos. */
async function comandasDe(ordenId: string) {
  const comandas = await db()
    .selectFrom('comandas')
    .select(['id', 'area', 'estado'])
    .where('orden_id', '=', ordenId)
    .orderBy('created_at')
    .orderBy('id')
    .execute();
  const items = await db()
    .selectFrom('comanda_items')
    .select(['comanda_id', 'producto_nombre', 'estado'])
    .where(
      'comanda_id',
      'in',
      comandas.map((c) => c.id),
    )
    .execute();
  return comandas.map((c) => ({
    ...c,
    items: items.filter((i) => i.comanda_id === c.id),
  }));
}

async function marcarListo(comandaId: string): Promise<void> {
  exigirOk(
    await comando(transicionarPedido, {
      entrada: { comandaId, estado: 'listo' },
      ambito: ambitoDeCaja(salon),
      idempotencyKey: clave(),
    }),
    'restaurante.transicionar_pedido',
  );
}

const estadoDeLaMesa = async (mesaId: string): Promise<string> =>
  (await mesaPersistida(mesaId)).estado;

describe('M1 · la mesa llega a «Esperando entrega» con varias estaciones', () => {
  it(
    'Cocina y Bebidas marcan «Listo»: la mesa pasa a esperando entrega',
    async () => {
      const { mesaId, ordenId } = await sentarYPedir(salon, 0, [
        { platillo: 'arrachera', cantidad: '1' },
        { platillo: 'cerveza', cantidad: '2' },
      ]);
      const [primera, segunda] = await comandasDe(ordenId);
      expect(primera?.area).not.toBe(segunda?.area);

      await marcarListo(primera?.id ?? '');
      // La barra sigue trabajando: la mesa NO está lista todavía.
      expect(await estadoDeLaMesa(mesaId)).not.toBe('en_espera_entrega');

      await marcarListo(segunda?.id ?? '');
      expect(await estadoDeLaMesa(mesaId)).toBe('en_espera_entrega');
    },
    POR_COMANDOS,
  );

  it(
    'con tres comandas, la mesa sólo pasa cuando la ÚLTIMA queda lista',
    async () => {
      const { mesaId, ordenId } = await sentarYPedir(salon, 1, [
        { platillo: 'arrachera', cantidad: '1' },
        { platillo: 'cerveza', cantidad: '1' },
      ]);
      await pedirMas(salon, ordenId, [{ platillo: 'guacamole', cantidad: '1' }]);
      const comandas = await comandasDe(ordenId);
      expect(comandas).toHaveLength(3);

      for (const comanda of comandas.slice(0, 2)) await marcarListo(comanda.id);
      expect(await estadoDeLaMesa(mesaId)).not.toBe('en_espera_entrega');

      await marcarListo(comandas[2]?.id ?? '');
      expect(await estadoDeLaMesa(mesaId)).toBe('en_espera_entrega');
    },
    POR_COMANDOS,
  );
});

describe('M2 · al cobrar, las comandas ya no se quedan en la pantalla de la estación', () => {
  it(
    'lo «listo» se da por entregado; lo «nuevo» sigue visible (no se pierde comida)',
    async () => {
      const { ordenId } = await sentarYPedir(salon, 2, [
        { platillo: 'arrachera', cantidad: '1' },
        { platillo: 'cerveza', cantidad: '1' },
      ]);
      await pedirMas(salon, ordenId, [{ platillo: 'guacamole', cantidad: '1' }]);
      const [cocina, barra, postre] = await comandasDe(ordenId);
      await marcarListo(barra?.id ?? '');
      await marcarListo(cocina?.id ?? '');

      await pedirLaCuenta(salon, ordenId);
      const total = ARRACHERA_CENTAVOS + CERVEZA_CENTAVOS + GUACAMOLE_CENTAVOS;
      exigirOk(await cobrarExacto(ambitoDeCaja(salon), ordenId, total), 'venta.cobrar');

      const despues = await comandasDe(ordenId);
      const de = (id: string | undefined) => despues.find((c) => c.id === id);
      expect(de(barra?.id)?.estado).toBe('entregado');
      expect(de(barra?.id)?.items.map((i) => i.estado)).toEqual(['entregado']);
      expect(de(cocina?.id)?.estado).toBe('entregado');
      // Lo que nadie marcó sigue vivo: cerrarlo escondería comida que sí se va a servir.
      expect(de(postre?.id)?.estado).toBe('nuevo');
      expect(de(postre?.id)?.items.map((i) => i.estado)).toEqual(['pendiente']);
    },
    POR_COMANDOS,
  );

  it(
    'cobrar con la OTRA caja da lo mismo (la cuenta la toma la primera que cobra)',
    async () => {
      const { ordenId } = await sentarYPedir(salon, 3, [{ platillo: 'cerveza', cantidad: '1' }]);
      const [barra] = await comandasDe(ordenId);
      await marcarListo(barra?.id ?? '');
      await pedirLaCuenta(salon, ordenId);
      exigirOk(await cobrarExacto(ambitoDeCaja(salon, 1), ordenId, CERVEZA_CENTAVOS), 'cobrar');
      expect((await comandasDe(ordenId))[0]?.estado).toBe('entregado');
    },
    POR_COMANDOS,
  );

  it(
    'cuenta dividida: cada parte cobrada entrega SÓLO lo suyo; la comanda cierra con la última',
    async () => {
      const { ordenId } = await sentarYPedir(salon, 5, [
        { platillo: 'arrachera', cantidad: '1' },
        { platillo: 'guacamole', cantidad: '1' },
        { platillo: 'cerveza', cantidad: '1' },
      ]);
      for (const comanda of await comandasDe(ordenId)) await marcarListo(comanda.id);
      await pedirLaCuenta(salon, ordenId);
      const division = await dividirEn(salon, ordenId, [
        [{ platillo: 'cerveza', cantidad: 1 }],
        [{ platillo: 'arrachera', cantidad: 1 }],
        [{ platillo: 'guacamole', cantidad: 1 }],
      ]);
      const [cerveza, arrachera, guacamole] = division.hijas.map((h) => h.ordenId);
      const estados = async () =>
        Object.fromEntries(
          (await comandasDe(ordenId)).flatMap((c) =>
            c.items.map((i) => [i.producto_nombre, `${i.estado}/${c.estado}`]),
          ),
        );
      const cobra = async (parte: string | undefined, total: number, caja: number) =>
        exigirOk(await cobrarExacto(ambitoDeCaja(salon, caja), parte ?? '', total), 'venta.cobrar');

      await cobra(cerveza, CERVEZA_CENTAVOS, 0);
      expect(await estados()).toMatchObject({
        'Cerveza clara': 'entregado/entregado',
        'Arrachera al carbón': 'listo/listo',
        'Guacamole con totopos': 'listo/listo',
      });
      await cobra(arrachera, ARRACHERA_CENTAVOS, 1);
      expect(await estados()).toMatchObject({
        'Arrachera al carbón': 'entregado/listo',
        'Guacamole con totopos': 'listo/listo',
      });
      await cobra(guacamole, GUACAMOLE_CENTAVOS, 0);
      expect(await estados()).toMatchObject({
        'Guacamole con totopos': 'entregado/entregado',
        'Arrachera al carbón': 'entregado/entregado',
      });
    },
    POR_COMANDOS,
  );

  it(
    'el platillo QUITADO ya no cuenta en la comanda; si era el único, la comanda se cancela',
    async () => {
      const { ordenId } = await sentarYPedir(salon, 4, [
        { platillo: 'arrachera', cantidad: '1' },
        { platillo: 'guacamole', cantidad: '1' },
      ]);
      const quitar = async (platillo: string) =>
        exigirOk(
          await comando(anularLineaComando, {
            entrada: {
              ordenId,
              lineaId: (await lineasDe(ordenId)).get(platillo)?.[0] ?? '',
              motivo: 'error_mesero',
            },
            ambito: ambitoDeCaja(salon),
            idempotencyKey: clave(),
          }),
          'restaurante.anular_linea',
        );

      await quitar('Guacamole con totopos');
      const [comanda] = await comandasDe(ordenId);
      // Sigue la arrachera: la comanda vive, con el guacamole quitado marcado como cancelado.
      expect(comanda?.estado).toBe('nuevo');
      expect(comanda?.items.filter((i) => i.estado === 'cancelado')).toHaveLength(1);

      await quitar('Arrachera al carbón');
      // Ya no queda ningún platillo vivo: la pantalla de la estación no debe seguir con ella.
      expect((await comandasDe(ordenId))[0]?.estado).toBe('cancelado');
    },
    POR_COMANDOS,
  );
});

/** Quita (anula) el primer renglón del platillo en la cuenta. */
async function quitarDe(ordenId: string, platillo: string): Promise<void> {
  exigirOk(
    await comando(anularLineaComando, {
      entrada: {
        ordenId,
        lineaId: (await lineasDe(ordenId)).get(platillo)?.[0] ?? '',
        motivo: 'error_mesero',
      },
      ambito: ambitoDeCaja(salon),
      idempotencyKey: clave(),
    }),
    'restaurante.anular_linea',
  );
}

describe('DP-15 · la revisión · la mesa, cuando se quita lo último que faltaba', () => {
  it(
    'se quita el único platillo de la mesa: la comanda se cancela y la mesa queda ocupada, sin nada en cocina',
    async () => {
      const { mesaId, ordenId } = await sentarYPedir(salon, 6, [
        { platillo: 'arrachera', cantidad: '1' },
      ]);
      expect(await estadoDeLaMesa(mesaId)).toBe('pedido_enviado');

      await quitarDe(ordenId, 'Arrachera al carbón');
      expect((await comandasDe(ordenId))[0]?.estado).toBe('cancelado');
      expect(await estadoDeLaMesa(mesaId)).toBe('ocupada');
    },
    POR_COMANDOS,
  );

  it(
    'la barra ya terminó y se quita lo único pendiente de la cocina: la mesa pasa a esperando entrega',
    async () => {
      const { mesaId, ordenId } = await sentarYPedir(salon, 7, [
        { platillo: 'arrachera', cantidad: '1' },
        { platillo: 'cerveza', cantidad: '1' },
      ]);
      const barra = (await comandasDe(ordenId)).find((c) => c.area === 'barra');
      await marcarListo(barra?.id ?? '');
      expect(await estadoDeLaMesa(mesaId)).not.toBe('en_espera_entrega');

      await quitarDe(ordenId, 'Arrachera al carbón');
      expect(await estadoDeLaMesa(mesaId)).toBe('en_espera_entrega');
    },
    POR_COMANDOS,
  );
});
