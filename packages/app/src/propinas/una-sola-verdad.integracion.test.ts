import { randomUUID } from 'node:crypto';

import { conTransaccion, obtenerDb } from '@morphiqpos/data';
import type { Resultado } from '@morphiqpos/contracts';
import { sql } from 'kysely';
import { beforeAll, describe, expect, it } from 'vitest';

import { ejecutarComandoPublico } from '../portal/comando-publico.ts';
import { pedirCuentaQR, type ResultadoCuenta } from '../portal/cuenta.ts';
import { enviarPedidoDesdeQR } from '../portal/pedido.ts';
import { comando } from '../produccion.ts';
import {
  abrirCajaReal,
  ambitoDe,
  clave,
  exigirOk,
  sembrarNegocio,
  sembrarProducto,
  sembrarSucursal,
  type NegocioReal,
} from '../pruebas/negocio-real.ts';
import { solicitarCuenta } from '../restaurante/cuenta.ts';
import { abrirMesa } from '../restaurante/mesas.ts';
import { rotarQr } from '../restaurante/qr.ts';
import { cobrarOrden } from '../venta/cobrar.ts';
import { fijarPropina, type PropinaFijada } from './fijar-propina.ts';
import { fijarQuienEligeLaPropina } from './quien-elige.ts';

/**
 * DP-21 · Bloque 4 · LA PROPINA, UNA SOLA VERDAD, contra Postgres y en paralelo de verdad.
 *
 * Lo que vio Miguel (M11): la propina del portal y la de la Caja se pisaban. Aquí las dos
 * pantallas eligen sobre la misma cuenta, 50 veces cada caso:
 *
 *   · la Caja elige primero  → el portal no la pisa y se entera («ya quedó registrada en caja»);
 *   · el portal elige primero → la Caja recibe 409 con la vigente; «Cambiarla» sí la cambia;
 *   · los dos a la vez        → gana UNA, la otra se entera, y nunca hay un 500;
 *   · cobrar con la propina cambiada → el cobro se rechaza con la vigente y la cuenta no se paga.
 *
 * Y M12: sin la casilla del mesero, «Pedir cuenta» no escribe propina aunque la mande.
 */

const PIMIENTA = 'pimienta-de-la-prueba-de-propinas-0123456789';
const VECES = 50;
const LARGO = 600_000;
const TACO_CENTAVOS = 3_500;

let negocio: NegocioReal;
let ambito: ReturnType<typeof ambitoDe>;
let sucursalId: string;
let taco: string;
let siguienteMesa = 100;

beforeAll(async () => {
  negocio = await sembrarNegocio({
    nombre: 'Fonda de la propina',
    rol: 'dueno',
    giro: 'restaurante',
    paquete: 'restaurante',
  });
  const sucursal = await sembrarSucursal(negocio, { terminales: ['Caja'] });
  sucursalId = sucursal.sucursalId;
  ambito = ambitoDe(negocio, sucursalId, sucursal.terminales[0] ?? null);
  ({ productoId: taco } = await sembrarProducto(negocio, sucursal.almacenId, {
    nombre: 'Taco de barbacoa',
    precioCentavos: BigInt(TACO_CENTAVOS),
    existencia: '100000',
  }));
  await conTransaccion(async (tx) => {
    await tx
      .updateTable('productos')
      .set({ visible_en_menu_digital: true })
      .where('organizacion_id', '=', negocio.organizacionId)
      .execute();
    const banderas = {
      portal_qr_activo: true,
      portal_qr_permitir_pedidos_cliente: true,
      portal_qr_envia_a_cocina: 'comensales',
      portal_qr_comensales_abren_mesa: true,
      portal_qr_cuenta_modo: 'ambos',
    };
    await sql`
      insert into configuracion (organizacion_id, valores)
      values (${negocio.organizacionId}, ${JSON.stringify(banderas)}::jsonb)
      on conflict (organizacion_id)
      do update set valores = configuracion.valores || excluded.valores
    `.execute(tx);
  });
  await abrirCajaReal(ambito);
}, LARGO);

