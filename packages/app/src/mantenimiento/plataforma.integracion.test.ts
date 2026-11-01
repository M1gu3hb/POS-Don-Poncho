import { conTransaccion, obtenerDb } from '@morphiqpos/data';
import { describe, expect, it } from 'vitest';

import { comando } from '../produccion.ts';
import {
  ambitoDe,
  clave,
  exigirOk,
  sembrarCompanero,
  sembrarNegocio,
  sembrarSucursal,
} from '../pruebas/negocio-real.ts';
import { guardarConfiguracionParcial, leerConfiguracion } from '../puente/configuracion.ts';
import {
  purgarSeccionDelHistorico,
  purgarVentas,
  reiniciarPruebas,
  reiniciarTodo,
  vaciarMesas,
} from './comandos.ts';
import { leerEsDePlataforma, marcarPlataforma } from './plataforma.ts';

/**
 * DP-12.1 · LOS BOTONES QUE BORRAN EN MASA, SÓLO PARA EL USUARIO DE PLATAFORMA, contra Postgres.
 *
 * «Miguel · Morphiq» y el dueño del restaurante tienen el mismo rol. Lo que los distingue es la
 * marca de `configuracion.valores.plataforma`, que el dueño no puede escribir, y el servidor la
 * exige en los cinco comandos de mantenimiento: esconder el botón no es autorización (R11).
 */

const NOMBRE = 'Barbacoa de prueba';

async function negocioConDosDuenos() {
  const negocio = await sembrarNegocio({
    nombre: NOMBRE,
    rol: 'dueno',
    giro: 'restaurante',
    paquete: 'restaurante',
  });
  const { sucursalId } = await sembrarSucursal(negocio, { terminales: [] });
  const otroEmpleo = await sembrarCompanero(negocio, { nombre: 'Dueño del local', rol: 'dueno' });
  // `sembrarCompanero` no le da identidad (no entra): ésta sí la necesita para tener ámbito.
  const { persona_id } = await obtenerDb()
    .selectFrom('empleos')
    .select('persona_id')
    .where('id', '=', otroEmpleo)
    .executeTakeFirstOrThrow();
  const { id: identidadDelOtro } = await obtenerDb()
    .insertInto('identidades')
    .values({ persona_id })
    .returning('id')
    .executeTakeFirstOrThrow();
  const plataforma = ambitoDe(negocio, sucursalId, null);
  const dueno = { ...plataforma, empleoId: otroEmpleo, identidadId: identidadDelOtro };
  return { negocio, plataforma, dueno };
}

const confirmada = { confirmacionNombreNegocio: NOMBRE };

describe('los cinco comandos de mantenimiento exigen al usuario de plataforma', () => {
  it('sin la marca, ningún dueño los ejecuta: 403 SIN_PERMISO', async () => {
    const { plataforma, dueno } = await negocioConDosDuenos();
    for (const ambito of [plataforma, dueno]) {
      const intentos = [
        await comando(vaciarMesas, { ambito, entrada: {}, idempotencyKey: clave() }),
        await comando(purgarSeccionDelHistorico, {
          ambito,
          entrada: { ...confirmada, seccion: 'ventas' },
          idempotencyKey: clave(),
        }),
        await comando(purgarVentas, { ambito, entrada: confirmada, idempotencyKey: clave() }),
        await comando(reiniciarPruebas, { ambito, entrada: confirmada, idempotencyKey: clave() }),
        await comando(reiniciarTodo, { ambito, entrada: confirmada, idempotencyKey: clave() }),
      ];
      for (const r of intentos) {
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.error.codigo).toBe('SIN_PERMISO');
      }
    }
  });

  it('marcado, el de plataforma sí; el otro dueño sigue sin poder', async () => {
    const { negocio, plataforma, dueno } = await negocioConDosDuenos();
    const marca = exigirOk(
      await comando(marcarPlataforma, { ambito: plataforma, entrada: {}, idempotencyKey: clave() }),
      'marcar',
    );
    expect(marca).toEqual({ empleoId: negocio.empleoId, yaLoEra: false });
    // Otra vez, con otra clave: la misma lista, sin duplicar.
    const otraVez = exigirOk(
      await comando(marcarPlataforma, { ambito: plataforma, entrada: {}, idempotencyKey: clave() }),
      'marcar otra vez',
    );
    expect(otraVez.yaLoEra).toBe(true);

    expect(await leerEsDePlataforma(negocio.organizacionId, plataforma.empleoId)).toBe(true);
    expect(await leerEsDePlataforma(negocio.organizacionId, dueno.empleoId)).toBe(false);

    exigirOk(
      await comando(purgarVentas, {
        ambito: plataforma,
        entrada: confirmada,
        idempotencyKey: clave(),
      }),
      'purgar como plataforma',
    );
    exigirOk(
      await comando(vaciarMesas, { ambito: plataforma, entrada: {}, idempotencyKey: clave() }),
      'vaciar mesas como plataforma',
    );
    exigirOk(
      await comando(reiniciarTodo, {
        ambito: plataforma,
        entrada: confirmada,
        idempotencyKey: clave(),
      }),
      'reiniciar todo como plataforma',
    );
    const delDueno = await comando(purgarVentas, {
      ambito: dueno,
      entrada: confirmada,
      idempotencyKey: clave(),
    });
    expect(delDueno.ok).toBe(false);
    if (!delDueno.ok) expect(delDueno.error.codigo).toBe('SIN_PERMISO');
  });

  it('el dueño no se puede poner la marca por Configuración, y la lectura no la enseña', async () => {
    const { negocio, plataforma, dueno } = await negocioConDosDuenos();
    exigirOk(
      await comando(marcarPlataforma, { ambito: plataforma, entrada: {}, idempotencyKey: clave() }),
      'marcar',
    );
    await expect(
      conTransaccion((tx) =>
        guardarConfiguracionParcial(tx, negocio.organizacionId, {
          plataforma: { empleos: [dueno.empleoId] },
        }),
      ),
    ).rejects.toMatchObject({ codigo: 'PUENTE_CAMPO_INVALIDO' });
    const leida = await leerConfiguracion(negocio.organizacionId);
    expect(leida).not.toHaveProperty('plataforma');
    // Guardar otra cosa no borra la marca (el documento se mezcla).
    await conTransaccion((tx) =>
      guardarConfiguracionParcial(tx, negocio.organizacionId, { nombre_sistema: 'POS' }),
    );
    expect(await leerEsDePlataforma(negocio.organizacionId, plataforma.empleoId)).toBe(true);
    expect(await leerEsDePlataforma(negocio.organizacionId, dueno.empleoId)).toBe(false);
  });
});
