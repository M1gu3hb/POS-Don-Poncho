import { conTransaccion, obtenerDb } from '@morphiqpos/data';
import { sql } from 'kysely';
import { describe, expect, it } from 'vitest';

import { comando } from '../produccion.ts';
import { consultar } from '../puente/consultar.ts';
import { clave, exigirOk } from '../pruebas/negocio-real.ts';
import { candadoDelCarrito } from '../restaurante/carrito-del-salon.ts';
import { abrirMesa } from '../restaurante/mesas.ts';
import { resolverLosAvisosCaducados } from './avisos-caducados.ts';
import { HORAS_SIN_ACTIVIDAD } from './carrito.ts';
import { mesaConPortal, TELEFONO_A, TELEFONO_B } from './pruebas/mesa-con-portal.ts';

/**
 * DP-14 ronda 2 · medio 9 · EL CARRITO CADUCADO, en el mapa del mesero y en los teléfonos.
 *
 *   · El globo «Pedido listo para confirmar» del mapa del mesero se leía por el puente
 *     (`SolicitudQR`), que no miraba si el carrito ya había caducado: el globo se quedaba vivo
 *     hasta que algún teléfono sondeaba el carrito. Ahora la lectura del mapa lo resuelve.
 *   · «Tu pedido se borró…» es del teléfono que tenía líneas en ese carrito; la familia nueva que se
 *     sienta después (otro teléfono) nunca lo lee.
 */

async function conElCarritoViejo() {
  const caso = await mesaConPortal({ envian: 'mesero' });
  exigirOk(await caso.agregar(TELEFONO_A, caso.taco), 'agregar');
  exigirOk(await caso.llamar(TELEFONO_A), 'llamar al mesero');
  // El reloj de la base no se adelanta: se envejecen las líneas.
  await sql`
    update carrito_mesa_lineas
       set created_at = now() - make_interval(hours => ${HORAS_SIN_ACTIVIDAD}, mins => 5)
     where mesa_id = ${caso.mesaId}
  `.execute(obtenerDb());
  return caso;
}

/** Otra mesa del MISMO negocio con un carrito recién armado: lo de una mesa no decide la otra. */
async function otraMesaConUnCarritoFresco(caso: Awaited<ReturnType<typeof mesaConPortal>>) {
  await sql`
    with otra as (
      insert into mesas (organizacion_id, sucursal_id, numero, nombre)
      values (${caso.negocio.organizacionId}, ${caso.sucursalId}, 4, 'Mesa 4')
      returning id
    )
    insert into carrito_mesa_lineas
      (organizacion_id, mesa_id, dispositivo_huella, producto_id, cantidad, created_at)
    select l.organizacion_id, otra.id, l.dispositivo_huella, l.producto_id, l.cantidad, now()
      from carrito_mesa_lineas l, otra
     where l.mesa_id = ${caso.mesaId}
  `.execute(obtenerDb());
}

async function avisosVivos(mesaId: string) {
  return obtenerDb()
    .selectFrom('solicitudes_qr')
    .select('estado')
    .where('mesa_id', '=', mesaId)
    .where('tipo', '=', 'ordenar')
    .where('estado', 'in', ['pendiente', 'atendida'])
    .execute();
}

