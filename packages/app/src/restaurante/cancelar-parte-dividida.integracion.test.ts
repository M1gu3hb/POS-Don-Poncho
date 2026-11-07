import { obtenerDb } from '@morphiqpos/data';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { cancelacionesRegistradasComando } from '../caja/corte/lectura-de-cancelaciones.ts';
import { firmarAutorizacion } from '../identidad/supervisor.ts';
import { comando } from '../produccion.ts';
import { clave, exigirOk, sembrarCompanero } from '../pruebas/negocio-real.ts';
import { cancelarOrden } from './cancelacion.ts';
import { liberarMesa } from './mesas.ts';
import { dividirCuentaComando } from './division.ts';
import {
  cancelar,
  cobrar,
  como,
  cuenta,
  dejarListoUnPlatillo,
  deLaCajera,
  mesero,
  negocio,
  sembrarElSalonQueCancela,
} from './pruebas/cancelacion-real.ts';

/**
 * DP-14.6 (medio 1) · CANCELAR UNA PARTE DE UNA CUENTA DIVIDIDA, contra Postgres.
 *
 * Las partes nacen sin mesa (`division-escrituras.ts`) y `ordenDeMesa` las rechazaba: una parte
 * que el comensal ya no iba a pagar no tenía salida. Ahora se cancela con las mismas reglas de una
 * cuenta (motivo, PIN cuando ya se pidió, pérdida de lo ya hecho) y, después, la madre vale lo que
 * suman sus partes vivas y la mesa no se queda ocupada para siempre.
 */

const SECRETO = 'secreto_de_integracion_para_firmar_autorizaciones_2026';
vi.mock('@morphiqpos/contracts', async (original) => ({
  ...(await original<typeof import('@morphiqpos/contracts')>()),
  validarEntorno: () => ({ SESSION_SECRET: SECRETO }),
}));

let gema = '';
let pablo = '';

beforeAll(async () => {
  await sembrarElSalonQueCancela();
  gema = await sembrarCompanero(negocio, { nombre: 'Gema', rol: 'gerente' });
  pablo = await sembrarCompanero(negocio, { nombre: 'Pablo', rol: 'mesero' });
});

const codigo = (r: {
  ok: boolean;
  error?: { codigo: string; datos?: Readonly<Record<string, unknown>> | undefined };
}): string => {
  if (r.ok) return 'ok';
  const regla = r.error?.datos?.['regla'];
  return typeof regla === 'string' ? regla : (r.error?.codigo ?? '?');
};

/** Una mesa con tres arracheras, dividida en tres partes de una cada una. */
async function mesaDividida(numero: number) {
  const { ordenId: madreId, lineaIds } = await cuenta(numero, ['1', '1', '1']);
  const hechas = exigirOk(
    await comando(dividirCuentaComando, {
      entrada: {
        ordenId: madreId,
        particiones: lineaIds.map((lineaId) => ({ tomas: [{ lineaId, cantidad: 1 }] })),
      },
      ambito: deLaCajera(),
      idempotencyKey: clave(),
    }),
    'restaurante.dividir_cuenta',
  );
  const partes = hechas.hijas.map((h) => h.ordenId);
  const db = obtenerDb();
  const { mesa_id } = await db
    .selectFrom('ordenes')
    .select('mesa_id')
    .where('id', '=', madreId)
    .executeTakeFirstOrThrow();
  return { madreId, partes, lineaIds, mesaId: mesa_id ?? '' };
}

const laMesa = (mesaId: string) =>
  obtenerDb()
    .selectFrom('mesas')
    .select(['estado', 'orden_activa_id'])
    .where('id', '=', mesaId)
    .executeTakeFirstOrThrow();

const laOrden = (id: string) =>
  obtenerDb()
    .selectFrom('ordenes')
    .select(['estado', 'total_centavos', 'cancelada_por', 'motivo_cancelacion'])
    .where('id', '=', id)
    .executeTakeFirstOrThrow();

/** Lo que firma `/api/identidad/supervisor` cuando Gema teclea su PIN para la mesera. */
const conPin = (parteId: string, solicita: string, ambito = como(solicita, 'mesero')) =>
  comando(cancelarOrden, {
    entrada: {
      ordenId: parteId,
      motivo: 'El comensal ya no la paga',
      autorizacion: firmarAutorizacion(
        {
          org: negocio.organizacionId,
          supervisor: gema,
          rol: 'gerente',
          solicita,
          exp: Math.floor(Date.now() / 1000) + 120,
          n: `prueba-${clave().slice(0, 8)}`,
          para: 'cancelacion',
          cuenta: parteId,
        },
        SECRETO,
      ),
    },
    ambito,
    idempotencyKey: clave(),
  });