/** Una mesa nueva con su QR y un taco pedido: cada vuelta, la suya. */
async function mesaConCuenta(): Promise<{ token: string; ordenId: string }> {
  const mesaId = randomUUID();
  siguienteMesa += 1;
  const numero = siguienteMesa;
  await conTransaccion((tx) =>
    tx
      .insertInto('mesas')
      .values({
        id: mesaId,
        organizacion_id: negocio.organizacionId,
        sucursal_id: sucursalId,
        numero,
        nombre: `Mesa ${String(numero)}`,
      })
      .execute(),
  );
  exigirOk(
    await comando(abrirMesa, { entrada: { mesaId, personas: 2 }, ambito, idempotencyKey: clave() }),
    'restaurante.abrir_mesa',
  );
  const { qrToken } = exigirOk(
    await comando(rotarQr, { entrada: { mesaId }, ambito, idempotencyKey: clave() }),
    'restaurante.rotar_qr',
  );
  exigirOk(
    await ejecutarComandoPublico(enviarPedidoDesdeQR, {
      token: qrToken,
      organizacionId: negocio.organizacionId,
      entrada: { items: [{ productoId: taco, cantidad: '1' }] },
      idempotencyKey: clave(),
      pimienta: PIMIENTA,
    }),
    'portal.enviar_pedido',
  );
  const mesa = await obtenerDb()
    .selectFrom('mesas')
    .select('orden_activa_id')
    .where('id', '=', mesaId)
    .executeTakeFirstOrThrow();
  if (mesa.orden_activa_id === null) throw new Error('La mesa abierta no tiene orden.');
  return { token: qrToken, ordenId: mesa.orden_activa_id };
}

async function cuenta(ordenId: string) {
  const fila = await obtenerDb()
    .selectFrom('ordenes')
    .select(['estado', 'version', 'propina_tipo', 'propina_puntos_base', 'propina_origen'])
    .where('id', '=', ordenId)
    .executeTakeFirstOrThrow();
  return {
    estado: fila.estado,
    version: fila.version,
    tipo: fila.propina_tipo,
    puntosBase: fila.propina_puntos_base,
    origen: fila.propina_origen,
  };
}

function laCajaElige(
  ordenId: string,
  version: number,
  puntosBase: number,
  cambiar = false,
): Promise<Resultado<PropinaFijada>> {
  return comando(fijarPropina, {
    entrada: {
      ordenId,
      version,
      propinaTipo: 'porcentaje',
      propinaPuntosBase: puntosBase,
      cambiar,
    },
    ambito,
    idempotencyKey: clave(),
  });
}

function elPortalElige(token: string, porcentaje: number): Promise<Resultado<ResultadoCuenta>> {
  return ejecutarComandoPublico(pedirCuentaQR, {
    token,
    organizacionId: negocio.organizacionId,
    entrada: { propinaTipo: 'porcentaje', propinaPorcentaje: porcentaje },
    idempotencyKey: clave(),
    pimienta: PIMIENTA,
  });
}

function cobrar(ordenId: string, versionDeLaCuenta: number) {
  return comando(cobrarOrden, {
    entrada: {
      ordenId,
      pagos: [
        { metodo: 'efectivo', montoCentavos: TACO_CENTAVOS, recibidoCentavos: TACO_CENTAVOS },
      ],
      totalEsperadoCentavos: TACO_CENTAVOS,
      versionDeLaCuenta,
    },
    ambito,
    idempotencyKey: clave(),
  });
}

/** Ningún resultado puede ser «Algo falló de nuestro lado». */
function sinErrorInterno(resultado: Resultado<unknown>): void {
  if (!resultado.ok) expect(resultado.error.codigo).not.toBe('ERROR_INTERNO');
}

