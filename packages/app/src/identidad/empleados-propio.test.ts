import { esErrorDominio, type Ambito, type Rol } from '@morphiqpos/contracts';
import { beforeAll, describe, expect, it } from 'vitest';

import { contextoFalso, crearBaseFalsa, type Fila } from '../restaurante/pruebas/base-falsa.ts';
import { guardarEmpleado } from './empleados.ts';

/**
 * `identidad.guardar_empleado` · editarse a uno mismo y no tocar el puesto que no cambió (DP-14, ronda 2).
 *
 * La pantalla de Usuarios mandaba `administrador` para el dueño, el administrador y el gerente
 * (el puente servía el puesto de SU vocabulario). El servidor, honesto, rechazaba al dueño que se
 * editaba (su "nuevo" puesto era otro) y a los demás les cambiaba el puesto. Aquí se vigila lo que
 * el servidor debe hacer con el puesto REAL: no tocarlo si no cambió, dejar que uno cambie su
 * nombre y su PIN, nunca su puesto, y no editar a quien no puede otorgar.
 */

const ORG = '11111111-1111-4111-8111-111111111111';
const SUCURSAL = '22222222-2222-4222-8222-222222222222';
const YO = '55555555-5555-4555-8555-555555555555';
const OTRO = '66666666-6666-4666-8666-666666666666';
const PERSONA_YO = '77777777-7777-4777-8777-777777777777';
const PERSONA_OTRO = '88888888-8888-4888-8888-888888888888';
const AHORA = new Date('2026-03-01T10:00:00.000Z');

function ambitoDe(rol: Rol, empleoId = YO): Ambito {
  return {
    organizacionId: ORG,
    sucursalId: SUCURSAL,
    terminalId: null,
    identidadId: '44444444-4444-4444-8444-444444444444',
    empleoId,
    rol,
  };
}

function empleo(id: string, personaId: string, rol: string, cambios: Fila = {}): Fila {
  return {
    id,
    persona_id: personaId,
    organizacion_id: ORG,
    sucursal_id: SUCURSAL,
    rol,
    activo: true,
    color: '#16a34a',
    estacion_preparacion_id: null,
    ve_todas_las_estaciones: false,
    ...cambios,
  };
}

function persona(id: string, nombre: string): Fila {
  return { id, organizacion_id: ORG, nombre, telefono: null };
}

function sesionDe(empleoId: string): Fila {
  return {
    sid: `0123456789abcdef0123456789ab${empleoId.slice(0, 4)}`,
    organizacion_id: ORG,
    empleo_id: empleoId,
    creada_en: new Date('2026-03-01T08:00:00.000Z'),
    expira_en: new Date('2026-03-01T16:00:00.000Z'),
    revocada_en: null,
  };
}

function baseDe(datos: Record<string, readonly Fila[]>) {
  return crearBaseFalsa({
    empleos: [],
    personas: [],
    identidades: [],
    credenciales_pin: [],
    sesiones: [],
    mesas: [],
    ...datos,
  });
}

async function falla(promesa: Promise<unknown>): Promise<string> {
  try {
    await promesa;
    return 'NO_LANZO';
  } catch (error) {
    return esErrorDominio(error) ? error.codigo : `INESPERADO:${String(error)}`;
  }
}

function edicion(empleado: string, puesto: string, cambios: Record<string, unknown> = {}) {
  return {
    empleado,
    nombre: 'Nombre nuevo',
    puesto,
    telefono: null,
    color: '#16a34a',
    estacionPreparacionId: null,
    veTodasLasEstaciones: false,
    activo: true,
    ...cambios,
  };
}

beforeAll(() => {
  process.env['PIN_PEPPER'] = 'pimienta-de-pruebas-que-no-es-la-de-produccion';
  process.env['DATABASE_URL'] ??= 'postgres://pruebas@localhost:5432/pruebas';
  process.env['STORAGE_ENDPOINT'] ??= 'http://localhost:9000';
  process.env['STORAGE_BUCKET'] ??= 'pruebas';
  process.env['STORAGE_ACCESS_KEY'] ??= 'pruebas';
  process.env['STORAGE_SECRET_KEY'] ??= 'pruebas';
  process.env['SESSION_SECRET'] ??= 'ZmFsc28tcGFyYS1wcnVlYmFzLW5vLWVzLWVsLWRlLXByb2R1Y2Npb24';
  process.env['APP_URL'] ??= 'http://localhost:3000';
});

