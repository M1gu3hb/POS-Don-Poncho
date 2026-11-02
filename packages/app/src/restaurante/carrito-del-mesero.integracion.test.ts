import type { Ambito, Rol } from '@morphiqpos/contracts';
import { obtenerDb } from '@morphiqpos/data';
import { describe, expect, it } from 'vitest';

import {
  comandasDe,
  lineasDeLaCuenta,
  mesaConPortal,
  TELEFONO_A,
  TELEFONO_B,
} from '../portal/pruebas/mesa-con-portal.ts';
import { comando } from '../produccion.ts';
import { clave, exigirOk, sembrarCompanero, sembrarSucursal } from '../pruebas/negocio-real.ts';
import {
  cambiarEnElCarrito,
  enviarElCarritoDeLaMesa,
  quitarDelCarritoDeLaMesa,
  vaciarElCarrito,
} from './carrito-del-mesero.ts';
import { leerElCarritoParaElMesero } from './carrito-del-mesero-lectura.ts';
import { cambiarMesaComando } from './cambio-de-mesa.ts';
import { abrirMesa } from './mesas.ts';
import { LADO, mesa, salonEnFila, unir } from './pruebas/union-en-el-plano.ts';

/**
 * DP-12.2 · EL PORTAL EN MODO MESERO, contra Postgres real: el mesero ve el carrito de todos los
 * teléfonos, cambia, quita, borra y lo manda a cocina a su nombre, dentro de su sesión y su
 * sucursal. Un rol sin permiso no puede.
 */

async function ambitoDeRol(
  caso: Awaited<ReturnType<typeof mesaConPortal>>,
  rol: Rol,
  sucursalId: string = caso.sucursalId,
): Promise<Ambito> {
  const empleoId = await sembrarCompanero(caso.negocio, { nombre: `Persona ${rol}`, rol });
  const { persona_id } = await obtenerDb()
    .selectFrom('empleos')
    .select('persona_id')
    .where('id', '=', empleoId)
    .executeTakeFirstOrThrow();
  const { id: identidadId } = await obtenerDb()
    .insertInto('identidades')
    .values({ persona_id })
    .returning('id')
    .executeTakeFirstOrThrow();
  return {
    organizacionId: caso.negocio.organizacionId,
    sucursalId,
    terminalId: null,
    identidadId,
    empleoId,
    rol,
  };
}