describe(`la propina del portal y la de la Caja, ${String(VECES)} veces cada caso`, () => {
  it('la Caja elige primero: el portal no la pisa y se entera', { timeout: LARGO }, async () => {
    for (let vuelta = 0; vuelta < VECES; vuelta += 1) {
      const { token, ordenId } = await mesaConCuenta();
      const antes = await cuenta(ordenId);
      const fijada = exigirOk(await laCajaElige(ordenId, antes.version, 1500), 'la caja elige');
      expect(fijada.propinaOrigen).toBe('caja');

      const delPortal = exigirOk(await elPortalElige(token, 10), 'el portal elige');
      expect(delPortal.propinaYaRegistradaEn).toBe('caja');
      // 15 % de $35.00, la de la Caja; no el 10 % que mandó el teléfono.
      expect(delPortal.propinaCentavos).toBe('525');

      const despues = await cuenta(ordenId);
      expect([despues.tipo, despues.puntosBase, despues.origen]).toEqual([
        'porcentaje',
        1500,
        'caja',
      ]);
      expect(despues.version).toBe(fijada.version);
    }
  });

  it(
    'el portal elige primero: la Caja recibe 409 con la vigente; «Cambiarla» sí la cambia',
    { timeout: LARGO },
    async () => {
      for (let vuelta = 0; vuelta < VECES; vuelta += 1) {
        const { token, ordenId } = await mesaConCuenta();
        const loQueVeiaLaCaja = await cuenta(ordenId);
        const delPortal = exigirOk(await elPortalElige(token, 10), 'el portal elige');
        expect(delPortal.propinaYaRegistradaEn).toBeUndefined();

        // La Caja, con la versión de antes: se entera de la del portal.
        const tarde = await laCajaElige(ordenId, loQueVeiaLaCaja.version, 1500);
        expect(tarde.ok).toBe(false);
        if (tarde.ok) continue;
        expect(tarde.error.codigo).toBe('CONFLICTO_ESTADO');
        expect(tarde.error.datos).toMatchObject({
          regla: 'PROPINA_VIGENTE',
          propinaTipo: 'porcentaje',
          propinaPuntosBase: 1000,
          propinaOrigen: 'portal_qr',
        });
        expect(tarde.error.mensaje).toBe('Los comensales ya eligieron 10 % de propina.');

        // Con la versión nueva pero sin «Cambiarla», tampoco la pisa.
        const vigente = await cuenta(ordenId);
        expect(tarde.error.datos?.['version']).toBe(vigente.version);
        const sinCambiar = await laCajaElige(ordenId, vigente.version, 1500);
        expect(sinCambiar.ok).toBe(false);
        expect([vigente.tipo, vigente.puntosBase, vigente.origen]).toEqual([
          'porcentaje',
          1000,
          'portal_qr',
        ]);

        // La mitad de las vueltas la Caja toca «Usar ésa» (no escribe); la otra, «Cambiarla».
        if (vuelta % 2 === 0) continue;
        exigirOk(await laCajaElige(ordenId, vigente.version, 1500, true), 'cambiarla');
        const cambiada = await cuenta(ordenId);
        expect([cambiada.tipo, cambiada.puntosBase, cambiada.origen]).toEqual([
          'porcentaje',
          1500,
          'caja',
        ]);
      }

      // «Cambiarla» queda en la auditoría como un cambio de la Caja, con lo que había antes.
      const cambios = await obtenerDb()
        .selectFrom('auditoria')
        .select('payload')
        .where('organizacion_id', '=', negocio.organizacionId)
        .where('accion', '=', 'cuenta.fijar_propina')
        .execute();
      const deLaCaja = cambios
        .map((f) => f.payload as { cambio?: boolean; antes?: { origen?: string } })
        .filter((p) => p.cambio === true);
      expect(deLaCaja).toHaveLength(VECES / 2);
      expect(deLaCaja.every((p) => p.antes?.origen === 'portal_qr')).toBe(true);
    },
  );

  it(
    'los dos al mismo tiempo: gana una, la otra se entera, y nunca hay un 500',
    { timeout: LARGO },
    async () => {
      let ganoLaCaja = 0;
      let ganoElPortal = 0;
      for (let vuelta = 0; vuelta < VECES; vuelta += 1) {
        const { token, ordenId } = await mesaConCuenta();
        const antes = await cuenta(ordenId);
        const [deLaCaja, delPortal] = await Promise.all([
          laCajaElige(ordenId, antes.version, 1500),
          elPortalElige(token, 10),
        ]);
        sinErrorInterno(deLaCaja);
        sinErrorInterno(delPortal);
        const final = await cuenta(ordenId);

        if (deLaCaja.ok) {
          // Ganó la Caja: el portal tuvo que enterarse, y la cuenta dice la de la Caja.
          ganoLaCaja += 1;
          expect(delPortal.ok && delPortal.datos.propinaYaRegistradaEn).toBe('caja');
          expect([final.puntosBase, final.origen]).toEqual([1500, 'caja']);
        } else {
          // Ganó el portal: la Caja recibió la vigente, y la cuenta dice la del portal.
          ganoElPortal += 1;
          expect(deLaCaja.error.codigo).toBe('CONFLICTO_ESTADO');
          expect(delPortal.ok && delPortal.datos.propinaYaRegistradaEn).toBeUndefined();
          expect([final.puntosBase, final.origen]).toEqual([1000, 'portal_qr']);
          expect(deLaCaja.error.datos?.['propinaPuntosBase']).toBe(1000);
        }
      }
      // Siempre gana exactamente una: ninguna vuelta se quedó sin propina ni con las dos.
      expect(ganoLaCaja + ganoElPortal).toBe(VECES);
    },
  );

  it(
    'cobrar con la propina cambiada: se rechaza con la vigente y la cuenta no se paga',
    { timeout: LARGO },
    async () => {
      for (let vuelta = 0; vuelta < VECES; vuelta += 1) {
        const { token, ordenId } = await mesaConCuenta();
        const loQueVeiaLaCaja = await cuenta(ordenId);
        exigirOk(await elPortalElige(token, 10), 'el portal elige');

        const cobro = await cobrar(ordenId, loQueVeiaLaCaja.version);
        sinErrorInterno(cobro);
        expect(cobro.ok).toBe(false);
        if (cobro.ok) continue;
        expect(cobro.error.codigo).toBe('CONFLICTO_ESTADO');
        expect(cobro.error.datos).toMatchObject({
          regla: 'PROPINA_VIGENTE',
          propinaPuntosBase: 1000,
          propinaOrigen: 'portal_qr',
        });
        const sinCobrar = await cuenta(ordenId);
        expect(sinCobrar.estado).not.toBe('pagada');

        // Con la cuenta ya releída, cobra.
        exigirOk(await cobrar(ordenId, sinCobrar.version), 'cobrar con la versión vigente');
        expect((await cuenta(ordenId)).estado).toBe('pagada');
      }
    },
  );
});