describe('el mapa del mesero con un carrito caducado (medio 9)', () => {
  it('la lectura del mapa resuelve el globo sin que ningún teléfono sondee', async () => {
    const caso = await conElCarritoViejo();
    await otraMesaConUnCarritoFresco(caso);
    expect(await avisosVivos(caso.mesaId)).toHaveLength(1);

    const filas = await consultar(
      { ...caso.ambito, rol: 'dueno' },
      { entidad: 'SolicitudQR', operacion: 'filter', filtro: { estado: 'pendiente' } },
    );
    expect(filas.filter((f) => f['tipo'] === 'ordenar')).toEqual([]);
    expect(await avisosVivos(caso.mesaId)).toHaveLength(0);
  });

  it('un carrito vigente conserva su globo en el mapa', async () => {
    const caso = await mesaConPortal({ envian: 'mesero' });
    exigirOk(await caso.agregar(TELEFONO_A, caso.taco), 'agregar');
    exigirOk(await caso.llamar(TELEFONO_A), 'llamar al mesero');
    const filas = await consultar(
      { ...caso.ambito, rol: 'dueno' },
      { entidad: 'SolicitudQR', operacion: 'filter', filtro: { estado: 'pendiente' } },
    );
    expect(filas.filter((f) => f['tipo'] === 'ordenar')).toHaveLength(1);
  });

  it('con la cuenta abierta se mide hasta su apertura: lo pedido después no caduca', async () => {
    const caso = await mesaConPortal({ envian: 'mesero' });
    exigirOk(
      await comando(abrirMesa, {
        ambito: caso.ambito,
        entrada: { mesaId: caso.mesaId, personas: 2 },
        idempotencyKey: clave(),
      }),
      'restaurante.abrir_mesa',
    );
    exigirOk(await caso.agregar(TELEFONO_A, caso.taco), 'agregar');
    exigirOk(await caso.llamar(TELEFONO_A), 'llamar al mesero');
    // Todo ocurrió hace cuatro horas, pero el carrito se armó DESPUÉS de abrir la cuenta.
    await sql`
      update ordenes set created_at = now() - interval '4 hours'
       where mesa_id = ${caso.mesaId} and estado <> 'pagada'
    `.execute(obtenerDb());
    await sql`
      update carrito_mesa_lineas set created_at = now() - interval '3 hours 59 minutes'
       where mesa_id = ${caso.mesaId}
    `.execute(obtenerDb());
    const filas = await consultar(
      { ...caso.ambito, rol: 'dueno' },
      { entidad: 'SolicitudQR', operacion: 'filter', filtro: { estado: 'pendiente' } },
    );
    expect(filas.filter((f) => f['tipo'] === 'ordenar')).toHaveLength(1);
    expect(await avisosVivos(caso.mesaId)).toHaveLength(1);
  });

  it('un carrito vigente no se toca: el mapa no espera el candado de quien está agregando', async () => {
    // Cada mesero sondea el mapa cada pocos segundos. Si por cada globo se abriera una transacción y
    // se esperara el candado del carrito, un comensal agregando (o diez mesas con globo) haría
    // esperar al mapa y llenaría el pool. Sólo se miran las mesas cuyo carrito PUDO caducar.
    const caso = await mesaConPortal({ envian: 'mesero' });
    exigirOk(await caso.agregar(TELEFONO_A, caso.taco), 'agregar');
    exigirOk(await caso.llamar(TELEFONO_A), 'llamar al mesero');
    // Vigente, pero por poco: a cinco minutos de caducar. El corte es el de la regla, no uno holgado.
    await sql`
      update carrito_mesa_lineas
         set created_at = now() - make_interval(hours => ${HORAS_SIN_ACTIVIDAD}) + interval '5 minutes'
       where mesa_id = ${caso.mesaId}
    `.execute(obtenerDb());
    let tomado: () => void = () => undefined;
    let soltar: () => void = () => undefined;
    const yaLoTiene = new Promise<void>((r) => {
      tomado = r;
    });
    const suelta = new Promise<void>((r) => {
      soltar = r;
    });
    const comensal = conTransaccion(async (tx) => {
      await candadoDelCarrito(tx, caso.ambito.organizacionId, caso.mesaId);
      tomado();
      await suelta;
    });
    await yaLoTiene;
    let reloj: ReturnType<typeof setTimeout> | undefined;
    const trabado = new Promise<'trabado'>((r) => {
      reloj = setTimeout(() => {
        r('trabado');
      }, 3_000);
    });
    const resultado = await Promise.race([
      resolverLosAvisosCaducados(caso.ambito.organizacionId).then((n) => ({ resueltas: n })),
      trabado,
    ]);
    clearTimeout(reloj);
    soltar();
    await comensal;
    expect(resultado).toEqual({ resueltas: 0 });
    expect(await avisosVivos(caso.mesaId)).toHaveLength(1);
  });

  it('otra entidad del puente no toca los avisos', async () => {
    const caso = await conElCarritoViejo();
    await consultar({ ...caso.ambito, rol: 'dueno' }, { entidad: 'Mesa', operacion: 'list' });
    expect(await avisosVivos(caso.mesaId)).toHaveLength(1);
  });
});

describe('«Tu pedido se borró…» es del teléfono que lo tenía (medio 9)', () => {
  it('lo lee el teléfono que estaba en el carrito, no la familia nueva', async () => {
    const caso = await conElCarritoViejo();
    const delQueEstaba = await caso.mirar(TELEFONO_A);
    expect(delQueEstaba).toMatchObject({ caducado: true, lineas: [] });
    const laFamiliaNueva = await caso.mirar(TELEFONO_B);
    expect(laFamiliaNueva).toMatchObject({ caducado: false, lineas: [] });
  });

  it('aunque lo lea primero la familia nueva, el teléfono que estaba lo sigue leyendo', async () => {
    const caso = await conElCarritoViejo();
    expect((await caso.mirar(TELEFONO_B))?.caducado).toBe(false);
    expect((await caso.mirar(TELEFONO_A))?.caducado).toBe(true);
  });
});