describe('cancelar una parte', () => {
  it('la gerente cancela una parte: queda con su motivo y quién, y la madre suma las vivas', async () => {
    const { madreId, partes, mesaId } = await mesaDividida(1);
    const [primera, segunda, tercera] = partes;
    const antes = (await laOrden(madreId)).total_centavos;
    const parte = (await laOrden(segunda ?? '')).total_centavos;

    const r = exigirOk(
      await cancelar(segunda ?? '', como(gema, 'gerente'), 'Se fue sin pagar'),
      'restaurante.cancelar_orden',
    );
    expect(r).toMatchObject({ ordenId: segunda, mesaLiberada: false });
    expect(await laOrden(segunda ?? '')).toMatchObject({
      estado: 'cancelada',
      cancelada_por: gema,
      motivo_cancelacion: 'Se fue sin pagar',
    });
    expect((await laOrden(primera ?? '')).estado).toBe('cuenta_solicitada');
    expect((await laOrden(tercera ?? '')).estado).toBe('cuenta_solicitada');
    // La madre vale lo que suman sus partes vivas (la base lo exige al confirmar).
    expect((await laOrden(madreId)).total_centavos).toBe(antes - parte);
    // Quedan partes por cobrar: la mesa sigue sirviéndose, con su cuenta.
    expect(await laMesa(mesaId)).toEqual({ estado: 'cuenta_solicitada', orden_activa_id: madreId });
  });

  it('la cocina deja de preparar lo de esa parte y NO lo de las demás', async () => {
    const { partes, lineaIds } = await mesaDividida(2);
    await cancelar(partes[0] ?? '', como(gema, 'gerente'));
    const items = await obtenerDb()
      .selectFrom('comanda_items')
      .select(['orden_linea_id', 'estado'])
      .where('orden_linea_id', 'in', lineaIds)
      .execute();
    const de = (i: number) => items.find((x) => x.orden_linea_id === lineaIds[i])?.estado;
    expect(de(0)).toBe('cancelado');
    expect(de(1)).not.toBe('cancelado');
    expect(de(2)).not.toBe('cancelado');
  });

  it('lo ya hecho de la parte es pérdida en Registros, a su precio', async () => {
    const { partes, lineaIds } = await mesaDividida(3);
    await dejarListoUnPlatillo(lineaIds[1] ?? '');
    const total = (await laOrden(partes[1] ?? '')).total_centavos;
    exigirOk(
      await cancelar(partes[1] ?? '', como(gema, 'gerente'), 'Se enfrió y la rechazaron'),
      'cancelar',
    );
    const registros = exigirOk(
      await comando(cancelacionesRegistradasComando, {
        entrada: { dias: 1 },
        ambito: como(gema, 'gerente'),
        idempotencyKey: clave(),
      }),
      'caja.cancelaciones_registradas',
    );
    const fila = registros.cancelaciones.find((c) => c.motivo === 'Se enfrió y la rechazaron');
    expect(fila).toMatchObject({ tipo: 'orden', perdida: true, perdidaCentavos: total.toString() });
  });

  it('la madre no se cancela entera mientras esté dividida', async () => {
    const { madreId } = await mesaDividida(4);
    expect(codigo(await cancelar(madreId, como(gema, 'gerente')))).toBe('ORDEN_NO_EDITABLE');
  });

  it('un segundo toque no es un error', async () => {
    const { partes } = await mesaDividida(5);
    exigirOk(await cancelar(partes[0] ?? '', como(gema, 'gerente')), 'cancelar');
    const otra = exigirOk(
      await cancelar(partes[0] ?? '', como(gema, 'gerente')),
      'cancelar otra vez',
    );
    expect(otra.yaEstabaCancelada).toBe(true);
  });
});