describe('quién puede elegir la propina (M12)', () => {
  const pedirComoMesero = (ordenId: string) =>
    comando(solicitarCuenta, {
      entrada: {
        ordenId,
        propinaTipo: 'porcentaje',
        propinaPuntosBase: 2000,
        aunConPendientes: true,
      },
      ambito,
      idempotencyKey: clave(),
    });

  it('sin la casilla del mesero, «Pedir cuenta» pide la cuenta y NO escribe propina', async () => {
    const { ordenId } = await mesaConCuenta();
    exigirOk(await pedirComoMesero(ordenId), 'restaurante.solicitar_cuenta');
    const pedida = await cuenta(ordenId);
    expect(pedida.estado).toBe('cuenta_solicitada');
    expect([pedida.tipo, pedida.puntosBase]).toEqual([null, 0]);
  });

  it('un «la eligen los comensales» del mesero sí se escribe: no es una propina, es el aviso', async () => {
    const { ordenId } = await mesaConCuenta();
    exigirOk(
      await comando(solicitarCuenta, {
        entrada: {
          ordenId,
          propinaTipo: 'pendiente_cliente',
          propinaPuntosBase: 0,
          aunConPendientes: true,
        },
        ambito,
        idempotencyKey: clave(),
      }),
      'restaurante.solicitar_cuenta',
    );
    const pedida = await cuenta(ordenId);
    expect(pedida.tipo).toBe('pendiente_cliente');
    // Y la Caja puede elegirla después sin «Cambiarla»: nadie la había decidido.
    exigirOk(await laCajaElige(ordenId, pedida.version, 1500), 'la caja elige');
  });

  it('con la casilla del mesero, la escribe; y la Caja ya no la pisa sin «Cambiarla»', async () => {
    exigirOk(
      await comando(fijarQuienEligeLaPropina, {
        entrada: { comensales: true, mesero: true, caja: true },
        ambito,
        idempotencyKey: clave(),
      }),
      'fijar quién elige',
    );
    const { ordenId } = await mesaConCuenta();
    const antes = await cuenta(ordenId);
    exigirOk(await pedirComoMesero(ordenId), 'restaurante.solicitar_cuenta');
    const pedida = await cuenta(ordenId);
    expect([pedida.tipo, pedida.puntosBase, pedida.origen]).toEqual(['porcentaje', 2000, 'mesero']);
    // La cuenta cambió de versión: la Caja que la tenía abierta lo nota.
    expect(pedida.version).toBeGreaterThan(antes.version);
    expect((await laCajaElige(ordenId, pedida.version, 1500)).ok).toBe(false);
  });

  it('si la Caja no elige en este negocio, su comando se niega', async () => {
    exigirOk(
      await comando(fijarQuienEligeLaPropina, {
        entrada: { comensales: true, mesero: false, caja: false },
        ambito,
        idempotencyKey: clave(),
      }),
      'fijar quién elige',
    );
    const { ordenId } = await mesaConCuenta();
    const antes = await cuenta(ordenId);
    const negada = await laCajaElige(ordenId, antes.version, 1500);
    expect(negada.ok).toBe(false);
    expect((await cuenta(ordenId)).tipo).toBeNull();
  });
});
