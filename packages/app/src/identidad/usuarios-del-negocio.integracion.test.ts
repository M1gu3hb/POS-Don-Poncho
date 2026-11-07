import type { Rol } from '@morphiqpos/contracts';
import { obtenerDb } from '@morphiqpos/data';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { listarUsuariosPOS } from '../puente/usuarios.ts';
import { comando } from '../produccion.ts';
import {
  ambitoDe,
  clave,
  exigirOk,
  sembrarNegocio,
  sembrarSucursal,
  type NegocioReal,
} from '../pruebas/negocio-real.ts';
import { topeDeDescuento } from '../venta/descuento-de-mostrador.ts';
import { entrarConPin } from './entrar.ts';
import { guardarEmpleado } from './empleados.ts';

/**
 * LOS USUARIOS DEL NEGOCIO · contra Postgres (DP-14, ronda 2).
 *
 * La pantalla de Usuarios cambiaba los puestos (el puente servía el de SU vocabulario) y el dueño
 * no podía editarse. Aquí se mira lo PERSISTIDO: el dueño cambia su nombre y su PIN y entra con el
 * nuevo; renombrar a la gerente la deja gerente, con su tope y sus sesiones; un gerente no edita
 * a un dueño. Las mesas al desactivar y al repartir: `mesas-de-un-mesero.integracion.test.ts`.
 */

const PIMIENTA = 'pimienta_de_integracion_de_los_usuarios_2026';
vi.mock('@morphiqpos/contracts', async (original) => ({
  ...(await original<typeof import('@morphiqpos/contracts')>()),
  validarEntorno: () => ({ PIN_PEPPER: PIMIENTA }),
}));

let dueno: NegocioReal;
let sucursalId: string;

beforeAll(async () => {
  dueno = await sembrarNegocio({
    nombre: 'Fonda de los usuarios',
    rol: 'dueno',
    giro: 'restaurante',
    paquete: 'restaurante',
  });
  sucursalId = (await sembrarSucursal(dueno, { terminales: ['Caja 1'] })).sucursalId;
});

const como = (negocio: NegocioReal, rol: Rol, empleoId = negocio.empleoId): NegocioReal => ({
  ...negocio,
  rol,
  empleoId,
});

function guardar(quien: NegocioReal, entrada: Record<string, unknown>) {
  return comando(guardarEmpleado, {
    entrada: {
      nombre: 'Nombre',
      telefono: null,
      color: null,
      estacionPreparacionId: null,
      veTodasLasEstaciones: false,
      activo: true,
      ...entrada,
    },
    ambito: ambitoDe(quien, sucursalId, null),
    idempotencyKey: clave(),
  });
}

async function fila(empleoId: string) {
  return obtenerDb()
    .selectFrom('empleos')
    .innerJoin('personas', 'personas.id', 'empleos.persona_id')
    .select(['empleos.rol', 'empleos.activo', 'empleos.color', 'personas.nombre'])
    .where('empleos.id', '=', empleoId)
    .executeTakeFirstOrThrow();
}

function entrar(empleoId: string, pin: string) {
  return entrarConPin({
    empleoId,
    pin,
    deviceToken: '',
    organizacionId: dueno.organizacionId,
    pimienta: PIMIENTA,
    secretoSesion: 'secreto-de-sesion-de-los-usuarios-2026',
  });
}

/** Da de alta a alguien con PIN por el mismo comando que usa la pantalla. */
async function altaCon(puesto: string, nombre: string, pin: string, color: string | null = null) {
  const salida = exigirOk(await guardar(dueno, { nombre, puesto, pin, color }), `alta ${puesto}`);
  return salida.empleoId;
}