describe('el carrito del portal en modo mesero (DP-12.2)', () => {
  it('lo lee por el QR escaneado y por la mesa, con los teléfonos numerados', async () => {
    const caso = await mesaConPortal({ envian: 'mesero' });
    exigirOk(await caso.agregar(TELEFONO_A, caso.taco, '2'), 'agregar A');
    exigirOk(await caso.agregar(TELEFONO_B, caso.agua), 'agregar B');
    const mesero = await ambitoDeRol(caso, 'mesero');
    const porQr = await leerElCarritoParaElMesero(mesero, { qr: caso.qrToken });
    const porMesa = await leerElCarritoParaElMesero(mesero, { mesaId: caso.mesaId });
    expect(porQr.mesa).toMatchObject({ id: caso.mesaId, numero: 3, ordenId: null });
    expect(porMesa.carrito.lineas).toEqual(porQr.carrito.lineas);
    expect(porQr.carrito.lineas.map((l) => [l.nombre, l.cantidad, l.telefono, l.esMia])).toEqual([
      ['Taco de barbacoa', '2', 1, false],
      ['Agua de jamaica', '1', 2, false],
    ]);
  });

  it('una mesa de otra sucursal no existe para el mesero; para el dueño sí', async () => {
    const caso = await mesaConPortal({ envian: 'mesero' });
    const otra = await sembrarSucursal(caso.negocio, { terminales: [] });
    const meseroDeOtra = await ambitoDeRol(caso, 'mesero', otra.sucursalId);
    await expect(
      leerElCarritoParaElMesero(meseroDeOtra, { mesaId: caso.mesaId }),
    ).rejects.toMatchObject({ codigo: 'PUENTE_NO_ENCONTRADO' });
    const dueno = await ambitoDeRol(caso, 'dueno', otra.sucursalId);
    await expect(leerElCarritoParaElMesero(dueno, { mesaId: caso.mesaId })).resolves.toBeTruthy();
  });

  it('cambia cantidades y quita cualquier línea; la cocina no puede', async () => {
    const caso = await mesaConPortal({ envian: 'mesero' });
    const estado = exigirOk(await caso.agregar(TELEFONO_A, caso.taco), 'agregar');
    const linea = estado.lineas[0]?.id ?? '';
    const mesero = await ambitoDeRol(caso, 'mesero');
    const cambiado = exigirOk(
      await comando(cambiarEnElCarrito, {
        ambito: mesero,
        entrada: { mesaId: caso.mesaId, lineaId: linea, cantidad: '3' },
        idempotencyKey: clave(),
      }),
      'cambiar',
    );
    expect(cambiado.lineas.map((l) => l.cantidad)).toEqual(['3']);

    const cocina = await ambitoDeRol(caso, 'cocina');
    const negado = await comando(quitarDelCarritoDeLaMesa, {
      ambito: cocina,
      entrada: { mesaId: caso.mesaId, lineaId: linea },
      idempotencyKey: clave(),
    });
    expect(negado.ok ? null : negado.error.codigo).toBe('SIN_PERMISO');

    exigirOk(
      await comando(quitarDelCarritoDeLaMesa, {
        ambito: mesero,
        entrada: { mesaId: caso.mesaId, lineaId: linea },
        idempotencyKey: clave(),
      }),
      'quitar',
    );
    expect((await caso.mirar(TELEFONO_A))?.lineas).toEqual([]);
  });

  it('borra el pedido de unos comensales que se fueron y resuelve su aviso', async () => {
    const caso = await mesaConPortal({ envian: 'mesero' });
    exigirOk(await caso.agregar(TELEFONO_A, caso.taco), 'agregar');
    exigirOk(await caso.llamar(TELEFONO_A), 'llamar');
    const mesero = await ambitoDeRol(caso, 'mesero');
    const vacio = exigirOk(
      await comando(vaciarElCarrito, {
        ambito: mesero,
        entrada: { mesaId: caso.mesaId },
        idempotencyKey: clave(),
      }),
      'vaciar',
    );
    expect(vacio.lineas).toEqual([]);
    const aviso = await obtenerDb()
      .selectFrom('solicitudes_qr')
      .select(['estado', 'empleado_atiende_id'])
      .where('mesa_id', '=', caso.mesaId)
      .executeTakeFirstOrThrow();
    expect(aviso).toEqual({ estado: 'resuelta', empleado_atiende_id: mesero.empleoId });
  });

  it('abre la mesa y confirma: sale a cocina a su nombre, por estación y con el precio del catálogo', async () => {
    const caso = await mesaConPortal({ envian: 'mesero' });
    exigirOk(await caso.agregar(TELEFONO_A, caso.taco, '2'), 'agregar A');
    exigirOk(await caso.agregar(TELEFONO_B, caso.agua), 'agregar B');
    exigirOk(await caso.llamar(TELEFONO_B), 'llamar');
    const mesero = await ambitoDeRol(caso, 'mesero');
    // El camino del mesero exige estación (regla 10): la general del negocio, como en producción.
    await obtenerDb()
      .insertInto('estaciones_preparacion')
      .values({ organizacion_id: caso.negocio.organizacionId, nombre: 'Cocina', es_general: true })
      .execute();
    const sinCuenta = await comando(enviarElCarritoDeLaMesa, {
      ambito: mesero,
      entrada: { mesaId: caso.mesaId },
      idempotencyKey: clave(),
    });
    expect(sinCuenta.ok ? null : sinCuenta.error.datos?.['regla']).toBe('CARRITO_SIN_CUENTA');

    exigirOk(
      await comando(abrirMesa, {
        ambito: mesero,
        entrada: { mesaId: caso.mesaId, personas: 2 },
        idempotencyKey: clave(),
      }),
      'abrir_mesa',
    );
    const enviado = exigirOk(
      await comando(enviarElCarritoDeLaMesa, {
        ambito: mesero,
        entrada: { mesaId: caso.mesaId, notaGeneral: 'Todo junto' },
        idempotencyKey: clave(),
      }),
      'enviar',
    );
    expect(enviado).toMatchObject({ enviado: true, ronda: 1 });
    expect(await lineasDeLaCuenta(caso.mesaId)).toEqual([
      expect.objectContaining({
        producto_nombre: 'Taco de barbacoa',
        precio_unitario_centavos: 3_500n,
      }),
      expect.objectContaining({
        producto_nombre: 'Agua de jamaica',
        precio_unitario_centavos: 2_800n,
      }),
    ]);
    expect(await comandasDe(caso.mesaId)).toBeGreaterThanOrEqual(1);
    const visto = await caso.mirar(TELEFONO_A);
    expect(visto).toMatchObject({ lineas: [], ronda: 1, ultimoEnvio: { porEsteTelefono: false } });
    expect(visto?.meseroAvisado).toBe(false);
    const auditoria = await obtenerDb()
      .selectFrom('auditoria')
      .select(['identidad_id'])
      .where('accion', '=', 'restaurante.carrito_enviar')
      .where('organizacion_id', '=', caso.negocio.organizacionId)
      .execute();
    expect(auditoria).toEqual([{ identidad_id: mesero.identidadId }]);
  });
});