describe('guardar_empleado · uno mismo cambia su nombre y su PIN, nunca su puesto', () => {
  it.each(['dueno', 'administrador'] as const)(
    'el %s se edita a sí mismo: nombre y PIN nuevos, mismo puesto y sus sesiones siguen',
    async (rol) => {
      const base = baseDe({
        empleos: [empleo(YO, PERSONA_YO, rol)],
        personas: [persona(PERSONA_YO, 'Nombre viejo')],
        sesiones: [sesionDe(YO)],
      });
      const { ctx } = contextoFalso(base.tx, ambitoDe(rol), AHORA);

      const salida = await guardarEmpleado.ejecutar(ctx, edicion(YO, rol, { pin: '4821' }));

      expect(salida.rol).toBe(rol);
      expect(salida.pinEstablecido).toBe(true);
      expect(base.campo('empleos', 'rol')).toBe(rol);
      expect(base.campo('personas', 'nombre')).toBe('Nombre nuevo');
      expect(String(base.campo('credenciales_pin', 'pin_hash'))).toMatch(/^\$argon2id\$/);
      expect(base.campo('sesiones', 'revocada_en')).toBeNull();
    },
  );

  it('uno mismo no cambia su puesto ni siquiera hacia arriba', async () => {
    const base = baseDe({
      empleos: [empleo(YO, PERSONA_YO, 'administrador')],
      personas: [persona(PERSONA_YO, 'Nombre viejo')],
    });
    const { ctx } = contextoFalso(base.tx, ambitoDe('administrador'), AHORA);

    expect(await falla(guardarEmpleado.ejecutar(ctx, edicion(YO, 'gerente')))).toBe(
      'PUESTO_NO_OTORGABLE',
    );
    expect(await falla(guardarEmpleado.ejecutar(ctx, edicion(YO, 'dueno')))).toBe(
      'PUESTO_NO_OTORGABLE',
    );
    expect(base.campo('empleos', 'rol')).toBe('administrador');
  });
});

describe('guardar_empleado · el puesto que no cambió no se toca', () => {
  it('renombrar a la gerente la deja gerente, con su color, y no le cierra las sesiones', async () => {
    const base = baseDe({
      empleos: [empleo(OTRO, PERSONA_OTRO, 'gerente')],
      personas: [persona(PERSONA_OTRO, 'Gerente')],
      sesiones: [sesionDe(OTRO)],
    });
    const { ctx } = contextoFalso(base.tx, ambitoDe('dueno'), AHORA);

    const salida = await guardarEmpleado.ejecutar(
      ctx,
      edicion(OTRO, 'gerente', { nombre: 'Lupita la gerente' }),
    );

    expect(salida.rol).toBe('gerente');
    expect(base.campo('empleos', 'rol')).toBe('gerente');
    expect(base.campo('empleos', 'color')).toBe('#16a34a');
    expect(base.campo('personas', 'nombre')).toBe('Lupita la gerente');
    expect(base.campo('sesiones', 'revocada_en')).toBeNull();
  });

  it('el administrador renombra a una gerente sin que el puesto "administrador" estorbe', async () => {
    const base = baseDe({
      empleos: [empleo(OTRO, PERSONA_OTRO, 'gerente')],
      personas: [persona(PERSONA_OTRO, 'Gerente')],
    });
    const { ctx } = contextoFalso(base.tx, ambitoDe('administrador'), AHORA);

    await guardarEmpleado.ejecutar(ctx, edicion(OTRO, 'gerente'));

    expect(base.campo('empleos', 'rol')).toBe('gerente');
  });

  it('un administrador no edita a un dueño aunque no le cambie el puesto', async () => {
    const base = baseDe({
      empleos: [empleo(OTRO, PERSONA_OTRO, 'dueno')],
      personas: [persona(PERSONA_OTRO, 'La dueña')],
    });
    const { ctx } = contextoFalso(base.tx, ambitoDe('administrador'), AHORA);

    expect(await falla(guardarEmpleado.ejecutar(ctx, edicion(OTRO, 'dueno')))).toBe(
      'PUESTO_NO_OTORGABLE',
    );
    expect(base.campo('personas', 'nombre')).toBe('La dueña');
  });

  it('un administrador no sube a nadie a administrador ni a dueño, pero sí a gerente', async () => {
    const base = baseDe({
      empleos: [empleo(OTRO, PERSONA_OTRO, 'mesero')],
      personas: [persona(PERSONA_OTRO, 'Mesero')],
    });
    const { ctx } = contextoFalso(base.tx, ambitoDe('administrador'), AHORA);

    expect(await falla(guardarEmpleado.ejecutar(ctx, edicion(OTRO, 'administrador')))).toBe(
      'PUESTO_NO_OTORGABLE',
    );
    expect(await falla(guardarEmpleado.ejecutar(ctx, edicion(OTRO, 'dueno')))).toBe(
      'PUESTO_NO_OTORGABLE',
    );
    expect(base.campo('empleos', 'rol')).toBe('mesero');

    await guardarEmpleado.ejecutar(ctx, edicion(OTRO, 'gerente'));
    expect(base.campo('empleos', 'rol')).toBe('gerente');
  });

  it('un gerente no edita a un dueño: ni el cuerpo del comando lo deja pasar', async () => {
    // El envoltorio ya lo niega por rol (SIN_PERMISO); esto vigila la segunda puerta: aun si el
    // comando se abriera al gerente, `PUEDE_OTORGAR` no le da nada que otorgar.
    const base = baseDe({
      empleos: [empleo(OTRO, PERSONA_OTRO, 'dueno')],
      personas: [persona(PERSONA_OTRO, 'La dueña')],
    });
    const { ctx } = contextoFalso(base.tx, ambitoDe('gerente'), AHORA);

    expect(await falla(guardarEmpleado.ejecutar(ctx, edicion(OTRO, 'dueno')))).toBe(
      'PUESTO_NO_OTORGABLE',
    );
    expect(guardarEmpleado.roles).not.toContain('gerente');
    expect(base.campo('personas', 'nombre')).toBe('La dueña');
  });
});

