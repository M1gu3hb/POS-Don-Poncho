import { conTransaccion, obtenerDb } from '@morphiqpos/data';
import { sql } from 'kysely';
import { describe, expect, it } from 'vitest';

import { marcarPlataforma } from '../mantenimiento/plataforma.ts';
import { quitarMarcaDeEmpleo, quitarPlataforma } from '../mantenimiento/plataforma-cambios.ts';
import { marcaGuardada } from '../mantenimiento/pruebas/duenos.ts';
import { reponerConfiguracion } from '../negocio-de-prueba/resetear.ts';
import { comando } from '../produccion.ts';
import {
  ambitoDe,
  clave,
  exigirOk,
  sembrarNegocio,
  sembrarSucursal,
} from '../pruebas/negocio-real.ts';
import { escribirDatos } from '../puente/comandos.ts';
import { fijarApariencia } from './apariencia.ts';
import { guardarConfiguracion } from './configuracion.ts';
import {
  conOtraEscrituraEnMedio,
  documentoActual,
  mezclarEnElDocumento,
} from './pruebas/otra-escritura-en-medio.ts';

/**
 * DP-13.3b · DOS ESCRITURAS DE CONFIGURACIÓN QUE SE CRUZAN NO SE PISAN, contra Postgres real.
 *
 * `configuracion.valores` es UN documento que escriben seis módulos: Configuración (`guardar` y
 * el puente), la apariencia, la marca de plataforma, el teléfono de cocina y el reseteo de
 * pruebas. Los que leían el documento y lo escribían ENTERO sin tomar la fila borraban, sin
 * error, lo que otro hubiera confirmado entre la lectura y la escritura: la marca de plataforma
 * o «quién manda a cocina». Cada prueba cruza las dos escrituras a la fuerza
 * (`conOtraEscrituraEnMedio`) y lee el documento después.
 */

const APARIENCIA = {
  estilo: 'bloque',
  densidad: 'guantes',
  redondeo: 'nula',
  elevacion: 'linea-dura',
  movimiento: 'sutil',
} as const;

async function sembrar() {
  const negocio = await sembrarNegocio({
    nombre: 'Fonda de la carrera',
    rol: 'dueno',
    giro: 'restaurante',
    paquete: 'restaurante',
  });
  const sucursal = await sembrarSucursal(negocio, { terminales: [] });
  const org = negocio.organizacionId;
  await conTransaccion(async (tx) => {
    await sql`
      insert into configuracion (organizacion_id, valores)
      values (${org}, ${JSON.stringify({ nombre_sistema: 'POS de la fonda' })}::jsonb)
    `.execute(tx);
  });
  const ambito = ambitoDe(negocio, sucursal.sucursalId, null);
  return { org, ambito, empleo: ambito.empleoId };
}

const marca = (empleo: string) => ({ plataforma: { empleos: [empleo] } });

describe('lo que otro confirmó entre mi lectura y mi escritura no se pierde', () => {
  it('fijar la apariencia conserva la marca de plataforma', async () => {
    const { org, ambito, empleo } = await sembrar();
    exigirOk(
      await conOtraEscrituraEnMedio(
        org,
        () => comando(fijarApariencia, { ambito, entrada: APARIENCIA, idempotencyKey: clave() }),
        (tx) => mezclarEnElDocumento(tx, org, marca(empleo)),
      ),
      'configuracion.fijar_apariencia',
    );
    const { valores } = await documentoActual(org);
    expect(valores).toMatchObject({
      ...marca(empleo),
      apariencia: { estilo: 'bloque' },
      nombre_sistema: 'POS de la fonda',
    });
  });

  it('guardar la configuración conserva la marca aunque la versión no se movió', async () => {
    const { org, ambito, empleo } = await sembrar();
    const { version } = await documentoActual(org);
    const guardado = exigirOk(
      await conOtraEscrituraEnMedio(
        org,
        () =>
          comando(guardarConfiguracion, {
            ambito,
            entrada: {
              version,
              nombreNegocio: 'Fonda de la carrera',
              telefono: null,
              direccion: null,
              logoUrl: null,
              colorPrimario: '#112233',
              colorAcento: '#445566',
              impuestoPuntosBase: 800,
              impuestoIncluidoEnPrecio: true,
            },
            idempotencyKey: clave(),
          }),
        (tx) => mezclarEnElDocumento(tx, org, marca(empleo)),
      ),
      'configuracion.guardar',
    );
    expect(guardado.version).toBe(version + 1);
    const { valores } = await documentoActual(org);
    expect(valores).toMatchObject({ ...marca(empleo), impuesto: { puntosBase: 800 } });
  });

  it('el guardado genérico de Configuración conserva la marca y «quién manda a cocina»', async () => {
    const { org, ambito, empleo } = await sembrar();
    exigirOk(
      await conOtraEscrituraEnMedio(
        org,
        () =>
          comando(escribirDatos, {
            ambito,
            entrada: {
              entidad: 'ConfiguracionNegocio',
              operacion: 'update',
              datos: { nombre_sistema: 'POS nuevo' },
            },
            idempotencyKey: clave(),
          }),
        (tx) =>
          mezclarEnElDocumento(tx, org, {
            ...marca(empleo),
            portal_qr_envia_a_cocina: 'comensales',
          }),
      ),
      'puente.escribir (ConfiguracionNegocio)',
    );
    const { valores } = await documentoActual(org);
    expect(valores).toMatchObject({
      ...marca(empleo),
      portal_qr_envia_a_cocina: 'comensales',
      nombre_sistema: 'POS nuevo',
    });
  });

  it('marcar plataforma conserva «quién manda a cocina» y lo demás', async () => {
    const { org, ambito, empleo } = await sembrar();
    exigirOk(
      await conOtraEscrituraEnMedio(
        org,
        () => comando(marcarPlataforma, { ambito, entrada: {}, idempotencyKey: clave() }),
        (tx) => mezclarEnElDocumento(tx, org, { portal_qr_envia_a_cocina: 'comensales' }),
      ),
      'mantenimiento.marcar_plataforma',
    );
    const { valores } = await documentoActual(org);
    expect(valores).toMatchObject({
      ...marca(empleo),
      portal_qr_envia_a_cocina: 'comensales',
      nombre_sistema: 'POS de la fonda',
    });
  });

  it('el reseteo de pruebas sube la versión sobre la que dejó la otra escritura', async () => {
    const { org } = await sembrar();
    const { version } = await documentoActual(org);
    await conOtraEscrituraEnMedio(
      org,
      () => conTransaccion((tx) => reponerConfiguracion(tx, org)),
      (tx) => mezclarEnElDocumento(tx, org, { nombre_sistema: 'otro' }, true),
    );
    // Dos subidas: la de la otra escritura y la del reseteo. Sin el candado, el reseteo leía la
    // versión vieja y escribía `version + 1`, y una de las dos subidas se perdía.
    expect((await documentoActual(org)).version).toBe(version + 2);
  });
});