describe('el carrito sigue a la cuenta (DP-12.2)', () => {
  it('al cambiar de mesa, las líneas y los teléfonos pasan a la nueva', async () => {
    const caso = await mesaConPortal({ envian: 'mesero' });
    const mesero = await ambitoDeRol(caso, 'mesero');
    // Con el mesero confirmando, la mesa la abre él (el comensal no puede: DP-12.2).
    const { ordenId: ventaId } = exigirOk(
      await comando(abrirMesa, {
        ambito: mesero,
        entrada: { mesaId: caso.mesaId, personas: 1 },
        idempotencyKey: clave(),
      }),
      'abrir_mesa',
    );
    exigirOk(await caso.agregar(TELEFONO_A, caso.taco), 'agregar');
    const destino = await obtenerDb()
      .insertInto('mesas')
      .values({
        organizacion_id: caso.negocio.organizacionId,
        sucursal_id: caso.sucursalId,
        numero: 7,
        nombre: 'Mesa 7',
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    exigirOk(
      await comando(cambiarMesaComando, {
        ambito: mesero,
        entrada: { ordenId: ventaId, mesaDestinoId: destino.id },
        idempotencyKey: clave(),
      }),
      'cambiar_mesa',
    );
    const enLaNueva = await leerElCarritoParaElMesero(mesero, { mesaId: destino.id });
    expect(enLaNueva.carrito.lineas.map((l) => l.nombre)).toEqual(['Taco de barbacoa']);
    const telefonos = await obtenerDb()
      .selectFrom('dispositivos_mesa')
      .select('mesa_id')
      .where('organizacion_id', '=', caso.negocio.organizacionId)
      .execute();
    expect(telefonos.map((t) => t.mesa_id)).toEqual([destino.id]);
  });
});

describe('al unir mesas, el carrito de la absorbida pasa a la principal (DP-12.2)', () => {
  it('líneas y teléfonos de la 2 quedan en la 1', async () => {
    const salon = await salonEnFila('Salón del carrito unido', 2);
    const [uno, dos] = [mesa(salon, 0), mesa(salon, 1)];
    const huella = 'a'.repeat(64);
    const platillo = Object.values(salon.platillos)[0] ?? '';
    await obtenerDb()
      .insertInto('carrito_mesa_lineas')
      .values({
        organizacion_id: salon.negocio.organizacionId,
        mesa_id: dos,
        dispositivo_huella: huella,
        producto_id: platillo,
        cantidad: '1',
      })
      .execute();
    await obtenerDb()
      .insertInto('dispositivos_mesa')
      .values({
        organizacion_id: salon.negocio.organizacionId,
        mesa_id: dos,
        dispositivo_huella: huella,
      })
      .execute();
    exigirOk(await unir(salon, 0, [1], [{ i: 1, x: 100 + LADO, y: 100 }]), 'unir');
    const lineas = await obtenerDb()
      .selectFrom('carrito_mesa_lineas')
      .select('mesa_id')
      .where('organizacion_id', '=', salon.negocio.organizacionId)
      .execute();
    expect(lineas).toEqual([{ mesa_id: uno }]);
    const telefonos = await obtenerDb()
      .selectFrom('dispositivos_mesa')
      .select('mesa_id')
      .where('organizacion_id', '=', salon.negocio.organizacionId)
      .execute();
    expect(telefonos).toEqual([{ mesa_id: uno }]);
  });
});