describe('guardar_empleado · al desactivar a un mesero sus mesas quedan sin asignar', () => {
  const mesa = (id: string, asignada: string | null): Fila => ({
    id,
    organizacion_id: ORG,
    sucursal_id: SUCURSAL,
    empleado_asignado_id: asignada,
  });
  const OTRO_MESERO = '99999999-9999-4999-8999-999999999999';

  it('libera sólo las suyas, en la misma transacción, y lo deja en la auditoría', async () => {
    const base = baseDe({
      empleos: [empleo(OTRO, PERSONA_OTRO, 'mesero')],
      personas: [persona(PERSONA_OTRO, 'Mesero')],
      mesas: [mesa('m1', OTRO), mesa('m2', OTRO_MESERO), mesa('m3', null), mesa('m4', OTRO)],
    });
    const { ctx, auditorias } = contextoFalso(base.tx, ambitoDe('dueno'), AHORA);

    await guardarEmpleado.ejecutar(ctx, edicion(OTRO, 'mesero', { activo: false }));

    expect(base.campo('empleos', 'activo')).toBe(false);
    expect(base.filas('mesas').map((m) => m['empleado_asignado_id'])).toEqual([
      null,
      OTRO_MESERO,
      null,
      null,
    ]);
    expect(auditorias[0]?.payload).toMatchObject({ mesasLiberadas: 2 });
    // Con el antes: sin él, la auditoría no dice qué puesto tenía ni que lo dieron de baja.
    expect(auditorias[0]?.payload).toMatchObject({
      rol: 'mesero',
      activo: false,
      rolAntes: 'mesero',
      activoAntes: true,
    });
  });

  it('dejar de ser mesero también libera sus mesas; seguir siéndolo no las toca', async () => {
    const base = baseDe({
      empleos: [empleo(OTRO, PERSONA_OTRO, 'mesero')],
      personas: [persona(PERSONA_OTRO, 'Mesero')],
      mesas: [mesa('m1', OTRO)],
    });
    const { ctx, auditorias } = contextoFalso(base.tx, ambitoDe('dueno'), AHORA);

    await guardarEmpleado.ejecutar(ctx, edicion(OTRO, 'mesero'));
    expect(base.campo('mesas', 'empleado_asignado_id')).toBe(OTRO);

    await guardarEmpleado.ejecutar(ctx, edicion(OTRO, 'cajero'));
    expect(base.campo('mesas', 'empleado_asignado_id')).toBeNull();
    // La auditoría del cambio de puesto dice de cuál a cuál.
    expect(auditorias[1]?.payload).toMatchObject({ rol: 'cajero', rolAntes: 'mesero' });
  });
});