/**
 * La lista de plataforma se calcula leyendo la lista: marcar, quitar y desactivar un empleo
 * leen «quiénes son» y escriben «quiénes quedan». Si otro cambió la lista en medio y no hay
 * candado, la escritura de uno devuelve la lista vieja y borra al otro, sin error.
 */
describe('la lista de plataforma que otro cambió en medio no se pierde', () => {
  const OTRO = '6f4a3d21-9e0c-4f7b-8a55-2d1c0b9e8f77';

  async function marcado() {
    const caso = await sembrar();
    exigirOk(
      await comando(marcarPlataforma, {
        ambito: caso.ambito,
        entrada: {},
        idempotencyKey: clave(),
      }),
      'mantenimiento.marcar_plataforma',
    );
    return caso;
  }

  it('marcar conserva al otro que se marcó en medio', async () => {
    const { org, ambito, empleo } = await sembrar();
    exigirOk(
      await conOtraEscrituraEnMedio(
        org,
        () => comando(marcarPlataforma, { ambito, entrada: {}, idempotencyKey: clave() }),
        (tx) => mezclarEnElDocumento(tx, org, marca(OTRO)),
      ),
      'mantenimiento.marcar_plataforma',
    );
    expect((await marcaGuardada(org)).empleos.toSorted()).toEqual([empleo, OTRO].toSorted());
  });

  it('quitar conserva al otro que se marcó en medio', async () => {
    const { org, ambito, empleo } = await marcado();
    exigirOk(
      await conOtraEscrituraEnMedio(
        org,
        () =>
          comando(quitarPlataforma, {
            ambito,
            entrada: { empleado: empleo },
            idempotencyKey: clave(),
          }),
        (tx) => mezclarEnElDocumento(tx, org, { plataforma: { empleos: [empleo, OTRO] } }),
      ),
      'mantenimiento.quitar_plataforma',
    );
    expect((await marcaGuardada(org)).empleos).toEqual([OTRO]);
  });

  it('desactivar a un empleo conserva al otro que se marcó en medio', async () => {
    const { org, empleo } = await marcado();
    const quitada = await conOtraEscrituraEnMedio(
      org,
      () => conTransaccion((tx) => quitarMarcaDeEmpleo(tx, org, empleo, new Date())),
      (tx) => mezclarEnElDocumento(tx, org, { plataforma: { empleos: [empleo, OTRO] } }),
    );
    expect(quitada).toBe(true);
    expect((await marcaGuardada(org)).empleos).toEqual([OTRO]);
  });
});

describe('las mismas escrituras, lanzadas a la vez', () => {
  it('ninguna pierde a las otras en diez rondas', async () => {
    const { org, ambito, empleo } = await sembrar();
    for (let ronda = 0; ronda < 10; ronda += 1) {
      await sql`update configuracion set valores = valores - 'plataforma' where organizacion_id = ${org}`.execute(
        obtenerDb(),
      );
      const [apariencia, parcial, marcada] = await Promise.all([
        comando(fijarApariencia, { ambito, entrada: APARIENCIA, idempotencyKey: clave() }),
        comando(escribirDatos, {
          ambito,
          entrada: {
            entidad: 'ConfiguracionNegocio',
            operacion: 'update',
            datos: { nombre_sistema: `Ronda ${String(ronda)}` },
          },
          idempotencyKey: clave(),
        }),
        comando(marcarPlataforma, { ambito, entrada: {}, idempotencyKey: clave() }),
      ]);
      exigirOk(apariencia, 'configuracion.fijar_apariencia');
      exigirOk(parcial, 'puente.escribir');
      exigirOk(marcada, 'mantenimiento.marcar_plataforma');
      const { valores } = await documentoActual(org);
      expect(valores, `ronda ${String(ronda)}`).toMatchObject({
        ...marca(empleo),
        apariencia: { estilo: 'bloque' },
        nombre_sistema: `Ronda ${String(ronda)}`,
      });
    }
  });
});