describe('quién cancela una parte', () => {
  it('la mesera que atiende la mesa necesita el PIN de un gerente (la parte ya se pidió)', async () => {
    const { partes } = await mesaDividida(6);
    expect(codigo(await cancelar(partes[0] ?? '', mesero()))).toBe('PUESTO_NO_OTORGABLE');
    exigirOk(
      await conPin(partes[0] ?? '', mesero().empleoId, mesero()),
      'cancelar con el PIN de la gerente',
    );
    expect((await laOrden(partes[0] ?? '')).estado).toBe('cancelada');
  });

  it('otro mesero no cancela la parte de una mesa que no es suya, ni con PIN', async () => {
    const { partes } = await mesaDividida(7);
    expect(codigo(await cancelar(partes[0] ?? '', como(pablo, 'mesero')))).toBe('SIN_PERMISO');
    expect(codigo(await conPin(partes[0] ?? '', pablo))).toBe('SIN_PERMISO');
    expect((await laOrden(partes[0] ?? '')).estado).toBe('cuenta_solicitada');
  });

  it('una parte ya cobrada no se cancela', async () => {
    const { partes } = await mesaDividida(8);
    await cobrar(partes[0] ?? '', deLaCajera());
    expect(codigo(await cancelar(partes[0] ?? '', como(gema, 'gerente')))).toBe(
      'ORDEN_NO_EDITABLE',
    );
  });
});

describe('la mesa tras cancelar las partes', () => {
  it('si se cancelan todas, la mesa vuelve a libre y no queda con cuenta activa', async () => {
    const { madreId, partes, mesaId } = await mesaDividida(9);
    for (const parte of partes) exigirOk(await cancelar(parte, como(gema, 'gerente')), 'cancelar');
    expect(await laMesa(mesaId)).toEqual({ estado: 'libre', orden_activa_id: null });
    expect((await laOrden(madreId)).total_centavos).toBe(0n);
  });

  it('si una se cobró y se cancelan las demás, la mesa pasa a limpieza', async () => {
    const { partes, mesaId, madreId } = await mesaDividida(10);
    await cobrar(partes[0] ?? '', deLaCajera());
    exigirOk(await cancelar(partes[1] ?? '', como(gema, 'gerente')), 'cancelar 1');
    expect((await laMesa(mesaId)).estado).toBe('cuenta_solicitada');
    exigirOk(await cancelar(partes[2] ?? '', como(gema, 'gerente')), 'cancelar 2');
    expect(await laMesa(mesaId)).toEqual({ estado: 'limpieza', orden_activa_id: madreId });
  });

  it('cancelar una y cobrar las otras deja la mesa en limpieza', async () => {
    const { partes, mesaId } = await mesaDividida(11);
    exigirOk(await cancelar(partes[1] ?? '', como(gema, 'gerente')), 'cancelar');
    await cobrar(partes[0] ?? '', deLaCajera());
    expect((await laMesa(mesaId)).estado).toBe('cuenta_solicitada');
    await cobrar(partes[2] ?? '', deLaCajera());
    expect((await laMesa(mesaId)).estado).toBe('limpieza');
  });

  it('con todas canceladas la mesa queda libre para otra familia', async () => {
    const { partes, mesaId } = await mesaDividida(12);
    for (const parte of partes) await cancelar(parte, como(gema, 'gerente'));
    expect((await laMesa(mesaId)).estado).toBe('libre');
  });
});

describe('DP-14.6 (medio 9) · la mesa dividida y cobrada se suelta del cierre del día', () => {
  it('cobradas todas sus partes, «Marcar libre» la deja libre y sin venta activa', async () => {
    const { partes, mesaId, madreId } = await mesaDividida(13);
    for (const parte of partes) await cobrar(parte, deLaCajera());
    // Del cobro sale en limpieza, con el id de la cuenta de donde viene.
    expect(await laMesa(mesaId)).toEqual({ estado: 'limpieza', orden_activa_id: madreId });
    exigirOk(
      await comando(liberarMesa, {
        entrada: { mesaId },
        ambito: deLaCajera(),
        idempotencyKey: clave(),
      }),
      'restaurante.liberar_mesa',
    );
    expect(await laMesa(mesaId)).toEqual({ estado: 'libre', orden_activa_id: null });
    // La madre no se canceló como «mesa liberada sin consumo»: sus partes cobraron cada peso.
    expect((await laOrden(madreId)).estado).toBe('dividida');
  });

  it('con una parte sin cobrar «Marcar libre» se niega', async () => {
    const { partes, mesaId } = await mesaDividida(14);
    await cobrar(partes[0] ?? '', deLaCajera());
    const r = await comando(liberarMesa, {
      entrada: { mesaId },
      ambito: deLaCajera(),
      idempotencyKey: clave(),
    });
    expect(codigo(r)).toBe('MESA_NO_LIBERABLE');
    expect((await laMesa(mesaId)).estado).toBe('cuenta_solicitada');
  });
});