describe('el dueño se edita a sí mismo', () => {
  it('cambia su nombre y su PIN, sigue siendo dueño y entra con el PIN nuevo', async () => {
    const yo = await altaCon('administrador', 'Administradora Edith', '1111');
    const comoYo = como(dueno, 'administrador', yo);
    expect(await entrar(yo, '1111')).toMatchObject({ ok: true });

    // El dueño (de la sesión) se edita: manda `dueno`, el puesto real que le sirvió el puente.
    const dueño = await fila(dueno.empleoId);
    expect(dueño.rol).toBe('dueno');
    exigirOk(
      await guardar(dueno, {
        empleado: dueno.empleoId,
        nombre: 'Doña Rosa',
        puesto: 'dueno',
        pin: '4821',
      }),
      'el dueño se edita',
    );
    expect(await fila(dueno.empleoId)).toMatchObject({ rol: 'dueno', nombre: 'Doña Rosa' });
    expect(await entrar(dueno.empleoId, '4821')).toMatchObject({ ok: true, rol: 'dueno' });

    // Y el administrador se edita a sí mismo sin que el "puesto" estorbe.
    exigirOk(
      await guardar(comoYo, {
        empleado: yo,
        nombre: 'Edith P.',
        puesto: 'administrador',
        pin: '2222',
      }),
      'el administrador se edita',
    );
    expect(await entrar(yo, '1111')).toMatchObject({ ok: false });
    expect(await entrar(yo, '2222')).toMatchObject({ ok: true, rol: 'administrador' });
  });

  it('nadie cambia su propio puesto, ni hacia arriba ni hacia abajo', async () => {
    const admin = await altaCon('administrador', 'Admin sin ambición', '3333');
    const comoAdmin = como(dueno, 'administrador', admin);

    const subirse = await guardar(comoAdmin, { empleado: admin, puesto: 'dueno' });
    expect(subirse.ok).toBe(false);
    const bajarse = await guardar(dueno, { empleado: dueno.empleoId, puesto: 'gerente' });
    expect(bajarse.ok).toBe(false);
    expect((await fila(admin)).rol).toBe('administrador');
    expect((await fila(dueno.empleoId)).rol).toBe('dueno');
  });
});

describe('renombrar a la gerente', () => {
  it('la deja gerente, con su tope de 30 %, con su color y sin cerrarle las sesiones', async () => {
    const gerente = await altaCon('gerente', 'Gerente', '5555', '#7c3aed');
    const dentro = await entrar(gerente, '5555');
    expect(dentro).toMatchObject({ ok: true });

    exigirOk(
      await guardar(dueno, {
        empleado: gerente,
        nombre: 'Lupita la gerente',
        puesto: 'gerente',
        color: '#7c3aed',
      }),
      'renombrar',
    );

    expect(await fila(gerente)).toMatchObject({
      rol: 'gerente',
      nombre: 'Lupita la gerente',
      color: '#7c3aed',
    });
    const sesiones = await obtenerDb()
      .selectFrom('sesiones')
      .select('revocada_en')
      .where('empleo_id', '=', gerente)
      .execute();
    expect(sesiones.length).toBeGreaterThan(0);
    expect(sesiones.every((s) => s.revocada_en === null)).toBe(true);

    const tope = exigirOk(
      await comando(topeDeDescuento, {
        entrada: {},
        ambito: ambitoDe(como(dueno, 'gerente', gerente), sucursalId, null),
        idempotencyKey: clave(),
      }),
      'tope',
    );
    expect(tope.topeBp).toBe(3_000);
  });

  it('el puente sirve el puesto real y el color que la persona tiene (no el calculado)', async () => {
    const gerente = await altaCon('gerente', 'Gerente de color', '6666', '#0891b2');
    const sinColor = await altaCon('mesero', 'Mesero sin color', '7777');
    const lista = await listarUsuariosPOS(dueno.organizacionId);
    const de = (id: string) => lista.find((u) => u['id'] === id);

    expect(de(dueno.empleoId)).toMatchObject({ rol: 'dueno', etiqueta: 'Dueño' });
    expect(de(gerente)).toMatchObject({
      rol: 'gerente',
      color: '#0891b2',
      color_guardado: '#0891b2',
    });
    // Sin color propio: se PINTA uno estable, pero el que "tiene" es nulo (no se guarda al renombrar).
    expect(de(sinColor)?.['color_guardado']).toBeNull();
    expect(String(de(sinColor)?.['color'])).toMatch(/^#[0-9a-f]{6}$/i);
  });
});

describe('quién edita a quién', () => {
  it('un gerente no edita a un dueño, y el dueño queda como estaba', async () => {
    const gerente = await altaCon('gerente', 'Gerente curioso', '8888');
    const antes = await fila(dueno.empleoId);

    const salida = await guardar(como(dueno, 'gerente', gerente), {
      empleado: dueno.empleoId,
      nombre: 'Me adueñé',
      puesto: 'dueno',
    });

    expect(salida.ok).toBe(false);
    expect(await fila(dueno.empleoId)).toEqual(antes);
  });

  it('el administrador no edita ni desactiva a un dueño', async () => {
    const admin = await altaCon('administrador', 'Admin ajeno', '9999');
    const salida = await guardar(como(dueno, 'administrador', admin), {
      empleado: dueno.empleoId,
      puesto: 'dueno',
      activo: false,
    });
    expect(salida.ok).toBe(false);
    expect((await fila(dueno.empleoId)).activo).toBe(true);
  });
});
